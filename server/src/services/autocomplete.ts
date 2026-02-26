import { ApiError } from '../middleware/errorHandler';
import * as connectionService from './connections';
import * as metadataService from './metadata';
import logger from '../utils/logger';

export interface AutocompleteSuggestion {
  label: string;
  kind: 'keyword' | 'table' | 'column' | 'function' | 'database';
  detail?: string;
  documentation?: string;
  insertText?: string;
  tableName?: string; // For columns, which table they belong to
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'DATABASE', 'INDEX',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS',
  'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'DISTINCT', 'ALL', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'UNION', 'INTERSECT', 'EXCEPT',
  'PRIMARY', 'KEY', 'FOREIGN', 'UNIQUE', 'CHECK', 'DEFAULT',
  'CASCADE', 'RESTRICT', 'NO', 'ACTION',
  'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
  'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'TRANSACTION', 'BEGIN',
  'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATE', 'DATETIME',
  'VARCHAR', 'CHAR', 'INT', 'BIGINT', 'SMALLINT', 'FLOAT', 'DOUBLE',
];

const SQL_FUNCTIONS = [
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'UPPER', 'LOWER', 'LENGTH', 'SUBSTR', 'TRIM', 'LTRIM', 'RTRIM',
  'REPLACE', 'ROUND', 'ABS', 'COALESCE', 'NULLIF',
  'DATE', 'TIME', 'DATETIME', 'JULIANDAY', 'STRFTIME',
  'CAST', 'TYPEOF', 'IFNULL', 'RANDOM', 'HEX',
];

export function getAutocompleteSuggestions(
  connectionId: string,
  database: string
): AutocompleteSuggestion[] {
  const suggestions: AutocompleteSuggestion[] = [];

  try {
    const connection = connectionService.getConnectionById(connectionId);
    if (!connection) {
      throw new ApiError(`Connection with id "${connectionId}" not found`, 404);
    }

    // Add SQL keywords
    SQL_KEYWORDS.forEach((keyword) => {
      suggestions.push({
        label: keyword,
        kind: 'keyword',
        detail: 'SQL Keyword',
        insertText: keyword,
      });
    });

    // Add SQL functions
    SQL_FUNCTIONS.forEach((func) => {
      suggestions.push({
        label: func,
        kind: 'function',
        detail: 'SQL Function',
        insertText: `${func}()`,
        documentation: `Built-in SQL function: ${func}`,
      });
    });

    // Add databases
    try {
      const databases = metadataService.getDatabases(connectionId);
      databases.forEach((db) => {
        suggestions.push({
          label: db.name,
          kind: 'database',
          detail: 'Database',
          documentation: `Database: ${db.name} (${db.size})`,
        });
      });
    } catch (error) {
      logger.warn('Failed to fetch databases for autocomplete', { error });
    }

    // Add tables from current database
    try {
      const tables = metadataService.getTables(connectionId, database, 'main');
      tables.forEach((table) => {
        suggestions.push({
          label: table.name,
          kind: 'table',
          detail: table.type === 'view' ? 'View' : 'Table',
          documentation: `${table.type === 'view' ? 'View' : 'Table'}: ${table.name} (${table.rowCount} rows)`,
        });

        // For each table, get its columns
        try {
          const structure = metadataService.getTableStructure(
            connectionId,
            database,
            'main',
            table.name
          );

          structure.columns.forEach((column) => {
            suggestions.push({
              label: column.name,
              kind: 'column',
              detail: `${table.name}.${column.name}`,
              documentation: `Column: ${column.name} (${column.dataType})${column.isNullable ? ' NULL' : ' NOT NULL'}${column.defaultValue ? ` DEFAULT ${column.defaultValue}` : ''}`,
              insertText: column.name,
              tableName: table.name,
            });
          });
        } catch (error) {
          logger.warn('Failed to fetch columns for table', { table: table.name, error });
        }
      });
    } catch (error) {
      logger.warn('Failed to fetch tables for autocomplete', { error });
    }

    logger.info('Generated autocomplete suggestions', {
      connectionId,
      database,
      count: suggestions.length,
    });
  } catch (error) {
    logger.error('Error generating autocomplete suggestions', { error });
    throw error;
  }

  return suggestions;
}
