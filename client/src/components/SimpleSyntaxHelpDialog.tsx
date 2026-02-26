import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { X } from 'lucide-react';

interface SimpleSyntaxHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimpleSyntaxHelpDialog({ open, onOpenChange }: SimpleSyntaxHelpDialogProps) {
  const [activeTab, setActiveTab] = useState('select');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SimpleSyntax Command Reference</DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-border pb-2 mb-4">
          {[
            { id: 'select', label: 'SELECT' },
            { id: 'aggregates', label: 'AGGREGATES' },
            { id: 'group', label: 'GROUP BY' },
            { id: 'insert', label: 'INSERT' },
            { id: 'update', label: 'UPDATE' },
            { id: 'delete', label: 'DELETE' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`px-3 py-1 text-sm rounded ${
                activeTab === tab.id
                  ? 'bg-[#0078d4] text-white font-semibold'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === 'select' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">SELECT Operations</h3>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Show all columns:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">show tablename</pre>
                <p className="text-xs text-gray-600">→ SELECT * FROM tablename</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Show specific columns:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">show tablename col1 col2 col3</pre>
                <p className="text-xs text-gray-600">→ SELECT col1, col2, col3 FROM tablename</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">With WHERE clause:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">show tablename where age &gt; 30</pre>
                <p className="text-xs text-gray-600">→ SELECT * FROM tablename WHERE age &gt; 30</p>
                <p className="text-xs text-gray-500 mt-1">
                  Operators: =, !=, &lt;&gt;, &gt;, &lt;, &gt;=, &lt;=, like<br />
                  Logical: and, or
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">With ORDER BY:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">show tablename order by col asc</pre>
                <p className="text-xs text-gray-600">→ SELECT * FROM tablename ORDER BY col ASC</p>
                <p className="text-xs text-gray-500 mt-1">Use 'asc' or 'desc'</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">With LIMIT:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">show tablename limit 10</pre>
                <p className="text-xs text-gray-600">→ SELECT * FROM tablename LIMIT 10</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Combined example:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  show users name email where age &gt; 30 order by name asc limit 50
                </pre>
                <p className="text-xs text-gray-600">
                  → SELECT name, email FROM users WHERE age &gt; 30 ORDER BY name ASC LIMIT 50
                </p>
              </div>
            </div>
          )}

          {activeTab === 'aggregates' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Aggregate Functions</h3>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Count rows:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">count tablename</pre>
                <p className="text-xs text-gray-600">→ SELECT COUNT(*) FROM tablename</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Sum column values:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">sum tablename colname</pre>
                <p className="text-xs text-gray-600">→ SELECT SUM(colname) FROM tablename</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Average:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">avg tablename colname</pre>
                <p className="text-xs text-gray-600">→ SELECT AVG(colname) FROM tablename</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Minimum / Maximum:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  min tablename colname{'\n'}
                  max tablename colname
                </pre>
                <p className="text-xs text-gray-600">
                  → SELECT MIN(colname) FROM tablename<br />
                  → SELECT MAX(colname) FROM tablename
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">With WHERE clause:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  sum sales amount where status = 'completed'
                </pre>
                <p className="text-xs text-gray-600">
                  → SELECT SUM(amount) FROM sales WHERE status = 'completed'
                </p>
              </div>
            </div>
          )}

          {activeTab === 'group' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">GROUP BY</h3>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Group by single column:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">group tablename by colname</pre>
                <p className="text-xs text-gray-600">
                  → SELECT colname, COUNT(*) as count FROM tablename GROUP BY colname
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Group by multiple columns:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">group tablename by col1 col2</pre>
                <p className="text-xs text-gray-600">
                  → SELECT col1, col2, COUNT(*) as count FROM tablename GROUP BY col1, col2
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Example:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">group orders by customer_id</pre>
                <p className="text-xs text-gray-600">
                  → SELECT customer_id, COUNT(*) as count FROM orders GROUP BY customer_id
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Note: Returns grouped columns + count
                </p>
              </div>
            </div>
          )}

          {activeTab === 'insert' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">INSERT</h3>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Add single row:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  add tablename col1=value1 col2=value2
                </pre>
                <p className="text-xs text-gray-600">
                  → INSERT INTO tablename (col1, col2) VALUES (value1, value2)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Columns are sorted alphabetically in output
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Example with strings:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  add users name='John' email='john@example.com' age=30
                </pre>
                <p className="text-xs text-gray-600">
                  → INSERT INTO users (age, email, name) VALUES (30, 'john@example.com', 'John')
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  String values must be single-quoted
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Value types:</h4>
                <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
                  <li>Strings: 'John', 'New York' (single quotes)</li>
                  <li>Numbers: 42, 3.14, -10</li>
                  <li>Booleans: true, false</li>
                  <li>NULL: null</li>
                  <li>Dates: '2024-01-15', '2024-01-15 14:30:00'</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'update' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">UPDATE</h3>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Update with WHERE (required):</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  update tablename set col1=value1 col2=value2 where condition
                </pre>
                <p className="text-xs text-gray-600">
                  → UPDATE tablename SET col1=value1, col2=value2 WHERE condition
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Example:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  update users set status='inactive' where last_login &lt; '2023-01-01'
                </pre>
                <p className="text-xs text-gray-600">
                  → UPDATE users SET status='inactive' WHERE last_login &lt; '2023-01-01'
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mt-4">
                <p className="text-sm font-semibold text-yellow-800">⚠️ Safety Feature</p>
                <p className="text-xs text-yellow-700 mt-1">
                  WHERE clause is REQUIRED in SimpleSyntax mode to prevent accidental mass updates.
                  Use SQL mode for unrestricted updates.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'delete' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">DELETE</h3>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Delete with WHERE (required):</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  remove tablename where condition
                </pre>
                <p className="text-xs text-gray-600">
                  → DELETE FROM tablename WHERE condition
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Example:</h4>
                <pre className="bg-gray-100 p-2 rounded text-sm">
                  remove logs where created &lt; '2023-01-01'
                </pre>
                <p className="text-xs text-gray-600">
                  → DELETE FROM logs WHERE created &lt; '2023-01-01'
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mt-4">
                <p className="text-sm font-semibold text-yellow-800">⚠️ Safety Feature</p>
                <p className="text-xs text-yellow-700 mt-1">
                  WHERE clause is REQUIRED in SimpleSyntax mode to prevent accidental data loss.
                  Use SQL mode for unrestricted deletes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Limitations Section */}
        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-lg font-semibold mb-2">Not Supported (Use SQL Mode)</h3>
          <ul className="text-xs text-gray-600 space-y-1 ml-4 list-disc">
            <li>Subqueries, JOINs, DISTINCT, UNION</li>
            <li>Aliases (AS keyword)</li>
            <li>Functions in WHERE clause (e.g., UPPER, LOWER)</li>
            <li>Parentheses for operator precedence in WHERE</li>
            <li>Multi-statement batches</li>
            <li>HAVING clause</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-border text-center">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-2 py-1 bg-gray-100 rounded">Ctrl+Shift+M</kbd> to toggle between SQL and SimpleSyntax modes
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
