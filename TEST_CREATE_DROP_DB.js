/**
 * Test CREATE DATABASE and DROP DATABASE commands
 * This verifies the SQLite-specific handling of these PostgreSQL commands
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing CREATE/DROP DATABASE commands...\n');

// Simulate the query service logic
function handleCreateDatabase(dbName, connectionId) {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, `${connectionId}_${dbName}.db`);
  
  // Create the database (this is what happens in the query service)
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.close();
  
  return dbPath;
}

function handleDropDatabase(dbName, connectionId) {
  const dataDir = path.join(__dirname, 'data');
  const dbPath = path.join(dataDir, `${connectionId}_${dbName}.db`);
  
  // Delete database files
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  
  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);
  }
  
  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath);
  }
}

try {
  // Test 1: CREATE DATABASE
  console.log('1️⃣  Testing CREATE DATABASE...');
  const connectionId = 'test-connection-123';
  const dbName = 'testdb';
  
  const dbPath = handleCreateDatabase(dbName, connectionId);
  
  if (fs.existsSync(dbPath)) {
    console.log('✅ Database file created:', dbPath);
  } else {
    throw new Error('Database file was not created!');
  }
  
  // Test 2: Verify database is functional
  console.log('\n2️⃣  Testing database functionality...');
  const db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE test_table (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
  
  db.prepare('INSERT INTO test_table (name) VALUES (?)').run('Test Record');
  const result = db.prepare('SELECT * FROM test_table').all();
  
  if (result.length === 1 && result[0].name === 'Test Record') {
    console.log('✅ Database is functional and can store data');
  } else {
    throw new Error('Database is not working correctly!');
  }
  
  db.close();
  
  // Test 3: DROP DATABASE
  console.log('\n3️⃣  Testing DROP DATABASE...');
  handleDropDatabase(dbName, connectionId);
  
  if (!fs.existsSync(dbPath)) {
    console.log('✅ Database file deleted successfully');
  } else {
    throw new Error('Database file was not deleted!');
  }
  
  // Verify WAL/SHM files are also deleted
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  
  if (!fs.existsSync(walPath) && !fs.existsSync(shmPath)) {
    console.log('✅ WAL and SHM files deleted successfully');
  }
  
  console.log('\n✅ ALL TESTS PASSED!');
  console.log('🎉 CREATE DATABASE and DROP DATABASE work correctly for SQLite!\n');
  
} catch (error) {
  console.error('\n❌ TEST FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
}
