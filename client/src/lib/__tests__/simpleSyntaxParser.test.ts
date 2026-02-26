/**
 * Unit tests for SimpleSyntax Parser
 * Tests all command types, operators, and edge cases
 */

import { describe, it, expect } from 'vitest';
import { translate } from '../simpleSyntaxParser';

describe('SimpleSyntax Parser', () => {
  describe('SHOW command (SELECT)', () => {
    it('should translate show all columns', () => {
      const result = translate('show users');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users');
    });

    it('should translate show specific columns', () => {
      const result = translate('show users name email age');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT name, email, age FROM users');
    });

    it('should translate show with WHERE clause', () => {
      const result = translate('show users where age > 30');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users WHERE age > 30');
    });

    it('should translate show with multiple WHERE conditions', () => {
      const result = translate('show users where age > 30 and status = \'active\'');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users WHERE age > 30 AND status = \'active\'');
    });

    it('should translate show with ORDER BY', () => {
      const result = translate('show users order by name asc');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users ORDER BY name ASC');
    });

    it('should translate show with ORDER BY DESC', () => {
      const result = translate('show users order by created desc');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users ORDER BY created DESC');
    });

    it('should translate show with multiple ORDER BY columns', () => {
      const result = translate('show users order by status asc name desc');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users ORDER BY status ASC, name DESC');
    });

    it('should translate show with LIMIT', () => {
      const result = translate('show users limit 10');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users LIMIT 10');
    });

    it('should translate show with all clauses combined', () => {
      const result = translate('show users name email where age > 30 order by name asc limit 50');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT name, email FROM users WHERE age > 30 ORDER BY name ASC LIMIT 50');
    });

    it('should reject show without table name', () => {
      const result = translate('show');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('table name');
    });

    it('should be case insensitive', () => {
      const result = translate('SHOW Users WHERE Age > 30');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM Users WHERE Age > 30');
    });
  });

  describe('COUNT command', () => {
    it('should translate count without WHERE', () => {
      const result = translate('count users');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT COUNT(*) FROM users');
    });

    it('should translate count with WHERE', () => {
      const result = translate('count orders where status = \'completed\'');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT COUNT(*) FROM orders WHERE status = \'completed\'');
    });

    it('should reject count without table name', () => {
      const result = translate('count');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('table name');
    });
  });

  describe('Aggregate functions (SUM, AVG, MIN, MAX)', () => {
    it('should translate sum', () => {
      const result = translate('sum sales amount');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT SUM(amount) FROM sales');
    });

    it('should translate avg', () => {
      const result = translate('avg sales amount');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT AVG(amount) FROM sales');
    });

    it('should translate min', () => {
      const result = translate('min products price');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT MIN(price) FROM products');
    });

    it('should translate max', () => {
      const result = translate('max products price');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT MAX(price) FROM products');
    });

    it('should translate aggregates with WHERE', () => {
      const result = translate('sum sales amount where date > \'2024-01-01\'');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT SUM(amount) FROM sales WHERE date > \'2024-01-01\'');
    });

    it('should reject aggregates without column name', () => {
      const result = translate('sum sales');
      expect(result.success).toBe(false);
      expect(result.error?.message).toBeDefined();
    });
  });

  describe('GROUP BY command', () => {
    it('should translate group by single column', () => {
      const result = translate('group orders by customer_id');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT customer_id, COUNT(*) as count FROM orders GROUP BY customer_id');
    });

    it('should translate group by multiple columns', () => {
      const result = translate('group sales by region product_id');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT region, product_id, COUNT(*) as count FROM sales GROUP BY region, product_id');
    });

    it('should reject group without by keyword', () => {
      const result = translate('group orders customer_id');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('by');
    });

    it('should reject group without column name', () => {
      const result = translate('group orders by');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('column name');
    });
  });

  describe('ADD command (INSERT)', () => {
    it('should translate insert with single column', () => {
      const result = translate('add users name=\'John\'');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('INSERT INTO users (name) VALUES (\'John\')');
    });

    it('should translate insert with multiple columns', () => {
      const result = translate('add users name=\'John\' email=\'john@example.com\' age=30');
      expect(result.success).toBe(true);
      // Columns should be sorted alphabetically
      expect(result.sql).toBe('INSERT INTO users (age, email, name) VALUES (30, \'john@example.com\', \'John\')');
    });

    it('should handle boolean values', () => {
      const result = translate('add users name=\'John\' is_admin=true');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('1'); // true -> 1
    });

    it('should handle null values', () => {
      const result = translate('add users name=\'John\' middle_name=null');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('NULL');
    });

    it('should reject insert without assignments', () => {
      const result = translate('add users');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('assignment');
    });

    it('should reject insert with invalid assignment format', () => {
      const result = translate('add users name John');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('assignment');
    });
  });

  describe('UPDATE command', () => {
    it('should translate update with WHERE', () => {
      const result = translate('update users set status=\'inactive\' where last_login < \'2023-01-01\'');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('UPDATE users SET status = \'inactive\' WHERE last_login < \'2023-01-01\'');
    });

    it('should translate update with multiple columns', () => {
      const result = translate('update users set status=\'active\' verified=true where id=1');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('SET status = \'active\', verified = 1');
      expect(result.sql).toContain('WHERE id = 1');
    });

    it('should REQUIRE WHERE clause', () => {
      const result = translate('update users set status=\'inactive\'');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('WHERE clause');
      expect(result.error?.message).toContain('SimpleSyntax mode');
    });

    it('should reject update without set keyword', () => {
      const result = translate('update users status=\'inactive\' where id=1');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('set');
    });
  });

  describe('REMOVE command (DELETE)', () => {
    it('should translate delete with WHERE', () => {
      const result = translate('remove logs where created < \'2023-01-01\'');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DELETE FROM logs WHERE created < \'2023-01-01\'');
    });

    it('should REQUIRE WHERE clause', () => {
      const result = translate('remove logs');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('WHERE clause');
      expect(result.error?.message).toContain('SimpleSyntax mode');
    });

    it('should reject if WHERE is missing', () => {
      const result = translate('remove users id=1');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('WHERE');
    });
  });

  describe('WHERE clause operators', () => {
    it('should support = operator', () => {
      const result = translate('show users where status = \'active\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('status = \'active\'');
    });

    it('should support != operator', () => {
      const result = translate('show users where status != \'inactive\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('status != \'inactive\'');
    });

    it('should support <> operator', () => {
      const result = translate('show users where status <> \'inactive\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('status <> \'inactive\'');
    });

    it('should support > operator', () => {
      const result = translate('show users where age > 18');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('age > 18');
    });

    it('should support < operator', () => {
      const result = translate('show users where age < 65');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('age < 65');
    });

    it('should support >= operator', () => {
      const result = translate('show users where age >= 18');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('age >= 18');
    });

    it('should support <= operator', () => {
      const result = translate('show users where age <= 65');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('age <= 65');
    });

    it('should support LIKE operator', () => {
      const result = translate('show users where name like \'%john%\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('name LIKE \'%john%\'');
    });

    it('should support AND logical operator', () => {
      const result = translate('show users where age > 18 and status = \'active\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('age > 18 AND status = \'active\'');
    });

    it('should support OR logical operator', () => {
      const result = translate('show users where role = \'admin\' or role = \'moderator\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('role = \'admin\' OR role = \'moderator\'');
    });
  });

  describe('NULL handling', () => {
    it('should translate col = null to IS NULL', () => {
      const result = translate('show users where manager = null');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users WHERE manager IS NULL');
    });

    it('should translate col != null to IS NOT NULL', () => {
      const result = translate('show users where manager != null');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users WHERE manager IS NOT NULL');
    });

    it('should translate col <> null to IS NOT NULL', () => {
      const result = translate('show users where manager <> null');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users WHERE manager IS NOT NULL');
    });

    it('should handle NULL in INSERT', () => {
      const result = translate('add users name=\'John\' manager=null');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('NULL');
    });
  });

  describe('Value types', () => {
    it('should handle string values', () => {
      const result = translate('show users where name = \'John Doe\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('\'John Doe\'');
    });

    it('should handle integer values', () => {
      const result = translate('show users where age = 42');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('age = 42');
    });

    it('should handle decimal values', () => {
      const result = translate('show products where price = 19.99');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('price = 19.99');
    });

    it('should handle negative numbers', () => {
      const result = translate('show transactions where amount = -50');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('amount = -50');
    });

    it('should handle boolean true', () => {
      const result = translate('show users where is_active = true');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('is_active = 1');
    });

    it('should handle boolean false', () => {
      const result = translate('show users where is_active = false');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('is_active = 0');
    });

    it('should handle date strings', () => {
      const result = translate('show users where created > \'2024-01-15\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('\'2024-01-15\'');
    });

    it('should handle datetime strings', () => {
      const result = translate('show logs where timestamp > \'2024-01-15 14:30:00\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('\'2024-01-15 14:30:00\'');
    });
  });

  describe('SQL injection protection', () => {
    it('should validate table names', () => {
      const result = translate('show users; DROP TABLE users;');
      expect(result.success).toBe(false);
    });

    it('should validate column names', () => {
      const result = translate('show users name; email');
      expect(result.success).toBe(false);
    });

    it('should escape single quotes in strings', () => {
      const result = translate('add users name=\'O\'\'Brien\'');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('\'O\'\'Brien\'');
    });
  });

  describe('Error handling', () => {
    it('should reject unknown commands', () => {
      const result = translate('select * from users');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unknown command');
      expect(result.error?.message).toContain('select');
    });

    it('should reject empty input', () => {
      const result = translate('');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('empty');
    });

    it('should reject whitespace-only input', () => {
      const result = translate('   ');
      expect(result.success).toBe(false);
    });

    it('should handle trailing semicolons', () => {
      const result = translate('show users;');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users');
    });

    it('should provide helpful error messages', () => {
      const result = translate('show');
      expect(result.success).toBe(false);
      expect(result.error?.message).toBeDefined();
      expect(result.error?.token).toBeDefined();
      expect(result.error?.position).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Case insensitivity', () => {
    it('should handle mixed case commands', () => {
      const result = translate('ShOw UsErS WhErE AgE > 30');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM UsErS WHERE AgE > 30');
    });

    it('should handle uppercase keywords', () => {
      const result = translate('SHOW users WHERE age > 30 ORDER BY name ASC LIMIT 10');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('SELECT');
    });

    it('should handle lowercase keywords', () => {
      const result = translate('show users where age > 30 order by name asc limit 10');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('SELECT');
    });

    it('should preserve case in identifiers', () => {
      const result = translate('show MyTableName MyColumnName');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('MyTableName');
      expect(result.sql).toContain('MyColumnName');
    });
  });

  describe('Whitespace handling', () => {
    it('should handle multiple spaces', () => {
      const result = translate('show   users    where   age  >  30');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users WHERE age > 30');
    });

    it('should handle tabs', () => {
      const result = translate('show\tusers\twhere\tage\t>\t30');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users WHERE age > 30');
    });

    it('should handle newlines', () => {
      const result = translate('show users\nwhere age > 30\norder by name asc');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('SELECT * FROM users WHERE age > 30 ORDER BY name ASC');
    });
  });

  describe('Complex queries', () => {
    it('should handle complex SELECT with all options', () => {
      const result = translate(
        'show orders id customer_id amount where status = \'completed\' and amount >= 100 order by amount desc limit 20'
      );
      expect(result.success).toBe(true);
      expect(result.sql).toBe(
        'SELECT id, customer_id, amount FROM orders WHERE status = \'completed\' AND amount >= 100 ORDER BY amount DESC LIMIT 20'
      );
    });

    it('should handle multiple ORDER BY with mixed ASC/DESC', () => {
      const result = translate('show users order by status asc created desc name asc');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('SELECT * FROM users ORDER BY status ASC, created DESC, name ASC');
    });

    it('should handle complex WHERE with AND and OR', () => {
      const result = translate(
        'show products where category = \'electronics\' and price < 1000 or featured = true'
      );
      expect(result.success).toBe(true);
      expect(result.sql).toContain('category = \'electronics\' AND price < 1000 OR featured = 1');
    });
  });
});
