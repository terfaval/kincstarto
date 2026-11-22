#!/usr/bin/env node
/** P08: safe, local regression gate. Does not publish, deploy, modify Blob or sign off content.
 * --full additionally runs TypeScript and Next.js production build; they require local node_modules.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mode = process.argv[2] ?? '--quick';
if (!['--quick', '--full'].includes(mode) || process.argv.length > 3) {
  console.error('Hasznalat: node scripts/yasuragi-p08-release-gate.mjs [--quick|--full]');
  process.exit(2);
}
const phases = [
  ['P01-P07 motor + integracio', process.execPath, ['--experimental-strip-types', '--test',
    'scripts/test-yasuragi-p07-p08.mjs', 'scripts/test-yasuragi-p06.mjs', 'scripts/test-yasuragi-p05d.mjs',
    'scripts/test-yasuragi-p05c.mjs', 'scripts/test-yasuragi-p05b.mjs', 'scripts/test-yasuragi-p05a.mjs',
    'scripts/test-yasuragi-player.mjs', 'scripts/test-yasuragi-p03.mjs', 'scripts/test-yasuragi-preview-bridge.mjs']],
  ['P02 import', process.execPath, ['scripts/test-yasuragi-p02.mjs']],
  ['P04 review + authoring kit', process.execPath, ['--experimental-strip-types', '--test',
    'scripts/test-yasuragi-p04.mjs', 'scripts/test-yasuragi-p04-1.mjs', 'scripts/test-yasuragi-p04-2.mjs']],
  ['P08 local private integrity', process.execPath, ['--experimental-strip-types', 'scripts/yasuragi-p08-local-audit.mjs']],
];
if (mode === '--full') {
  phases.push(['TypeScript', process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit']]);
  phases.push(['Next.js production build', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']]);
}
for (const [label, cmd, args] of phases) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' && cmd.endsWith('.cmd') });
  if (result.error || result.status !== 0) {
    console.error(`P08 GATE BLOCKED: ${label} (exit=${result.status ?? 'spawn error'})`);
    process.exit(1);
  }
}
console.log('\nP08 LOCAL GATE PASS. KORLAT: nem igazol valos Blob backupot, restore-t, bongeszos QA-t vagy eles deploymentet.');
