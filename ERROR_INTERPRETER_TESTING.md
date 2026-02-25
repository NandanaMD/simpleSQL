# SQL Error Interpreter - Testing Guide

## Overview

The rule-based SQL error interpretation engine converts raw MySQL error messages into clear, human-readable explanations and highlights problematic tokens in the Monaco editor.

**Key Features:**
- ✅ NO AI - Pure deterministic pattern matching
- ✅ NO external APIs - Fully local processing
- ✅ 40+ error rules covering common MySQL errors
- ✅ Monaco editor token highlighting
- ✅ Extensible rule-based architecture

---

## Architecture

### Files
- **`client/src/lib/errorInterpreter.ts`** - Main error interpretation engine
- **`client/src/components/SQLEditor.tsx`** - Integration with Monaco editor
- **`client/src/index.css`** - Error highlighting styles

### Flow
1. SQL query fails with MySQL error
2. `interpretError(errorMessage, queryText, editorInstance)` is called
3. Error matched against rules using pattern matching
4. Problematic token extracted from error message
5. Token highlighted in Monaco editor (red wavy underline)
6. Natural explanation returned to user

---

## Testing Error Rules

Below are test cases for each error category. Run these queries to see the error interpreter in action:

### 1. SYNTAX ERRORS

#### Test 1.1: Error 1064 - General Syntax Error
```sql
SELECT * FORM users;
```
**Expected:**
- Token: `FORM`
- Message: "There is a syntax issue near 'FORM'. Check the spelling of SQL keywords..."
- Highlight: `FORM` in red

#### Test 1.2: Typo in SELECT
```sql
SELEC * FROM users;
```
**Expected:**
- Token: `SELEC`
- Message: "'SELEC' is not a valid SQL keyword. Did you mean 'SELECT'?"
- Highlight: `SELEC` in red

#### Test 1.3: Typo in WHERE
```sql
SELECT * FROM users WHRE id = 1;
```
**Expected:**
- Token: `WHRE`
- Message: "'WHRE' is not valid. Did you mean 'WHERE'?"
- Highlight: `WHRE` in red

#### Test 1.4: Missing Comma
```sql
SELECT id name email FROM users;
```
**Expected:**
- Message: "Missing comma in column list. Separate multiple columns with commas."

#### Test 1.5: Missing FROM Clause
```sql
SELECT id, name;
```
**Expected:**
- Message: "SELECT statement is missing the FROM clause."
- Suggestion: "Add FROM table_name after the column list."

---

### 2. UNKNOWN IDENTIFIERS

#### Test 2.1: Unknown Column
```sql
SELECT salery FROM employees;
```
**Expected:**
- Token: `salery`
- Message: "The column 'salery' does not exist. Check spelling or verify the table structure."
- Highlight: `salery` in red

#### Test 2.2: Unknown Table
```sql
SELECT * FROM userz;
```
**Expected:**
- Token: `userz`
- Message: "The table 'userz' does not exist. Verify the table name and database selection."
- Highlight: `userz` in red

#### Test 2.3: Unknown Database
```sql
USE nonexistent_db;
```
**Expected:**
- Token: `nonexistent_db`
- Message: "The database 'nonexistent_db' does not exist on this server."

#### Test 2.4: Unknown Alias
```sql
SELECT u.name FROM users WHERE u2.id = 1;
```
**Expected:**
- Token: `u2`
- Message: "The alias 'u2' has not been defined in your query."
- Suggestion: "Make sure all table aliases are defined with AS keyword."

---

### 3. AGGREGATION ERRORS

#### Test 3.1: Missing GROUP BY
```sql
SELECT department, COUNT(*), salary FROM employees;
```
**Expected:**
- Token: `salary`
- Message: "Column 'salary' must appear in GROUP BY or be used in an aggregate function."
- Suggestion: "Add missing columns to GROUP BY or wrap them in aggregate functions..."

#### Test 3.2: Invalid Aggregate Function
```sql
SELECT * FROM users WHERE SUM(price) > 100;
```
**Expected:**
- Token: `SUM`
- Message: "Invalid use of aggregate function SUM."
- Suggestion: "Aggregate functions can only be used in SELECT or HAVING clauses."

