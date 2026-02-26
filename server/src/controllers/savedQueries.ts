import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import * as savedQueriesService from '../services/savedQueries';
import { SavedQuery } from '../config/database';

export const createSavedQuery = asyncHandler(async (req: Request, res: Response) => {
  const queryData: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'> = req.body;

  if (!queryData.name || !queryData.sql) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: name, sql',
    });
    return;
  }

  const savedQuery = savedQueriesService.createSavedQuery(queryData);

  res.status(201).json({
    success: true,
    data: savedQuery,
  });
});

export const getAllSavedQueries = asyncHandler(async (_req: Request, res: Response) => {
  const savedQueries = savedQueriesService.getAllSavedQueries();

  res.json({
    success: true,
    data: savedQueries,
  });
});

export const getSavedQuery = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const savedQuery = savedQueriesService.getSavedQueryById(id);

  if (!savedQuery) {
    res.status(404).json({
      success: false,
      error: 'Saved query not found',
    });
    return;
  }

  res.json({
    success: true,
    data: savedQuery,
  });
});

export const updateSavedQuery = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates: Partial<SavedQuery> = req.body;

  const savedQuery = savedQueriesService.updateSavedQuery(id, updates);

  res.json({
    success: true,
    data: savedQuery,
  });
});

export const deleteSavedQuery = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  savedQueriesService.deleteSavedQuery(id);

  res.json({
    success: true,
    message: 'Saved query deleted successfully',
  });
});
