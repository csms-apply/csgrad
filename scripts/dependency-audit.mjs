import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireValid = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function evaluateAudit(report, lock, policy, now = new Date()) {
  requireValid(isObject(report) && !report.error && report.auditReportVersion === 2 &&
    isObject(report.vulnerabilities) && isObject(report.metadata?.vulnerabilities),
  'Invalid npm audit response or registry error');
  requireValid(isObject(lock?.packages) && Array.isArray(policy?.exceptions) &&
    Number.isFinite(now.getTime()), 'Invalid lockfile, exception policy, or date');
  for (const exception of policy.exceptions) {
    requireValid(isObject(exception) && exception.package === 'braces' &&
      exception.version === '3.0.3' &&
      exception.advisory === 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' &&
      exception.maxSeverity === 'high' && exception.expires === '2026-11-21' &&
      typeof exception.reason === 'string' && exception.reason.length > 0,
    'Invalid or overly broad dependency exception');
  }
  const vulnerabilities = report.vulnerabilities;
  const counts = Object.fromEntries(severities.map(severity => [severity, 0]));
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    requireValid(isObject(entry) && entry.name === name && severities.includes(entry.severity) &&
      Array.isArray(entry.via) && entry.via.length > 0 && Array.isArray(entry.nodes) &&
      entry.nodes.length > 0 && entry.nodes.every(node => typeof node === 'string'),
    `Malformed vulnerability entry: ${name}`);
    counts[entry.severity]++;
    for (const via of entry.via) {
      requireValid(typeof via === 'string' || (isObject(via) &&
        typeof via.name === 'string' && typeof via.dependency === 'string' &&
        typeof via.url === 'string' && severities.includes(via.severity) &&
        severities.indexOf(via.severity) <= severities.indexOf(entry.severity)),
      `Malformed advisory: ${name}`);
    }
  }
  counts.total = Object.keys(vulnerabilities).length;
  requireValid(Object.entries(counts).every(([key, count]) =>
    report.metadata.vulnerabilities[key] === count), 'Inconsistent npm audit vulnerability counts');

  function allowedRoot(entry, advisory) {
    return policy.exceptions.find(exception =>
      entry.name === exception.package && advisory.name === exception.package &&
      advisory.dependency === exception.package && advisory.url === exception.advisory &&
      advisory.severity !== 'critical' && entry.severity !== 'critical' &&
      severities.indexOf(advisory.severity) <= severities.indexOf(exception.maxSeverity) &&
      now < new Date(`${exception.expires}T00:00:00Z`) && entry.fixAvailable === false &&
      entry.nodes.every(node => lock.packages[node]?.version === exception.version));
  }

  const accepted = new Map();
  const failures = [];
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (severities.indexOf(entry.severity) < severities.indexOf('high')) continue;
    const visited = new Set();
    const roots = [];
    const unknown = [];
    // Visit the complete reachable graph. Cycles are normal for Docusaurus;
    // revisiting an edge is not itself an exception or evidence of safety.
    function visit(dependency) {
      if (visited.has(dependency)) return;
      visited.add(dependency);
      const current = vulnerabilities[dependency];
      if (!current) {
        unknown.push(dependency);
        return;
      }
      for (const via of current.via) {
        if (typeof via === 'string') visit(via);
        else roots.push({entry: current, advisory: via});
      }
    }
    visit(name);
    // Every reachable branch must resolve to an advisory, including branches
    // containing cycles without an exit to a known advisory.
    const rooted = new Set([...visited].filter(dependency =>
      vulnerabilities[dependency]?.via.some(via => typeof via !== 'string')));
    let changed;
    do {
      changed = false;
      for (const dependency of visited) {
        if (!rooted.has(dependency) && vulnerabilities[dependency]?.via.some(via =>
          typeof via === 'string' && rooted.has(via))) {
          rooted.add(dependency);
          changed = true;
        }
      }
    } while (changed);
    unknown.push(...[...visited].filter(dependency => !rooted.has(dependency) && !unknown.includes(dependency)));
    const denied = roots.filter(root => !allowedRoot(root.entry, root.advisory));
    if (entry.severity === 'critical' || unknown.length || !roots.length || denied.length) {
      failures.push({package: name, severity: entry.severity,
        advisories: denied.map(root => root.advisory.url), unknown,
        reason: entry.severity === 'critical' ? 'critical severity is never excepted' :
          !roots.length ? 'no resolved root advisory' : 'unapproved or unresolved advisory'});
    } else {
      for (const root of roots) {
        const exception = allowedRoot(root.entry, root.advisory);
        accepted.set(exception.advisory, exception);
      }
    }
  }
  return {counts, failures, exceptions: [...accepted.values()]};
}

export function parseAuditProcess(result) {
  requireValid(!result.error && !result.signal && [0, 1].includes(result.status),
    `npm audit failed: ${result.error?.message || result.stderr || result.signal || result.status}`);
  let report;
  try { report = JSON.parse(result.stdout); }
  catch { throw new Error('npm audit did not return valid JSON'); }
  requireValid(!report?.error, 'npm audit returned a registry or audit error');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['audit', '--json', '--package-lock-only', '--audit-level=low'],
      {cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000});
    const audit = evaluateAudit(parseAuditProcess(result),
      JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8')),
      JSON.parse(readFileSync(new URL('./dependency-audit-exceptions.json', import.meta.url), 'utf8')));
    console.log(`Raw npm audit package counts: ${JSON.stringify(audit.counts)}`);
    for (const exception of audit.exceptions) {
      console.log(`UNRESOLVED EXCEPTION: ${exception.package}@${exception.version} ${exception.advisory}; expires ${exception.expires} (UTC, exclusive). ${exception.reason}`);
    }
    for (const failure of audit.failures) console.error(`BLOCKED: ${JSON.stringify(failure)}`);
    if (audit.failures.length) process.exitCode = 1;
    else console.log('Dependency gate passed: no unapproved high/critical advisories. Raw findings above remain visible.');
  } catch (error) {
    console.error(`Dependency audit failed closed: ${error.message}`);
    process.exitCode = 1;
  }
}