#### Test 3.3: HAVING without GROUP BY
```sql
SELECT * FROM orders HAVING total > 1000;
```
**Expected:**
- Token: `HAVING`
- Message: "HAVING clause requires GROUP BY to be present."
- Suggestion: "Add GROUP BY clause before HAVING, or use WHERE instead..."

---

### 4. CONSTRAINT ERRORS

#### Test 4.1: Duplicate Entry for PRIMARY KEY
```sql
INSERT INTO users (id, name) VALUES (1, 'John');
-- Run twice to trigger duplicate key error
```
**Expected:**
- Token: `1` (the duplicate value)
- Message: "A record with value '1' already exists. This field must be unique."
- Suggestion: "Use a different value, update the existing record, or remove the duplicate."

#### Test 4.2: Foreign Key Constraint Fails
```sql
INSERT INTO orders (user_id, total) VALUES (9999, 100);
-- Assuming user_id 9999 doesn't exist
```
**Expected:**
- Message: "Cannot perform operation due to foreign key constraint violation."
- Suggestion: "Ensure the referenced record exists in the parent table..."

#### Test 4.3: Cannot Delete Parent Row
```sql
DELETE FROM users WHERE id = 1;
-- If user has related orders
```
**Expected:**
- Message: "Cannot delete record because other records depend on it."
- Suggestion: "Delete dependent records first, or use CASCADE delete if appropriate."

---

### 5. NULL / VALUE ERRORS

#### Test 5.1: Column Cannot Be NULL
```sql
INSERT INTO users (id, name) VALUES (100, NULL);
-- If name is NOT NULL
```
**Expected:**
- Token: `name`
- Message: "Column 'name' does not allow NULL values. Provide a valid value."
- Suggestion: "Provide a non-NULL value or set a DEFAULT value for the column."

#### Test 5.2: Data Too Long
```sql
INSERT INTO users (name) VALUES ('This is a very long string that exceeds the VARCHAR limit...');
```
**Expected:**
- Token: `name`
- Message: "Value for 'name' exceeds the maximum allowed length."
- Suggestion: "Reduce the length of the value or increase the column size..."

#### Test 5.3: Incorrect Integer Value
```sql
INSERT INTO products (id, price) VALUES ('abc', 100);
```
**Expected:**
- Token: `abc`
- Message: "'abc' is not a valid integer value."
- Suggestion: "Ensure numeric columns receive valid numbers without quotes."

#### Test 5.4: Incorrect Date Format
```sql
INSERT INTO orders (order_date) VALUES ('2024-13-45');
```
**Expected:**
- Token: `2024-13-45`
- Message: "'2024-13-45' is not a valid date format."
- Suggestion: "Use standard date format like 'YYYY-MM-DD'..."

#### Test 5.5: Value Out of Range
```sql
INSERT INTO products (quantity) VALUES (9999999999999999999);
-- Exceeds INT range
```
**Expected:**
- Message: "Value is outside the allowed range for this column type."
- Suggestion: "Check the min/max values allowed for the column data type."

---

### 6. JOIN ERRORS

#### Test 6.1: Ambiguous Column Name
```sql
SELECT id, name FROM users JOIN orders ON users.id = orders.user_id;
-- If both tables have 'id' column
```
**Expected:**
- Token: `id`
- Message: "Column 'id' is ambiguous. Multiple tables have this column name."
- Suggestion: "Use table prefix like 'tablename.id' or define table aliases."

#### Test 6.2: Unknown Table in JOIN
```sql
SELECT * FROM users JOIN orderz ON users.id = orderz.user_id;
```
**Expected:**
- Token: `orderz`
- Message: "Table 'orderz' used in JOIN does not exist."
- Suggestion: "Check table names in your JOIN clauses..."

---

### 7. PERMISSION ERRORS

#### Test 7.1: Access Denied
```sql
DROP DATABASE production;
-- If user lacks permission
```
**Expected:**
- Message: "Access denied. You do not have permission for this operation."
- Suggestion: "Contact your database administrator to grant the necessary privileges."

---

### 8. SUBQUERY ERRORS

#### Test 8.1: Subquery Returns More Than One Row
```sql
SELECT * FROM users WHERE id = (SELECT user_id FROM orders);
```
**Expected:**
- Token: `subquery`
- Message: "Subquery returned more than one row when only one is expected."
- Suggestion: "Use LIMIT 1 in subquery, or use IN instead of = for multiple values."

