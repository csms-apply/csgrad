import assert from 'node:assert/strict';
import test from 'node:test';

import { assessMigrationIntegrity, parseAllowSkips } from './migration-integrity.mjs';

test('rejects a migration that silently skips datapoints', () => {
  const result = assessMigrationIntegrity({
    sourceDatapoints: 1960,
    emittedDatapoints: 1908,
    orphanNoApplicant: 24,
    orphanNoProgram: 7,
    orphanBoth: 21,
    allowSkips: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.skippedDatapoints, 52);
  assert.match(result.message, /source=1960 emitted=1908 skipped=52/);
});

test('allows an incomplete migration only with an explicit override', () => {
  const result = assessMigrationIntegrity({
    sourceDatapoints: 1960,
    emittedDatapoints: 1908,
    orphanNoApplicant: 24,
    orphanNoProgram: 7,
    orphanBoth: 21,
    allowSkips: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.overridden, true);
  assert.match(result.message, /INCOMPLETE\/OVERRIDDEN/);
});

test('accepts a complete migration without an override', () => {
  const result = assessMigrationIntegrity({
    sourceDatapoints: 1960,
    emittedDatapoints: 1960,
    orphanNoApplicant: 0,
    orphanNoProgram: 0,
    allowSkips: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.overridden, false);
  assert.match(result.message, /COMPLETE/);
});

test('rejects unknown CLI arguments', () => {
  assert.throws(() => parseAllowSkips(['--typo']), /unknown argument/);
});

test('never accepts an unaccounted row, even with an override', () => {
  const result = assessMigrationIntegrity({
    sourceDatapoints: 1960,
    emittedDatapoints: 1908,
    orphanNoApplicant: 24,
    orphanNoProgram: 7,
    orphanBoth: 20,
    allowSkips: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /classified=51/);
});
