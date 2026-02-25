import { Database, Schema, Table, TableStructure, Column, Index, Constraint } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import * as connectionService from './connections';
import logger from '../utils/logger';

export async function getDatabases(connectionId: string): Promise<Database[]> {
  const connection = connectionService.getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  const pool = connectionService.createPool(connection);
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        datname as name,
        pg_catalog.pg_get_userbyid(datdba) as owner,
        pg_encoding_to_char(encoding) as encoding,
        pg_size_pretty(pg_database_size(datname)) as size
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `);

    logger.info('Retrieved databases', { connectionId, count: result.rowCount });

    return result.rows as Database[];
  } finally {
    client.release();
  }
}

export async function getSchemas(connectionId: string, database: string): Promise<Schema[]> {
  const connection = connectionService.getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  const pool = connectionService.createPool(connection, database);
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        schema_name as name,
        schema_owner as owner
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);

    logger.info('Retrieved schemas', { connectionId, database, count: result.rowCount });

    return result.rows as Schema[];
  } finally {
    client.release();
  }
}

export async function getTables(connectionId: string, database: string, schema: string): Promise<Table[]> {
  const connection = connectionService.getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  const pool = connectionService.createPool(connection, database);
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        t.table_name as name,
        t.table_schema as schema,
        CASE 
          WHEN t.table_type = 'BASE TABLE' THEN 'table'
          WHEN t.table_type = 'VIEW' THEN 'view'
          ELSE 'table'
        END as type,
        pg_size_pretty(pg_total_relation_size('"' || t.table_schema || '"."' || t.table_name || '"')) as size
      FROM information_schema.tables t
      WHERE t.table_schema = $1
        AND t.table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY t.table_name
    `, [schema]);

    // Get row counts for tables (not views)
    const tables: Table[] = [];
    for (const row of result.rows) {
      let rowCount: number | undefined;

      if (row.type === 'table') {
        try {
          const countResult = await client.query(
            `SELECT COUNT(*) as count FROM "${schema}"."${row.name}"`
          );
          rowCount = parseInt(countResult.rows[0].count, 10);
        } catch (error) {
          // Skip count if query fails
          logger.warn('Failed to get row count', { schema, table: row.name, error });
        }
      }

      tables.push({
        name: row.name,
        schema: row.schema,
        type: row.type,
        size: row.size,
        rowCount,
      });
    }

    logger.info('Retrieved tables', { connectionId, database, schema, count: tables.length });

    return tables;
  } finally {
    client.release();
  }
}

export async function getTableStructure(
  connectionId: string,
  database: string,
  schema: string,
  tableName: string
): Promise<TableStructure> {
  const connection = connectionService.getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  const pool = connectionService.createPool(connection, database);
  const client = await pool.connect();

  try {
    // Get table info
    const tableResult = await client.query(`
      SELECT 
        table_name as name,
        table_schema as schema,
        CASE 
          WHEN table_type = 'BASE TABLE' THEN 'table'
          WHEN table_type = 'VIEW' THEN 'view'
          ELSE 'table'
        END as type
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2
    `, [schema, tableName]);

    if (tableResult.rows.length === 0) {
      throw new ApiError('Table not found', 404);
    }

    const table: Table = tableResult.rows[0];

    // Get columns
    const columnsResult = await client.query(`
      SELECT 
        c.column_name as name,
        c.data_type as data_type,
        c.is_nullable = 'YES' as is_nullable,
        c.column_default as default_value,
        c.character_maximum_length as max_length,
        c.numeric_precision as precision,
        c.numeric_scale as scale,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
        CASE WHEN u.column_name IS NOT NULL THEN true ELSE false END as is_unique,
        pgd.description as comment
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku 
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      ) pk ON c.column_name = pk.column_name
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku 
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = $1
          AND tc.table_name = $2
      ) u ON c.column_name = u.column_name
      LEFT JOIN pg_catalog.pg_statio_all_tables st 
        ON st.schemaname = c.table_schema AND st.relname = c.table_name
      LEFT JOIN pg_catalog.pg_description pgd 
        ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `, [schema, tableName]);

    const columns: Column[] = columnsResult.rows.map((row: Record<string, unknown>) => ({
      name: row.name as string,
      dataType: row.data_type as string,
      isNullable: row.is_nullable as boolean,
      defaultValue: row.default_value as string | null,
      maxLength: row.max_length as number | null,
      precision: row.precision as number | null,
      scale: row.scale as number | null,
      isPrimaryKey: row.is_primary_key as boolean,
      isUnique: row.is_unique as boolean,
      comment: row.comment as string | null,
    }));

    // Get indexes
    const indexesResult = await client.query(`
      SELECT
        i.indexname as name,
        array_agg(a.attname ORDER BY a.attnum) as columns,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary,
        am.amname as index_type,
        pg_get_indexdef(ix.indexrelid) as definition
      FROM pg_indexes i
      JOIN pg_class c ON c.relname = i.indexname
      JOIN pg_index ix ON ix.indexrelid = c.oid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_am am ON am.oid = c.relam
      WHERE i.schemaname = $1 AND i.tablename = $2
      GROUP BY i.indexname, ix.indisunique, ix.indisprimary, am.amname, ix.indexrelid
      ORDER BY i.indexname
    `, [schema, tableName]);

    const indexes: Index[] = indexesResult.rows.map((row: Record<string, unknown>) => ({
      name: row.name as string,
      columns: row.columns as string[],
      isUnique: row.is_unique as boolean,
      isPrimary: row.is_primary as boolean,
      indexType: row.index_type as string,
      definition: row.definition as string,
    }));

    // Get constraints
    const constraintsResult = await client.query(`
      SELECT
        tc.constraint_name as name,
        tc.constraint_type as type,
        pg_get_constraintdef(pgc.oid) as definition,
        array_agg(kcu.column_name) as columns
      FROM information_schema.table_constraints tc
      JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1 AND tc.table_name = $2
      GROUP BY tc.constraint_name, tc.constraint_type, pgc.oid
      ORDER BY tc.constraint_name
    `, [schema, tableName]);

    const constraints: Constraint[] = constraintsResult.rows.map((row: Record<string, unknown>) => ({
      name: row.name as string,
      type: row.type as 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK',
      definition: row.definition as string,
      columns: (row.columns as (string | null)[]).filter((c): c is string => c !== null),
    }));

    logger.info('Retrieved table structure', { connectionId, database, schema, table: tableName });

    return {
      table,
      columns,
      indexes,
      constraints,
    };
  } finally {
    client.release();
  }
}
