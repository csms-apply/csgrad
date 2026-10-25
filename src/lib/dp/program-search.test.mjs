import assert from 'node:assert/strict';
import test from 'node:test';
import {searchPrograms} from './program-search.mjs';

// School and program names as stored in /api/programs, including the inconsistent spellings.
const programs = [
  ['CMU', 'MSCS'], ['CMU', 'MCDS'], ['CMU', 'MITS'], ['Columbia', 'MSCS'], ['GaTech', 'CSE'],
  ['GaTech', 'MSCS'], ['IC', 'MSc Computing (SE)'], ['MIT', 'EECS PhD'], ['Stanford', 'MSCS'],
  ['UChicago', 'Pre-Doctoral MSCS'], ['UPenn', 'DS'], ['Upenn', 'MSE'], ['USC', 'Applied Physics'],
  ['USC', 'CS28'], ['UT Austin', 'ECE'], ['UT-Austin', 'MSCS'], ['Duke', 'MSDS'],
].map(([school, program], i) => ({id: `p${i}`, school, program}));

const names = (query) => searchPrograms(programs, query).map((p) => `${p.school} · ${p.program}`);

test('empty query keeps every program in order', () => {
  assert.equal(searchPrograms(programs, '  ').length, programs.length);
});

test('ignores case, spacing, punctuation and token order', () => {
  assert.deepEqual(names('cmu mscs'), ['CMU · MSCS']);
  assert.deepEqual(names('MSCS cmu'), ['CMU · MSCS']);
  assert.deepEqual(names('cmumscs'), ['CMU · MSCS']);
  assert.deepEqual(names('ut austin'), ['UT Austin · ECE', 'UT-Austin · MSCS']);
});

test('matches full names and Chinese names of abbreviated schools', () => {
  assert.deepEqual(names('georgia tech cse'), ['GaTech · CSE']);
  assert.deepEqual(names('卡梅 mscs'), ['CMU · MSCS']);
  assert.deepEqual(names('宾大'), ['UPenn · DS', 'Upenn · MSE']);
  assert.deepEqual(names('斯坦'), ['Stanford · MSCS']);
});

test('Chinese names must start a word', () => {
  // 芝加哥大学 contains 哥大 but is UChicago, not Columbia.
  assert.deepEqual(names('哥大 mscs'), ['Columbia · MSCS']);
});

test('tolerates skipped letters and typos', () => {
  assert.deepEqual(names('gtech mscs'), ['GaTech · MSCS']);
  assert.deepEqual(names('stanfrod'), ['Stanford · MSCS']);
  assert.deepEqual(names('colombia'), ['Columbia · MSCS']);
});

test('fuzzy matching does not kick in when the token matches literally', () => {
  assert.ok(!names('mscs').includes('Duke · MSDS'));
  assert.ok(!names('cmu').includes('IC · MSc Computing (SE)'));
});

test('word-start matches rank above mid-word matches', () => {
  assert.deepEqual(names('usc cs'), ['USC · CS28', 'USC · Applied Physics']);
  assert.equal(names('mit')[0], 'MIT · EECS PhD');
});

test('no match returns an empty list', () => {
  assert.deepEqual(names('xyzq'), []);
});
