import { SavedQuery, getConfigDatabase, saveConfig } from '../config/database';
import { ApiError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { nanoid } from 'nanoid';

export function createSavedQuery(
  data: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>
): SavedQuery {
  const config = getConfigDatabase();
  if (!config.savedQueries) {
    config.savedQueries = {};
  }

  const now = new Date().toISOString();
  const savedQuery: SavedQuery = {
    id: nanoid(),
    name: data.name,
    description: data.description,
    sql: data.sql,
    connectionId: data.connectionId,
    database: data.database,
    folder: data.folder,
    tags: data.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  config.savedQueries[savedQuery.id] = savedQuery;
  saveConfig();

  logger.info('Created saved query', { id: savedQuery.id, name: savedQuery.name });
  return savedQuery;
}

export function getAllSavedQueries(): SavedQuery[] {
  const config = getConfigDatabase();
  if (!config.savedQueries) {
    config.savedQueries = {};
    saveConfig();
  }
  return Object.values(config.savedQueries).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getSavedQueryById(id: string): SavedQuery | null {
  const config = getConfigDatabase();
  if (!config.savedQueries) {
    return null;
  }
  return config.savedQueries[id] || null;
}

export function updateSavedQuery(id: string, updates: Partial<SavedQuery>): SavedQuery {
  const config = getConfigDatabase();
  if (!config.savedQueries) {
    throw new ApiError(`Saved query with id "${id}" not found`, 404);
  }
  const savedQuery = config.savedQueries[id];

  if (!savedQuery) {
    throw new ApiError(`Saved query with id "${id}" not found`, 404);
  }

  const updatedQuery: SavedQuery = {
    ...savedQuery,
    ...updates,
    id: savedQuery.id, // Don't allow ID changes
    createdAt: savedQuery.createdAt, // Don't allow createdAt changes
    updatedAt: new Date().toISOString(),
  };

  config.savedQueries[id] = updatedQuery;
  saveConfig();

  logger.info('Updated saved query', { id });
  return updatedQuery;
}

export function deleteSavedQuery(id: string): void {
  const config = getConfigDatabase();
  if (!config.savedQueries) {
    throw new ApiError(`Saved query with id "${id}" not found`, 404);
  }

  if (!config.savedQueries[id]) {
    throw new ApiError(`Saved query with id "${id}" not found`, 404);
  }

  delete config.savedQueries[id];
  saveConfig();

  logger.info('Deleted saved query', { id });
}
