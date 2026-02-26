import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as backupService from '../services/backup';

export const backupDatabase = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database } = req.body;

  if (!connectionId || !database) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: connectionId, database',
    });
    return;
  }

  const result = await backupService.backupDatabase(connectionId, database);

  res.json({
    success: true,
    data: result,
  });
});

export const restoreDatabase = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database, backupFile } = req.body;

  if (!connectionId || !database || !backupFile) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: connectionId, database, backupFile',
    });
    return;
  }

  await backupService.restoreDatabase(connectionId, database, backupFile);

  res.json({
    success: true,
    message: 'Database restored successfully',
  });
});

export const listBackups = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database } = req.query;

  if (!connectionId || !database) {
    res.status(400).json({
      success: false,
      error: 'Missing required query parameters: connectionId, database',
    });
    return;
  }

  const backups = await backupService.listBackups(connectionId as string, database as string);

  res.json({
    success: true,
    data: backups,
  });
});

export const deleteBackup = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!filename) {
    res.status(400).json({
      success: false,
      error: 'Missing required parameter: filename',
    });
    return;
  }

  await backupService.deleteBackup(filename);

  res.json({
    success: true,
    message: 'Backup deleted successfully',
  });
});

export const downloadBackup = asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!filename) {
    res.status(400).json({
      success: false,
      error: 'Missing required parameter: filename',
    });
    return;
  }

  const filePath = await backupService.getBackupPath(filename);

  res.download(filePath, filename);
});
