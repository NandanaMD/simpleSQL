import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { useState } from 'react';
import { HelpCircle, Search, BookOpen, Code, AlertCircle } from 'lucide-react';

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sqlReference = {
  'SELECT': {
    syntax: 'SELECT column1, column2 FROM table_name WHERE condition;',
    description: 'Retrieves data from one or more tables',
    examples: [
      'SELECT * FROM users;',
      'SELECT name, email FROM users WHERE active = true;',
      'SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL \'7 days\';'
    ]
  },
  'INSERT': {
    syntax: 'INSERT INTO table_name (column1, column2) VALUES (value1, value2);',
    description: 'Adds new rows to a table',
    examples: [
      'INSERT INTO users (name, email) VALUES (\'John Doe\', \'john@example.com\');',
      'INSERT INTO products (name, price) VALUES (\'Widget\', 19.99), (\'Gadget\', 29.99);'
    ]
  },
  'UPDATE': {
    syntax: 'UPDATE table_name SET column1 = value1 WHERE condition;',
    description: 'Modifies existing rows in a table',
    examples: [
      'UPDATE users SET active = false WHERE last_login < NOW() - INTERVAL \'1 year\';',
      'UPDATE products SET price = price * 1.10 WHERE category = \'electronics\';'
    ]
  },
  'DELETE': {
    syntax: 'DELETE FROM table_name WHERE condition;',
    description: 'Removes rows from a table',
    examples: [
      'DELETE FROM logs WHERE created_at < NOW() - INTERVAL \'90 days\';',
      'DELETE FROM temp_data WHERE processed = true;'
    ]
  },
  'JOIN': {
    syntax: 'SELECT * FROM table1 JOIN table2 ON table1.id = table2.table1_id;',
    description: 'Combines rows from two or more tables based on a related column',
    examples: [
      'SELECT u.name, o.total FROM users u INNER JOIN orders o ON u.id = o.user_id;',
      'SELECT * FROM products p LEFT JOIN categories c ON p.category_id = c.id;',
      'SELECT * FROM employees e RIGHT JOIN departments d ON e.dept_id = d.id;'
    ]
  },
  'CREATE TABLE': {
    syntax: 'CREATE TABLE table_name (column1 datatype constraints, column2 datatype constraints);',
    description: 'Creates a new table',
    examples: [
      'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(255) UNIQUE);',
      'CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), total DECIMAL(10,2));'
    ]
  },
  'ALTER TABLE': {
    syntax: 'ALTER TABLE table_name ADD/DROP/MODIFY column_name datatype;',
    description: 'Modifies an existing table structure',
    examples: [
      'ALTER TABLE users ADD COLUMN phone VARCHAR(20);',
      'ALTER TABLE products ALTER COLUMN price TYPE DECIMAL(12,2);',
      'ALTER TABLE orders DROP COLUMN shipping_method;'
    ]
  },
};

const errorCodes = {
  '42P01': { message: 'Table does not exist', solution: 'Check the table name and ensure it exists in the current database' },
  '42703': { message: 'Column does not exist', solution: 'Verify the column name is spelled correctly and exists in the table' },
  '42601': { message: 'Syntax error', solution: 'Review your SQL syntax for missing keywords, commas, or parentheses' },
  '23505': { message: 'Unique violation', solution: 'The value already exists and must be unique. Use a different value or update the existing row' },
  '23503': { message: 'Foreign key violation', solution: 'The referenced record does not exist. Ensure the foreign key value is valid' },
  '42501': { message: 'Insufficient privilege', solution: 'You don\'t have permission for this operation. Contact your database administrator' },
  '08006': { message: 'Connection failure', solution: 'Cannot connect to the database. Check if the server is running and accessible' },
  '28P01': { message: 'Authentication failed', solution: 'Incorrect username or password. Verify your credentials' },
  '22P02': { message: 'Invalid text representation', solution: 'Data type mismatch. Check that values match the expected column types' },
  '22003': { message: 'Numeric value out of range', solution: 'The number is too large or too small for the column type' },
};

const keyboardShortcuts = [
  { keys: 'Ctrl + Enter', description: 'Execute query' },
  { keys: 'Ctrl + S', description: 'Save current query' },
  { keys: 'Ctrl + Shift + F', description: 'Format SQL' },
  { keys: 'Ctrl + /', description: 'Toggle line comment' },
  { keys: 'Ctrl + F', description: 'Find in editor' },
  { keys: 'Ctrl + H', description: 'Find and replace' },
  { keys: 'Ctrl + D', description: 'Duplicate line' },
  { keys: 'Alt + Up/Down', description: 'Move line up/down' },
  { keys: 'Ctrl + K, Ctrl + C', description: 'Comment selection' },
  { keys: 'Ctrl + Z', description: 'Undo' },
  { keys: 'Ctrl + Y', description: 'Redo' },
];

export function HelpPanel({ open, onOpenChange }: HelpPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [errorCodeSearch, setErrorCodeSearch] = useState('');

  const filteredReference = Object.entries(sqlReference).filter(([key, value]) =>
    key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    value.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredErrors = Object.entries(errorCodes).filter(([code, error]) =>
    code.includes(errorCodeSearch) ||
    error.message.toLowerCase().includes(errorCodeSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help & Documentation
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="reference" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reference">
              <Code className="h-4 w-4 mr-2" />
              SQL Reference
            </TabsTrigger>
            <TabsTrigger value="errors">
              <AlertCircle className="h-4 w-4 mr-2" />
              Error Codes
            </TabsTrigger>
            <TabsTrigger value="shortcuts">
              <BookOpen className="h-4 w-4 mr-2" />
              Shortcuts
            </TabsTrigger>
          </TabsList>

          {/* SQL Reference */}
          <TabsContent value="reference" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search SQL commands..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredReference.map(([command, details]) => (
                <div key={command} className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-lg">{command}</h3>
                  <p className="text-sm text-muted-foreground">{details.description}</p>
                  <div className="bg-muted p-3 rounded font-mono text-sm">
                    {details.syntax}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Examples:</p>
                    {details.examples.map((example, idx) => (
                      <div key={idx} className="bg-muted/50 p-2 rounded font-mono text-xs">
                        {example}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Error Codes */}
          <TabsContent value="errors" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search error code or message..."
                value={errorCodeSearch}
                onChange={(e) => setErrorCodeSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredErrors.map(([code, error]) => (
                <div key={code} className="border-l-4 border-destructive bg-destructive/10 p-4 rounded">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold font-mono text-sm">{code}</p>
                      <p className="text-sm font-medium mt-1">{error.message}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Solution:</strong> {error.solution}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Keyboard Shortcuts */}
          <TabsContent value="shortcuts" className="space-y-4 mt-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {keyboardShortcuts.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                  <span className="text-sm">{shortcut.description}</span>
                  <kbd className="px-3 py-1 text-xs font-semibold bg-muted rounded border shadow-sm">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
