import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateAudit, parseAuditProcess} from './dependency-audit.mjs';

const policy = JSON.parse(readFileSync(new URL('./dependency-audit-exceptions.json', import.meta.url)));
const now = new Date('2026-10-21T12:00:00Z');
const lock = {packages: {'node_modules/braces': {version: '3.0.3'}}};
const advisory = {name: 'braces', dependency: 'braces', severity: 'high',
  url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'};
const entry = (name, via, extra = {}) => ({name, via, nodes: [`node_modules/${name}`],
  severity: 'high', fixAvailable: false, ...extra});
function report(vulnerabilities) {
  const counts = {info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0};
  for (const value of Object.values(vulnerabilities)) { counts[value.severity]++; counts.total++; }
  return {auditReportVersion: 2, vulnerabilities, metadata: {vulnerabilities: counts}};
}
const baseline = () => report({braces: entry('braces', [advisory])});
const evaluate = (input, at = now) => evaluateAudit(input, lock, policy, at);

test('exact unresolved advisory is visible with raw counts and its expiry', () => {
  const result = evaluate(baseline());
  assert.equal(result.failures.length, 0);
  assert.equal(result.counts.high, 1);
  assert.equal(result.exceptions[0].expires, '2026-11-21');
});

test('a new advisory on the same package or another package fails', () => {
  const same = baseline();
  same.vulnerabilities.braces.via.push({...advisory, url: 'https://github.com/advisories/GHSA-new'});
  assert.equal(evaluate(same).failures.length, 1);
  assert.equal(evaluate(report({other: entry('other', [{...advisory, name: 'other', dependency: 'other'}])})).failures.length, 1);
});

test('critical roots and critical transitive entries never inherit an exception', () => {
  assert.equal(evaluate(report({braces: entry('braces', [{...advisory, severity: 'critical'}], {severity: 'critical'})})).failures.length, 1);
  const input = report({braces: entry('braces', [advisory]), core: entry('core', ['braces'], {severity: 'critical'})});
  assert.equal(evaluate(input).failures[0].package, 'core');
});

test('expiry, version change and available fix invalidate the exception', () => {
  assert.equal(evaluate(baseline(), new Date('2026-11-21T00:00:00Z')).failures.length, 1);
  assert.equal(evaluateAudit(baseline(), {packages: {'node_modules/braces': {version: '3.0.4'}}}, policy, now).failures.length, 1);
  for (const fixAvailable of [true, {name: 'braces', version: '3.0.4'}, undefined]) {
    const input = baseline(); input.vulnerabilities.braces.fixAvailable = fixAvailable;
    assert.equal(evaluate(input).failures.length, 1);
  }
});

test('Docusaurus-shaped cycles resolve every reachable root', () => {
  const graph = {braces: entry('braces', [advisory]), core: entry('core', ['theme', 'braces']),
    theme: entry('theme', ['core'])};
  assert.equal(evaluate(report(graph)).failures.length, 0);
  graph.theme.via.push({...advisory, url: 'https://github.com/advisories/GHSA-new'});
  assert.deepEqual(evaluate(report(graph)).failures.map(item => item.package).sort(), ['core', 'theme']);
});

test('rootless cycles and dangling references fail closed', () => {
  assert.equal(evaluate(report({a: entry('a', ['b']), b: entry('b', ['a'])})).failures.length, 2);
  assert.equal(evaluate(report({a: entry('a', ['missing'])})).failures.length, 1);
  const mixed = report({braces: entry('braces', [advisory]),
    core: entry('core', ['braces', 'a']), a: entry('a', ['b'], {severity: 'moderate'}),
    b: entry('b', ['a'], {severity: 'moderate'})});
  assert.equal(evaluate(mixed).failures[0].package, 'core');
});

test('malformed audit data, inconsistent counts and registry errors fail closed', () => {
  for (const input of [{}, {...baseline(), error: {code: 'ENOAUDIT'}},
    {...baseline(), vulnerabilities: {braces: {name: 'braces'}}}]) {
    assert.throws(() => evaluate(input));
  }
  const mismatch = baseline(); mismatch.metadata.vulnerabilities.high = 0;
  assert.throws(() => evaluate(mismatch), /counts/);
  assert.throws(() => evaluate(report({braces: entry('braces', [{...advisory, severity: 'critical'}], {severity: 'low'})})), /Malformed advisory/);
  for (const result of [{status: 1, stdout: 'not json'}, {status: 2, stdout: '{}'},
    {status: 1, stdout: JSON.stringify({error: {code: 'ENOAUDIT'}})},
    {status: null, signal: 'SIGTERM'}, {status: null, error: new Error('spawn failed')}]) {
    assert.throws(() => parseAuditProcess(result));
  }
  assert.deepEqual(parseAuditProcess({status: 1, stdout: JSON.stringify(baseline())}), baseline());
});

test('clean and moderate-only reports pass without claiming an exception', () => {
  assert.equal(evaluate(report({})).failures.length, 0);
  const result = evaluate(report({other: entry('other', [{...advisory, name: 'other', dependency: 'other', severity: 'moderate'}], {severity: 'moderate'})}));
  assert.equal(result.failures.length, 0);
  assert.equal(result.counts.moderate, 1);
  assert.equal(result.exceptions.length, 0);
});
