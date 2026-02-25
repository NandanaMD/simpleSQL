import { QueryRequest, QueryResult, QueryField } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import * as connectionService from './connections';
import logger from '../utils/logger';
import appConfig from '../config';

export async function executeQuery(request: QueryRequest): Promise<QueryResult> {
  const connection = connectionService.getConnectionById(request.connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${request.connectionId}" not found`, 404);
  }

  // Validate SQL query
  const trimmedSql = request.sql.trim();
  if (!trimmedSql) {
    throw new ApiError('Query cannot be empty', 400);
  }

  const pool = connectionService.createPool(connection, request.database);
  const timeout = request.timeout || appConfig.query.timeoutMs;

  const startTime = Date.now();
  let client;

  try {
    client = await pool.connect();

    // Set statement timeout
    await client.query(`SET statement_timeout = ${timeout}`);

    // Execute query with trimmed SQL
    const result = await client.query(trimmedSql);

    const executionTime = Date.now() - startTime;

    // Map fields
    const fields: QueryField[] = result.fields.map((field: { name: string; dataTypeID: number; tableID: number; columnID: number }) => ({
      name: field.name,
      dataTypeID: field.dataTypeID,
      tableID: field.tableID,
      columnID: field.columnID,
      dataType: getPostgresTypeName(field.dataTypeID),
    }));

    // Limit rows if needed
    const rows = result.rows.slice(0, appConfig.query.maxResultRows);
    const rowCount = result.rowCount || 0;

    logger.info('Query executed successfully', {
      connectionId: request.connectionId,
      database: request.database || connection.defaultDatabase,
      rowCount,
      executionTime: `${executionTime}ms`,
    });

    return {
      rows,
      rowCount,
      fields,
      executionTime,
      command: result.command,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error('Query execution failed', {
      connectionId: request.connectionId,
      database: request.database || connection.defaultDatabase,
      error,
      executionTime: `${executionTime}ms`,
    });

    throw parsePostgresError(error);
  } finally {
    if (client) {
      client.release();
    }
  }
}

function parsePostgresError(error: unknown): ApiError {
  if (error instanceof Error) {
    const pgError = error as Error & {
      code?: string;
      detail?: string;
      hint?: string;
      position?: string;
      line?: string;
      column?: string;
    };

    const apiError = new ApiError(pgError.message, 400, pgError.code);
    apiError.detail = pgError.detail;
    apiError.hint = pgError.hint;

    return apiError;
  }

  return new ApiError('Unknown query execution error', 500);
}

// Map PostgreSQL OID to type name
function getPostgresTypeName(oid: number): string {
  const typeMap: Record<number, string> = {
    16: 'bool',
    17: 'bytea',
    20: 'int8',
    21: 'int2',
    23: 'int4',
    25: 'text',
    26: 'oid',
    700: 'float4',
    701: 'float8',
    1043: 'varchar',
    1082: 'date',
    1083: 'time',
    1114: 'timestamp',
    1184: 'timestamptz',
    1186: 'interval',
    1266: 'timetz',
    1700: 'numeric',
    2950: 'uuid',
    3802: 'jsonb',
    114: 'json',
  };

  return typeMap[oid] || `oid_${oid}`;
}
