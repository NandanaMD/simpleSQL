import { getConfigDatabase, saveConfig } from '../config/database';
import { Connection, ConnectionConfig, ConnectionTestResult } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';
import * as dbAdapter from './dbAdapter';

const CONNECTION_UNLOCK_TTL_MS = 30 * 60 * 1000;
const unlockedConnections = new Map<string, number>();

function requiresAuthentication(connection: Connection): boolean {
  return Boolean(connection.password?.trim() || connection.username?.trim());
}

export function sanitizeConnectionForClient(connection: Connection): Connection {
  return {
    ...connection,
    password: '',
    requiresAuthentication: requiresAuthentication(connection),
  };
}

function isConnectionUnlocked(connectionId: string): boolean {
  const expiry = unlockedConnections.get(connectionId);
  if (!expiry) {
    return false;
  }

  if (expiry < Date.now()) {
    unlockedConnections.delete(connectionId);
    return false;
  }

  return true;
}

export function authenticateConnection(
  connectionId: string,
  username: string,
  password: string
): void {
  const connection = getConnectionById(connectionId);
  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  if (!requiresAuthentication(connection)) {
    unlockedConnections.set(connectionId, Date.now() + CONNECTION_UNLOCK_TTL_MS);
    return;
  }

  const expectedUsername = connection.username || '';
  const expectedPassword = connection.password || '';
  const providedUsername = username || '';
  const providedPassword = password || '';

  if (expectedUsername && providedUsername !== expectedUsername) {
    throw new ApiError('Invalid connection credentials', 401);
  }

  if (expectedPassword !== providedPassword) {
    throw new ApiError('Invalid connection credentials', 401);
  }

  unlockedConnections.set(connectionId, Date.now() + CONNECTION_UNLOCK_TTL_MS);
}

export function ensureConnectionAccess(connection: Connection): void {
  if (!requiresAuthentication(connection)) {
    return;
  }

  if (!isConnectionUnlocked(connection.id)) {
    throw new ApiError('Connection is locked. Authenticate before accessing this connection.', 401);
  }
}

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
  unlockedConnections.delete(id);

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
  unlockedConnections.delete(id);

  closeConnectionDatabases(id);

  logger.info('Deleted connection', { id });
}

export function getDatabase(connection: Connection, database?: string) {
  ensureConnectionAccess(connection);

  const dbName = database || connection.defaultDatabase;
  const dbPath = dbAdapter.getDatabasePath(connection.id, dbName);

  const db = dbAdapter.initialize(dbPath);

  logger.info('Retrieved database connection', { connectionId: connection.id, database: dbName });

  return db;
}

export function closeConnectionDatabases(connectionId: string): void {
  unlockedConnections.delete(connectionId);
  logger.info('Connection databases marked for closure', { connectionId });
}

export function closeAllDatabases(): void {
  unlockedConnections.clear();
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
