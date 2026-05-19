#!/usr/bin/env node
// Read migration-output SQL → emit anonymized static/data/dp-snapshot.json
// for the new /datapoints page to consume before the API is up.
//
// What is stripped (private free-text that could identify a person):
//   - contact_info
//   - education_notes / gpa_notes
//   - research_notes / internship_notes
//   - rec_notes
//   - pub_notes
//   - other_soft_background
//   - notes (on datapoints)
//
// What is kept (already shape of the Seatable iframe that was public before):
//   - ug_school_category / ug_school_name / graduation_year / ug_major
//   - GPA + scale + rank
//   - language scores (TOEFL/IELTS) + GRE
//   - research / internship counts
//   - publication booleans
//   - recommendation-letter tags (categorical only)
//   - DP outcomes: result, is_funded, is_final_destination, year, semester, dates

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

// ---------- strip private free-text from applicants ----------
const STRIP = new Set([
  'contact_info',
  'education_notes',
  'gpa_notes',
  'research_notes',
  'internship_notes',
  'rec_notes',
  'pub_notes',
  'other_soft_background',
  'seatable_row_id',
  'seatable_applicant_id',
  'user_id',
  'locked_at',
]);

const applicants = {};
for (const a of applicantRows) {
  const safe = {};
  for (const [k, v] of Object.entries(a)) {
    if (STRIP.has(k)) continue;
    // parse JSON-array text fields back to arrays for easier frontend handling
    if (k === 'cs_courses' || /^rec\d_tags$/.test(k)) {
      try { safe[k] = v ? JSON.parse(v) : []; }
      catch { safe[k] = []; }
    } else {
      safe[k] = v;
    }
  }
  applicants[a.id] = safe;
}

// ---------- programs: keep all (already public via positioning) ----------
const programs = {};
for (const p of programRows) {
  programs[p.id] = {
    id: p.id,
    school: p.school,
    program: p.program,
    degree: p.degree,
    country: p.country,
    tier: p.tier,
    homepage_url: p.homepage_url,
  };
}

// ---------- datapoints: strip notes, keep outcomes ----------
const datapoints = [];
for (const d of dpRows) {
  datapoints.push({
    id: d.id,
    applicant_id: d.applicant_id,
    program_id: d.program_id,
    result: d.result,
    is_funded: d.is_funded,
    is_final_destination: d.is_final_destination,
    academic_year: d.academic_year,
    semester: d.semester,
    notified_at: d.notified_at,
    submitted_at: d.submitted_at,
    // notes intentionally dropped
  });
}

// ---------- output ----------
const snapshot = {
  generated_at: new Date().toISOString(),
  counts: {
    applicants: Object.keys(applicants).length,
    programs: Object.keys(programs).length,
    datapoints: datapoints.length,
  },
  applicants,
  programs,
  datapoints,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`✔ wrote ${OUT}  (${kb} KB)`);
console.log(`  applicants=${snapshot.counts.applicants}  programs=${snapshot.counts.programs}  datapoints=${snapshot.counts.datapoints}`);
