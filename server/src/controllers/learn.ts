import { Request, Response } from 'express';
import {
  AdaptiveCoachRequest,
  AutoLabGeneratorRequest,
  ExecutionVisualizerRequest,
  FixQueryDrillsRequest,
  MisconceptionDetectorRequest,
  NaturalLanguageToSqlRequest,
  SocraticHintRequest,
} from '@sql-ide/shared';
import { asyncHandler } from '../middleware/errorHandler';
import * as learnService from '../services/learn';

export const getAdaptiveCoach = asyncHandler(async (req: Request, res: Response) => {
  const request: AdaptiveCoachRequest = req.body || {};

  const response = learnService.getAdaptiveCoach(request);
  res.json({ success: true, data: response });
});

export const getSocraticHints = asyncHandler(async (req: Request, res: Response) => {
  const request: SocraticHintRequest = req.body || {};
  const response = learnService.getSocraticHints(request);
  res.json({ success: true, data: response });
});

export const getExecutionVisualization = asyncHandler(async (req: Request, res: Response) => {
  const request: ExecutionVisualizerRequest = req.body;

  if (!request?.sql?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Missing required field: sql',
    });
    return;
  }

  const response = learnService.visualizeExecution(request);
  res.json({ success: true, data: response });
});

export const getMisconceptions = asyncHandler(async (req: Request, res: Response) => {
  const request: MisconceptionDetectorRequest = req.body;

  if (!request?.sql?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Missing required field: sql',
    });
    return;
  }

  const response = learnService.detectMisconceptions(request);
  res.json({ success: true, data: response });
});

export const generateAutoLab = asyncHandler(async (req: Request, res: Response) => {
  const request: AutoLabGeneratorRequest = req.body;

  if (!request?.connectionId || !request?.database) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: connectionId, database',
    });
    return;
  }

  const response = learnService.generateAutoLab(request);
  res.json({ success: true, data: response });
});

export const generateFixDrills = asyncHandler(async (req: Request, res: Response) => {
  const request: FixQueryDrillsRequest = req.body || {};

  const response = learnService.generateFixQueryDrills(request);
  res.json({ success: true, data: response });
});

export const naturalLanguageToSql = asyncHandler(async (req: Request, res: Response) => {
  const request: NaturalLanguageToSqlRequest = req.body;

  if (!request?.prompt?.trim()) {
    res.status(400).json({
      success: false,
      error: 'Missing required field: prompt',
    });
    return;
  }

  const response = learnService.naturalLanguageToSql(request);
  res.json({ success: true, data: response });
});
