import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as queryService from '../services/query';
import { QueryRequest } from '@sql-ide/shared';

export const executeQuery = asyncHandler(async (req: Request, res: Response) => {
  const request: QueryRequest = req.body;

  if (!request.connectionId || !request.sql) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: connectionId, sql',
    });
    return;
  }

  const result = await queryService.executeQuery(request);

  // Set appropriate headers for fast response
  res.setHeader('Content-Type', 'application/json');
  
  res.json({
    success: true,
    data: result,
  });
});
