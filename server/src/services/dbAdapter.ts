/**
 * SQLite Database Adapter
 * 
 * Clean abstraction layer for SQLite database operations using better-sqlite3.
 * Manages multiple database connections and provides a consistent API.
 * 
 * NO direct access to better-sqlite3 should occur outside this module.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  changes: number;
  lastInsertRowid: number;
  command: string;
}

export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): QueryResult;
  transaction<T>(callback: () => T): T;
  close(): void;
  pragma(name: string, value?: string | number): unknown;
}

// ========================================
// ACTIVE DATABASE CONNECTIONS
// ========================================

const activeConnections = new Map<string, Database.Database>();

// Prepared statement cache for performance optimization
const preparedStatementCache = new Map<string, Map<string, Database.Statement>>();

// Cache size limits
const MAX_PREPARED_STATEMENTS_PER_DB = 100;

// ========================================
// PUBLIC API
// ========================================

/**
 * Initialize or retrieve a SQLite database connection
 * 
 * @param dbPath - Absolute path to the database file
 * @param options - Optional database options
 * @returns DatabaseAdapter instance
 */
export function initialize(
  dbPath: string,
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: boolean;
  }
): DatabaseAdapter {
  // Normalize path
  const normalizedPath = path.resolve(dbPath);

  // Return existing connection if available
  if (activeConnections.has(normalizedPath)) {
    logger.info('Reusing existing database connection', { dbPath: normalizedPath });
    return createAdapter(activeConnections.get(normalizedPath)!, normalizedPath);
  }

  // Ensure directory exists
  const dbDir = path.dirname(normalizedPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info('Created database directory', { dir: dbDir });
  }

  // Create database connection
  const db = new Database(normalizedPath, {
    readonly: options?.readonly || false,
    fileMustExist: options?.fileMustExist || false,
    timeout: options?.timeout || 5000,
    verbose: options?.verbose ? console.log : undefined,
  });

  // Configure pragmas for optimal performance and safety
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
  db.pragma('synchronous = NORMAL'); // Balance between safety and performance
  db.pragma('foreign_keys = ON'); // Enable foreign key constraints
  db.pragma('temp_store = MEMORY'); // Keep temp tables in memory
  db.pragma('cache_size = -64000'); // 64MB cache (negative means KB)
  db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

  logger.info('Initialized SQLite database', { dbPath: normalizedPath });

  // Store connection
  activeConnections.set(normalizedPath, db);
  
  // Initialize prepared statement cache for this connection
  preparedStatementCache.set(normalizedPath, new Map());

  return createAdapter(db, normalizedPath);
}

/**
 * Close a specific database connection
 * 
 * @param dbPath - Absolute path to the database file
 */
export function closeConnection(dbPath: string): void {
  const normalizedPath = path.resolve(dbPath);
  const db = activeConnections.get(normalizedPath);

  if (db) {
    try {
      // Clear prepared statement cache for this connection
      const stmtCache = preparedStatementCache.get(normalizedPath);
      if (stmtCache) {
        // Clear the cache
        stmtCache.clear();
        preparedStatementCache.delete(normalizedPath);
      }
      
      db.close();
      activeConnections.delete(normalizedPath);
      logger.info('Closed database connection', { dbPath: normalizedPath });
    } catch (error) {
      logger.error('Error closing database connection', { dbPath: normalizedPath, error });
    }
  }
}

/**
 * Close a database by connection ID and database name
 */
export function closeDatabase(connectionId: string, database: string): void {
  const dbPath = getDatabasePath(connectionId, database);
  closeConnection(dbPath);
}

/**
 * Close all active database connections
 */
export function closeAll(): void {
  for (const [dbPath, db] of activeConnections.entries()) {
    try {
      // Clear prepared statement cache
      preparedStatementCache.delete(dbPath);
      
      db.close();
      logger.info('Closed database connection', { dbPath });
    } catch (error) {
      logger.error('Error closing database connection during shutdown', { dbPath, error });
    }
  }

  activeConnections.clear();
  preparedStatementCache.clear();
  logger.info('Closed all database connections');
}

// ========================================
// ADAPTER IMPLEMENTATION
// ========================================

/**
 * Get or create a prepared statement with caching
 */
