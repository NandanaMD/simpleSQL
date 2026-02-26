import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as metadataService from '../services/metadata';

export const getDatabases = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId } = req.params;

  const databases = metadataService.getDatabases(connectionId);

  res.json({
    success: true,
    data: databases,
  });
});

export const getSchemas = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database } = req.params;

  const schemas = metadataService.getSchemas(connectionId, database);

  res.json({
    success: true,
    data: schemas,
  });
});

export const getTables = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database, schema } = req.params;

  const tables = metadataService.getTables(connectionId, database, schema);

  res.json({
    success: true,
    data: tables,
  });
});

export const getTableStructure = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database, schema, table } = req.params;

  const structure = metadataService.getTableStructure(connectionId, database, schema, table);

  res.json({
    success: true,
    data: structure,
  });
});
