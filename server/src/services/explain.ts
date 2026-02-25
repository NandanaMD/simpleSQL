import { ExplainRequest, ExplainResult, ExplainNode } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import * as connectionService from './connections';
import logger from '../utils/logger';

export async function explainQuery(request: ExplainRequest): Promise<ExplainResult> {
  const connection = connectionService.getConnectionById(request.connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${request.connectionId}" not found`, 404);
  }

  const pool = connectionService.createPool(connection, request.database);
  const client = await pool.connect();

  try {
    const analyzeClause = request.analyze ? 'ANALYZE, ' : '';
    const explainSQL = `EXPLAIN (${analyzeClause}FORMAT JSON) ${request.sql}`;

    const result = await client.query(explainSQL);

    const explainData = result.rows[0]['QUERY PLAN'][0];
    const plan: ExplainNode = explainData.Plan;
    const planningTime = explainData['Planning Time'];
    const executionTime = explainData['Execution Time'];
    const totalCost = plan['Total Cost'];

    logger.info('Query plan generated', {
      connectionId: request.connectionId,
      database: request.database || connection.defaultDatabase,
      analyze: request.analyze,
      totalCost,
    });

    return {
      plan,
      planningTime,
      executionTime,
      totalCost,
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
  } finally {
    client.release();
  }
}
