/**
 * SimpleSyntax Parser
 * Translates simplified SQL commands to standard SQL
 * Pure, deterministic translation layer - no AI/LLM
 */

export interface TranslationResult {
  success: boolean;
  sql: string | null;
  error: {
    token: string;
    position: number;
    message: string;
  } | null;
}

interface Token {
  value: string;
  position: number;
}

/**
 * Tokenize input while preserving quoted strings
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let current = '';
  let position = 0;
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuote) {
      current += char;
      if (char === quoteChar && input[i - 1] !== '\\') {
        inQuote = false;
      }
    } else if (char === "'" || char === '"') {
      if (current.trim()) {
        tokens.push({ value: current.trim(), position: position });
        position = i;
      }
      inQuote = true;
      quoteChar = char;
      current = char;
    } else if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      if (current.trim()) {
        tokens.push({ value: current.trim(), position: position });
      }
      current = '';
      position = i + 1;
    } else {
      if (current === '') position = i;
      current += char;
    }
  }

  if (current.trim()) {
    tokens.push({ value: current.trim(), position: position });
  }

  // Remove trailing semicolons
  if (tokens.length > 0 && tokens[tokens.length - 1].value === ';') {
    tokens.pop();
  }

  return tokens;
}

/**
 * Validate identifier (table/column name)
 */
function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Escape and validate string value
 */
function processStringValue(value: string): string {
  // If already quoted, validate and escape
  if ((value.startsWith("'") && value.endsWith("'")) || 
      (value.startsWith('"') && value.endsWith('"'))) {
    const inner = value.slice(1, -1);
    // Escape single quotes by doubling them
    return "'" + inner.replace(/'/g, "''") + "'";
  }
  throw new Error(`String values must be single-quoted: ${value}`);
}

/**
 * Process a value - could be string, number, boolean, or null
 */
function processValue(value: string): string {
  const lower = value.toLowerCase();
  
  // Handle null
  if (lower === 'null') {
    return 'NULL';
  }
  
  // Handle booleans
  if (lower === 'true') {
    return '1';
  }
  if (lower === 'false') {
    return '0';
  }
  
  // Handle numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return value;
  }
  
  // Must be a string - validate quoting
  return processStringValue(value);
}

/**
 * Parse WHERE clause
 * Returns SQL WHERE clause without the WHERE keyword
 */
function parseWhereClause(tokens: Token[], startIdx: number): { sql: string; nextIdx: number } {
  let idx = startIdx;
  const conditions: string[] = [];
  
  while (idx < tokens.length) {
    const token = tokens[idx];
    const lower = token.value.toLowerCase();
    
    // Stop at other clauses
    if (lower === 'order' || lower === 'limit' || lower === 'set') {
      break;
    }
    
    // Skip 'and'/'or' operators
    if (lower === 'and' || lower === 'or') {
      if (conditions.length === 0) {
        throw {
          token: token.value,
          position: token.position,
          message: `Invalid WHERE condition near '${token.value}'`
        };
      }
      conditions.push(lower.toUpperCase());
      idx++;
      continue;
    }
    
    // Parse condition: column operator value
    if (idx + 2 >= tokens.length) {
      throw {
        token: token.value,
        position: token.position,
        message: `Invalid WHERE condition near '${token.value}'`
      };
    }
    
    const column = tokens[idx].value;
    const operator = tokens[idx + 1].value;
    const value = tokens[idx + 2].value;
    
    if (!isValidIdentifier(column)) {
      throw {
        token: column,
        position: tokens[idx].position,
        message: `Invalid column name: ${column}`
      };
    }
    
    const opLower = operator.toLowerCase();
    let sqlOperator = operator;
    let sqlValue = processValue(value);
    
    // Handle special operators
    if (opLower === 'like') {
      sqlOperator = 'LIKE';
    } else if (opLower === '=' || opLower === '!=' || opLower === '<>' || 
               opLower === '>' || opLower === '<' || opLower === '>=' || opLower === '<=') {
      sqlOperator = operator;
      
      // Special handling for NULL
      if (value.toLowerCase() === 'null') {
        if (opLower === '=') {
          conditions.push(`${column} IS NULL`);
          idx += 3;
          continue;
        } else if (opLower === '!=' || opLower === '<>') {
          conditions.push(`${column} IS NOT NULL`);
          idx += 3;
          continue;
        }
      }
    } else {
      throw {
        token: operator,
        position: tokens[idx + 1].position,
        message: `Invalid operator: ${operator}`
      };
    }
    
    conditions.push(`${column} ${sqlOperator} ${sqlValue}`);
    idx += 3;
  }
  
  if (conditions.length === 0) {
    throw {
      token: tokens[startIdx]?.value || '',
      position: tokens[startIdx]?.position || 0,
      message: 'WHERE clause is empty'
    };
  }
  
  return {
    sql: conditions.join(' '),
    nextIdx: idx
  };
}

