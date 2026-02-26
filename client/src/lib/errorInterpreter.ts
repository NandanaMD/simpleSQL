/**
 * Rule-Based SQL Error Interpretation Engine
 * 
 * Converts raw MySQL error messages into clear, human-readable explanations
 * and highlights problematic tokens in the Monaco editor.
 * 
 * Uses deterministic pattern matching only - NO AI, NO external APIs.
 */

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface InterpretedError {
  type: string;
  token: string | null;
  naturalMessage: string;
  suggestion?: string;
}

export interface ErrorRule {
  name: string;
  test: (errorMessage: string) => boolean;
  extract: (errorMessage: string) => string | null;
  explain: (token: string | null) => string;
  suggestion?: (token: string | null) => string;
}

// ========================================
// MONACO EDITOR HIGHLIGHTING
// ========================================

let currentDecorations: string[] = [];

/**
 * Highlights a problematic token in the Monaco editor
 */
export function highlightErrorToken(
  editorInstance: any,
  queryText: string,
  token: string | null
): void {
  if (!editorInstance || !token) {
    clearHighlights(editorInstance);
    return;
  }

  try {
    const model = editorInstance.getModel();
    if (!model) return;

    // Find the position of the token in the query
    const index = queryText.indexOf(token);
    if (index === -1) {
      clearHighlights(editorInstance);
      return;
    }

    // Convert string index to Monaco position
    const position = model.getPositionAt(index);
    const endPosition = model.getPositionAt(index + token.length);

    // Create decoration with red underline
    const decorations = [
      {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: endPosition.lineNumber,
          endColumn: endPosition.column,
        },
        options: {
          isWholeLine: false,
          className: 'error-token-highlight',
          inlineClassName: 'error-token-inline',
          overviewRuler: {
            color: '#ff0000',
            position: 4, // OverviewRulerLane.Right
          },
          minimap: {
            color: '#ff0000',
            position: 2, // MinimapPosition.Inline
          },
        },
      },
    ];

    // Apply decorations
    currentDecorations = editorInstance.deltaDecorations(
      currentDecorations,
      decorations
    );
  } catch (error) {
    console.warn('Failed to highlight error token:', error);
  }
}

/**
 * Clears all error highlights from the editor
 */
export function clearHighlights(editorInstance: any): void {
  if (editorInstance && currentDecorations.length > 0) {
    currentDecorations = editorInstance.deltaDecorations(currentDecorations, []);
  }
}

// ========================================
// ERROR RULE DEFINITIONS
// ========================================

