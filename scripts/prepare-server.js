const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Preparing server for packaging...');

const rootPath = path.join(__dirname, '..');
const serverPath = path.join(__dirname, '..', 'server');
const serverNodeModules = path.join(serverPath, 'node_modules');
const rootNodeModules = path.join(rootPath, 'node_modules');

// Read server package.json to get dependencies
const serverPackage = JSON.parse(
  fs.readFileSync(path.join(serverPath, 'package.json'), 'utf8')
);

const dependencies = [
  ...Object.keys(serverPackage.dependencies || {}),
];

const runtimeDependencies = Object.fromEntries(
  Object.entries(serverPackage.dependencies || {}).filter(
    ([dep]) => !dep.startsWith('@sql-ide/')
  )
);

console.log(`Copying ${dependencies.length} dependencies to server/node_modules...`);

// Create server/node_modules if it doesn't exist
if (!fs.existsSync(serverNodeModules)) {
  fs.mkdirSync(serverNodeModules, { recursive: true });
}

// Copy each dependency and its subdependencies
for (const dep of dependencies) {
  // Skip workspace dependencies (those starting with @sql-ide/)
  if (dep.startsWith('@sql-ide/')) {
    console.log(`  Skipping workspace dependency: ${dep}`);
    continue;
  }
  
  const srcPath = path.join(rootNodeModules, dep);
  const destPath = path.join(serverNodeModules, dep);
  
  // Skip if already exists (avoid copying to same location)
  if (fs.existsSync(destPath)) {
    console.log(`  Skipping ${dep} (already exists)...`);
    continue;
  }
  
  if (fs.existsSync(srcPath)) {
    console.log(`  Copying ${dep}...`);
    fs.cpSync(srcPath, destPath, { recursive: true, force: true });
  } else {
    console.warn(`  Warning: ${dep} not found in root node_modules`);
  }
}

// Also need to copy dependencies of dependencies (sub-dependencies)
// Use npm ls to get the full dependency tree and copy all needed modules
console.log('Installing all nested dependencies...');
const serverPackageJsonPath = path.join(serverPath, 'package.json');
const originalServerPackageJson = fs.readFileSync(serverPackageJsonPath, 'utf8');

try {
  const sanitizedPackage = {
    ...serverPackage,
    dependencies: runtimeDependencies,
  };

  fs.writeFileSync(
    serverPackageJsonPath,
    JSON.stringify(sanitizedPackage, null, 2) + '\n',
    'utf8'
  );

  execSync('npm install --prefix server --omit=dev --legacy-peer-deps', {
    cwd: rootPath,
    stdio: 'inherit'
  });
} finally {
  fs.writeFileSync(serverPackageJsonPath, originalServerPackageJson, 'utf8');
}

// Rebuild native modules for Electron since server runs via fork with Electron's Node.js
console.log('Rebuilding native modules for Electron...');
try {
  // Get electron version from root package.json devDependencies
  const rootPackage = JSON.parse(
    fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8')
  );
  const electronVersion = rootPackage.devDependencies.electron.replace('^', '');
  console.log(`  Electron version: ${electronVersion}`);
  
  // Use @electron/rebuild to rebuild native modules in server/node_modules
  execSync(
    `npx @electron/rebuild --version=${electronVersion} --module-dir=server --force`,
    {
      cwd: rootPath,
      stdio: 'inherit'
    }
  );
  console.log('  ✓ Native modules rebuilt successfully');
} catch (error) {
  console.error('  ⚠ Warning: Failed to rebuild native modules:', error.message);
  console.error('  The app may have issues with native dependencies like better-sqlite3');
}

console.log('✅ Server prepared successfully!');