/**
 * Parse ORDER BY clause
 */
function parseOrderByClause(tokens: Token[], startIdx: number): { sql: string; nextIdx: number } {
  let idx = startIdx + 1; // Skip 'by'
  
  if (idx >= tokens.length) {
    throw {
      token: 'by',
      position: tokens[startIdx].position,
      message: 'ORDER BY requires at least one column name'
    };
  }
  
  const orderCols: string[] = [];
  
  while (idx < tokens.length) {
    const token = tokens[idx];
    const lower = token.value.toLowerCase();
    
    // Stop at LIMIT
    if (lower === 'limit') {
      break;
    }
    
    const column = token.value;
    if (!isValidIdentifier(column)) {
      throw {
        token: column,
        position: token.position,
        message: `Invalid column name in ORDER BY: ${column}`
      };
    }
    
    // Check for ASC/DESC
    if (idx + 1 < tokens.length) {
      const direction = tokens[idx + 1].value.toLowerCase();
      if (direction === 'asc' || direction === 'desc') {
        orderCols.push(`${column} ${direction.toUpperCase()}`);
        idx += 2;
      } else {
        throw {
          token: tokens[idx + 1].value,
          position: tokens[idx + 1].position,
          message: "ORDER BY requires 'asc' or 'desc' after column name"
        };
      }
    } else {
      throw {
        token: column,
        position: token.position,
        message: "ORDER BY requires 'asc' or 'desc' after column name"
      };
    }
  }
  
  if (orderCols.length === 0) {
    throw {
      token: tokens[startIdx].value,
      position: tokens[startIdx].position,
      message: 'ORDER BY requires at least one column'
    };
  }
  
  return {
    sql: orderCols.join(', '),
    nextIdx: idx
  };
}

/**
 * Parse LIMIT clause
 */
function parseLimitClause(tokens: Token[], startIdx: number): { sql: string; nextIdx: number } {
  const idx = startIdx + 1; // Skip 'limit'
  
  if (idx >= tokens.length) {
    throw {
      token: 'limit',
      position: tokens[startIdx].position,
      message: 'LIMIT requires a positive number'
    };
  }
  
  const value = tokens[idx].value;
  if (!/^\d+$/.test(value) || parseInt(value) <= 0) {
    throw {
      token: value,
      position: tokens[idx].position,
      message: 'LIMIT requires a positive number'
    };
  }
  
  return {
    sql: value,
    nextIdx: idx + 1
  };
}

/**
 * Parse SHOW command (SELECT)
 */
function parseShow(tokens: Token[]): string {
  if (tokens.length < 2) {
    throw {
      token: tokens[0]?.value || '',
      position: tokens[0]?.position || 0,
      message: "Expected table name after 'show'"
    };
  }
  
  const tableName = tokens[1].value;
  if (!isValidIdentifier(tableName)) {
    throw {
      token: tableName,
      position: tokens[1].position,
      message: `Invalid table name: ${tableName}`
    };
  }
  
  // Parse columns (optional)
  let columns = '*';
  let idx = 2;
  const columnList: string[] = [];
  
  while (idx < tokens.length) {
    const lower = tokens[idx].value.toLowerCase();
    if (lower === 'where' || lower === 'order' || lower === 'limit') {
      break;
    }
    
    const col = tokens[idx].value;
    if (!isValidIdentifier(col)) {
      throw {
        token: col,
        position: tokens[idx].position,
        message: `Invalid column name: ${col}`
      };
    }
    columnList.push(col);
    idx++;
  }
  
  if (columnList.length > 0) {
    columns = columnList.join(', ');
  }
  
  let sql = `SELECT ${columns} FROM ${tableName}`;
  
  // Parse WHERE clause
  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'where') {
    idx++; // Skip 'where'
    const whereResult = parseWhereClause(tokens, idx);
    sql += ` WHERE ${whereResult.sql}`;
    idx = whereResult.nextIdx;
  }
  
  // Parse ORDER BY clause
  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'order') {
    if (idx + 1 >= tokens.length || tokens[idx + 1].value.toLowerCase() !== 'by') {
      throw {
        token: tokens[idx].value,
        position: tokens[idx].position,
        message: "Expected 'by' after 'order'"
      };
    }
    const orderResult = parseOrderByClause(tokens, idx + 1);
    sql += ` ORDER BY ${orderResult.sql}`;
    idx = orderResult.nextIdx;
  }
  
  // Parse LIMIT clause
  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'limit') {
    const limitResult = parseLimitClause(tokens, idx);
    sql += ` LIMIT ${limitResult.sql}`;
    idx = limitResult.nextIdx;
  }
  
  // Check for unexpected tokens
  if (idx < tokens.length) {
    throw {
      token: tokens[idx].value,
      position: tokens[idx].position,
      message: `Unexpected token: ${tokens[idx].value}`
    };
  }
  
  return sql;
}

