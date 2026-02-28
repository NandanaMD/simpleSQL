import path from 'path';
import fs from 'fs';
import appConfig from '../config';
import logger from '../utils/logger';
import { Connection } from '@sql-ide/shared';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

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
const keyPath = configPath.replace('.json', '.key');
const ENCRYPTED_PREFIX = 'enc:v1:';

function getOrCreateEncryptionKey(): Buffer {
  const envKey = process.env.CONFIG_ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, 'hex');
  }

  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (fs.existsSync(keyPath)) {
    const existingKeyHex = fs.readFileSync(keyPath, 'utf8').trim();
    return Buffer.from(existingKeyHex, 'hex');
  }

  const generatedKey = randomBytes(32);
  fs.writeFileSync(keyPath, generatedKey.toString('hex'), { encoding: 'utf8' });
  logger.info(`Generated config encryption key at: ${keyPath}`);
  return generatedKey;
}

const configEncryptionKey = getOrCreateEncryptionKey();

function encryptSecret(value: string): string {
  if (!value) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', configEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, authTag, encrypted]).toString('base64');
  return `${ENCRYPTED_PREFIX}${packed}`;
}

function decryptSecret(value: string): string {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const packed = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64');
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const encrypted = packed.subarray(28);

  const decipher = createDecipheriv('aes-256-gcm', configEncryptionKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function decryptConnections(store: ConfigStore): ConfigStore {
  const nextConnections: Record<string, Connection> = {};

  for (const [id, conn] of Object.entries(store.connections || {})) {
    nextConnections[id] = {
      ...conn,
      password: decryptSecret(conn.password || ''),
    };
  }

  return {
    ...store,
    connections: nextConnections,
  };
}

function getEncryptedSnapshot(store: ConfigStore): ConfigStore {
  const nextConnections: Record<string, Connection> = {};

  for (const [id, conn] of Object.entries(store.connections || {})) {
    nextConnections[id] = {
      ...conn,
      password: encryptSecret(conn.password || ''),
    };
  }

  return {
    ...store,
    connections: nextConnections,
  };
}

export function initConfigDatabase(): void {
  try {
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      logger.info(`Created config directory: ${configDir}`);
    }

    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(data) as ConfigStore;
      configStore = decryptConnections(parsed);
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
    const encryptedSnapshot = getEncryptedSnapshot(configStore);
    fs.writeFileSync(configPath, JSON.stringify(encryptedSnapshot, null, 2), 'utf-8');
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
