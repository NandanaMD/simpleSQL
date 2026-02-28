import { QueryRequest, QueryResult, QueryField } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import * as connectionService from './connections';
import * as dbAdapter from './dbAdapter';
import logger from '../utils/logger';
import appConfig from '../config';

export async function executeQuery(request: QueryRequest): Promise<QueryResult> {
  const connection = connectionService.getConnectionById(request.connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${request.connectionId}" not found`, 404);
  }

  // Validate SQL query
  const trimmedSql = request.sql.trim();
  if (!trimmedSql) {
    throw new ApiError('Query cannot be empty', 400);
  }

  // Handle CREATE DATABASE command specially for SQLite
  // SQLite doesn't support CREATE DATABASE SQL - databases are just files
  const createDbMatch = trimmedSql.match(/^\s*CREATE\s+DATABASE\s+["'`]?(\w+)["'`]?\s*;?\s*$/i);
  if (createDbMatch) {
    const newDbName = createDbMatch[1];
    const startTime = Date.now();
    
    try {
      // Create the database by initializing a connection to it
      // This will create the .db file if it doesn't exist
      const newDb = connectionService.getDatabase(connection, newDbName);
      
      // Just opening the connection creates the file, so we can close it
      newDb.close();
      
      const executionTime = Date.now() - startTime;
      
      logger.info('Database created successfully', {
        connectionId: request.connectionId,
        database: newDbName,
        executionTime: `${executionTime}ms`,
      });
      
      return {
        rows: [],
        rowCount: 0,
        fields: [],
        executionTime,
        command: 'CREATE',
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Database creation failed', {
        connectionId: request.connectionId,
        database: newDbName,
        error,
        executionTime: `${executionTime}ms`,
      });
      
      throw parseSQLiteError(error);
    }
  }

  // Handle DROP DATABASE command specially for SQLite
  const dropDbMatch = trimmedSql.match(/^\s*DROP\s+DATABASE\s+["'`]?(\w+)["'`]?\s*;?\s*$/i);
  if (dropDbMatch) {
    const dbName = dropDbMatch[1];
    const startTime = Date.now();
    
    try {
      // Get the database file path and delete it
      const dbPath = dbAdapter.getDatabasePath(request.connectionId, dbName);
      dbAdapter.deleteDatabase(dbPath);
      
      const executionTime = Date.now() - startTime;
      
      logger.info('Database dropped successfully', {
        connectionId: request.connectionId,
        database: dbName,
        executionTime: `${executionTime}ms`,
      });
      
      return {
        rows: [],
        rowCount: 0,
        fields: [],
        executionTime,
        command: 'DROP',
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Database drop failed', {
        connectionId: request.connectionId,
        database: dbName,
        error,
        executionTime: `${executionTime}ms`,
      });
      
      throw parseSQLiteError(error);
    }
  }

  const db = connectionService.getDatabase(connection, request.database);

  const startTime = Date.now();
  
  // Apply timeout wrapper for query execution
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Query execution timeout')), appConfig.query.timeoutMs);
  });

  try {
    // Execute query (single or multi-statement) with timeout and optimized limiting
    const result = await Promise.race([
      executeStatementsWithOptimization(db, trimmedSql),
      timeoutPromise
    ]);

    const executionTime = Date.now() - startTime;

    // Map fields from SQLite result
    const fields: QueryField[] = result.rows.length > 0
      ? Object.keys(result.rows[0]).map((name, index) => {
          const value = result.rows[0][name];
          const dataType = inferSQLiteType(value);

          return {
            name,
            dataTypeID: 0, // SQLite doesn't use OIDs
            tableID: 0,
            columnID: index,
            dataType,
          };
        })
      : [];

    const rowCount = result.rowCount;

    logger.info('Query executed successfully', {
      connectionId: request.connectionId,
      database: request.database || connection.defaultDatabase,
      rowCount,
      executionTime: `${executionTime}ms`,
    });

    return {
      rows: result.rows,
      rowCount,
      fields,
      executionTime,
      command: result.command,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error('Query execution failed', {
      connectionId: request.connectionId,
      database: request.database || connection.defaultDatabase,
      error,
      executionTime: `${executionTime}ms`,
    });

    throw parseSQLiteError(error);
  }
}

function parseSQLiteError(error: unknown): ApiError {
  if (error instanceof Error) {
    const sqliteError = error as Error & {
      code?: string;
    };

    const apiError = new ApiError(sqliteError.message, 400, sqliteError.code);

    return apiError;
  }

  return new ApiError('Unknown query execution error', 500);
}

// Map SQLite value types to type names
function inferSQLiteType(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'INTEGER' : 'REAL';
  }
  if (typeof value === 'string') return 'TEXT';
  if (typeof value === 'boolean') return 'INTEGER'; // SQLite stores booleans as 0/1
  if (value instanceof Buffer) return 'BLOB';

  return 'TEXT';
}

