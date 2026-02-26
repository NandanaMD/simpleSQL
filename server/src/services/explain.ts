import { ExplainRequest, ExplainResult, ExplainNode } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import * as connectionService from './connections';
import logger from '../utils/logger';

export function explainQuery(request: ExplainRequest): ExplainResult {
  const connection = connectionService.getConnectionById(request.connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${request.connectionId}" not found`, 404);
  }

  const db = connectionService.getDatabase(connection, request.database);

  try {
    // SQLite uses EXPLAIN QUERY PLAN
    const explainSQL = `EXPLAIN QUERY PLAN ${request.sql}`;

    const result = db.execute(explainSQL);

    // SQLite returns a different format than PostgreSQL
    // Convert to a simplified plan structure
    const plan: ExplainNode = {
      'Node Type': 'SQLite Query Plan',
      'Startup Cost': 0,
      'Plan Rows': 0,
      'Plan Width': 0,
      'Total Cost': 0,
      'Actual Rows': 0,
      'Actual Total Time': 0,
      Plans: result.rows.map((row: any) => ({
        'Node Type': row.detail || 'Unknown',
        'Startup Cost': 0,
        'Plan Rows': 0,
        'Plan Width': 0,
        'Total Cost': 0,
      })),
    };

    logger.info('Query plan generated', {
      connectionId: request.connectionId,
      database: request.database || connection.defaultDatabase,
      rows: result.rows.length,
    });

    return {
      plan,
      planningTime: 0,
      executionTime: 0,
      totalCost: 0,
      queryText: request.sql,
    };
  } catch (error) {
    logger.error('EXPLAIN query failed', {
      connectionId: request.connectionId,
      database: request.database || connection.defaultDatabase,
      error,
    });

    throw new ApiError(
      error instanceof Error ? error.message : 'EXPLAIN query failed',
      400
    );
  }
}