/**
 * Parse COUNT command
 */
function parseCount(tokens: Token[]): string {
  if (tokens.length < 2) {
    throw {
      token: tokens[0]?.value || '',
      position: tokens[0]?.position || 0,
      message: "Expected table name after 'count'"
    };
  }
  
  const tableName = tokens[1].value;
  if (!isValidIdentifier(tableName)) {
    throw {
      token: tableName,
      position: tokens[1].position,
      message: `Invalid table name: ${tableName}`
    };
  }
  
  let sql = `SELECT COUNT(*) FROM ${tableName}`;
  let idx = 2;
  
  // Parse WHERE clause
  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'where') {
    idx++; // Skip 'where'
    const whereResult = parseWhereClause(tokens, idx);
    sql += ` WHERE ${whereResult.sql}`;
    idx = whereResult.nextIdx;
  }
  
  // Check for unexpected tokens
  if (idx < tokens.length) {
    throw {
      token: tokens[idx].value,
      position: tokens[idx].position,
      message: `Unexpected token: ${tokens[idx].value}`
    };
  }
  
  return sql;
}

/**
 * Parse aggregate function (SUM, AVG, MIN, MAX)
 */
function parseAggregate(tokens: Token[], funcName: string): string {
  if (tokens.length < 3) {
    throw {
      token: tokens[0]?.value || '',
      position: tokens[0]?.position || 0,
      message: `Expected table name and column name after '${funcName.toLowerCase()}'`
    };
  }
  
  const tableName = tokens[1].value;
  const columnName = tokens[2].value;
  
  if (!isValidIdentifier(tableName)) {
    throw {
      token: tableName,
      position: tokens[1].position,
      message: `Invalid table name: ${tableName}`
    };
  }
  
  if (!isValidIdentifier(columnName)) {
    throw {
      token: columnName,
      position: tokens[2].position,
      message: `Invalid column name: ${columnName}`
    };
  }
  
  let sql = `SELECT ${funcName}(${columnName}) FROM ${tableName}`;
  let idx = 3;
  
  // Parse WHERE clause
  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'where') {
    idx++; // Skip 'where'
    const whereResult = parseWhereClause(tokens, idx);
    sql += ` WHERE ${whereResult.sql}`;
    idx = whereResult.nextIdx;
  }
  
  // Check for unexpected tokens
  if (idx < tokens.length) {
    throw {
      token: tokens[idx].value,
      position: tokens[idx].position,
      message: `Unexpected token: ${tokens[idx].value}`
    };
  }
  
  return sql;
}

/**
 * Parse GROUP command (GROUP BY)
 */
