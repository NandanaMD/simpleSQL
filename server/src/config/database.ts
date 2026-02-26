import path from 'path';
import fs from 'fs';
import appConfig from '../config';
import logger from '../utils/logger';
import { Connection } from '@sql-ide/shared';

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql: string;
  connectionId?: string;
  database?: string;
  folder?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ConfigStore {
  connections: Record<string, Connection>;
  savedQueries: Record<string, SavedQuery>;
}

let configStore: ConfigStore = { connections: {}, savedQueries: {} };
const configPath = appConfig.database.configDbPath.replace('.db', '.json');

export function initConfigDatabase(): void {
  try {
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      logger.info(`Created config directory: ${configDir}`);
    }

    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      configStore = JSON.parse(data);
      logger.info(`Loaded config from: ${configPath}`);
    } else {
      saveConfig();
      logger.info(`Initialized new config at: ${configPath}`);
    }
  } catch (error) {
    logger.error('Failed to initialize config database', { error });
    throw error;
  }
}

export function getConfigDatabase() {
  return configStore;
}

export function saveConfig(): void {
  try {
    fs.writeFileSync(configPath, JSON.stringify(configStore, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to saved config', { error });
    throw error;
  }
}

export function closeConfigDatabase(): void {
  try {
    saveConfig();
    logger.info('Saved and closed config database');
  } catch (error) {
    logger.error('Error closing config database', { error });
  }
}
