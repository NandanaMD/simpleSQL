-- Performance Test Data Generator for SimpleSQL
-- Use these queries to test the virtualized ResultsPanel

-- ========================================
-- Test 1: Generate 100 rows (baseline)
-- ========================================
WITH RECURSIVE numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 100
)
SELECT 
  n as id,
  'User ' || n as username,
  'user' || n || '@example.com' as email,
  CASE WHEN n % 2 = 0 THEN 1 ELSE 0 END as is_active,
  n * 1.5 as balance,
  date('2024-01-01', '+' || (n % 365) || ' days') as created_at,
  'https://example.com/user/' || n as profile_url,
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.' as bio
FROM numbers;

-- ========================================
-- Test 2: Generate 1000 rows (medium)
-- ========================================
WITH RECURSIVE numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 1000
)
SELECT 
  n as id,
  'User ' || n as username,
  'user' || n || '@example.com' as email,
  CASE WHEN n % 2 = 0 THEN 1 ELSE 0 END as is_active,
  n * 1.5 as balance,
  date('2024-01-01', '+' || (n % 365) || ' days') as created_at,
  'https://example.com/user/' || n as profile_url,
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' as bio,
  n * 10 as points,
  CASE 
    WHEN n % 5 = 0 THEN 'premium'
    WHEN n % 3 = 0 THEN 'standard'
    ELSE 'basic'
  END as tier
FROM numbers;

-- ========================================
-- Test 3: Generate 3000 rows (large)
-- ========================================
WITH RECURSIVE numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 3000
)
SELECT 
  n as id,
  'User ' || n as username,
  'user' || n || '@example.com' as email,
  CASE WHEN n % 2 = 0 THEN 1 ELSE 0 END as is_active,
  n * 1.5 as balance,
  date('2024-01-01', '+' || (n % 365) || ' days') as created_at,
  'https://example.com/user/' || n as profile_url,
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.' as bio,
  n * 10 as points,
  CASE 
    WHEN n % 5 = 0 THEN 'premium'
    WHEN n % 3 = 0 THEN 'standard'
    ELSE 'basic'
  END as tier
FROM numbers;

-- ========================================
-- Test 4: Generate 10000 rows (very large)
-- ========================================
WITH RECURSIVE numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 10000
)
SELECT 
  n as id,
  'User ' || n as username,
  'user' || n || '@example.com' as email,
  CASE WHEN n % 2 = 0 THEN 1 ELSE 0 END as is_active,
  CASE WHEN n % 7 = 0 THEN NULL ELSE n * 1.5 END as balance,
  date('2024-01-01', '+' || (n % 365) || ' days') as created_at,
  CASE WHEN n % 10 = 0 THEN 'https://example.com/user/' || n ELSE NULL END as profile_url,
  'Bio for user ' || n as bio,
  n * 10 as points,
  CASE 
    WHEN n % 5 = 0 THEN 'premium'
    WHEN n % 3 = 0 THEN 'standard'
    ELSE 'basic'
  END as tier
FROM numbers;

-- ========================================
-- Test 5: Create and populate actual table
-- ========================================

-- Create database for testing
CREATE DATABASE IF NOT EXISTS test_performance;

-- Use the database
-- (In SimpleSQL, select the database in the explorer)

-- Create table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  balance REAL,
  created_at TEXT,
  profile_url TEXT,
  bio TEXT,
  points INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'basic'
);

-- Insert 5000 rows (adjust as needed)
WITH RECURSIVE numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 5000
)
INSERT INTO users (id, username, email, is_active, balance, created_at, profile_url, bio, points, tier)
SELECT 
  n,
  'User ' || n,
  'user' || n || '@example.com',
  CASE WHEN n % 2 = 0 THEN 1 ELSE 0 END,
  CASE WHEN n % 7 = 0 THEN NULL ELSE n * 1.5 END,
  date('2024-01-01', '+' || (n % 365) || ' days'),
  CASE WHEN n % 10 = 0 THEN 'https://example.com/user/' || n ELSE NULL END,
  CASE 
    WHEN n % 100 = 0 THEN 'This is a very long bio that will be truncated in the UI because it exceeds 100 characters. Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    ELSE 'Bio for user ' || n
  END,
  n * 10,
  CASE 
    WHEN n % 5 = 0 THEN 'premium'
    WHEN n % 3 = 0 THEN 'standard'
    ELSE 'basic'
  END
FROM numbers;

-- Query the table
SELECT * FROM users;

-- Test sorting (should remain fast)
SELECT * FROM users ORDER BY balance DESC LIMIT 3000;

-- Test filtering (client-side filter should remain responsive)
SELECT * FROM users WHERE tier = 'premium';

-- ========================================
-- Performance Benchmarks
-- ========================================

-- Measure query execution time
-- The result should show in the Output tab of SimpleSQL

-- Before optimization:
-- 2000 rows × 10 columns = ~22,000 DOM nodes
-- Expected UI freeze: 700-1700ms
-- Scrolling: Janky, low FPS

-- After optimization:
-- Only ~20-30 rows rendered (visible viewport)
-- ~300 DOM nodes total
-- Expected render time: 20-50ms
-- Scrolling: Smooth, 60 FPS

-- ========================================
-- Stress Test
-- ========================================

-- Generate 30000 rows (will be limited to 50000 by server)
WITH RECURSIVE numbers(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM numbers WHERE n < 30000
)
SELECT 
  n as id,
  'User ' || n as name,
  n * 1.5 as value,
  CASE WHEN n % 2 = 0 THEN 1 ELSE 0 END as flag
FROM numbers;