function getPreparedStatement(
  db: Database.Database,
  dbPath: string,
  sql: string
): Database.Statement {
  const cache = preparedStatementCache.get(dbPath);
  
  if (!cache) {
    throw new Error('Prepared statement cache not initialized');
  }
  
  // Check cache first
  if (cache.has(sql)) {
    return cache.get(sql)!;
  }
  
  // Create new prepared statement
  const stmt = db.prepare(sql);
  
  // Implement LRU-style cache limiting
  if (cache.size >= MAX_PREPARED_STATEMENTS_PER_DB) {
    // Remove oldest entry (first in Map)
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  
  cache.set(sql, stmt);
  return stmt;
}

/**
 * Create a DatabaseAdapter instance
 */
function createAdapter(db: Database.Database, dbPath: string): DatabaseAdapter {
  return {
    /**
     * Execute a SQL statement
     * 
     * @param sql - SQL statement to execute
     * @param params - Optional parameters for prepared statement
     * @returns QueryResult with rows, rowCount, and metadata
     */
    execute(sql: string, params?: unknown[]): QueryResult {
      const trimmedSql = sql.trim();
      if (!trimmedSql) {
        throw new Error('SQL statement cannot be empty');
      }

      // Determine command type
      const command = getCommandType(trimmedSql);

      try {
        // SELECT queries with prepared statement caching
        if (command === 'SELECT' || command === 'PRAGMA' || command === 'EXPLAIN') {
          const stmt = getPreparedStatement(db, dbPath, trimmedSql);
          const rows = params ? stmt.all(...params) : stmt.all();

          return {
            rows: rows as Record<string, unknown>[],
            rowCount: rows.length,
            changes: 0,
            lastInsertRowid: 0,
            command,
          };
        }

        // DML queries (INSERT, UPDATE, DELETE) with caching
        if (command === 'INSERT' || command === 'UPDATE' || command === 'DELETE') {
          const stmt = getPreparedStatement(db, dbPath, trimmedSql);
          const info = params ? stmt.run(...params) : stmt.run();

          return {
            rows: [],
            rowCount: info.changes,
            changes: info.changes,
            lastInsertRowid: Number(info.lastInsertRowid),
            command,
          };
        }

        // DDL queries (CREATE, ALTER, DROP, etc.) - don't cache these
        db.exec(trimmedSql);

        return {
          rows: [],
          rowCount: 0,
          changes: 0,
          lastInsertRowid: 0,
          command,
        };
      } catch (error) {
        logger.error('SQL execution error', { sql: trimmedSql, error });
        throw enhanceError(error, trimmedSql);
      }
    },

    /**
     * Execute multiple statements in a transaction
     * 
     * All statements must succeed or the entire transaction is rolled back.
     * 
     * @param callback - Function containing transaction logic
     * @returns Result from callback
     */
    transaction<T>(callback: () => T): T {
      const transaction = db.transaction(callback);
      return transaction();
    },

    /**
     * Close this database connection
     */
    close(): void {
      closeConnection(dbPath);
    },

    /**
     * Execute a PRAGMA statement
     * 
     * @param name - PRAGMA name
     * @param value - Optional value to set
     * @returns PRAGMA result
     */
    pragma(name: string, value?: string | number): unknown {
      if (value !== undefined) {
        return db.pragma(`${name} = ${value}`);
      }
      return db.pragma(name);
    },
  };
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Determine the SQL command type from the statement
 */
function getCommandType(sql: string): string {
  const normalized = sql.trim().toUpperCase();

  if (normalized.startsWith('SELECT')) return 'SELECT';
  if (normalized.startsWith('INSERT')) return 'INSERT';
  if (normalized.startsWith('UPDATE')) return 'UPDATE';
  if (normalized.startsWith('DELETE')) return 'DELETE';
  if (normalized.startsWith('CREATE')) return 'CREATE';
  if (normalized.startsWith('ALTER')) return 'ALTER';
  if (normalized.startsWith('DROP')) return 'DROP';
  if (normalized.startsWith('PRAGMA')) return 'PRAGMA';
  if (normalized.startsWith('EXPLAIN')) return 'EXPLAIN';
  if (normalized.startsWith('BEGIN')) return 'BEGIN';
  if (normalized.startsWith('COMMIT')) return 'COMMIT';
  if (normalized.startsWith('ROLLBACK')) return 'ROLLBACK';
  if (normalized.startsWith('ANALYZE')) return 'ANALYZE';
  if (normalized.startsWith('VACUUM')) return 'VACUUM';
  if (normalized.startsWith('ATTACH')) return 'ATTACH';
  if (normalized.startsWith('DETACH')) return 'DETACH';

  return 'OTHER';
}

/**
 * Enhance SQLite errors with additional context
 */
function enhanceError(error: unknown, sql: string): Error {
  if (error instanceof Error) {
    const enhanced = new Error(error.message);
    enhanced.name = error.name;
    enhanced.stack = error.stack;
    (enhanced as any).sql = sql;
    return enhanced;
  }

  return new Error(`Unknown database error: ${String(error)}`);
}

/**
 * Get database file path for a connection
 */
export function getDatabasePath(connectionId: string, database: string): string {
  const dataDir = path.join(process.cwd(), 'data');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Sanitize database name for filesystem
  const sanitizedName = database.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(dataDir, `${connectionId}_${sanitizedName}.db`);
}

/**
 * Check if a database file exists
 */
export function databaseExists(dbPath: string): boolean {
  return fs.existsSync(dbPath);
}

/**
 * Delete a database file
 */
export function deleteDatabase(dbPath: string): void {
  // Close connection if open
  closeConnection(dbPath);

  // Delete file
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    logger.info('Deleted database file', { dbPath });
  }

  // Delete WAL and SHM files if they exist
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  
  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);
  }
  
  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath);
  }
}
