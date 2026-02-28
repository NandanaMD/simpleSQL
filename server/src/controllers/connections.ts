import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as connectionService from '../services/connections';
import { ConnectionConfig } from '@sql-ide/shared';

export const createConnection = asyncHandler(async (req: Request, res: Response) => {
  const config: ConnectionConfig = req.body;

  if (!config.name || !config.host || !config.port || !config.defaultDatabase) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: name, host, port, defaultDatabase',
    });
    return;
  }

  const connection = connectionService.createConnection(config);

  res.status(201).json({
    success: true,
    data: connectionService.sanitizeConnectionForClient(connection),
  });
});

export const getAllConnections = asyncHandler(async (_req: Request, res: Response) => {
  const connections = connectionService.getAllConnections();

  res.json({
    success: true,
    data: connections.map(connectionService.sanitizeConnectionForClient),
  });
});

export const getConnection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const connection = connectionService.getConnectionById(id);

  if (!connection) {
    res.status(404).json({
      success: false,
      error: 'Connection not found',
    });
    return;
  }

  res.json({
    success: true,
    data: connectionService.sanitizeConnectionForClient(connection),
  });
});

export const updateConnection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const config: Partial<ConnectionConfig> = req.body;

  const connection = connectionService.updateConnection(id, config);

  res.json({
    success: true,
    data: connectionService.sanitizeConnectionForClient(connection),
  });
});

export const authenticateConnection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const username = (req.body?.username as string) || '';
  const password = (req.body?.password as string) || '';

  connectionService.authenticateConnection(id, username, password);

  res.json({
    success: true,
    message: 'Connection authenticated successfully',
  });
});

export const deleteConnection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  connectionService.deleteConnection(id);

  res.json({
    success: true,
    message: 'Connection deleted successfully',
  });
});

export const testConnection = asyncHandler(async (req: Request, res: Response) => {
  const config: ConnectionConfig = req.body;

  if (!config.host || !config.port || !config.defaultDatabase) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: host, port, defaultDatabase',
    });
    return;
  }

  const result = connectionService.testConnection(config);

  res.json({
    success: result.success,
    data: result,
  });
});
