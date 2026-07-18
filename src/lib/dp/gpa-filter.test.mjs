import assert from 'node:assert/strict';
import test from 'node:test';

import { formatGpaRange, parseGpaRange } from './gpa-filter.mjs';

test('parses minimum-only, maximum-only, and bounded GPA ranges', () => {
  assert.deepEqual(parseGpaRange('3.5', ''), { valid: true, min: 3.5, max: undefined });
  assert.deepEqual(parseGpaRange('', '95'), { valid: true, min: undefined, max: 95 });
  assert.deepEqual(parseGpaRange('85', '95'), { valid: true, min: 85, max: 95 });
});

test('rejects negative, non-finite, and reversed GPA ranges', () => {
  assert.equal(parseGpaRange('-1', '').error, 'value');
  assert.equal(parseGpaRange('Infinity', '').error, 'value');
  assert.equal(parseGpaRange('4', '3.5').error, 'range');
});

test('formats an active GPA range for the filter summary', () => {
  assert.equal(formatGpaRange(3.5, undefined), '≥ 3.5');
  assert.equal(formatGpaRange(undefined, 95), '≤ 95');
  assert.equal(formatGpaRange(85, 95), '85–95');
  assert.equal(formatGpaRange(undefined, undefined), '');
});