---

### 9. MATH ERRORS

#### Test 9.1: Division by Zero
```sql
SELECT price / 0 FROM products;
```
**Expected:**
- Message: "Cannot divide by zero. A divisor has a zero value."
- Suggestion: "Add a WHERE clause to exclude zero values or use NULLIF(divisor, 0)."

---

### 10. ORDER BY ERRORS

#### Test 10.1: Unknown Column in ORDER BY
```sql
SELECT name FROM users ORDER BY salery;
```
**Expected:**
- Token: `salery`
- Message: "Column 'salery' in ORDER BY does not exist."
- Suggestion: "Use column names or aliases that exist in the SELECT list."

---

## Visual Highlighting

When an error is detected:

1. **Monaco Editor**: The problematic token is highlighted with:
   - Red wavy underline (squiggly)
   - Light red background tint
   - Bold font weight
   - Red marker in overview ruler
   - Red marker in minimap

2. **Toast Notification**: User-friendly message appears with:
   - Natural explanation (title)
   - Actionable suggestion (description)
   - 8-second duration

3. **Results Panel**: Raw technical error displayed for debugging

---

## Extensibility

### Adding New Rules

To add a new error rule, add an object to the `errorRules` array in `errorInterpreter.ts`:

```typescript
{
  name: 'my_custom_error',
  test: (msg) => /some pattern/i.test(msg),
  extract: (msg) => {
    const match = msg.match(/['"`]([^'"`]+)['"`]/);
    return match ? match[1] : null;
  },
  explain: (token) =>
    token
      ? `Custom explanation with ${token}`
      : 'Fallback explanation',
  suggestion: () => 'Helpful suggestion for fixing the issue',
}
```

### Rule Properties

- **name**: Unique identifier for the rule
- **test**: Function returning `true` if error message matches this rule
- **extract**: Function to extract the problematic token from error message
- **explain**: Function to generate natural explanation
- **suggestion**: Optional function to provide actionable suggestions

---

## Implementation Details

### Pattern Matching Strategy

1. Rules are checked sequentially (first match wins)
2. Most specific rules come first, generic fallback last
3. Uses regex with case-insensitive matching
4. Extracts tokens using capture groups

### Token Extraction

Common patterns:
- `['"]([^'"]+)['"]` - Quoted strings
- `near\s+(\S+)` - Token after "near"
- `column\s+['"]([^'"]+)['"]` - Column names
- `table\s+['"]([^'"]+)['"]` - Table names

### Monaco Highlighting

Uses `deltaDecorations` API:
- Converts string index to line/column position
- Creates decoration range around token
- Applies CSS classes for visual styling
- Clears previous decorations on new error/success

---

## Performance

- **Rule matching**: O(n) where n = number of rules (~40)
- **Token extraction**: O(m) where m = error message length
- **Highlighting**: O(1) Monaco API call
- **Total overhead**: <1ms per error

---

## Browser Compatibility

Works in all modern browsers that support:
- ES6+ JavaScript
- Monaco Editor
- CSS3 animations

---

## Debugging

### Available Utility Functions

```typescript
// Get all rule names
const rules = getAvailableRuleNames();
console.log(rules);

// Test specific rule
const matches = testRule('unknown_column', errorMessage);
console.log(matches);
```

### Console Logging

The interpreter logs warnings if:
- Monaco instance is unavailable
- Token cannot be located in query
- Highlighting fails

---

## Future Enhancements

Possible additions without using AI:
- Support for PostgreSQL error formats
- Support for SQLite error messages
- Custom rule sets per database type
- Rule priority/ordering configuration
- Multi-token highlighting
- Error correction suggestions based on Levenshtein distance

---

## Summary

This error interpreter covers **40+ MySQL error patterns** including:
- ✅ 8 syntax error variants
- ✅ 4 unknown identifier types
- ✅ 3 aggregation errors
- ✅ 3 constraint violations
- ✅ 5 NULL/value errors
- ✅ 3 JOIN issues
- ✅ 2 permission errors
- ✅ 2 subquery errors
- ✅ 1 division error
- ✅ 1 ORDER BY error
- ✅ Plus connection, transaction, and fallback handlers

All using **deterministic rule-based pattern matching** - no AI, no external APIs.
