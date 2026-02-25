import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as importService from '../services/import';
import { CSVImportRequest } from '@sql-ide/shared';

export const previewCSV = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
    return;
  }

  if (!req.file.buffer || req.file.buffer.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Uploaded file is empty',
    });
    return;
  }

  // Pass buffer directly instead of stream to avoid consumption issues
  const preview = await importService.previewCSV(req.file.buffer, req.file.originalname);

  res.json({
    success: true,
    data: preview,
  });
});

export const importCSV = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
    return;
  }

  if (!req.file.buffer || req.file.buffer.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Uploaded file is empty',
    });
    return;
  }

  if (!req.body.importRequest) {
    res.status(400).json({
      success: false,
      error: 'Missing importRequest data',
    });
    return;
  }

  let importRequest: CSVImportRequest;
  try {
    importRequest = JSON.parse(req.body.importRequest);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid importRequest JSON format',
    });
    return;
  }

  if (!importRequest.connectionId || !importRequest.database || !importRequest.schema || !importRequest.tableName) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: connectionId, database, schema, tableName',
    });
    return;
  }

  if (!importRequest.columnMappings || importRequest.columnMappings.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Missing column mappings',
    });
    return;
  }

  // Pass buffer directly instead of stream
  const result = await importService.importCSV(req.file.buffer, req.file.originalname, importRequest);

  res.json({
    success: true,
    data: result,
  });
});