const errorRules: ErrorRule[] = [
  // -------------------------------------
  // SQLITE-SPECIFIC ERRORS
  // -------------------------------------
  {
    name: 'sqlite_no_such_table',
    test: (msg) => /no such table/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/no such table:\s*(\S+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Table '${token}' does not exist. Make sure the table is created in the current database.`
        : 'Table not found. Verify the table name and ensure it exists.',
    suggestion: () => 'Check available tables in the database explorer or create the table first.',
  },

  {
    name: 'sqlite_no_such_column',
    test: (msg) => /no such column/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/no such column:\s*(\S+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Column '${token}' does not exist. Check the column name or table structure.`
        : 'Column not found. Verify the column name is spelled correctly.',
    suggestion: () => 'Use the database explorer to view available columns in the table.',
  },

  {
    name: 'sqlite_unique_constraint',
    test: (msg) => /UNIQUE constraint failed/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/UNIQUE constraint failed:\s*(\S+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Duplicate value violates UNIQUE constraint on '${token}'. This value must be unique.`
        : 'UNIQUE constraint violation. The value already exists in the table.',
    suggestion: () => 'Use a different value or update the existing record instead.',
  },

  {
    name: 'sqlite_not_null_constraint',
    test: (msg) => /NOT NULL constraint failed/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/NOT NULL constraint failed:\s*(\S+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Column '${token}' cannot be NULL. A value is required.`
        : 'NOT NULL constraint violation. This column requires a value.',
    suggestion: () => 'Provide a valid value for this column or set a DEFAULT value in the schema.',
  },

  {
    name: 'sqlite_foreign_key_constraint',
    test: (msg) => /FOREIGN KEY constraint failed/i.test(msg),
    extract: () => 'foreign key',
    explain: () => 'Foreign key constraint violation. The referenced record does not exist.',
    suggestion: () =>
      'Ensure the referenced record exists in the parent table before inserting or updating.',
  },

  {
    name: 'sqlite_datatype_mismatch',
    test: (msg) => /datatype mismatch/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/column\s+(\S+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Data type mismatch for column '${token}'. The value type does not match the column type.`
        : 'Data type mismatch. The value does not match the expected column type.',
    suggestion: () =>
      'Ensure INTEGER columns receive numbers, TEXT columns receive strings, etc.',
  },

  {
    name: 'sqlite_syntax_error',
    test: (msg) => /syntax error/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/near\s+"([^"]+)"|near\s+(\S+)/i);
      return match ? match[1] || match[2] : null;
    },
    explain: (token) =>
      token
        ? `SQL syntax error near '${token}'. Check the query structure.`
        : 'SQL syntax error. Review your query structure and keyword spelling.',
    suggestion: () =>
      'Verify SQL keywords are spelled correctly and check for missing commas or parentheses.',
  },

  {
    name: 'sqlite_ambiguous_column',
    test: (msg) => /ambiguous column name/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/ambiguous column name:\s*(\S+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Column '${token}' is ambiguous. Multiple tables have this column.`
        : 'Ambiguous column reference. Specify which table the column belongs to.',
    suggestion: (token) =>
      token
        ? `Prefix the column with a table name or alias: 'tablename.${token}'`
        : 'Use table.column syntax to clarify which table the column belongs to.',
  },

  {
    name: 'sqlite_constraint_failed',
    test: (msg) => /constraint failed/i.test(msg) && !/UNIQUE|NOT NULL|FOREIGN KEY/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/constraint failed:\s*(\S+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Constraint '${token}' failed. The operation violates a table constraint.`
        : 'A table constraint was violated. Check your data against table constraints.',
    suggestion: () => 'Review the table schema and ensure data meets all constraints.',
  },

  {
    name: 'sqlite_no_such_function',
    test: (msg) => /no such function/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/no such function:\s*(\S+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Function '${token}' is not recognized by SQLite.`
        : 'Unknown SQL function. Verify the function name.',
    suggestion: () =>
      'Check SQLite documentation for available functions or check function spelling.',
  },

  // -------------------------------------
  // SYNTAX ERRORS
  // -------------------------------------
  {
    name: 'syntax_error_1064',
    test: (msg) => /error 1064|syntax error|syntax error at or near/i.test(msg),
    extract: (msg) => {
      // Extract token near the error (MySQL and PostgreSQL formats)
      const match = msg.match(/near\s+['"](.*?)['"]|near\s+(\S+)|at or near\s+"([^"]+)"/i);
      if (match) return match[1] || match[2] || match[3];
      return null;
    },
    explain: (token) =>
      token
        ? `There is a syntax issue near '${token}'. Check the spelling of SQL keywords and punctuation.`
        : 'SQL syntax error detected. Review your query structure and keyword spelling.',
    suggestion: () =>
      'Verify SQL keywords are spelled correctly and check for missing commas, parentheses, or quotes.',
  },

  {
    name: 'typo_select',
    test: (msg) => /\bSELEC\b|\bSELCT\b|\bSELET\b|\bSEECT\b/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/\b(SELEC|SELCT|SELET|SEECT)\b/i);
      return match ? match[1] : null;
    },
    explain: (token) => `'${token}' is not a valid SQL keyword. Did you mean 'SELECT'?`,
    suggestion: () => "Check spelling: use 'SELECT' to retrieve data from tables.",
  },

  {
    name: 'typo_from',
    test: (msg) => /\bFORM\b(?!AT)/i.test(msg) && !/\bFORMAT\b/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/\b(FORM)\b/i);
      return match ? match[1] : null;
    },
    explain: (token) => `'${token}' is not valid in this context. Did you mean 'FROM'?`,
    suggestion: () => "Use 'FROM' to specify which table to query.",
  },

  {
    name: 'typo_where',
    test: (msg) => /\bWHRE\b|\bWHER\b|\bWHEER\b/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/\b(WHRE|WHER|WHEER)\b/i);
      return match ? match[1] : null;
    },
    explain: (token) => `'${token}' is not valid. Did you mean 'WHERE'?`,
    suggestion: () => "Use 'WHERE' to filter rows based on conditions.",
  },

  {
    name: 'typo_insert',
    test: (msg) => /\bINSRT\b|\bINSERT\s+ITNO\b|\bINTO\s+VALUES\b/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/\b(INSRT|ITNO)\b/i);
      return match ? match[1] : null;
    },
    explain: (token) => `'${token}' is misspelled. Check the INSERT INTO syntax.`,
    suggestion: () => "Use 'INSERT INTO table_name (columns) VALUES (values)'.",
  },

  {
    name: 'missing_comma',
    test: (msg) => /expect.*comma|missing.*comma|columns.*comma/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/['"`]([^'"`]+)['"`]/);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Missing comma near '${token}'. Column lists must be separated by commas.`
        : 'Missing comma in column list. Separate multiple columns with commas.',
    suggestion: () => 'Example: SELECT column1, column2, column3 FROM table',
  },

  {
    name: 'missing_from',
    test: (msg) => /missing.*FROM|expect.*FROM|SELECT.*without.*FROM/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/SELECT\s+(.*?)\s*$/i);
      return match ? 'FROM' : null;
    },
    explain: () => 'SELECT statement is missing the FROM clause.',
    suggestion: () => 'Add FROM table_name after the column list.',
  },

  {
    name: 'unexpected_token',
    test: (msg) => /unexpected.*token|unexpected\s+['"](.+?)['"]/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/unexpected\s+['"](.+?)['"]/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Unexpected '${token}' found. This token is not valid in this position.`
        : 'Unexpected token encountered. Check your query syntax.',
    suggestion: () => 'Review the SQL syntax for the statement you are writing.',
  },

  // -------------------------------------
  // UNKNOWN IDENTIFIERS
  // -------------------------------------
  {
    name: 'unknown_column',
    test: (msg) =>
      /unknown column|column.*not found|column.*doesn't exist|column.*does not exist/i.test(msg),
    extract: (msg) => {
      // Match both MySQL and PostgreSQL formats
      const match = msg.match(/column\s+['"`]([^'"`]+)['"`]/i) ||
                    msg.match(/column\s+"([^"]+)"/i) ||
                    msg.match(/column\s+(\w+)/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `The column '${token}' does not exist. Check spelling or verify the table structure.`
        : 'Column not found. Verify the column name and table structure.',
    suggestion: () =>
      'Check column spelling or use the database explorer to view available columns.',
  },

  {
    name: 'unknown_table',
    test: (msg) =>
      /unknown table|table.*not found|table.*doesn't exist|relation.*does not exist|table.*does not exist/i.test(msg),
    extract: (msg) => {
      // Match both MySQL and PostgreSQL formats
      const match = msg.match(/(?:table|relation)\s+['"`]?(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)['"`]?/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `The table '${token}' does not exist. Verify the table name and database selection.`
        : 'Table not found. Make sure the table exists in the current database.',
    suggestion: (token) =>
      token
        ? `Check if table '${token}' exists or if you're connected to the right database.`
        : 'View available tables in the database explorer.',
  },

  {
    name: 'unknown_database',
    test: (msg) => /unknown database|database.*not found/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/database\s+['"`]([^'"`]+)['"`]/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `The database '${token}' does not exist on this server.`
        : 'Database not found. Verify the database name.',
    suggestion: () => 'Check available databases in the connection panel.',
  },

  {
    name: 'unknown_alias',
    test: (msg) => /unknown.*alias|alias.*not found/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/['"`]([^'"`]+)['"`]/);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `The alias '${token}' has not been defined in your query.`
        : 'Unknown table alias. Define aliases in the FROM clause.',
    suggestion: () => 'Make sure all table aliases are defined with AS keyword.',
  },

  // -------------------------------------
  // AGGREGATION ERRORS
  // -------------------------------------
  {
    name: 'must_use_group_by',
    test: (msg) =>
      /not in GROUP BY|must.*GROUP BY|aggregate.*without.*GROUP BY|isn't in GROUP BY/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/column\s+['"`]([^'"`]+)['"`]|['"`]([^'"`]+)['"`]\s+isn't/i);
      return match ? match[1] || match[2] : null;
    },
    explain: (token) =>
      token
        ? `Column '${token}' must appear in GROUP BY or be used in an aggregate function.`
        : 'When using aggregate functions, non-aggregated columns must be in GROUP BY.',
    suggestion: () =>
      'Add missing columns to GROUP BY or wrap them in aggregate functions like SUM(), AVG(), etc.',
  },

  {
    name: 'invalid_aggregate',
    test: (msg) =>
      /invalid use.*aggregate|aggregate.*not allowed|can't.*aggregate/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/\b(SUM|AVG|COUNT|MAX|MIN)\b/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Invalid use of aggregate function ${token}.`
        : 'Aggregate function used incorrectly.',
    suggestion: () =>
      'Aggregate functions like SUM, AVG, COUNT can only be used in SELECT or HAVING clauses.',
  },

  {
    name: 'having_without_group_by',
    test: (msg) => /HAVING.*without.*GROUP BY/i.test(msg),
    extract: () => 'HAVING',
    explain: () => 'HAVING clause requires GROUP BY to be present.',
    suggestion: () =>
      'Add GROUP BY clause before HAVING, or use WHERE instead if filtering individual rows.',
  },

  // -------------------------------------
  // CONSTRAINT ERRORS
  // -------------------------------------
  {
    name: 'duplicate_entry',
    test: (msg) => /duplicate entry|duplicate key|violates unique constraint|duplicate value/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/entry\s+['"`]([^'"`]+)['"`]|Key\s+\(([^)]+)\)/i);
      return match ? match[1] || match[2] : null;
    },
    explain: (token) =>
      token
        ? `A record with value '${token}' already exists. This field must be unique.`
        : 'Cannot insert duplicate value in a unique or primary key field.',
    suggestion: () =>
      'Use a different value, update the existing record, or remove the duplicate.',
  },

  {
    name: 'foreign_key_fails',
    test: (msg) =>
      /foreign key constraint fails|violates foreign key constraint|cannot add.*foreign key/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/CONSTRAINT\s+[`'""]([^`'""]+)[`'""]|constraint\s+"([^"]+)"/i);
      return match ? match[1] || match[2] : null;
    },
    explain: (token) =>
      token
        ? `Foreign key constraint '${token}' failed. Referenced record does not exist.`
        : 'Cannot perform operation due to foreign key constraint violation.',
    suggestion: () =>
      'Ensure the referenced record exists in the parent table before inserting.',
  },

  {
    name: 'cannot_delete_parent',
    test: (msg) =>
      /cannot delete.*parent row|foreign key constraint.*delete|update or delete.*violates foreign key/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/table\s+[`'""]([^`'""]+)[`'""]|on table "([^"]+)"/i);
      return match ? match[1] || match[2] : null;
    },
    explain: (token) =>
      token
        ? `Cannot delete from '${token}' because child records reference it.`
        : 'Cannot delete record because other records depend on it.',
    suggestion: () =>
      'Delete dependent records first, or use CASCADE delete if appropriate.',
  },

  // -------------------------------------
  // NULL / VALUE ERRORS
  // -------------------------------------
  {
    name: 'column_cannot_be_null',
    test: (msg) => /column.*cannot be null|not null constraint|violates not-null constraint|null value in column/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/column\s+['"`]([^'"`]+)['"`]|column "([^"]+)"/i);
      return match ? match[1] || match[2] : null;
    },
    explain: (token) =>
      token
        ? `Column '${token}' does not allow NULL values. Provide a valid value.`
        : 'NULL value provided for a column that requires a value.',
    suggestion: () => 'Provide a non-NULL value or set a DEFAULT value for the column.',
  },

  {
    name: 'data_too_long',
    test: (msg) => /data too long|value too long|string.*too long|value.*exceeds maximum length/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/column\s+['"`]([^'"`]+)['"`]|column "([^"]+)"/i);
      return match ? match[1] || match[2] : null;
    },
    explain: (token) =>
      token
        ? `Value for '${token}' exceeds the maximum allowed length.`
        : 'The data provided is too long for the column.',
    suggestion: () =>
      'Reduce the length of the value or increase the column size in the table schema.',
  },

  {
    name: 'incorrect_integer',
    test: (msg) =>
      /incorrect integer|invalid integer|invalid input syntax for.*integer|integer.*out of range/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/['"`]([^'"`]+)['"`]/);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `'${token}' is not a valid integer value.`
        : 'Invalid integer value provided.',
    suggestion: () => 'Ensure numeric columns receive valid numbers without quotes.',
  },

  {
    name: 'incorrect_date',
    test: (msg) =>
      /incorrect.*date|invalid date|date.*format|invalid input syntax for.*date|invalid input syntax for.*timestamp|incorrect datetime/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/['"`]([^'"`]+)['"`]/);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `'${token}' is not a valid date format.`
        : 'Invalid date format provided.',
    suggestion: () => "Use standard date format like 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS'.",
  },

  {
    name: 'out_of_range',
    test: (msg) => /out of range|value.*too large|value.*too small/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/column\s+['"`]([^'"`]+)['"`]/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Value for '${token}' is outside the allowed range.`
        : 'Value is outside the allowed range for this column type.',
    suggestion: () => 'Check the min/max values allowed for the column data type.',
  },

  // -------------------------------------
  // JOIN ERRORS
  // -------------------------------------
  {
    name: 'ambiguous_column',
    test: (msg) => /column.*ambiguous|ambiguous.*column/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/column\s+['"`]([^'"`]+)['"`]/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Column '${token}' is ambiguous. Multiple tables have this column name.`
        : 'Column reference is ambiguous. Specify which table the column belongs to.',
    suggestion: (token) =>
      token
        ? `Use table prefix like 'tablename.${token}' or define table aliases.`
        : 'Prefix columns with table names or aliases to clarify which table they belong to.',
  },

  {
    name: 'unknown_table_in_join',
    test: (msg) =>
      /unknown table.*in.*join|table.*not found.*join/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/table\s+['"`]([^'"`]+)['"`]/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Table '${token}' used in JOIN does not exist.`
        : 'A table referenced in your JOIN clause does not exist.',
    suggestion: () => 'Check table names in your JOIN clauses and verify they exist.',
  },

  {
    name: 'cross_join_cartesian',
    test: (msg) =>
      /cross join|cartesian product|missing join condition/i.test(msg),
    extract: () => 'JOIN',
    explain: () =>
      'Missing JOIN condition. This can create a large cartesian product.',
    suggestion: () =>
      'Add ON or USING clause to specify how tables should be joined.',
  },

  // -------------------------------------
  // PERMISSION ERRORS
  // -------------------------------------
  {
    name: 'access_denied',
    test: (msg) => /access denied|permission denied|must be owner|insufficient privilege/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/user\s+['"`]([^'"`@]+)['"`@]/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Access denied for user '${token}'. Insufficient privileges.`
        : 'Access denied. You do not have permission for this operation.',
    suggestion: () =>
      'Contact your database administrator to grant the necessary privileges.',
  },

  {
    name: 'command_denied',
    test: (msg) => /command denied|privilege.*denied/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/command\s+(.*?)\s+denied/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `You do not have privileges to execute '${token}' command.`
        : 'Insufficient privileges to execute this command.',
    suggestion: () => 'Request the required privileges from your administrator.',
  },

  // -------------------------------------
  // SUBQUERY ERRORS
  // -------------------------------------
  {
    name: 'subquery_returns_more_than_one',
    test: (msg) =>
      /subquery returns more than 1 row|subquery.*multiple rows/i.test(msg),
    extract: () => 'subquery',
    explain: () =>
      'Subquery returned more than one row when only one is expected.',
    suggestion: () =>
      'Use LIMIT 1 in subquery, or use IN instead of = for multiple values.',
  },

  {
    name: 'subquery_no_comparison',
    test: (msg) => /subquery.*without.*comparison/i.test(msg),
    extract: () => 'subquery',
    explain: () => 'Subquery used incorrectly without proper comparison operator.',
    suggestion: () =>
      'Subqueries must be used with comparison operators like =, IN, EXISTS.',
  },

  // -------------------------------------
  // DIVISION / MATH ERRORS
  // -------------------------------------
  {
    name: 'division_by_zero',
    test: (msg) => /division by zero|divide by zero/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/column\s+['"`]([^'"`]+)['"`]/i);
      return match ? match[1] : null;
    },
    explain: () => 'Cannot divide by zero. A divisor has a zero value.',
    suggestion: () =>
      'Add a WHERE clause to exclude zero values or use NULLIF(divisor, 0).',
  },

  // -------------------------------------
  // ORDER BY / LIMIT ERRORS
  // -------------------------------------
  {
    name: 'order_by_unknown_column',
    test: (msg) => /ORDER BY.*unknown column|unknown column.*ORDER BY/i.test(msg),
    extract: (msg) => {
      const match = msg.match(/column\s+['"`]([^'"`]+)['"`]/i);
      return match ? match[1] : null;
    },
    explain: (token) =>
      token
        ? `Column '${token}' in ORDER BY does not exist.`
        : 'Column referenced in ORDER BY clause does not exist.',
    suggestion: () => 'Use column names or aliases that exist in the SELECT list.',
  },

  // -------------------------------------
  // CONNECTION ERRORS
  // -------------------------------------
  {
    name: 'connection_refused',
    test: (msg) => /connection refused|can't connect/i.test(msg),
    extract: () => 'connection',
    explain: () =>
      'Cannot connect to database server. Server may be down or unreachable.',
    suggestion: () =>
      'Check if the database server is running and network connection is available.',
  },

  {
    name: 'connection_timeout',
    test: (msg) => /connection timeout|timeout.*connection/i.test(msg),
    extract: () => 'connection',
    explain: () => 'Connection attempt timed out. Server did not respond in time.',
    suggestion: () =>
      'Check network connectivity, firewall settings, or increase timeout value.',
  },

  // -------------------------------------
  // TRANSACTION ERRORS
  // -------------------------------------
  {
    name: 'deadlock',
    test: (msg) => /deadlock|lock wait timeout/i.test(msg),
    extract: () => 'transaction',
    explain: () => 'Transaction deadlock detected or lock wait timeout exceeded.',
    suggestion: () => 'Retry the transaction or optimize query execution order.',
  },

  // -------------------------------------
  // DEFAULT FALLBACK
  // -------------------------------------
  {
    name: 'generic_error',
    test: () => true, // Always matches as fallback
    extract: (msg) => {
      // Try to extract any quoted word
      const match = msg.match(/['"`]([^'"`]+)['"`]/);
      return match ? match[1] : null;
    },
    explain: () => 'An error occurred while executing your query.',
    suggestion: () => 'Review the error details and check your SQL syntax.',
  },
];

// ========================================
// MAIN INTERPRETATION FUNCTION
// ========================================

/**
 * Interprets a raw MySQL error message and returns structured, human-readable output
 * 
 * @param errorMessage - Raw error message from MySQL
 * @param queryText - The SQL query that caused the error
 * @param editorInstance - Monaco editor instance for highlighting
 * @returns Interpreted error with type, token, and natural message
 */
export function interpretError(
  errorMessage: string,
  queryText: string,
  editorInstance?: any
): InterpretedError {
  // Find the first matching rule
  for (const rule of errorRules) {
    if (rule.test(errorMessage)) {
      const token = rule.extract(errorMessage);
      const naturalMessage = rule.explain(token);
      const suggestion = rule.suggestion ? rule.suggestion(token) : undefined;

      // Highlight token in editor if available
      if (editorInstance) {
        highlightErrorToken(editorInstance, queryText, token);
      }

      return {
        type: rule.name,
        token,
        naturalMessage,
        suggestion,
      };
    }
  }

  // Fallback (should never reach here due to generic_error rule)
  return {
    type: 'unknown',
    token: null,
    naturalMessage: 'An unexpected error occurred.',
    suggestion: 'Check the error message details.',
  };
}

/**
 * Gets all available error rule names (useful for testing/debugging)
 */
export function getAvailableRuleNames(): string[] {
  return errorRules.map((rule) => rule.name);
}

/**
 * Tests an error message against a specific rule by name
 */
export function testRule(ruleName: string, errorMessage: string): boolean {
  const rule = errorRules.find((r) => r.name === ruleName);
  return rule ? rule.test(errorMessage) : false;
}