function parseGroup(tokens: Token[]): string {
  if (tokens.length < 4) {
    throw {
      token: tokens[0]?.value || '',
      position: tokens[0]?.position || 0,
      message: "Expected 'tablename by column' after 'group'"
    };
  }
  
  const tableName = tokens[1].value;
  if (!isValidIdentifier(tableName)) {
    throw {
      token: tableName,
      position: tokens[1].position,
      message: `Invalid table name: ${tableName}`
    };
  }
  
  if (tokens[2].value.toLowerCase() !== 'by') {
    throw {
      token: tokens[2].value,
      position: tokens[2].position,
      message: "Expected 'by' after table name in GROUP command"
    };
  }
  
  // Parse group by columns
  let idx = 3;
  const groupCols: string[] = [];
  
  while (idx < tokens.length) {
    const col = tokens[idx].value;
    if (!isValidIdentifier(col)) {
      throw {
        token: col,
        position: tokens[idx].position,
        message: `Invalid column name: ${col}`
      };
    }
    groupCols.push(col);
    idx++;
  }
  
  if (groupCols.length === 0) {
    throw {
      token: 'by',
      position: tokens[2].position,
      message: 'GROUP BY requires at least one column name'
    };
  }
  
  const selectCols = groupCols.join(', ');
  const groupByCols = groupCols.join(', ');
  
  return `SELECT ${selectCols}, COUNT(*) as count FROM ${tableName} GROUP BY ${groupByCols}`;
}

/**
 * Parse ADD command (INSERT)
 */
