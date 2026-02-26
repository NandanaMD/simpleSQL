import { Readable } from 'stream';
import { parse } from 'csv-parse';
import { CSVImportRequest, CSVImportResult, CSVImportError, CSVPreview } from '@sql-ide/shared';
import { ApiError } from '../middleware/errorHandler';
import * as connectionService from './connections';
import logger from '../utils/logger';
import appConfig from '../config';

export async function previewCSV(buffer: Buffer, filename: string): Promise<CSVPreview> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    let headers: string[] = [];
    const inferredTypes: Record<string, string> = {};
    let rowCount = 0;
    let isFirstRow = true;

    logger.info('CSV parsing started', { 
      filename, 
      bufferSize: buffer.length,
      firstChars: buffer.toString('utf8', 0, Math.min(200, buffer.length))
    });

    const fileStream = Readable.from(buffer);

    // Use parse without columns to get raw arrays
    const parser = parse({
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
      cast: false,
    });

    // Use 'data' event instead of 'readable' - this is the reliable pattern
    parser.on('data', (record: string[]) => {
      if (isFirstRow) {
        // First row contains headers
        headers = record.filter(h => h && h.trim());
        isFirstRow = false;
        
        // Initialize inferredTypes for each header
        headers.forEach((header) => {
          inferredTypes[header] = 'TEXT';
        });
        
        logger.info('CSV headers detected from first row', { 
          filename, 
          headers, 
          count: headers.length 
        });
      } else {
        // Data rows
        rowCount++;
        
        // Build row object
        const rowObj: Record<string, string> = {};
        headers.forEach((header, idx) => {
          const value = record[idx] || '';
          rowObj[header] = value;
          
          // Infer types from actual data
          if (value && inferredTypes[header] === 'TEXT') {
            inferredTypes[header] = inferSQLiteType(value);
          }
        });
        
        // Collect sample rows
        if (rows.length < appConfig.csv.sampleRows) {
          rows.push(rowObj);
        }
      }
    });

    parser.on('error', (error: Error) => {
      logger.error('CSV parsing error', { 
        filename, 
        error: error.message, 
        stack: error.stack 
      });
      reject(new ApiError(`CSV parsing failed: ${error.message}`, 400));
    });

    parser.on('end', () => {
      // Validate we got headers
      if (headers.length === 0) {
        logger.error('CSV has no valid columns', { 
          filename, 
          headerCount: headers.length,
          rowCount, 
          bufferSize: buffer.length
        });
        reject(new ApiError('CSV file has no valid columns. Please ensure the file has a header row with column names.', 400));
        return;
      }

      logger.info('CSV preview completed successfully', { 
        filename, 
        headerCount: headers.length, 
        rowCount, 
        sampleRows: rows.length,
        headers: headers
      });
      
      resolve({
        headers,
        rows,
        inferredTypes,
        rowCount,
      });
    });

    fileStream.pipe(parser);
  });
}

