/**
 * SQL formatter - formats SQL queries with proper indentation and spacing
 */

const newlineKeywords = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'FULL JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
  'UNION', 'INTERSECT', 'EXCEPT', 'INSERT INTO', 'VALUES', 'UPDATE', 'DELETE FROM',
  'SET', 'WITH'
];

export function formatSQL(sql: string, options: { indentSize?: number } = {}): string {
  const indentSize = options.indentSize || 2;
  const indent = ' '.repeat(indentSize);
  
  if (!sql || !sql.trim()) return sql;

  // Normalize whitespace and line breaks
  let formatted = sql
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/,\s*/g, ', ')
    .trim();

  // Add line breaks before major keywords
  newlineKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword.toUpperCase()}`);
  });

  // Handle subqueries
  formatted = formatted.replace(/\(\s*SELECT/gi, '(\n  SELECT');
  formatted = formatted.replace(/\)\s*(?=FROM|WHERE|AND|OR|\)|,|$)/gi, '\n)');

  // Add indentation
  const lines = formatted.split('\n');
  let level = 0;
  const result: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Decrease indent for closing parentheses
    if (line.startsWith(')')) {
      level = Math.max(0, level - 1);
    }

    // Add indented line
    result.push(indent.repeat(level) + line);

    // Increase indent for opening parentheses
    const openCount = (line.match(/\(/g) || []).length;
    const closeCount = (line.match(/\)/g) || []).length;
    level += openCount - closeCount;
    level = Math.max(0, level);
  }

  return result.join('\n');
}

/**
 * Validates SQL syntax (basic validation)
 */
export function validateSQL(sql: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!sql || !sql.trim()) {
    errors.push('Query is empty');
    return { valid: false, errors };
  }

  // Check for balanced parentheses
  let parenCount = 0;
  for (const char of sql) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (parenCount < 0) {
      errors.push('Unbalanced parentheses: unexpected closing parenthesis');
      break;
    }
  }
  if (parenCount > 0) {
    errors.push('Unbalanced parentheses: missing closing parenthesis');
  }

  // Check for balanced quotes
  const singleQuotes = (sql.match(/(?<!\\)'/g) || []).length;
  const doubleQuotes = (sql.match(/(?<!\\)"/g) || []).length;
  
  if (singleQuotes % 2 !== 0) {
    errors.push('Unbalanced single quotes');
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unbalanced double quotes');
  }

  // Check for basic SQL structure
  const upperSQL = sql.toUpperCase();
  const hasSelect = upperSQL.includes('SELECT');
  const hasFrom = upperSQL.includes('FROM');
  const hasDelete = upperSQL.includes('DELETE');
  const hasDrop = upperSQL.includes('DROP');

  if (hasSelect && !hasFrom && !upperSQL.includes('SELECT NOW()') && !upperSQL.includes('SELECT VERSION()')) {
    errors.push('SELECT statement typically requires a FROM clause');
  }

  // Check for potentially dangerous operations
  if ((hasDelete || hasDrop) && !upperSQL.includes('WHERE')) {
    errors.push('Warning: Destructive operation without WHERE clause');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extracts line and column from error position
 */
export function parseErrorPosition(sql: string, positionStr?: string): { line: number; column: number } | null {
  if (!positionStr) return null;
  
  const position = parseInt(positionStr, 10);
  if (isNaN(position)) return null;

  const lines = sql.split('\n');
  let currentPos = 0;
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const lineLength = lines[lineNum].length + 1; // +1 for newline
    if (currentPos + lineLength >= position) {
      return {
        line: lineNum + 1,
        column: position - currentPos + 1,
      };
    }
    currentPos += lineLength;
  }

  return null;
}
