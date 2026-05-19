#!/usr/bin/env node
// Read migration-output SQL → emit static/data/dp-snapshot.json for the
// /datapoints page to consume when offline / before the API is reachable.
//
// All applicant fields and DP fields are kept — the old Seatable iframe was
// already public, and submitters of new DPs sign in and know the row will be
// public. Only DB metadata is stripped (seatable internal ids, user_id,
// locked_at) since those aren't useful to the frontend.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(REPO_ROOT, 'scripts', 'migration-output');
const OUT = path.join(REPO_ROOT, 'static', 'data', 'dp-snapshot.json');

// ---------- minimal SQL VALUES parser ----------
function parseInsert(line) {
  // INSERT INTO foo (col1, col2, ...) VALUES (v1, v2, ...);
  const m = line.match(/^INSERT INTO \w+ \(([^)]+)\) VALUES \((.+)\);$/s);
  if (!m) return null;
  const cols = m[1].split(',').map((s) => s.trim());
  const valsRaw = m[2];
  const vals = [];
  let i = 0;
  while (i < valsRaw.length) {
    while (valsRaw[i] === ' ' || valsRaw[i] === ',') i++;
    if (valsRaw[i] === "'") {
      // quoted string with '' escaping
      let s = '';
      i++;
      while (i < valsRaw.length) {
        if (valsRaw[i] === "'" && valsRaw[i + 1] === "'") {
          s += "'";
          i += 2;
        } else if (valsRaw[i] === "'") {
          i++;
          break;
        } else {
          s += valsRaw[i++];
        }
      }
      vals.push(s);
    } else {
      // number, NULL, or unquoted
      let s = '';
      while (i < valsRaw.length && valsRaw[i] !== ',') s += valsRaw[i++];
      s = s.trim();
      if (s === 'NULL') vals.push(null);
      else if (s === '') vals.push(null);
      else if (/^-?\d+(\.\d+)?$/.test(s)) vals.push(Number(s));
      else vals.push(s);
    }
  }
  const obj = {};
  cols.forEach((c, idx) => (obj[c] = vals[idx]));
  return obj;
}

function readInserts(file) {
  // Long-text fields can contain literal newlines inside quoted strings, so
  // split on the statement terminator (";\n" only at statement end) instead
  // of plain '\n'. We walk the source and respect single-quote escaping.
  const src = fs.readFileSync(file, 'utf8');
  const statements = [];
  let buf = '';
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'") {
      if (inStr && src[i + 1] === "'") {
        buf += "''";
        i++;
        continue;
      }
      inStr = !inStr;
      buf += ch;
    } else if (ch === ';' && !inStr) {
      statements.push(buf.trim());
      buf = '';
    } else if (ch === '\n' && !inStr) {
      buf += ' '; // collapse newlines outside strings to spaces
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) statements.push(buf.trim());

  const rows = [];
  for (const s of statements) {
    if (!s.startsWith('INSERT')) continue;
    const r = parseInsert(s + ';'); // parseInsert expects trailing ;
    if (r) rows.push(r);
  }
  return rows;
}

// ---------- read all three tables ----------
const applicantRows = readInserts(path.join(SRC, '001-applicants.sql'));
const programRows = readInserts(path.join(SRC, '002-programs.sql'));
const dpRows = readInserts(path.join(SRC, '003-datapoints.sql'));

console.log(`read: applicants=${applicantRows.length} programs=${programRows.length} datapoints=${dpRows.length}`);

// ---------- collect filter options (page hits API for actual rows) ----------
// Only unique values for each filter dropdown + total counts. No row payload.
const schools = new Set();
const tiers = new Set();
const years = new Set();
const ugCats = new Set();
const majors = new Set();

for (const p of programRows) {
  if (p.school) schools.add(p.school);
  if (p.tier) tiers.add(p.tier);
}
for (const a of applicantRows) {
  if (a.ug_school_category) ugCats.add(a.ug_school_category);
  if (a.ug_major) majors.add(a.ug_major);
}
for (const d of dpRows) {
  if (d.academic_year) years.add(d.academic_year);
}

// ---------- output: slim "options + counts" snapshot ----------
// Used only to populate filter dropdowns + show header counts before the
// API responds. Rows are now fetched on-demand from /api/dp.
const snapshot = {
  generated_at: new Date().toISOString(),
  counts: {
    applicants: applicantRows.length,
    programs: programRows.length,
    datapoints: dpRows.length,
  },
  options: {
    schools: [...schools].sort(),
    tiers: [...tiers].sort(),
    years: [...years].sort((a, b) => b - a),
    ugCats: [...ugCats].sort(),
    majors: [...majors].sort(),
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`✔ wrote ${OUT}  (${kb} KB)`);
console.log(`  counts: applicants=${snapshot.counts.applicants} programs=${snapshot.counts.programs} datapoints=${snapshot.counts.datapoints}`);
console.log(`  options: ${snapshot.options.schools.length} schools / ${snapshot.options.tiers.length} tiers / ${snapshot.options.years.length} years / ${snapshot.options.ugCats.length} ug cats / ${snapshot.options.majors.length} majors`);