export function importCSV(
  buffer: Buffer,
  filename: string,
  request: CSVImportRequest
): CSVImportResult {
  const connection = connectionService.getConnectionById(request.connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${request.connectionId}" not found`, 404);
  }

  const db = connectionService.getDatabase(connection, request.database);

  const startTime = Date.now();

  try {
    // Use transaction for atomic import
    const result = db.transaction(() => {
      // Create table if needed
      if (request.createTable) {
        const columns = request.columnMappings
          .map((col) => {
            const sqliteType = mapToSQLiteType(col.dataType);
            const nullable = col.nullable ? '' : 'NOT NULL';
            return `"${col.tableColumn}" ${sqliteType} ${nullable}`;
          })
          .join(', ');

        const createTableSQL = `CREATE TABLE IF NOT EXISTS "${request.tableName}" (${columns})`;

        db.execute(createTableSQL);
        logger.info('Created table for CSV import', {
          table: request.tableName,
        });
      }

      // Validate table exists
      const tableCheck = db.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `, [request.tableName]);

      if (tableCheck.rows.length === 0) {
        throw new Error(`Table "${request.tableName}" does not exist`);
      }

      // Parse and validate all rows first
      const allRows: Record<string, string>[] = [];
      const parseErrors: CSVImportError[] = [];

      // Synchronous CSV parsing
      const csvContent = buffer.toString('utf-8');
      const lines = csvContent.split(/\r?\n/);
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Parse header
      const headerLine = lines[0];
      const headers: string[] = [];
      let inQuote = false;
      let currentField = '';

      for (let i = 0; i < headerLine.length; i++) {
        const char = headerLine[i];
        
        if (char === '"') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          headers.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      headers.push(currentField.trim());

      // Validate headers match mappings
      for (const mapping of request.columnMappings) {
        if (!headers.includes(mapping.csvColumn)) {
          throw new Error(`CSV column "${mapping.csvColumn}" not found in file`);
        }
      }

      // Parse data rows
      for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
        const line = lines[rowIndex].trim();
        if (!line) continue;

        const values: string[] = [];
        inQuote = false;
        currentField = '';

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          
          if (char === '"') {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
            values.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
        values.push(currentField.trim());

        // Build row object
        const rowObj: Record<string, string> = {};
        headers.forEach((header, idx) => {
          rowObj[header] = values[idx] || '';
        });

        allRows.push(rowObj);
      }

      logger.info('Parsed CSV data', {
        filename,
        headerCount: headers.length,
        rowCount: allRows.length,
      });

      // Validate all rows before inserting
      const validatedRows: unknown[][] = [];

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const rowNumber = i + 2; // +2 because of header and 1-indexed

        try {
          const values = request.columnMappings.map((col) => {
            const value = row[col.csvColumn];
            return convertAndValidateValue(value, col.dataType, col.nullable, col.tableColumn);
          });

          validatedRows.push(values);
        } catch (error) {
          // Validation failed - abort immediately
          if (error instanceof ValidationError) {
            throw new ApiError(
              `Import failed at row ${rowNumber}. Column '${error.column}' ${error.reason}. The entire import has been rolled back.`,
              400
            );
          }
          throw error;
        }
      }

      // All rows validated - now insert them in batches for performance
      const columnNames = request.columnMappings.map((col) => `"${col.tableColumn}"`).join(', ');
      const placeholders = request.columnMappings.map(() => `?`).join(', ');
      const insertSQL = `INSERT INTO "${request.tableName}" (${columnNames}) VALUES (${placeholders})`;

      let rowsInserted = 0;
      const batchSize = appConfig.query.batchInsertSize;

      // Prepare statement once for reuse (cached by dbAdapter)
      for (let i = 0; i < validatedRows.length; i += batchSize) {
        const batch = validatedRows.slice(i, Math.min(i + batchSize, validatedRows.length));
        
        // Insert batch using prepared statement
        for (let j = 0; j < batch.length; j++) {
          const values = batch[j];
          const rowNumber = i + j + 2;

          try {
            db.execute(insertSQL, values);
            rowsInserted++;
          } catch (error) {
            // Insert failed - this will trigger transaction rollback
            const errorMsg = error instanceof Error ? error.message : 'Insert failed';
            
            // Extract constraint info from SQLite error
            let naturalMessage = `Import failed at row ${rowNumber}. ${errorMsg}. The entire import has been rolled back.`;

            if (errorMsg.includes('UNIQUE constraint failed')) {
              const match = errorMsg.match(/UNIQUE constraint failed: .*?\.(\w+)/);
              const column = match ? match[1] : 'unknown';
              const value = values[request.columnMappings.findIndex(m => m.tableColumn === column)];
              naturalMessage = `Import failed at row ${rowNumber}. Duplicate value '${value}' violates UNIQUE constraint on column '${column}'. No data has been imported.`;
            } else if (errorMsg.includes('NOT NULL constraint failed')) {
              const match = errorMsg.match(/NOT NULL constraint failed: .*?\.(\w+)/);
              const column = match ? match[1] : 'unknown';
              naturalMessage = `Import failed at row ${rowNumber}. Column '${column}' cannot be NULL. No data has been imported.`;
            } else if (errorMsg.includes('FOREIGN KEY constraint failed')) {
              naturalMessage = `Import failed at row ${rowNumber}. Foreign key constraint violation. No data has been imported.`;
            }

            throw new ApiError(naturalMessage, 400);
          }
        }
        
        logger.info('Batch inserted', {
          filename,
          batchStart: i + 1,
          batchEnd: Math.min(i + batchSize, validatedRows.length),
          totalRows: validatedRows.length
        });
      }

      return { rowsInserted, errors: parseErrors };
    });

    const duration = Date.now() - startTime;

    logger.info('CSV import completed successfully', {
      filename,
      table: request.tableName,
      rowsInserted: result.rowsInserted,
      duration: `${duration}ms`,
    });

    return {
      success: true,
      rowsInserted: result.rowsInserted,
      duration,
      errors: result.errors,
      message: `Successfully imported ${result.rowsInserted}  rows`,
    };
  } catch (error) {
    logger.error('CSV import failed', { filename, error });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'CSV import failed',
      500
    );
  }
}

class ValidationError extends Error {
  constructor(public column: string, public reason: string) {
    super(`Validation failed for column ${column}: ${reason}`);
    this.name = 'ValidationError';
  }
}

function inferSQLiteType(value: string): string {
  if (!value) return 'TEXT';

  // Check integer
  if (/^-?\d+$/.test(value)) {
    return 'INTEGER';
  }

  // Check float
  if (/^-?\d*\.\d+$/.test(value)) {
    return 'REAL';
  }

  // Check boolean
  if (/^(true|false|t|f|yes|no|1|0)$/i.test(value)) {
    return 'INTEGER';
  }

  return 'TEXT';
}

function mapToSQLiteType(pgType: string): string {
  const lowerType = pgType.toLowerCase();

  if (lowerType.includes('int') || lowerType.includes('serial')) {
    return 'INTEGER';
  }

  if (lowerType.includes('numeric') || lowerType.includes('decimal') || 
      lowerType.includes('float') || lowerType.includes('double') || 
      lowerType.includes('real')) {
    return 'REAL';
  }

  if (lowerType.includes('bool')) {
    return 'INTEGER';
  }

  if (lowerType.includes('blob') || lowerType.includes('bytea')) {
    return 'BLOB';
  }

  return 'TEXT';
}

function convertAndValidateValue(
  value: string,
  dataType: string,
  nullable: boolean,
  columnName: string
): unknown {
  // Handle null values
  if (!value || value === '') {
    if (!nullable) {
      throw new ValidationError(columnName, 'cannot be empty (NOT NULL constraint)');
    }
    return null;
  }

  const lowerType = dataType.toLowerCase();

  // INTEGER validation (with smart boolean conversion)
  if (lowerType.includes('int') || lowerType.includes('serial')) {
    // Check if value looks like a boolean (Yes/No, True/False, etc.)
    if (/^(true|t|yes|y)$/i.test(value)) {
      return 1;
    }
    if (/^(false|f|no|n)$/i.test(value)) {
      return 0;
    }
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new ValidationError(columnName, `expected an INTEGER but received '${value}'. Hint: Use 1/0 for boolean values.`);
    }
    return parsed;
  }

  // REAL/NUMERIC validation (with smart boolean conversion)
  if (lowerType.includes('numeric') || lowerType.includes('decimal') || 
      lowerType.includes('float') || lowerType.includes('double') || 
      lowerType.includes('real')) {
    // Check if value looks like a boolean
    if (/^(true|t|yes|y)$/i.test(value)) {
      return 1.0;
    }
    if (/^(false|f|no|n)$/i.test(value)) {
      return 0.0;
    }
    
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new ValidationError(columnName, `expected a REAL number but received '${value}'`);
    }
    return parsed;
  }

  // BOOLEAN validation
  if (lowerType.includes('bool')) {
    if (/^(true|t|yes|y|1)$/i.test(value)) {
      return 1;
    }
    if (/^(false|f|no|n|0)$/i.test(value)) {
      return 0;
    }
    throw new ValidationError(columnName, `expected a BOOLEAN but received '${value}'`);
  }

  // TEXT - return as-is
  return value;
}
