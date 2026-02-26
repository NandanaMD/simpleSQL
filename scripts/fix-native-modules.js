/**
 * Fix native modules for the current environment
 * This script rebuilds native modules (like better-sqlite3) for Electron
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const isCI = process.env.CI === 'true';

console.log('🔧 Fixing native modules for Electron...');
console.log(`   Environment: ${isProduction ? 'production' : 'development'}`);
console.log(`   Node version: ${process.version}`);

try {
  // Check if better-sqlite3 is installed
  const betterSqlitePath = path.join(__dirname, '..', 'node_modules', 'better-sqlite3');
  if (!fs.existsSync(betterSqlitePath)) {
    console.log('⚠️  better-sqlite3 not found, skipping rebuild');
    process.exit(0);
  }

  // Rebuild native modules for Electron
  console.log('   Rebuilding native modules...');
  
  try {
    execSync('npx electron-builder install-app-deps', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Native modules rebuilt successfully!');
  } catch (error) {
    console.warn('⚠️  electron-builder failed, trying @electron/rebuild...');
    
    // Fallback to electron-rebuild
    execSync('npx electron-rebuild', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Native modules rebuilt with electron-rebuild!');
  }

} catch (error) {
  if (isCI) {
    console.error('❌ Failed to rebuild native modules in CI environment');
    process.exit(1);
  } else {
    console.error('❌ Failed to rebuild native modules:', error.message);
    console.log('');
    console.log('📝 Manual fix:');
    console.log('   Run: npx electron-builder install-app-deps');
    console.log('   Or: npx electron-rebuild');
    console.log('');
    // Don't fail in development, just warn
    process.exit(0);
  }
}
