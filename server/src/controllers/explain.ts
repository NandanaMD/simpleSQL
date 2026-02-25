import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as explainService from '../services/explain';
import { ExplainRequest } from '@sql-ide/shared';

export const explainQuery = asyncHandler(async (req: Request, res: Response) => {
  const request: ExplainRequest = req.body;

  if (!request.connectionId || !request.sql) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: connectionId, sql',
    });
    return;
  }

  const result = await explainService.explainQuery(request);

  res.json({
    success: true,
    data: result,
  });
});
