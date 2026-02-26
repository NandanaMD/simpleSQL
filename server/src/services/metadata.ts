import { Database, Schema, Table, TableStructure, Column, Index, Constraint } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import * as connectionService from './connections';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

export function getDatabases(connectionId: string): Database[] {
  const connection = connectionService.getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  // In SQLite, each database is a file in the data directory
  // List all database files for this connection
  const dataDir = path.join(process.cwd(), 'data');
  const databases: Database[] = [];

  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir);
    const prefix = `${connectionId}_`;
    
    for (const file of files) {
      // Only include files for this connection
      if (file.startsWith(prefix) && file.endsWith('.db')) {
        // Clean database name: remove connectionId prefix and .db extension
        const dbName = file.slice(prefix.length, -3); // Remove prefix and '.db'
        const filePath = path.join(dataDir, file);
        
        try {
          const stats = fs.statSync(filePath);
          const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

          databases.push({
            name: dbName,
            owner: 'local',
            encoding: 'UTF-8',
            size: `${sizeInMB} MB`,
          });
        } catch (error) {
          logger.warn('Failed to stat database file', { file, error });
        }
      }
    }
  }

  // If no databases found, include the default database as placeholder
  if (databases.length === 0 && connection.defaultDatabase) {
    databases.push({
      name: connection.defaultDatabase,
      owner: 'local',
      encoding: 'UTF-8',
      size: '0 MB',
    });
  }

  logger.info('Retrieved databases for SQLite connection', { 
    connectionId, 
    count: databases.length,
    databases: databases.map(db => db.name)
  });

  return databases.sort((a, b) => a.name.localeCompare(b.name));
}

export function getSchemas(connectionId: string, database: string): Schema[] {
  const connection = connectionService.getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  // SQLite doesn't have separate schemas like PostgreSQL
  // Return a single 'main' schema
  logger.info('Retrieved schemas', { connectionId, database, count: 1 });

  return [
    {
      name: 'main',
      owner: 'local',
    },
  ];
}

export function getTables(connectionId: string, database: string, schema: string): Table[] {
  const connection = connectionService.getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  const db = connectionService.getDatabase(connection, database);

  try {
    const result = db.execute(`
      SELECT 
        name,
        type
      FROM sqlite_master
      WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    const tables: Table[] = [];

    for (const row of result.rows) {
      const tableName = row.name as string;
      const tableType = row.type as string;

      let rowCount: number | undefined;

      // Get row count for tables
      if (tableType === 'table') {
        try {
          const countResult = db.execute(`SELECT COUNT(*) as count FROM "${tableName}"`);
          rowCount = countResult.rows[0]?.count as number;
        } catch (error) {
          logger.warn('Failed to get row count', { table: tableName, error });
        }
      }

      tables.push({
        name: tableName,
        schema: 'main',
        type: tableType as 'table' | 'view',
        rowCount,
        size: undefined,
      });
    }

    logger.info('Retrieved tables', { connectionId, database, schema, count: tables.length });

    return tables;
  } catch (error) {
    logger.error('Failed to retrieve tables', { connectionId, database, error });
    throw new ApiError('Failed to retrieve tables', 500);
  }
}

export function getTableStructure(
  connectionId: string,
  database: string,
  schema: string,
  tableName: string
): TableStructure {
  const connection = connectionService.getConnectionById(connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
  }

  const db = connectionService.getDatabase(connection, database);

  try {
    // Get table info
    const tableResult = db.execute(`
      SELECT name, type
      FROM sqlite_master
      WHERE name = ? AND type IN ('table', 'view')
    `, [tableName]);

    if (tableResult.rows.length === 0) {
      throw new ApiError('Table not found', 404);
    }

    const table: Table = {
      name: tableResult.rows[0].name as string,
      schema: 'main',
      type: tableResult.rows[0].type as 'table' | 'view',
    };

    // Get columns using PRAGMA
    const columnsResult = db.execute(`PRAGMA table_info("${tableName}")`);

    const columns: Column[] = columnsResult.rows.map((row: Record<string, unknown>) => ({
      name: row.name as string,
      dataType: row.type as string || 'TEXT',
      isNullable: (row.notnull as number) === 0,
      defaultValue: row.dflt_value as string | null,
      maxLength: null,
      precision: null,
      scale: null,
      isPrimaryKey: (row.pk as number) > 0,
      isUnique: false, // Will be updated from index info
      comment: null,
    }));

    // Get indexes
    const indexListResult = db.execute(`PRAGMA index_list("${tableName}")`);
    const indexes: Index[] = [];

    for (const idxRow of indexListResult.rows) {
      const indexName = idxRow.name as string;
      const isUnique = (idxRow.unique as number) === 1;
      const origin = idxRow.origin as string;

      // Get index columns
      const indexInfoResult = db.execute(`PRAGMA index_info("${indexName}")`);
      const indexColumns = indexInfoResult.rows.map(col => col.name as string);

      // Mark columns as unique if in a unique index
      if (isUnique && indexColumns.length === 1) {
        const column = columns.find(c => c.name === indexColumns[0]);
        if (column) {
          column.isUnique = true;
        }
      }

      indexes.push({
        name: indexName,
        columns: indexColumns,
        isUnique,
        isPrimary: origin === 'pk',
        indexType: 'btree',
        definition: `INDEX ${indexName} ON ${tableName} (${indexColumns.join(', ')})`,
      });
    }

    // Get constraints
    const constraints: Constraint[] = [];

    // Primary key constraint
    const pkColumns = columns.filter(c => c.isPrimaryKey).map(c => c.name);
    if (pkColumns.length > 0) {
      constraints.push({
        name: 'PRIMARY',
        type: 'PRIMARY KEY',
        definition: `PRIMARY KEY (${pkColumns.join(', ')})`,
        columns: pkColumns,
      });
    }

    // Foreign keys
    const fkResult = db.execute(`PRAGMA foreign_key_list("${tableName}")`);
    const fkMap = new Map<number, any[]>();

    for (const fkRow of fkResult.rows) {
      const fkId = fkRow.id as number;
      if (!fkMap.has(fkId)) {
        fkMap.set(fkId, []);
      }
      fkMap.get(fkId)!.push(fkRow);
    }

    let fkIndex = 0;
    for (const [_, fkRows] of fkMap) {
      const firstRow = fkRows[0];
      const fromCols = fkRows.map(r => r.from as string);
      const toCols = fkRows.map(r => r.to as string);
      const refTable = firstRow.table as string;

      constraints.push({
        name: `fk_${tableName}_${fkIndex++}`,
        type: 'FOREIGN KEY',
        definition: `FOREIGN KEY (${fromCols.join(', ')}) REFERENCES ${refTable} (${toCols.join(', ')})`,
        columns: fromCols,
      });
    }

    logger.info('Retrieved table structure', { connectionId, database, schema, table: tableName });

    return {
      table,
      columns,
      indexes,
      constraints,
    };
  } catch (error) {
    logger.error('Failed to retrieve table structure', { connectionId, database, table: tableName, error });
    
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to retrieve table structure', 500);
  }
}
