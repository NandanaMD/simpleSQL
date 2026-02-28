#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const allowedBumps = new Set(['patch', 'minor', 'major']);
const args = process.argv.slice(2);

let bump = 'patch';
let dryRun = false;

for (const arg of args) {
  if (arg === '--dry-run' || arg === '-n') {
    dryRun = true;
    continue;
  }

  if (arg.startsWith('-')) {
    console.error(`❌ Unknown option: ${arg}`);
    process.exit(1);
  }

  if (bump !== 'patch') {
    console.error('❌ Too many positional arguments. Use: patch | minor | major');
    process.exit(1);
  }

  bump = arg;
}

if (!allowedBumps.has(bump)) {
  console.error('❌ Invalid release type. Use: patch | minor | major');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageLockPath = path.join(rootDir, 'package-lock.json');

function run(command, options = {}) {
  execSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options,
  });
}

function getJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getCurrentVersion() {
  return getJson(packageJsonPath).version;
}

function getGitStatusPorcelain() {
  return execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' }).trim();
}

function computeNextVersion(version, kind) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);

  if (kind === 'major') {
    return `${major + 1}.0.0`;
  }

  if (kind === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  return `${major}.${minor}.${patch + 1}`;
}

function printDryRunPlan(previousVersion, nextVersion) {
  console.log('\n🧪 Dry run mode (no changes will be made)');
  console.log(`📦 Planned version bump: v${previousVersion} → v${nextVersion}`);
  console.log('\nPlanned steps:');
  console.log(`1. npm version ${bump} --no-git-tag-version`);
  console.log('2. npm run package:win:publish');
  console.log('3. git add package.json package-lock.json');
  console.log(`4. git commit -m "release: v${nextVersion}"`);
  console.log(`5. git tag v${nextVersion}`);
  console.log('6. git push origin HEAD');
  console.log(`7. git push origin v${nextVersion}`);

  const dirty = getGitStatusPorcelain();
  if (dirty) {
    console.log('\n⚠️ Working tree is currently dirty (release would fail until clean).');
  } else {
    console.log('\n✅ Working tree is clean.');
  }

  if (!process.env.GH_TOKEN) {
    console.log('⚠️ GH_TOKEN is not set (publish step would fail).');
  } else {
    console.log('✅ GH_TOKEN is set.');
  }

  console.log('\nNo files were modified.');
}

function rollbackVersion(version) {
  const packageJson = getJson(packageJsonPath);
  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  if (fs.existsSync(packageLockPath)) {
    const packageLock = getJson(packageLockPath);
    packageLock.version = version;
    if (packageLock.packages && packageLock.packages['']) {
      packageLock.packages[''].version = version;
    }
    fs.writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`, 'utf8');
  }
}

(function main() {
  const previousVersion = getCurrentVersion();
  const nextVersionPreview = computeNextVersion(previousVersion, bump);

  if (dryRun) {
    printDryRunPlan(previousVersion, nextVersionPreview);
    process.exit(0);
  }

  try {
    const dirty = getGitStatusPorcelain();
    if (dirty) {
      console.error('❌ Working tree is not clean. Commit or stash changes first.');
      process.exit(1);
    }

    console.log(`\n🚀 Starting ${bump} release...`);

    run(`npm version ${bump} --no-git-tag-version`);

    const nextVersion = getCurrentVersion();
    console.log(`📦 Version bumped: v${previousVersion} → v${nextVersion}`);

    if (!process.env.GH_TOKEN) {
      throw new Error('GH_TOKEN is required to publish release assets to GitHub.');
    }

    run('npm run package:win:publish');

    run('git add package.json package-lock.json');
    run(`git commit -m "release: v${nextVersion}"`);
    run(`git tag v${nextVersion}`);

    run('git push origin HEAD');
    run(`git push origin v${nextVersion}`);

    console.log(`\n✅ Release complete: v${nextVersion}`);
    console.log('   - Installer and update metadata published to GitHub Releases');
    console.log('   - Git commit and tag pushed');
  } catch (error) {
    console.error(`\n❌ Release failed: ${error instanceof Error ? error.message : String(error)}`);

    const currentVersion = getCurrentVersion();
    if (currentVersion !== previousVersion) {
      console.log(`↩️  Rolling back version to v${previousVersion}`);
      rollbackVersion(previousVersion);
    }

    process.exit(1);
  }
})();