/**
 * Execute query with optimization for large result sets
 * Applies LIMIT at database level for SELECT queries
 */
async function executeWithOptimization(
  db: dbAdapter.DatabaseAdapter,
  sql: string
): Promise<{ rows: Record<string, unknown>[]; rowCount: number; command: string }> {
  return new Promise((resolve, reject) => {
    try {
      const trimmed = stripTrailingSemicolons(sql.trim());
      const upperSql = trimmed.toUpperCase();
      
      // Check if this is a SELECT-like query without LIMIT
      const isSelectLike = upperSql.startsWith('SELECT') || upperSql.startsWith('WITH');
      const hasLimit = /\bLIMIT\s+\d+/i.test(trimmed);
      
      let optimizedSql = trimmed;
      let needsCount = false;
      
      // For SELECT without LIMIT, add LIMIT to avoid loading massive result sets
      if (isSelectLike && !hasLimit) {
        // Add LIMIT clause for performance
        optimizedSql = `${trimmed} LIMIT ${appConfig.query.maxResultRows}`;
        needsCount = true;
      }
      
      // Execute the query
      const result = db.execute(optimizedSql);
      
      // For large queries, get actual count if needed
      let actualRowCount = result.rowCount;
      if (needsCount && result.rowCount === appConfig.query.maxResultRows) {
        // Result was limited, get actual count
        try {
          const countSql = `SELECT COUNT(*) as total FROM (${trimmed})`;
          const countResult = db.execute(countSql);
          actualRowCount = (countResult.rows[0]?.total as number) || result.rowCount;
        } catch {
          // If count query fails, use the limited count
          actualRowCount = result.rowCount;
        }
      }
      
      resolve({
        rows: result.rows,
        rowCount: actualRowCount,
        command: result.command
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function executeStatementsWithOptimization(
  db: dbAdapter.DatabaseAdapter,
  sql: string
): Promise<{ rows: Record<string, unknown>[]; rowCount: number; command: string }> {
  const statements = splitSqlStatements(sql);

  if (statements.length === 0) {
    throw new Error('SQL statement cannot be empty');
  }

  let lastResult: { rows: Record<string, unknown>[]; rowCount: number; command: string } = {
    rows: [],
    rowCount: 0,
    command: 'OTHER',
  };

  for (const statement of statements) {
    lastResult = await executeWithOptimization(db, statement);
  }

  return lastResult;
}

function stripTrailingSemicolons(sql: string): string {
  return sql.replace(/;+\s*$/, '').trim();
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktickQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];
    const next = sql[index + 1];
    const prev = sql[index - 1];

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (prev === '*' && char === '/') {
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktickQuote) {
      if (char === '-' && next === '-') {
        inLineComment = true;
        current += char;
        continue;
      }

      if (char === '/' && next === '*') {
        inBlockComment = true;
        current += char;
        continue;
      }
    }

    if (char === "'" && !inDoubleQuote && !inBacktickQuote) {
      if (inSingleQuote && next === "'") {
        current += "''";
        index++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote && !inBacktickQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktickQuote = !inBacktickQuote;
      current += char;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inBacktickQuote) {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();
  if (finalStatement) {
    statements.push(finalStatement);
  }

  return statements;
}
