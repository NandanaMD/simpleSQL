import path from 'path';
import fs from 'fs';
import { ApiError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import * as dbAdapter from './dbAdapter';

export interface BackupInfo {
  filename: string;
  size: string;
  createdAt: string;
  connectionId: string;
  database: string;
}

const BACKUP_DIR = path.join(process.cwd(), 'server', 'backups');

function isSafeBackupFilename(filename: string): boolean {
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  return /^[a-zA-Z0-9._-]+$/.test(filename);
}

function resolveBackupPath(filename: string): string {
  if (!isSafeBackupFilename(filename)) {
    throw new ApiError('Invalid backup filename', 400);
  }

  const resolvedDir = path.resolve(BACKUP_DIR);
  const resolvedPath = path.resolve(BACKUP_DIR, filename);

  if (!resolvedPath.startsWith(`${resolvedDir}${path.sep}`) && resolvedPath !== resolvedDir) {
    throw new ApiError('Invalid backup filename', 400);
  }

  return resolvedPath;
}

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  logger.info('Created backup directory', { path: BACKUP_DIR });
}

export async function backupDatabase(
  connectionId: string,
  database: string
): Promise<BackupInfo> {
  try {
    const sourcePath = dbAdapter.getDatabasePath(connectionId, database);
    
    if (!fs.existsSync(sourcePath)) {
      throw new ApiError(`Database file not found: ${database}`, 404);
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `${connectionId}_${database}_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    // Get database connection and use SQLite's VACUUM INTO (SQLite 3.27.0+)
    // This creates a clean, optimized copy
    const db = dbAdapter.initialize(sourcePath);
    db.execute(`VACUUM INTO '${backupPath.replace(/\\/g, '/')}'`);

    const stats = fs.statSync(backupPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    logger.info('Database backup created', {
      connectionId,
      database,
      backupPath,
      size: `${sizeInMB} MB`,
    });

    return {
      filename: backupFilename,
      size: `${sizeInMB} MB`,
      createdAt: new Date().toISOString(),
      connectionId,
      database,
    };
  } catch (error: any) {
    logger.error('Backup failed', { error: error.message, connectionId, database });
    throw new ApiError(`Backup failed: ${error.message}`, 500);
  }
}

export async function restoreDatabase(
  connectionId: string,
  database: string,
  backupFilename: string
): Promise<void> {
  try {
    const backupPath = resolveBackupPath(backupFilename);
    
    if (!fs.existsSync(backupPath)) {
      throw new ApiError(`Backup file not found: ${backupFilename}`, 404);
    }

    const targetPath = dbAdapter.getDatabasePath(connectionId, database);

    // Close active connection before restore
    try {
      dbAdapter.closeDatabase(connectionId, database);
    } catch (error) {
      // Connection might not be open, that's okay
    }

    // Create backup of current database before overwriting
    if (fs.existsSync(targetPath)) {
      const tempBackup = `${targetPath}.pre-restore-backup`;
      fs.copyFileSync(targetPath, tempBackup);
      logger.info('Created pre-restore backup', { tempBackup });
    }

    // Copy backup file to target location
    fs.copyFileSync(backupPath, targetPath);

    logger.info('Database restored', {
      connectionId,
      database,
      backupFilename,
    });
  } catch (error: any) {
    logger.error('Restore failed', { error: error.message, connectionId, database });
    throw new ApiError(`Restore failed: ${error.message}`, 500);
  }
}

export async function listBackups(
  connectionId: string,
  database: string
): Promise<BackupInfo[]> {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const prefix = `${connectionId}_${database}_`;
    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (file.startsWith(prefix) && file.endsWith('.db')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

        backups.push({
          filename: file,
          size: `${sizeInMB} MB`,
          createdAt: stats.ctime.toISOString(),
          connectionId,
          database,
        });
      }
    }

    // Sort by creation date, newest first
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    logger.info('Listed backups', { connectionId, database, count: backups.length });
    return backups;
  } catch (error: any) {
    logger.error('Failed to list backups', { error: error.message });
    throw new ApiError(`Failed to list backups: ${error.message}`, 500);
  }
}

export async function deleteBackup(filename: string): Promise<void> {
  try {
    const backupPath = resolveBackupPath(filename);
    
    if (!fs.existsSync(backupPath)) {
      throw new ApiError(`Backup file not found: ${filename}`, 404);
    }

    fs.unlinkSync(backupPath);
    logger.info('Backup deleted', { filename });
  } catch (error: any) {
    logger.error('Failed to delete backup', { error: error.message, filename });
    throw new ApiError(`Failed to delete backup: ${error.message}`, 500);
  }
}

export async function getBackupPath(filename: string): Promise<string> {
  const backupPath = resolveBackupPath(filename);
  
  if (!fs.existsSync(backupPath)) {
    throw new ApiError(`Backup file not found: ${filename}`, 404);
  }

  return backupPath;
}
