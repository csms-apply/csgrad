#!/usr/bin/env node
// Verify that 0001_init.sql + the three INSERT SQL files produced by
// migrate-seatable-to-d1.mjs apply cleanly to a fresh SQLite db and that
// every invariant holds.
//
// Usage:  node scripts/d1-schema/verify-local.mjs
// Requires the `sqlite3` CLI on PATH (ships with macOS).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DDL = path.join(__dirname, 'migrations', '0001_init.sql');
const INSERTS_DIR = path.join(REPO_ROOT, 'scripts', 'migration-output');

const DB = path.join('/tmp', `csgrad-verify-${Date.now()}.db`);

// programs is 280 (not 283): the migration script merges 3 duplicate
// (school, program) rows from Seatable into their canonicals.
const EXPECTED = { applicants: 317, programs: 280, datapoints: 1908 };

function sql(query) {
  const r = spawnSync('sqlite3', [DB, query], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`sqlite3 failed: ${r.stderr}`);
  return r.stdout.trim();
}

function applyFile(file) {
  if (!fs.existsSync(file)) throw new Error(`missing: ${file}`);
  execSync(`sqlite3 "${DB}" < "${file}"`);
}

function assertEq(actual, expected, label) {
  const ok = String(actual) === String(expected);
  console.log(`  ${ok ? '✓' : '✘'} ${label}: ${actual}${ok ? '' : ` (expected ${expected})`}`);
  if (!ok) process.exitCode = 1;
}

console.log(`db: ${DB}\n`);

console.log('1. applying DDL...');
applyFile(DDL);
const tables = sql("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log(`   tables created: ${tables.replace(/\n/g, ', ')}`);

console.log('\n2. applying backfill...');
// programs FIRST (datapoints FK-refs programs), then applicants, then datapoints
applyFile(path.join(INSERTS_DIR, '002-programs.sql'));
applyFile(path.join(INSERTS_DIR, '001-applicants.sql'));
applyFile(path.join(INSERTS_DIR, '003-datapoints.sql'));

console.log('\n3. row counts:');
assertEq(sql('SELECT COUNT(*) FROM applicants'), EXPECTED.applicants, 'applicants');
assertEq(sql('SELECT COUNT(*) FROM programs'), EXPECTED.programs, 'programs');
assertEq(sql('SELECT COUNT(*) FROM datapoints'), EXPECTED.datapoints, 'datapoints');

console.log('\n4. FK integrity:');
assertEq(
  sql('SELECT COUNT(*) FROM datapoints WHERE applicant_id NOT IN (SELECT id FROM applicants)'),
  0,
  'orphan applicant_id',
);
assertEq(
  sql('SELECT COUNT(*) FROM datapoints WHERE program_id NOT IN (SELECT id FROM programs)'),
  0,
  'orphan program_id',
);

console.log('\n5. unique constraints (should not have raised on insert):');
assertEq(sql('SELECT COUNT(DISTINCT seatable_row_id) FROM applicants'), EXPECTED.applicants, 'distinct seatable_row_id (applicants)');
assertEq(sql('SELECT COUNT(DISTINCT seatable_row_id) FROM programs'),   EXPECTED.programs,   'distinct seatable_row_id (programs)');
assertEq(sql('SELECT COUNT(DISTINCT seatable_row_id) FROM datapoints'), EXPECTED.datapoints, 'distinct seatable_row_id (datapoints)');

console.log('\n6. sample join (applicant #1, sorted by notified_at):');
const sample = sql(`
SELECT a.ug_school_name, a.gpa, p.school, p.program, d.result, d.notified_at
FROM datapoints d
JOIN applicants a ON d.applicant_id = a.id
JOIN programs   p ON d.program_id   = p.id
WHERE a.seatable_applicant_id = 1
ORDER BY d.notified_at
LIMIT 5
`);
console.log('   ' + sample.split('\n').join('\n   '));

console.log('\n7. result distribution:');
const dist = sql('SELECT COALESCE(result,\'(null)\'), COUNT(*) FROM datapoints GROUP BY result ORDER BY 2 DESC');
console.log('   ' + dist.split('\n').join('\n   '));

console.log('\n8. tier coverage:');
const tierWith = sql('SELECT COUNT(*) FROM programs WHERE tier IS NOT NULL');
const tierWithout = sql('SELECT COUNT(*) FROM programs WHERE tier IS NULL');
console.log(`   programs with tier: ${tierWith}  /  without tier: ${tierWithout} (needs admin)`);

console.log('\n9. cleanup');
fs.unlinkSync(DB);
console.log(`   removed ${DB}`);

if (process.exitCode) {
  console.log('\n✘ verification failed');
} else {
  console.log('\n✔ all checks passed');
}
