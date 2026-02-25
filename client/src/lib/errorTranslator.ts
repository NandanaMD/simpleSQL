/**
 * Translates technical database error messages into user-friendly natural language
 */

export interface TranslatedError {
  userMessage: string;
  technicalMessage: string;
  severity: 'error' | 'warning' | 'info';
  suggestions?: string[];
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

export function translateError(technicalError: string): TranslatedError {
  const lowerError = technicalError.toLowerCase();

  // Syntax errors
  if (lowerError.includes('syntax error')) {
    const match = technicalError.match(/at or near "([^"]+)"/i) || 
                  technicalError.match(/near "([^"]+)"/i);
    const nearWord = match ? match[1] : '';
    
    return {
      userMessage: nearWord 
        ? `SQL syntax error near '${nearWord}'. Please check your query structure.`
        : 'SQL syntax error. Please check your query structure.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Verify all SQL keywords are spelled correctly',
        'Check for missing commas, parentheses, or quotes',
        'Make sure SELECT statements have proper FROM clauses'
      ]
    };
  }

  // Table/relation not found
  if (lowerError.includes('does not exist') || lowerError.includes('doesn\'t exist')) {
    const tableMatch = technicalError.match(/relation "([^"]+)"/i) || 
                       technicalError.match(/table '([^']+)'/i) ||
                       technicalError.match(/table "([^"]+)"/i);
    const columnMatch = technicalError.match(/column "([^"]+)"/i) || 
                        technicalError.match(/column '([^']+)'/i);
    
    if (tableMatch) {
      const tableName = tableMatch[1];
      return {
        userMessage: `Table '${tableName}' not found. Make sure the table exists in the selected database.`,
        technicalMessage: technicalError,
        severity: 'error',
        suggestions: [
          'Check the table name spelling',
          'Verify you\'re connected to the correct database',
          'Check the database explorer to see available tables'
        ]
      };
    }
    
    if (columnMatch) {
      const columnName = columnMatch[1];
      return {
        userMessage: `Column '${columnName}' doesn't exist in this table.`,
        technicalMessage: technicalError,
        severity: 'error',
        suggestions: [
          'Check the column name spelling',
          'View table structure in the database explorer',
          'Make sure you\'re querying the right table'
        ]
      };
    }

    return {
      userMessage: 'The requested database object was not found.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: ['Verify the object name and database selection']
    };
  }

  // Permission denied
  if (lowerError.includes('permission denied') || lowerError.includes('access denied')) {
    return {
      userMessage: 'Permission denied. You don\'t have the required privileges for this operation.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Contact your database administrator',
        'Check your user permissions',
        'Use a different connection with appropriate privileges'
      ]
    };
  }

  // Connection errors
  if (lowerError.includes('connection') && (lowerError.includes('refused') || lowerError.includes('timeout'))) {
    return {
      userMessage: 'Cannot connect to the database. The server may be down or unreachable.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Check if the database server is running',
        'Verify your connection settings',
        'Check your network connection'
      ]
    };
  }

  // Authentication errors
  if (lowerError.includes('authentication') || lowerError.includes('login failed')) {
    return {
      userMessage: 'Login failed. Please check your username and password.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Verify your credentials are correct',
        'Check if your account is active',
        'Contact your database administrator if the issue persists'
      ]
    };
  }

  // Duplicate key/unique constraint
  if (lowerError.includes('duplicate') && (lowerError.includes('key') || lowerError.includes('unique'))) {
    return {
      userMessage: 'Cannot insert duplicate value. This value already exists and must be unique.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Check for existing records with the same value',
        'Use an UPDATE instead of INSERT if you want to modify existing data',
        'Change the value to something unique'
      ]
    };
  }

  // Foreign key constraint
  if (lowerError.includes('foreign key')) {
    return {
      userMessage: 'Cannot perform this operation because it would violate a relationship between tables.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Make sure related records exist in the referenced table',
        'Delete related records first before deleting parent records',
        'Check your foreign key constraints'
      ]
    };
  }

  // Data type mismatch
  if (lowerError.includes('invalid input syntax') || lowerError.includes('type')) {
    return {
      userMessage: 'Invalid data type. The value doesn\'t match the expected format.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Check that numbers don\'t contain letters',
        'Make sure dates are in the correct format',
        'Verify boolean values are true/false or 0/1'
      ]
    };
  }

  // Division by zero
  if (lowerError.includes('division by zero')) {
    return {
      userMessage: 'Cannot divide by zero. Check your calculation.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Add a condition to exclude zero values',
        'Use NULLIF to handle zero divisors',
        'Check your data for unexpected zero values'
      ]
    };
  }

  // Ambiguous column
  if (lowerError.includes('ambiguous')) {
    return {
      userMessage: 'Column reference is ambiguous. Multiple tables have columns with the same name.',
      technicalMessage: technicalError,
      severity: 'error',
      suggestions: [
        'Prefix column names with table names (e.g., users.id)',
        'Use table aliases for clarity',
        'Specify which table\'s column you want to use'
      ]
    };
  }

  // Default fallback for unknown errors
  return {
    userMessage: 'An error occurred while executing your query.',
    technicalMessage: technicalError,
    severity: 'error',
    suggestions: [
      'Check the technical details below for more information',
      'Review your SQL syntax',
      'Verify your connection and database settings'
    ]
  };
}

export function createSuccessMessage(rowCount: number, executionTime: number, command: string): string {
  const commandUpper = command.toUpperCase();
  
  if (commandUpper === 'SELECT') {
    if (rowCount === 0) {
      return `Query completed successfully, but no rows were found.`;
    } else if (rowCount === 1) {
      return `Query completed successfully • 1 row returned • ${executionTime}ms`;
    } else {
      return `Query completed successfully • ${rowCount.toLocaleString()} rows returned • ${executionTime}ms`;
    }
  } else if (commandUpper === 'INSERT') {
    return `Successfully inserted ${rowCount} row${rowCount !== 1 ? 's' : ''} • ${executionTime}ms`;
  } else if (commandUpper === 'UPDATE') {
    if (rowCount === 0) {
      return `No rows were updated. The conditions may not match any records.`;
    }
    return `Successfully updated ${rowCount} row${rowCount !== 1 ? 's' : ''} • ${executionTime}ms`;
  } else if (commandUpper === 'DELETE') {
    if (rowCount === 0) {
      return `No rows were deleted. The conditions may not match any records.`;
    }
    return `Successfully deleted ${rowCount} row${rowCount !== 1 ? 's' : ''} • ${executionTime}ms`;
  } else if (commandUpper === 'CREATE') {
    return `Object created successfully • ${executionTime}ms`;
  } else if (commandUpper === 'DROP') {
    return `Object dropped successfully • ${executionTime}ms`;
  } else if (commandUpper === 'ALTER') {
    return `Object altered successfully • ${executionTime}ms`;
  }
  
  return `Query completed successfully • ${executionTime}ms`;
}
