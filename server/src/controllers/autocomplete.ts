import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as autocompleteService from '../services/autocomplete';

export const getAutocompleteSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database } = req.query;

  if (!connectionId || !database) {
    res.status(400).json({
      success: false,
      error: 'Missing required query parameters: connectionId, database',
    });
    return;
  }

  const suggestions = autocompleteService.getAutocompleteSuggestions(
    connectionId as string,
    database as string
  );

  res.json({
    success: true,
    data: suggestions,
  });
});
