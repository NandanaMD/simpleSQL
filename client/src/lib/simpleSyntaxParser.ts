/**
 * SimpleSyntax Parser
 * Translates simplified SQL commands to standard SQL.
 * Pure, deterministic translation layer - no AI/LLM.
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

const SELECT_COMMANDS = new Set(['show', 'count', 'sum', 'avg', 'min', 'max', 'group', 'join']);
const ALLOWED_FUNCTIONS = new Set([
  'upper',
  'lower',
  'trim',
  'length',
  'substr',
  'substring',
  'coalesce',
  'ifnull',
  'round',
  'abs',
  'date',
  'time',
  'datetime',
  'strftime',
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'concat',
]);

const CLAUSE_WORDS = new Set(['where', 'order', 'limit', 'having', 'union']);

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isTwoCharOperator(value: string): boolean {
  return value === '>=' || value === '<=' || value === '!=' || value === '<>';
}

function isOneCharOperator(char: string): boolean {
  return char === '=' || char === '>' || char === '<';
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let idx = 0;

  while (idx < input.length) {
    const char = input[idx];

    if (isWhitespace(char)) {
      idx++;
      continue;
    }

    if (char === "'" || char === '"') {
      const quote = char;
      const start = idx;
      let value = quote;
      idx++;

      while (idx < input.length) {
        const current = input[idx];
        value += current;

        if (current === quote) {
          const next = input[idx + 1];
          if (quote === "'" && next === "'") {
            value += next;
            idx += 2;
            continue;
          }
          if (input[idx - 1] !== '\\') {
            idx++;
            break;
          }
        }

        idx++;
      }

      tokens.push({ value, position: start });
      continue;
    }

    if (char === ';' || char === ',' || char === '(' || char === ')') {
      tokens.push({ value: char, position: idx });
      idx++;
      continue;
    }

    const twoChar = input.slice(idx, idx + 2);
    if (isTwoCharOperator(twoChar)) {
      tokens.push({ value: twoChar, position: idx });
      idx += 2;
      continue;
    }

    if (isOneCharOperator(char)) {
      tokens.push({ value: char, position: idx });
      idx++;
      continue;
    }

    const start = idx;
    let value = '';

    while (idx < input.length) {
      const current = input[idx];
      const nextTwo = input.slice(idx, idx + 2);
      if (
        isWhitespace(current) ||
        current === ';' ||
        current === ',' ||
        current === '(' ||
        current === ')' ||
        isOneCharOperator(current) ||
        isTwoCharOperator(nextTwo)
      ) {
        break;
      }
      value += current;
      idx++;
    }

    if (value) {
      tokens.push({ value, position: start });
    } else {
      idx++;
    }
  }

  return tokens;
}

function splitStatements(input: string): string[] {
  const statements: string[] = [];
  let current = '';

  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (inSingleQuote && next === "'") {
        current += next;
        i++;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const finalStatement = current.trim();
  if (finalStatement) {
    statements.push(finalStatement);
  }

  return statements;
}

function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function isValidColumnReference(name: string): boolean {
  return /^([a-zA-Z_][a-zA-Z0-9_]*)(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(name);
}

function qualifyColumnReference(column: string, tableName: string): string {
  if (column.includes('.')) {
    return column;
  }
  return `${tableName}.${column}`;
}

function processStringValue(value: string): string {
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    const inner = value.slice(1, -1);
    const normalized = inner.replace(/''/g, "'");
    return "'" + normalized.replace(/'/g, "''") + "'";
  }
  throw new Error(`String values must be single-quoted: ${value}`);
}

function processValue(value: string): string {
  const lower = value.toLowerCase();
  if (lower === 'null') return 'NULL';
  if (lower === 'true') return '1';
  if (lower === 'false') return '0';
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  return processStringValue(value);
}

function throwToken(token: Token | undefined, message: string): never {
  throw {
    token: token?.value || '',
    position: token?.position || 0,
    message,
  };
}

function isClauseBoundary(token: Token | undefined, extra: Set<string> = new Set()): boolean {
  if (!token) return true;
  const lower = token.value.toLowerCase();
  return CLAUSE_WORDS.has(lower) || extra.has(lower);
}

function parseSimpleExpression(tokens: Token[], startIdx: number, stopWords: Set<string>): { sql: string; nextIdx: number } {
  let idx = startIdx;
  const token = tokens[idx];
  if (!token) {
    throwToken(tokens[idx - 1], 'Expected expression');
  }

  const lower = token.value.toLowerCase();

  if (token.value === '(') {
    let depth = 1;
    const inner: Token[] = [];
    idx++;

    while (idx < tokens.length && depth > 0) {
      const current = tokens[idx];
      if (current.value === '(') {
        depth++;
      } else if (current.value === ')') {
        depth--;
        if (depth === 0) {
          idx++;
          break;
        }
      }
      if (depth > 0) inner.push(current);
      idx++;
    }

    if (depth !== 0) {
      throwToken(token, 'Unclosed parenthesis');
    }

    const first = inner[0]?.value.toLowerCase();
    if (first && SELECT_COMMANDS.has(first)) {
      const sql = translateTokensWithUnion(inner);
      return { sql: `(${sql})`, nextIdx: idx };
    }

    if (inner.length === 0) {
      throwToken(token, 'Parenthesized expression cannot be empty');
    }

    const parsed = parseBooleanExpression(inner, 0, new Set());
    if (parsed.nextIdx !== inner.length) {
      throwToken(inner[parsed.nextIdx], `Unexpected token: ${inner[parsed.nextIdx].value}`);
    }

    return { sql: `(${parsed.sql})`, nextIdx: idx };
  }

  if ((token.value.startsWith("'") && token.value.endsWith("'")) || (token.value.startsWith('"') && token.value.endsWith('"'))) {
    return { sql: processStringValue(token.value), nextIdx: idx + 1 };
  }

  if (/^-?\d+(\.\d+)?$/.test(token.value) || lower === 'true' || lower === 'false' || lower === 'null') {
    return { sql: processValue(token.value), nextIdx: idx + 1 };
  }

  if (isValidColumnReference(token.value) || token.value === '*') {
    if (idx + 1 < tokens.length && tokens[idx + 1].value === '(') {
      const func = token.value.toLowerCase();
      if (!ALLOWED_FUNCTIONS.has(func)) {
        throwToken(token, `Function not allowed in SimpleSyntax: ${token.value}`);
      }

      idx += 2; // function + '('
      const args: string[] = [];

      if (idx < tokens.length && tokens[idx].value === ')') {
        idx++;
      } else {
        while (idx < tokens.length) {
          if (tokens[idx].value === ')') {
            idx++;
            break;
          }

          const arg = parseSimpleExpression(tokens, idx, new Set([')', ',']));
          args.push(arg.sql);
          idx = arg.nextIdx;

          if (idx < tokens.length && tokens[idx].value === ',') {
            idx++;
            continue;
          }

          if (idx < tokens.length && tokens[idx].value === ')') {
            idx++;
            break;
          }

          throwToken(tokens[idx], 'Expected comma or closing parenthesis in function arguments');
        }
      }

      if (func === 'concat') {
        if (args.length < 2) {
          throwToken(token, 'concat requires at least two arguments');
        }
        return { sql: `(${args.join(' || ')})`, nextIdx: idx };
      }

      return { sql: `${func.toUpperCase()}(${args.join(', ')})`, nextIdx: idx };
    }

    if (stopWords.has(lower)) {
      throwToken(token, `Expected expression before '${token.value}'`);
    }

    return { sql: token.value, nextIdx: idx + 1 };
  }

  throwToken(token, `Invalid expression token: ${token.value}`);
}

function parseInListOrSubquery(tokens: Token[], startIdx: number): { sql: string; nextIdx: number } {
  if (tokens[startIdx]?.value !== '(') {
    throwToken(tokens[startIdx], "Expected '(' after IN");
  }

  let idx = startIdx + 1;
  let depth = 1;
  const inner: Token[] = [];

  while (idx < tokens.length && depth > 0) {
    const token = tokens[idx];
    if (token.value === '(') {
      depth++;
      inner.push(token);
      idx++;
      continue;
    }
    if (token.value === ')') {
      depth--;
      if (depth === 0) {
        idx++;
        break;
      }
      inner.push(token);
      idx++;
      continue;
    }
    inner.push(token);
    idx++;
  }

  if (depth !== 0) {
    throwToken(tokens[startIdx], 'Unclosed parenthesis in IN clause');
  }

  if (inner.length === 0) {
    throwToken(tokens[startIdx], 'IN list cannot be empty');
  }

  const first = inner[0].value.toLowerCase();
  if (SELECT_COMMANDS.has(first)) {
    const translated = translateTokensWithUnion(inner);
    return { sql: `(${translated})`, nextIdx: idx };
  }

  const values: string[] = [];
  let innerIdx = 0;
  while (innerIdx < inner.length) {
    const parsed = parseSimpleExpression(inner, innerIdx, new Set([',']));
    values.push(parsed.sql);
    innerIdx = parsed.nextIdx;

    if (innerIdx < inner.length && inner[innerIdx].value === ',') {
      innerIdx++;
      continue;
    }

    if (innerIdx < inner.length) {
      throwToken(inner[innerIdx], `Unexpected token in IN list: ${inner[innerIdx].value}`);
    }
  }

  return { sql: `(${values.join(', ')})`, nextIdx: idx };
}

function parsePredicate(tokens: Token[], startIdx: number, stopWords: Set<string>): { sql: string; nextIdx: number } {
  const token = tokens[startIdx];
  if (!token) {
    throwToken(tokens[startIdx - 1], 'Invalid WHERE condition');
  }

  if (token.value.toLowerCase() === 'exists') {
    const parsed = parseInListOrSubquery(tokens, startIdx + 1);
    return { sql: `EXISTS ${parsed.sql}`, nextIdx: parsed.nextIdx };
  }

  const leftExpr = parseSimpleExpression(tokens, startIdx, stopWords);
  let idx = leftExpr.nextIdx;

  const operatorToken = tokens[idx];
  if (!operatorToken) {
    throwToken(tokens[idx - 1], 'Incomplete WHERE condition');
  }

  const opLower = operatorToken.value.toLowerCase();

  if (opLower === 'is') {
    idx++;
    let isNot = false;
    if (tokens[idx]?.value.toLowerCase() === 'not') {
      isNot = true;
      idx++;
    }
    if (tokens[idx]?.value.toLowerCase() !== 'null') {
      throwToken(tokens[idx], 'IS only supports NULL in SimpleSyntax');
    }
    return {
      sql: `${leftExpr.sql} IS${isNot ? ' NOT' : ''} NULL`,
      nextIdx: idx + 1,
    };
  }

  let notModifier = false;
  if (opLower === 'not') {
    notModifier = true;
    idx++;
  }

  const actualOperator = tokens[idx];
  if (!actualOperator) {
    throwToken(tokens[idx - 1], 'Expected operator after NOT');
  }

  const actualLower = actualOperator.value.toLowerCase();

  if (actualLower === 'in') {
    const parsed = parseInListOrSubquery(tokens, idx + 1);
    return {
      sql: `${leftExpr.sql} ${notModifier ? 'NOT IN' : 'IN'} ${parsed.sql}`,
      nextIdx: parsed.nextIdx,
    };
  }

  if (actualLower === 'between') {
    const lowerBound = parseSimpleExpression(tokens, idx + 1, new Set(['and']));
    if (tokens[lowerBound.nextIdx]?.value.toLowerCase() !== 'and') {
      throwToken(tokens[lowerBound.nextIdx], "BETWEEN requires 'and'");
    }
    const upperBound = parseSimpleExpression(tokens, lowerBound.nextIdx + 1, stopWords);
    return {
      sql: `${leftExpr.sql} ${notModifier ? 'NOT BETWEEN' : 'BETWEEN'} ${lowerBound.sql} AND ${upperBound.sql}`,
      nextIdx: upperBound.nextIdx,
    };
  }

  if (actualLower === 'like') {
    const rightExpr = parseSimpleExpression(tokens, idx + 1, stopWords);
    return {
      sql: `${leftExpr.sql} ${notModifier ? 'NOT LIKE' : 'LIKE'} ${rightExpr.sql}`,
      nextIdx: rightExpr.nextIdx,
    };
  }

  if (notModifier) {
    throwToken(actualOperator, "NOT can only be used with IN, BETWEEN, or LIKE");
  }

  const validOperators = new Set(['=', '!=', '<>', '>', '<', '>=', '<=']);
  if (!validOperators.has(actualOperator.value)) {
    throwToken(actualOperator, `Invalid operator: ${actualOperator.value}`);
  }

  const rightExpr = parseSimpleExpression(tokens, idx + 1, stopWords);

  if (rightExpr.sql === 'NULL') {
    if (actualOperator.value === '=') {
      return { sql: `${leftExpr.sql} IS NULL`, nextIdx: rightExpr.nextIdx };
    }
    if (actualOperator.value === '!=' || actualOperator.value === '<>') {
      return { sql: `${leftExpr.sql} IS NOT NULL`, nextIdx: rightExpr.nextIdx };
    }
  }

  return {
    sql: `${leftExpr.sql} ${actualOperator.value} ${rightExpr.sql}`,
    nextIdx: rightExpr.nextIdx,
  };
}

function parseWherePrimary(tokens: Token[], startIdx: number, stopWords: Set<string>): { sql: string; nextIdx: number } {
  const token = tokens[startIdx];
  if (!token) {
    throwToken(tokens[startIdx - 1], 'Invalid WHERE condition');
  }

  if (token.value === '(') {
    const nested = parseBooleanExpression(tokens, startIdx + 1, new Set([...stopWords, ')']));
    if (tokens[nested.nextIdx]?.value !== ')') {
      throwToken(tokens[nested.nextIdx], 'Expected closing parenthesis in WHERE clause');
    }
    return { sql: `(${nested.sql})`, nextIdx: nested.nextIdx + 1 };
  }

  return parsePredicate(tokens, startIdx, stopWords);
}

function parseWhereAnd(tokens: Token[], startIdx: number, stopWords: Set<string>): { sql: string; nextIdx: number } {
  let current = parseWherePrimary(tokens, startIdx, stopWords);

  while (current.nextIdx < tokens.length) {
    const token = tokens[current.nextIdx];
    if (!token || token.value.toLowerCase() !== 'and') break;

    const rhs = parseWherePrimary(tokens, current.nextIdx + 1, stopWords);
    current = {
      sql: `${current.sql} AND ${rhs.sql}`,
      nextIdx: rhs.nextIdx,
    };
  }

  return current;
}

function parseBooleanExpression(tokens: Token[], startIdx: number, stopWords: Set<string>): { sql: string; nextIdx: number } {
  let current = parseWhereAnd(tokens, startIdx, stopWords);

  while (current.nextIdx < tokens.length) {
    const token = tokens[current.nextIdx];
    if (!token || token.value.toLowerCase() !== 'or') break;

    const rhs = parseWhereAnd(tokens, current.nextIdx + 1, stopWords);
    current = {
      sql: `${current.sql} OR ${rhs.sql}`,
      nextIdx: rhs.nextIdx,
    };
  }

  return current;
}

function parseWhereClause(tokens: Token[], startIdx: number, stopWords: Set<string>): { sql: string; nextIdx: number } {
  if (startIdx >= tokens.length) {
    throwToken(tokens[startIdx - 1], 'WHERE clause is empty');
  }

  const result = parseBooleanExpression(tokens, startIdx, stopWords);
  if (!result.sql.trim()) {
    throwToken(tokens[startIdx], 'WHERE clause is empty');
  }

  return result;
}

function parseOrderByClause(tokens: Token[], startIdx: number): { sql: string; nextIdx: number } {
  let idx = startIdx + 1;

  if (idx >= tokens.length) {
    throwToken(tokens[startIdx], 'ORDER BY requires at least one column name');
  }

  const columns: string[] = [];

  while (idx < tokens.length) {
    const token = tokens[idx];
    const lower = token.value.toLowerCase();

    if (lower === 'limit' || lower === 'union') break;
    if (token.value === ',') {
      idx++;
      continue;
    }

    const columnExpr = parseSimpleExpression(tokens, idx, new Set(['asc', 'desc', ',', 'limit', 'union']));
    idx = columnExpr.nextIdx;

    if (idx >= tokens.length) {
      throwToken(tokens[idx - 1], "ORDER BY requires 'asc' or 'desc' after column name");
    }

    const dir = tokens[idx].value.toLowerCase();
    if (dir !== 'asc' && dir !== 'desc') {
      throwToken(tokens[idx], "ORDER BY requires 'asc' or 'desc' after column name");
    }

    columns.push(`${columnExpr.sql} ${dir.toUpperCase()}`);
    idx++;
  }

  if (columns.length === 0) {
    throwToken(tokens[startIdx], 'ORDER BY requires at least one column');
  }

  return { sql: columns.join(', '), nextIdx: idx };
}

function parseLimitClause(tokens: Token[], startIdx: number): { sql: string; nextIdx: number } {
  let idx = startIdx + 1;
  if (idx >= tokens.length) {
    throwToken(tokens[startIdx], 'LIMIT requires a positive number');
  }

  const value = tokens[idx].value;
  if (!/^\d+$/.test(value) || parseInt(value, 10) <= 0) {
    throwToken(tokens[idx], 'LIMIT requires a positive number');
  }

  idx++;
  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'offset') {
    const offsetToken = tokens[idx + 1];
    if (!offsetToken || !/^\d+$/.test(offsetToken.value) || parseInt(offsetToken.value, 10) < 0) {
      throwToken(offsetToken || tokens[idx], 'OFFSET requires a non-negative number');
    }
    return { sql: `${value} OFFSET ${offsetToken.value}`, nextIdx: idx + 2 };
  }

  return { sql: value, nextIdx: idx };
}

function parseShow(tokens: Token[]): string {
  if (tokens.length < 2) {
    throwToken(tokens[0], "Expected table name after 'show'");
  }

  let idx = 1;
  let isDistinct = false;

  if (tokens[idx]?.value.toLowerCase() === 'distinct') {
    isDistinct = true;
    idx++;
  }

  const tableToken = tokens[idx];
  if (!tableToken || !isValidIdentifier(tableToken.value)) {
    throwToken(tableToken, `Invalid table name: ${tableToken?.value || ''}`);
  }
  const tableName = tableToken.value;
  idx++;

  const projections: string[] = [];
  while (idx < tokens.length) {
    const token = tokens[idx];
    if (isClauseBoundary(token)) break;
    if (token.value === ',') {
      idx++;
      continue;
    }

    const expr = parseSimpleExpression(tokens, idx, new Set(['as', ',', ...Array.from(CLAUSE_WORDS)]));
    idx = expr.nextIdx;

    let projection = expr.sql;
    if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'as') {
      const aliasToken = tokens[idx + 1];
      if (!aliasToken || !isValidIdentifier(aliasToken.value)) {
        throwToken(aliasToken || tokens[idx], 'AS requires a valid alias name');
      }
      projection = `${projection} AS ${aliasToken.value}`;
      idx += 2;
    }

    projections.push(projection);
  }

  const selectPart = projections.length > 0 ? projections.join(', ') : '*';
  let sql = `SELECT ${isDistinct ? 'DISTINCT ' : ''}${selectPart} FROM ${tableName}`;

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'where') {
    const where = parseWhereClause(tokens, idx + 1, new Set(['order', 'limit', 'union']));
    sql += ` WHERE ${where.sql}`;
    idx = where.nextIdx;
  }

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'order') {
    if (tokens[idx + 1]?.value.toLowerCase() !== 'by') {
      throwToken(tokens[idx], "Expected 'by' after 'order'");
    }
    const order = parseOrderByClause(tokens, idx + 1);
    sql += ` ORDER BY ${order.sql}`;
    idx = order.nextIdx;
  }

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'limit') {
    const limit = parseLimitClause(tokens, idx);
    sql += ` LIMIT ${limit.sql}`;
    idx = limit.nextIdx;
  }

  if (idx < tokens.length) {
    throwToken(tokens[idx], `Unexpected token: ${tokens[idx].value}`);
  }

  return sql;
}

function parseCount(tokens: Token[]): string {
  if (tokens.length < 2) {
    throwToken(tokens[0], "Expected table name after 'count'");
  }

  const tableToken = tokens[1];
  if (!isValidIdentifier(tableToken.value)) {
    throwToken(tableToken, `Invalid table name: ${tableToken.value}`);
  }

  let sql = `SELECT COUNT(*) FROM ${tableToken.value}`;
  let idx = 2;

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'where') {
    const where = parseWhereClause(tokens, idx + 1, new Set(['union']));
    sql += ` WHERE ${where.sql}`;
    idx = where.nextIdx;
  }

  if (idx < tokens.length) {
    throwToken(tokens[idx], `Unexpected token: ${tokens[idx].value}`);
  }

  return sql;
}

function parseAggregate(tokens: Token[], funcName: string): string {
  if (tokens.length < 3) {
    throwToken(tokens[0], `Expected table name and column name after '${funcName.toLowerCase()}'`);
  }

  const tableToken = tokens[1];
  if (!isValidIdentifier(tableToken.value)) {
    throwToken(tableToken, `Invalid table name: ${tableToken.value}`);
  }

  const colExpr = parseSimpleExpression(tokens, 2, new Set(['where', 'union']));
  let idx = colExpr.nextIdx;
  let sql = `SELECT ${funcName}(${colExpr.sql}) FROM ${tableToken.value}`;

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'where') {
    const where = parseWhereClause(tokens, idx + 1, new Set(['union']));
    sql += ` WHERE ${where.sql}`;
    idx = where.nextIdx;
  }

  if (idx < tokens.length) {
    throwToken(tokens[idx], `Unexpected token: ${tokens[idx].value}`);
  }

  return sql;
}

function parseGroup(tokens: Token[]): string {
  if (tokens.length < 4) {
    throwToken(tokens[0], "Expected 'tablename by column' after 'group'");
  }

  const tableToken = tokens[1];
  if (!isValidIdentifier(tableToken.value)) {
    throwToken(tableToken, `Invalid table name: ${tableToken.value}`);
  }

  if (tokens[2].value.toLowerCase() !== 'by') {
    throwToken(tokens[2], "Expected 'by' after table name in GROUP command");
  }

  let idx = 3;
  const groupCols: string[] = [];
  while (idx < tokens.length) {
    const token = tokens[idx];
    const lower = token.value.toLowerCase();
    if (lower === 'having' || lower === 'order' || lower === 'limit' || lower === 'union') break;
    if (token.value === ',') {
      idx++;
      continue;
    }
    if (!isValidColumnReference(token.value)) {
      throwToken(token, `Invalid column name: ${token.value}`);
    }
    groupCols.push(token.value);
    idx++;
  }

  if (groupCols.length === 0) {
    throwToken(tokens[2], 'GROUP BY requires at least one column name');
  }

  let sql = `SELECT ${groupCols.join(', ')}, COUNT(*) as count FROM ${tableToken.value} GROUP BY ${groupCols.join(', ')}`;

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'having') {
    const having = parseWhereClause(tokens, idx + 1, new Set(['order', 'limit', 'union']));
    sql += ` HAVING ${having.sql}`;
    idx = having.nextIdx;
  }

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'order') {
    if (tokens[idx + 1]?.value.toLowerCase() !== 'by') {
      throwToken(tokens[idx], "Expected 'by' after 'order'");
    }
    const order = parseOrderByClause(tokens, idx + 1);
    sql += ` ORDER BY ${order.sql}`;
    idx = order.nextIdx;
  }

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'limit') {
    const limit = parseLimitClause(tokens, idx);
    sql += ` LIMIT ${limit.sql}`;
    idx = limit.nextIdx;
  }

  if (idx < tokens.length) {
    throwToken(tokens[idx], `Unexpected token: ${tokens[idx].value}`);
  }

  return sql;
}

function parseAssignments(tokens: Token[], startIdx: number, stopWords: Set<string>): { sql: string[]; nextIdx: number } {
  let idx = startIdx;
  const assignments: string[] = [];

  while (idx < tokens.length) {
    const token = tokens[idx];
    const lower = token.value.toLowerCase();
    if (stopWords.has(lower)) break;
    if (token.value === ',') {
      idx++;
      continue;
    }

    if (!isValidIdentifier(token.value)) {
      throwToken(token, `Invalid column name: ${token.value}`);
    }
    const column = token.value;

    if (tokens[idx + 1]?.value !== '=') {
      throwToken(tokens[idx + 1] || token, `Invalid column=value assignment near '${token.value}'`);
    }

    const valueExpr = parseSimpleExpression(tokens, idx + 2, new Set([',', ...Array.from(stopWords)]));
    assignments.push(`${column} = ${valueExpr.sql}`);
    idx = valueExpr.nextIdx;

    if (idx < tokens.length && tokens[idx].value === ',') {
      idx++;
    }
  }

  return { sql: assignments, nextIdx: idx };
}

function parseAdd(tokens: Token[]): string {
  if (tokens.length < 4) {
    throwToken(tokens[0], "Expected table name and column assignments after 'add'");
  }

  const tableToken = tokens[1];
  if (!isValidIdentifier(tableToken.value)) {
    throwToken(tableToken, `Invalid table name: ${tableToken.value}`);
  }

  const assignments = parseAssignments(tokens, 2, new Set());
  if (assignments.sql.length === 0) {
    throwToken(tokens[1], 'INSERT requires at least one column=value assignment');
  }

  const normalized = assignments.sql
    .map((entry) => {
      const [column, value] = entry.split('=').map((part) => part.trim());
      return { column, value };
    })
    .sort((a, b) => a.column.localeCompare(b.column));

  const columns = normalized.map((item) => item.column).join(', ');
  const values = normalized.map((item) => item.value).join(', ');

  return `INSERT INTO ${tableToken.value} (${columns}) VALUES (${values})`;
}

function parseUpdate(tokens: Token[]): string {
  if (tokens.length < 5) {
    throwToken(tokens[0], "Expected table name, 'set', and assignments after 'update'");
  }

  const tableToken = tokens[1];
  if (!isValidIdentifier(tableToken.value)) {
    throwToken(tableToken, `Invalid table name: ${tableToken.value}`);
  }

  if (tokens[2].value.toLowerCase() !== 'set') {
    throwToken(tokens[2], "Expected 'set' after table name in UPDATE command");
  }

  const assignments = parseAssignments(tokens, 3, new Set(['where']));
  if (assignments.sql.length === 0) {
    throwToken(tokens[2], 'UPDATE requires at least one column=value assignment');
  }

  let idx = assignments.nextIdx;
  if (idx >= tokens.length || tokens[idx].value.toLowerCase() !== 'where') {
    throwToken(tokens[idx - 1], 'UPDATE requires WHERE clause in SimpleSyntax mode. Use SQL mode for unrestricted updates.');
  }

  const where = parseWhereClause(tokens, idx + 1, new Set());
  idx = where.nextIdx;

  if (idx < tokens.length) {
    throwToken(tokens[idx], `Unexpected token: ${tokens[idx].value}`);
  }

  return `UPDATE ${tableToken.value} SET ${assignments.sql.join(', ')} WHERE ${where.sql}`;
}

function parseRemove(tokens: Token[]): string {
  if (tokens.length < 3) {
    throwToken(tokens[0], "Expected table name and WHERE clause after 'remove'");
  }

  const tableToken = tokens[1];
  if (!isValidIdentifier(tableToken.value)) {
    throwToken(tableToken, `Invalid table name: ${tableToken.value}`);
  }

  if (tokens[2].value.toLowerCase() !== 'where') {
    throwToken(tokens[2], 'DELETE requires WHERE clause in SimpleSyntax mode. Use SQL mode for unrestricted deletes.');
  }

  const where = parseWhereClause(tokens, 3, new Set());
  if (where.nextIdx < tokens.length) {
    throwToken(tokens[where.nextIdx], `Unexpected token: ${tokens[where.nextIdx].value}`);
  }

  return `DELETE FROM ${tableToken.value} WHERE ${where.sql}`;
}

function parseJoin(tokens: Token[]): string {
  if (tokens.length < 6) {
    throwToken(tokens[0], "Expected JOIN syntax: join [inner|left|right] table1 table2 on col1 = col2");
  }

  let idx = 1;
  let joinType = 'INNER';
  const maybeType = tokens[idx].value.toLowerCase();
  if (maybeType === 'inner' || maybeType === 'left' || maybeType === 'right') {
    joinType = maybeType.toUpperCase();
    idx++;
  }

  const leftTable = tokens[idx];
  const rightTable = tokens[idx + 1];
  if (!leftTable || !rightTable || !isValidIdentifier(leftTable.value) || !isValidIdentifier(rightTable.value)) {
    throwToken(leftTable || rightTable, 'Expected two valid table names after join command');
  }

  idx += 2;
  if (tokens[idx]?.value.toLowerCase() !== 'on') {
    throwToken(tokens[idx], "Expected 'on' after table names in JOIN command");
  }
  idx++;

  const leftCol = tokens[idx];
  const eq = tokens[idx + 1];
  const rightCol = tokens[idx + 2];
  if (!leftCol || !eq || !rightCol || eq.value !== '=') {
    throwToken(tokens[idx], "Expected join condition after 'on'. Use col1 = col2");
  }

  if (!isValidColumnReference(leftCol.value) || !isValidColumnReference(rightCol.value)) {
    throwToken(leftCol, 'Invalid column name in JOIN condition');
  }

  idx += 3;

  const leftRef = qualifyColumnReference(leftCol.value, leftTable.value);
  const rightRef = qualifyColumnReference(rightCol.value, rightTable.value);

  let sql = `SELECT * FROM ${leftTable.value} ${joinType} JOIN ${rightTable.value} ON ${leftRef} = ${rightRef}`;

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'where') {
    const where = parseWhereClause(tokens, idx + 1, new Set(['order', 'limit', 'union']));
    sql += ` WHERE ${where.sql}`;
    idx = where.nextIdx;
  }

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'order') {
    if (tokens[idx + 1]?.value.toLowerCase() !== 'by') {
      throwToken(tokens[idx], "Expected 'by' after 'order'");
    }
    const order = parseOrderByClause(tokens, idx + 1);
    sql += ` ORDER BY ${order.sql}`;
    idx = order.nextIdx;
  }

  if (idx < tokens.length && tokens[idx].value.toLowerCase() === 'limit') {
    const limit = parseLimitClause(tokens, idx);
    sql += ` LIMIT ${limit.sql}`;
    idx = limit.nextIdx;
  }

  if (idx < tokens.length) {
    throwToken(tokens[idx], `Unexpected token: ${tokens[idx].value}`);
  }

  return sql;
}

function parseSingleCommand(tokens: Token[]): string {
  if (tokens.length === 0) {
    throwToken(undefined, 'No valid tokens found');
  }

  const command = tokens[0].value.toLowerCase();
  switch (command) {
    case 'show':
      return parseShow(tokens);
    case 'count':
      return parseCount(tokens);
    case 'sum':
      return parseAggregate(tokens, 'SUM');
    case 'avg':
      return parseAggregate(tokens, 'AVG');
    case 'min':
      return parseAggregate(tokens, 'MIN');
    case 'max':
      return parseAggregate(tokens, 'MAX');
    case 'group':
      return parseGroup(tokens);
    case 'add':
      return parseAdd(tokens);
    case 'update':
      return parseUpdate(tokens);
    case 'remove':
      return parseRemove(tokens);
    case 'join':
      return parseJoin(tokens);
    default:
      throw {
        token: tokens[0].value,
        position: tokens[0].position,
        message:
          `Unknown command '${tokens[0].value}'. Use: show, count, sum, avg, min, max, group, add, update, remove, join`,
      };
  }
}

function splitByUnion(tokens: Token[]): { segments: Token[][]; operators: string[] } {
  const segments: Token[][] = [];
  const operators: string[] = [];

  let current: Token[] = [];
  let depth = 0;
  let idx = 0;

  while (idx < tokens.length) {
    const token = tokens[idx];
    const lower = token.value.toLowerCase();

    if (token.value === '(') {
      depth++;
      current.push(token);
      idx++;
      continue;
    }

    if (token.value === ')') {
      depth = Math.max(0, depth - 1);
      current.push(token);
      idx++;
      continue;
    }

    if (depth === 0 && lower === 'union') {
      if (current.length === 0) {
        throwToken(token, 'UNION requires a query before it');
      }

      segments.push(current);
      current = [];

      let op = 'UNION';
      if (tokens[idx + 1]?.value.toLowerCase() === 'all') {
        op = 'UNION ALL';
        idx += 2;
      } else {
        idx += 1;
      }
      operators.push(op);
      continue;
    }

    current.push(token);
    idx++;
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return { segments, operators };
}

function translateTokensWithUnion(tokens: Token[]): string {
  const { segments, operators } = splitByUnion(tokens);

  if (segments.length === 0) {
    throwToken(tokens[0], 'Query is empty');
  }

  if (segments.length === 1) {
    return parseSingleCommand(segments[0]);
  }

  const translated = segments.map((segment) => {
    const command = segment[0]?.value.toLowerCase();
    if (!command || !SELECT_COMMANDS.has(command)) {
      throwToken(segment[0], 'UNION only supports read queries in SimpleSyntax (show/count/sum/avg/min/max/group/join)');
    }
    return parseSingleCommand(segment);
  });

  let sql = translated[0];
  for (let idx = 1; idx < translated.length; idx++) {
    sql += ` ${operators[idx - 1]} ${translated[idx]}`;
  }

  return sql;
}

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
          message: 'Input is empty',
        },
      };
    }

    const statements = splitStatements(trimmed);
    if (statements.length === 0) {
      return {
        success: false,
        sql: null,
        error: {
          token: '',
          position: 0,
          message: 'No valid tokens found',
        },
      };
    }

    const translatedStatements = statements.map((statement) => {
      const tokens = tokenize(statement);
      if (tokens.length === 0) {
        throw {
          token: '',
          position: 0,
          message: 'No valid tokens found',
        };
      }
      return translateTokensWithUnion(tokens);
    });

    return {
      success: true,
      sql: translatedStatements.join('; '),
      error: null,
    };
  } catch (error: any) {
    if (error?.token !== undefined) {
      return {
        success: false,
        sql: null,
        error: {
          token: error.token,
          position: error.position,
          message: error.message,
        },
      };
    }

    return {
      success: false,
      sql: null,
      error: {
        token: '',
        position: 0,
        message: error?.message || 'Translation failed',
      },
    };
  }
}
