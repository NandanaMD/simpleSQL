import { Pool, PoolConfig } from 'pg';
import { getConfigDatabase, saveConfig } from '../config/database';
import { Connection, ConnectionConfig, ConnectionTestResult } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

const activePools = new Map<string, Pool>();

export function createConnection(config: ConnectionConfig): Connection {
  const db = getConfigDatabase();
  const now = new Date().toISOString();
  const id = randomUUID();

  // Check if name already exists
  const existing = Object.values(db.connections).find((c) => c.name === config.name);
  if (existing) {
    throw new ApiError(`Connection with name "${config.name}" already exists`, 409);
  }

  const connection: Connection = {
    id,
    name: config.name,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    defaultDatabase: config.defaultDatabase,
    createdAt: now,
    updatedAt: now,
  };

  db.connections[id] = connection;
  saveConfig();

  logger.info('Created connection', { id, name: config.name });
  return connection;
}

export function getAllConnections(): Connection[] {
  const db = getConfigDatabase();
  return Object.values(db.connections).sort((a, b) => a.name.localeCompare(b.name));
}

export function getConnectionById(id: string): Connection | null {
  const db = getConfigDatabase();
  return db.connections[id] || null;
}

export function updateConnection(id: string, config: Partial<ConnectionConfig>): Connection {
  const db = getConfigDatabase();
  const existing = db.connections[id];

  if (!existing) {
    throw new ApiError(`Connection with id "${id}" not found`, 404);
  }

  const updated: Connection = {
    ...existing,
    ...config,
    id,
    updatedAt: new Date().toISOString(),
  };

  db.connections[id] = updated;
  saveConfig();

  // Close existing pool if connection details changed
  closePool(id);

  logger.info('Updated connection', { id });
  return updated;
}

export function deleteConnection(id: string): void {
  const db = getConfigDatabase();

  if (!db.connections[id]) {
    throw new ApiError(`Connection with id "${id}" not found`, 404);
  }

  delete db.connections[id];
  saveConfig();

  // Close and remove pool
  closePool(id);

  logger.info('Deleted connection', { id });
}

export function createPool(connection: Connection, database?: string): Pool {
  const poolKey = `${connection.id}:${database || connection.defaultDatabase}`;

  // Return existing pool if available
  if (activePools.has(poolKey)) {
    return activePools.get(poolKey)!;
  }

  const poolConfig: PoolConfig = {
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    database: database || connection.defaultDatabase,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  const pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    logger.error('Unexpected pool error', { connectionId: connection.id, error: err });
  });

  activePools.set(poolKey, pool);
  logger.info('Created connection pool', { connectionId: connection.id, database });

  return pool;
}

export function closePool(connectionId: string): void {
  const keysToRemove: string[] = [];

  for (const [key, pool] of activePools.entries()) {
    if (key.startsWith(`${connectionId}:`)) {
      pool.end().catch((err) => {
        logger.error('Error closing pool', { connectionId, error: err });
      });
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => activePools.delete(key));

  if (keysToRemove.length > 0) {
    logger.info('Closed connection pools', { connectionId, count: keysToRemove.length });
  }
}

export function closeAllPools(): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const [key, pool] of activePools.entries()) {
    promises.push(
      pool.end().catch((err) => {
        logger.error('Error closing pool during shutdown', { poolKey: key, error: err });
      })
    );
  }

  activePools.clear();
  logger.info('Closed all connection pools');

  return Promise.all(promises).then(() => undefined);
}

export async function testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.defaultDatabase,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    client.release();
    await pool.end();

    const version = result.rows[0]?.version || 'Unknown';
    logger.info('Connection test successful', { host: config.host, database: config.defaultDatabase });

    return {
      success: true,
      message: `Connected successfully. ${version}`,
    };
  } catch (error) {
    await pool.end().catch(() => {
      // Ignore cleanup errors
    });

    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Handle common connection errors with more helpful messages
      if (errorMessage.includes('ECONNREFUSED')) {
        errorMessage = `Cannot connect to PostgreSQL server at ${config.host}:${config.port}. Make sure PostgreSQL is running.`;
      } else if (errorMessage.includes('ENOTFOUND')) {
        errorMessage = `Host ${config.host} not found. Check your connection settings.`;
      } else if (errorMessage.includes('authentication')) {
        errorMessage = 'Authentication failed. Check your username and password.';
      } else if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
        errorMessage = `Database "${config.defaultDatabase}" does not exist.`;
      }
    }
    
    logger.warn('Connection test failed', {
      host: config.host,
      database: config.defaultDatabase,
      error: errorMessage,
    });

    return {
      success: false,
      message: 'Connection failed',
      error: errorMessage,
    };
  }
}
