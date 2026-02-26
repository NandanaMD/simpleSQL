import { getConfigDatabase, saveConfig } from '../config/database';
import { Connection, ConnectionConfig, ConnectionTestResult } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import * as dbAdapter from './dbAdapter';

export function createConnection(config: ConnectionConfig): Connection {
  const db = getConfigDatabase();
  const now = new Date().toISOString();
  const id = randomUUID();

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

  closeConnectionDatabases(id);

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

  closeConnectionDatabases(id);

  logger.info('Deleted connection', { id });
}

export function getDatabase(connection: Connection, database?: string) {
  const dbName = database || connection.defaultDatabase;
  const dbPath = dbAdapter.getDatabasePath(connection.id, dbName);

  const db = dbAdapter.initialize(dbPath);

  logger.info('Retrieved database connection', { connectionId: connection.id, database: dbName });

  return db;
}

export function closeConnectionDatabases(connectionId: string): void {
  logger.info('Connection databases marked for closure', { connectionId });
}

export function closeAllDatabases(): void {
  dbAdapter.closeAll();
  logger.info('Closed all database connections');
}

export function testConnection(config: ConnectionConfig): ConnectionTestResult {
  try {
    const testDbPath = dbAdapter.getDatabasePath('test', config.defaultDatabase);
    const db = dbAdapter.initialize(testDbPath);

    const result = db.execute('SELECT sqlite_version() as version');
    const version = result.rows[0]?.version || 'Unknown';

    logger.info('Connection test successful', { database: config.defaultDatabase, version });

    return {
      success: true,
      message: `SQLite connection successful. Version: ${version}`,
    };
  } catch (error) {
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    logger.warn('Connection test failed', {
      database: config.defaultDatabase,
      error: errorMessage,
    });

    return {
      success: false,
      message: 'Connection test failed',
      error: errorMessage,
    };
  }
}
