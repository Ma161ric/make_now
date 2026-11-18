#!/usr/bin/env node
// Runs every tests/server/*.test.ts in its own Node process (Node >= 22.7, no install needed)
// and fails if any file reports a failed check or crashes.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.test.ts') && (!only.length || only.some((o) => f.includes(o)))).sort();
let passed = 0;
let failed = 0;
const broken = [];
for (const f of files) {
  const r = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', '--import', join(dir, 'support/resolve.mjs'), join(dir, f)], {
    encoding: 'utf8',
    env: { ...process.env, TZ: 'Europe/Berlin' },
  });
  const out = `${r.stdout}${r.stderr}`;
  const m = out.match(/(\d+) passed (\d+) failed/);
  if (r.status !== 0 || !m) {
    broken.push(f);
    console.log(`✗ ${f}: crashed\n${out.trim().split('\n').slice(-8).join('\n')}`);
    continue;
  }
  passed += Number(m[1]);
  failed += Number(m[2]);
  const bad = out.split('\n').filter((l) => l.startsWith('FAIL'));
  console.log(`${Number(m[2]) ? '✗' : '✓'} ${f}: ${m[1]} passed, ${m[2]} failed`);
  bad.forEach((l) => console.log(`    ${l}`));
}
console.log(`\n${passed} passed, ${failed} failed, ${broken.length} crashed (${files.length} files)`);
process.exit(failed || broken.length ? 1 : 0);
