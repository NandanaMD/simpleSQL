/**
 * Enforce Node 20 runtime for workspace lifecycle scripts.
 */

const major = Number.parseInt(process.versions.node.split('.')[0], 10);

if (major !== 20) {
  console.error('❌ Node 20 is required for this workspace.');
  console.error(`   Current runtime: ${process.version} (ABI ${process.versions.modules})`);
  console.error('   Activate the portable Node 20 runtime at .tools/node20 before installing.');
  process.exit(1);
}

console.log(`✅ Node runtime locked: ${process.version} (ABI ${process.versions.modules})`);