function parseAdd(tokens: Token[]): string {
  if (tokens.length < 3) {
    throw {
      token: tokens[0]?.value || '',
      position: tokens[0]?.position || 0,
      message: "Expected table name and column assignments after 'add'"
    };
  }
  
  const tableName = tokens[1].value;
  if (!isValidIdentifier(tableName)) {
    throw {
      token: tableName,
      position: tokens[1].position,
      message: `Invalid table name: ${tableName}`
    };
  }
  
  // Parse column=value pairs
  const assignments: { column: string; value: string }[] = [];
  
  for (let idx = 2; idx < tokens.length; idx++) {
    const token = tokens[idx].value;
    const parts = token.split('=');
    
    if (parts.length !== 2) {
      throw {
        token: token,
        position: tokens[idx].position,
        message: `Invalid column=value assignment near '${token}'`
      };
    }
    
    const column = parts[0].trim();
    const value = parts[1].trim();
    
    if (!isValidIdentifier(column)) {
      throw {
        token: column,
        position: tokens[idx].position,
        message: `Invalid column name: ${column}`
      };
    }
    
    assignments.push({ column, value: processValue(value) });
  }
  
  if (assignments.length === 0) {
    throw {
      token: tableName,
      position: tokens[1].position,
      message: 'INSERT requires at least one column=value assignment'
    };
  }
  
  // Sort columns alphabetically for consistency
  assignments.sort((a, b) => a.column.localeCompare(b.column));
  
  const columns = assignments.map(a => a.column).join(', ');
  const values = assignments.map(a => a.value).join(', ');
  
  return `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
}

/**
 * Parse UPDATE command
 */
function parseUpdate(tokens: Token[]): string {
  if (tokens.length < 4) {
    throw {
      token: tokens[0]?.value || '',
      position: tokens[0]?.position || 0,
      message: "Expected table name, 'set', and assignments after 'update'"
    };
  }
  
  const tableName = tokens[1].value;
  if (!isValidIdentifier(tableName)) {
    throw {
      token: tableName,
      position: tokens[1].position,
      message: `Invalid table name: ${tableName}`
    };
  }
  
  if (tokens[2].value.toLowerCase() !== 'set') {
    throw {
      token: tokens[2].value,
      position: tokens[2].position,
      message: "Expected 'set' after table name in UPDATE command"
    };
  }
  
  // Parse column=value pairs until WHERE
  const assignments: string[] = [];
  let idx = 3;
  
  while (idx < tokens.length && tokens[idx].value.toLowerCase() !== 'where') {
    const token = tokens[idx].value;
    const parts = token.split('=');
    
    if (parts.length !== 2) {
      throw {
        token: token,
        position: tokens[idx].position,
        message: `Invalid column=value assignment near '${token}'`
      };
    }
    
    const column = parts[0].trim();
    const value = parts[1].trim();
    
    if (!isValidIdentifier(column)) {
      throw {
        token: column,
        position: tokens[idx].position,
        message: `Invalid column name: ${column}`
      };
    }
    
    assignments.push(`${column} = ${processValue(value)}`);
    idx++;
  }
  
  if (assignments.length === 0) {
    throw {
      token: 'set',
      position: tokens[2].position,
      message: 'UPDATE requires at least one column=value assignment'
    };
  }
  
  // WHERE clause is REQUIRED for UPDATE in SimpleSyntax
  if (idx >= tokens.length || tokens[idx].value.toLowerCase() !== 'where') {
    throw {
      token: tokens[idx - 1]?.value || '',
      position: tokens[idx - 1]?.position || 0,
      message: 'UPDATE requires WHERE clause in SimpleSyntax mode. Use SQL mode for unrestricted updates.'
    };
  }
  
  idx++; // Skip 'where'
  const whereResult = parseWhereClause(tokens, idx);
  
  const sql = `UPDATE ${tableName} SET ${assignments.join(', ')} WHERE ${whereResult.sql}`;
  
  // Check for unexpected tokens
  if (whereResult.nextIdx < tokens.length) {
    throw {
      token: tokens[whereResult.nextIdx].value,
      position: tokens[whereResult.nextIdx].position,
      message: `Unexpected token: ${tokens[whereResult.nextIdx].value}`
    };
  }
  
  return sql;
}

/**
 * Parse REMOVE command (DELETE)
 */
function parseRemove(tokens: Token[]): string {
  if (tokens.length < 3) {
    throw {
      token: tokens[0]?.value || '',
      position: tokens[0]?.position || 0,
      message: "Expected table name and WHERE clause after 'remove'"
    };
  }
  
  const tableName = tokens[1].value;
  if (!isValidIdentifier(tableName)) {
    throw {
      token: tableName,
      position: tokens[1].position,
      message: `Invalid table name: ${tableName}`
    };
  }
  
  // WHERE clause is REQUIRED for DELETE in SimpleSyntax
  if (tokens[2].value.toLowerCase() !== 'where') {
    throw {
      token: tokens[2].value,
      position: tokens[2].position,
      message: 'DELETE requires WHERE clause in SimpleSyntax mode. Use SQL mode for unrestricted deletes.'
    };
  }
  
  let idx = 3; // Skip 'where'
  const whereResult = parseWhereClause(tokens, idx);
  
  const sql = `DELETE FROM ${tableName} WHERE ${whereResult.sql}`;
  
  // Check for unexpected tokens
  if (whereResult.nextIdx < tokens.length) {
    throw {
      token: tokens[whereResult.nextIdx].value,
      position: tokens[whereResult.nextIdx].position,
      message: `Unexpected token: ${tokens[whereResult.nextIdx].value}`
    };
  }
  
  return sql;
}

/**
 * Main translation function
 * Translates SimpleSyntax to SQL
 */
export function translate(inputText: string): TranslationResult {
  try {
    const trimmed = inputText.trim();
    
    if (!trimmed) {
      return {
        success: false,
        sql: null,
        error: {
          token: '',
          position: 0,
          message: 'Input is empty'
        }
      };
    }
    
    const tokens = tokenize(trimmed);
    
    if (tokens.length === 0) {
      return {
        success: false,
        sql: null,
        error: {
          token: '',
          position: 0,
          message: 'No valid tokens found'
        }
      };
    }
    
    const command = tokens[0].value.toLowerCase();
    let sql: string;
    
    switch (command) {
      case 'show':
        sql = parseShow(tokens);
        break;
      case 'count':
        sql = parseCount(tokens);
        break;
      case 'sum':
        sql = parseAggregate(tokens, 'SUM');
        break;
      case 'avg':
        sql = parseAggregate(tokens, 'AVG');
        break;
      case 'min':
        sql = parseAggregate(tokens, 'MIN');
        break;
      case 'max':
        sql = parseAggregate(tokens, 'MAX');
        break;
      case 'group':
        sql = parseGroup(tokens);
        break;
      case 'add':
        sql = parseAdd(tokens);
        break;
      case 'update':
        sql = parseUpdate(tokens);
        break;
      case 'remove':
        sql = parseRemove(tokens);
        break;
      default:
        return {
          success: false,
          sql: null,
          error: {
            token: tokens[0].value,
            position: tokens[0].position,
            message: `Unknown command '${tokens[0].value}'. Use: show, count, sum, avg, min, max, group, add, update, remove`
          }
        };
    }
    
    return {
      success: true,
      sql,
      error: null
    };
    
  } catch (error: any) {
    if (error.token !== undefined) {
      // Already formatted error
      return {
        success: false,
        sql: null,
        error: {
          token: error.token,
          position: error.position,
          message: error.message
        }
      };
    }
    
    // Unexpected error
    return {
      success: false,
      sql: null,
      error: {
        token: '',
        position: 0,
        message: error.message || 'Translation failed'
      }
    };
  }
}
