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
          inferredTypes[header] = 'text';
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
          if (value && inferredTypes[header] === 'text') {
            inferredTypes[header] = inferType(value);
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

export async function importCSV(
  buffer: Buffer,
  filename: string,
  request: CSVImportRequest
): Promise<CSVImportResult> {
  const connection = connectionService.getConnectionById(request.connectionId);

  if (!connection) {
    throw new ApiError(`Connection with id "${request.connectionId}" not found`, 404);
  }

  const pool = connectionService.createPool(connection, request.database);
  let client;
  
  try {
    client = await pool.connect();
  } catch (error) {
    logger.error('Failed to connect to database for import', { error });
    throw new ApiError(
      `Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }

  const startTime = Date.now();
  const errors: CSVImportError[] = [];

  try {
    await client.query('BEGIN');

    // Create table if needed
    if (request.createTable) {
      const columns = request.columnMappings
        .map((col) => `"${col.tableColumn}" ${col.dataType} ${col.nullable ? '' : 'NOT NULL'}`)
        .join(', ');

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS "${request.schema}"."${request.tableName}" (${columns})
      `;

      await client.query(createTableSQL);
      logger.info('Created table for CSV import', {
        schema: request.schema,
        table: request.tableName,
      });
    }

    // Prepare insert statement
    const columnNames = request.columnMappings.map((col) => `"${col.tableColumn}"`).join(', ');
    const placeholders = request.columnMappings
      .map((_, idx) => `$${idx + 1}`)
      .join(', ');
    const insertSQL = `
      INSERT INTO "${request.schema}"."${request.tableName}" (${columnNames})
      VALUES (${placeholders})
    `;

    // Parse and insert CSV data
    let rowsInserted = 0;
    let currentRow = 0;
    let batch: unknown[][] = [];

    // Create stream from buffer
    const fileStream = Readable.from(buffer);

    await new Promise<void>((resolve, reject) => {
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true, // Handle byte order mark
        cast: false, // Keep all values as strings
      });

      parser.on('data', (row: Record<string, string>) => {
        currentRow++;

        try {
          const values = request.columnMappings.map((col) => {
            const value = row[col.csvColumn];
            return convertValue(value, col.dataType);
          });

          batch.push(values);

          // Insert batch
          if (batch.length >= appConfig.query.batchInsertSize) {
            parser.pause();

            Promise.all(batch.map((vals) => client.query(insertSQL, vals)))
              .then(() => {
                rowsInserted += batch.length;
                batch = [];
                parser.resume();
              })
              .catch((error) => {
                errors.push({
                  row: currentRow,
                  message: error instanceof Error ? error.message : 'Insert failed',
                });
                batch = [];
                parser.resume();
              });
          }
        } catch (error) {
          errors.push({
            row: currentRow,
            message: error instanceof Error ? error.message : 'Conversion failed',
          });
        }
      });

      parser.on('error', (error: Error) => {
        reject(new ApiError(`CSV parsing failed: ${error.message}`, 400));
      });

      parser.on('end', async () => {
        // Insert remaining batch
        if (batch.length > 0) {
          try {
            await Promise.all(batch.map((vals) => client.query(insertSQL, vals)));
            rowsInserted += batch.length;
          } catch (error) {
            errors.push({
              row: currentRow,
              message: error instanceof Error ? error.message : 'Insert failed',
            });
          }
        }
        resolve();
      });

      fileStream.pipe(parser);
    });

    await client.query('COMMIT');

    const duration = Date.now() - startTime;

    logger.info('CSV import completed', {
      filename,
      schema: request.schema,
      table: request.tableName,
      rowsInserted,
      errors: errors.length,
      duration: `${duration}ms`,
    });

    return {
      success: true,
      rowsInserted,
      duration,
      errors,
      message: `Successfully imported ${rowsInserted} rows${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
    };
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Rollback failed', { rollbackError });
      }
    }

    logger.error('CSV import failed', { filename, error });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'CSV import failed',
      500
    );
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        logger.error('Failed to release database client', { releaseError });
      }
    }
  }
}

function inferType(value: string): string {
  if (!value) return 'text';

  // Check integer
  if (/^-?\d+$/.test(value)) {
    const num = parseInt(value, 10);
    if (num >= -2147483648 && num <= 2147483647) {
      return 'integer';
    }
    return 'bigint';
  }

  // Check float
  if (/^-?\d*\.\d+$/.test(value)) {
    return 'numeric';
  }

  // Check boolean
  if (/^(true|false|t|f|yes|no|1|0)$/i.test(value)) {
    return 'boolean';
  }

  // Check date
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'date';
  }

  // Check timestamp
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(value)) {
    return 'timestamp';
  }

  return 'text';
}

function convertValue(value: string, dataType: string): unknown {
  if (!value || value === '') {
    return null;
  }

  const lowerType = dataType.toLowerCase();

  if (lowerType.includes('int') || lowerType.includes('serial')) {
    return parseInt(value, 10);
  }

  if (lowerType.includes('numeric') || lowerType.includes('decimal') || lowerType.includes('float') || lowerType.includes('double')) {
    return parseFloat(value);
  }

  if (lowerType.includes('bool')) {
    return /^(true|t|yes|1)$/i.test(value);
  }

  if (lowerType.includes('json')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}
