#!/usr/bin/env node
// One-shot migration: DataPoints.dtable (Seatable export) → D1 SQL.
//
// Usage:  node scripts/migrate-seatable-to-d1.mjs
// Reads:  ./DataPoints.dtable  (gitignored, contains 317 applicants' real data)
// Writes: ./scripts/migration-output/
//           001-applicants.sql
//           002-programs.sql
//           003-datapoints.sql
//           manual-review.json   ← rows that need human attention
//           summary.txt          ← row counts + diffs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { assessMigrationIntegrity, parseAllowSkips } from './migration-integrity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DTABLE_PATH = path.join(REPO_ROOT, 'DataPoints.dtable');
const OUTPUT_DIR = path.join(REPO_ROOT, 'scripts', 'migration-output');
const PROGRAMS_JSON_PATH = path.join(REPO_ROOT, 'static', 'data', 'programs.json');

const EXPECTED_COUNTS = { applicants: 317, programs: 283, datapoints: 1960 };

let allowSkips;
try {
  allowSkips = parseAllowSkips(process.argv.slice(2));
} catch (error) {
  console.error(`✘ ${error.message}`);
  process.exit(2);
}

// ---------- unzip .dtable → tmp dir ----------
if (!fs.existsSync(DTABLE_PATH)) {
  console.error(`✘ DataPoints.dtable not found at ${DTABLE_PATH}`);
  process.exit(1);
}
const tmpDir = fs.mkdtempSync(path.join('/tmp', 'dtable-extract-'));
execSync(`unzip -q "${DTABLE_PATH}" -d "${tmpDir}"`);
const content = JSON.parse(fs.readFileSync(path.join(tmpDir, 'content.json'), 'utf8'));
process.on('exit', () => fs.rmSync(tmpDir, { recursive: true, force: true }));

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ---------- helpers ----------
let _ulidCounter = 0;
function ulid(prefix = '') {
  // 26-char Crockford-base32-ish ID; deterministic ordering within a run.
  const ts = Date.now().toString(36).padStart(9, '0');
  const ctr = (_ulidCounter++).toString(36).padStart(6, '0');
  const rnd = Math.random().toString(36).slice(2, 13).padStart(11, '0');
  return prefix + ts + ctr + rnd;
}

function sqlEscape(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function insertRow(table, fields) {
  const cols = Object.keys(fields);
  const vals = cols.map((k) => sqlEscape(fields[k])).join(', ');
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals});`;
}

function getCell(row, col) {
  // Seatable .dtable rows use column key OR column name depending on the column.
  if (row[col.key] !== undefined) return row[col.key];
  if (row[col.name] !== undefined) return row[col.name];
  return undefined;
}

function readLongText(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'object' && typeof v.text === 'string') {
    const t = v.text.trim();
    return t || null;
  }
  return null;
}

function readNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readAutoNumber(v) {
  if (v == null) return null;
  // "Applicants-00000001" → 1
  const m = String(v).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}

function readDate(v) {
  if (v == null || v === '') return null;
  // Seatable date is "YYYY-MM-DD" or ISO datetime
  return String(v).slice(0, 10);
}

function readISO(v) {
  if (v == null || v === '') return null;
  return String(v);
}

function readCheckbox(v) {
  return v === true ? 1 : 0;
}

function readSelect(v, optMap) {
  if (v == null || v === '') return null;
  return optMap[v] ?? null; // option id → option name
}

function readMultiSelect(arr, optMap) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const names = arr.map((id) => optMap[id]).filter(Boolean);
  return names.length ? JSON.stringify(names) : null;
}

// ---------- index tables + build option maps ----------
const tableByName = {};
for (const t of content.tables) tableByName[t.name] = t;

const tApp = tableByName['申请者信息'];
const tProg = tableByName['项目列表'];
const tDP = tableByName['DataPoints'];
if (!tApp || !tProg || !tDP) {
  console.error('✘ missing one of the expected tables: 申请者信息 / 项目列表 / DataPoints');
  process.exit(1);
}

function buildColIndex(table) {
  const byName = {};
  for (const c of table.columns) {
    const opts = (c.data && c.data.options) || [];
    c._optMap = Object.fromEntries(opts.map((o) => [o.id, o.name]));
    byName[c.name] = c;
  }
  return byName;
}

const aCols = buildColIndex(tApp);
const pCols = buildColIndex(tProg);
const dCols = buildColIndex(tDP);

// Generic typed reader
function read(row, cols, name) {
  const c = cols[name];
  if (!c) return null;
  const raw = getCell(row, c);
  switch (c.type) {
    case 'single-select': return readSelect(raw, c._optMap);
    case 'multiple-select': return readMultiSelect(raw, c._optMap);
    case 'long-text': return readLongText(raw);
    case 'checkbox': return readCheckbox(raw);
    case 'number': return readNumber(raw);
    case 'auto-number': return readAutoNumber(raw);
    case 'date': return readDate(raw);
    case 'ctime': case 'mtime': return readISO(raw);
    case 'url': case 'text': case 'creator': return (raw == null || raw === '') ? null : String(raw);
    case 'geolocation': return raw && raw.country_region ? raw.country_region : null;
    case 'link': case 'link-formula': case 'formula': return null; // handled separately or dropped
    default: return raw == null ? null : raw;
  }
}

function readGeoLat(row, cols, name) {
  const c = cols[name];
  if (!c) return null;
  const raw = getCell(row, c);
  return raw && typeof raw.lat === 'number' ? raw.lat : null;
}
function readGeoLng(row, cols, name) {
  const c = cols[name];
  if (!c) return null;
  const raw = getCell(row, c);
  return raw && typeof raw.lng === 'number' ? raw.lng : null;
}

// ---------- build link maps ----------
// Links: each {_id, table1_id, table2_id, table1_table2_map: { row_in_t1: [rows_in_t2] }}
//
// Link "nN6j": table1=YrbT(DataPoints) ↔ table2=txZw(申请者) → dp→applicant
// Link "JVMh": table1=0000(项目)        ↔ table2=YrbT(DP)    → program→dp (need to reverse for dp→program)
const linkById = {};
for (const l of content.links || []) linkById[l._id] = l;

const dpToApplicant = {};
{
  const map = linkById['nN6j']?.table1_table2_map || {};
  for (const [dpRow, applicantRows] of Object.entries(map)) {
    dpToApplicant[dpRow] = applicantRows[0] || null;
  }
}
const dpToProgram = {};
{
  const map = linkById['JVMh']?.table1_table2_map || {};
  for (const [progRow, dpRows] of Object.entries(map)) {
    for (const dpRow of dpRows) dpToProgram[dpRow] = progRow;
  }
}

// ---------- generate id mappings ----------
const applicantIdMap = {}; // seatable row_id → ulid
for (const r of tApp.rows) applicantIdMap[r._id] = ulid('app_');

// Load programs.json to inherit tier + id for matched programs
const programsJson = JSON.parse(fs.readFileSync(PROGRAMS_JSON_PATH, 'utf8'));

// Seatable uses short forms ("Stanford", "CMU", "UPenn"), programs.json uses official names
// ("Stanford University", "Carnegie Mellon University", "UPenn"). Normalize both sides.
const SCHOOL_ALIASES = {
  'stanford': 'stanford university',
  'princeton': 'princeton university',
  'cmu': 'carnegie mellon university',
  'cornell': 'cornell university',
  'harvard': 'harvard university',
  'yale': 'yale university',
  'brown': 'brown university',
  'duke': 'duke university',
  'columbia': 'columbia university',
  'emory': 'emory university',
  'rice': 'rice university',
  'jhu': 'johns hopkins university',
  'gatech': 'georgia tech',
  'georgia institute of technology': 'georgia tech',
  'neu': 'northeastern university',
  'nwu': 'northwestern university',
  'umd': 'university of maryland',
  'umich': 'university of michigan',
  'umn': 'university of minnesota',
  'uchicago': 'university of chicago',
  'uchi': 'university of chicago',
  'umass': 'umass amherst',
  'uci': 'uc irvine',
  'berkeley': 'uc berkeley',
  'ucla': 'ucla',
  'ucsd': 'ucsd',
  'ucsb': 'ucsb',
  'ut-austin': 'ut austin',
  'wisc': 'uw-madison',
  'uw': 'university of washington',
  'upenn': 'upenn',
  'mit': 'mit',
  'caltech': 'caltech',
  'uiuc': 'uiuc',
  'usc': 'usc',
  'nyu': 'nyu',
  'cornell tech': 'cornell tech',
  'ncsu': 'nc state',
  'tamu': 'texas a&m',
};

function normSchool(school) {
  const s = (school || '').toLowerCase().trim();
  return SCHOOL_ALIASES[s] || s;
}
function normProgram(program) {
  // Light normalization: collapse whitespace, lowercase. MSECS == MSCS is not handled — those differ.
  return (program || '').toLowerCase().trim().replace(/\s+/g, ' ');
}
function normKey(school, program) {
  return `${normSchool(school)}|${normProgram(program)}`;
}
const programsJsonByKey = new Map();
for (const p of programsJson) programsJsonByKey.set(normKey(p.school, p.program), p);

const programIdMap = {}; // seatable row_id → final program id (slug or new ulid)
const programTierFromJson = {}; // canonical seatable row_id → tier if matched
// Some (school, program) pairs are duplicated in Seatable (e.g. CMU/MSML×3).
// Merge duplicates: first row wins; later duplicates map to the same program
// id and are skipped during INSERT emission below.
const programCanonicalByKey = new Map(); // normKey → canonical seatable row_id
const programDuplicateRows = new Set(); // seatable_row_ids that are dupes (skip INSERT)
const programDuplicatesReview = [];

for (const r of tProg.rows) {
  const school = read(r, pCols, '学校');
  const program = read(r, pCols, '项目');
  const key = normKey(school, program);

  if (programCanonicalByKey.has(key)) {
    const canonicalRowId = programCanonicalByKey.get(key);
    programIdMap[r._id] = programIdMap[canonicalRowId];
    programDuplicateRows.add(r._id);
    programDuplicatesReview.push({
      seatable_row_id: r._id,
      canonical_row_id: canonicalRowId,
      school,
      program,
    });
    continue;
  }

  programCanonicalByKey.set(key, r._id);
  const matched = programsJsonByKey.get(key);
  if (matched) {
    programIdMap[r._id] = matched.id;
    programTierFromJson[r._id] = matched.tier;
  } else {
    programIdMap[r._id] = ulid('pgm_');
  }
}

// ---------- manual-review accumulator ----------
const manualReview = {
  expected_counts: EXPECTED_COUNTS,
  notes: [
    'TOEFL/IELTS: rows with total ≤ 10 are assumed IELTS, otherwise TOEFL.',
    'programs.tier is NULL when the (school, program) pair did not match static/data/programs.json — needs admin to label tier.',
    'datapoints without a linked applicant or program are blocked and listed below with their recoverable fields.',
  ],
  programs_unmapped_tier: [],
  programs_duplicate_pairs_merged: [],
  datapoints_orphan_no_applicant: [],
  datapoints_orphan_no_program: [],
  datapoints_orphan_both: [],
  applicants_locked_school_name_blank: [],
};

// ---------- emit applicants SQL ----------
const applicantSql = [
  '-- 001-applicants.sql — Seatable 申请者信息 → applicants',
  '-- Run AFTER schema is applied. ulid prefix=app_',
  'BEGIN TRANSACTION;',
];
for (const r of tApp.rows) {
  const toeflTotal = read(r, aCols, 'TOEFL/IELTS 总分');
  const isIelts = toeflTotal != null && toeflTotal > 0 && toeflTotal <= 10;
  const lr = read(r, aCols, 'TOEFL/IELTS 阅读');
  const ll = read(r, aCols, 'TOEFL/IELTS 听力');
  const ls = read(r, aCols, 'TOEFL/IELTS 口语');
  const lw = read(r, aCols, 'TOEFL/IELTS 写作');

  const schoolName = read(r, aCols, '本科学校名称');
  if (!schoolName) {
    manualReview.applicants_locked_school_name_blank.push({
      seatable_row_id: r._id,
      seatable_applicant_id: read(r, aCols, 'Applicants ID'),
    });
  }

  const fields = {
    id: applicantIdMap[r._id],
    seatable_row_id: r._id,
    seatable_applicant_id: read(r, aCols, 'Applicants ID'),
    user_id: null,
    ug_school_category: read(r, aCols, '本科学校类别'),
    ug_school_name: schoolName,
    graduation_year: read(r, aCols, '毕业年份'),
    ug_major: read(r, aCols, '本科专业'),
    honors_college: read(r, aCols, '荣誉学院'),
    exchange_abroad: read(r, aCols, '海外交换经历'),
    dual_degree: read(r, aCols, '陆本海本双学位'),
    education_notes: read(r, aCols, '教育背景备注'),
    cs_courses: read(r, aCols, '本科修读课程'),
    gpa_scale: read(r, aCols, '本科分数制'),
    gpa: read(r, aCols, '本科GPA'),
    gpa_rank: read(r, aCols, '本科GPA排名'),
    gpa_notes: read(r, aCols, 'GPA备注'),
    toefl_total: isIelts ? null : toeflTotal,
    toefl_reading: isIelts ? null : lr,
    toefl_listening: isIelts ? null : ll,
    toefl_speaking: isIelts ? null : ls,
    toefl_writing: isIelts ? null : lw,
    ielts_total: isIelts ? toeflTotal : null,
    ielts_reading: isIelts ? lr : null,
    ielts_listening: isIelts ? ll : null,
    ielts_speaking: isIelts ? ls : null,
    ielts_writing: isIelts ? lw : null,
    gre_total: read(r, aCols, 'GRE 总分'),
    gre_quant: read(r, aCols, 'GRE 数学'),
    gre_verbal: read(r, aCols, 'GRE 语文'),
    gre_writing: read(r, aCols, 'GRE 写作'),
    research_domestic_count: read(r, aCols, '国内科研经历段数'),
    research_overseas_count: read(r, aCols, '海外科研经历段数'),
    research_notes: read(r, aCols, '科研经历介绍'),
    internship_domestic_count: read(r, aCols, '国内实习经历段数'),
    internship_overseas_count: read(r, aCols, '海外实习经历段数'),
    internship_notes: read(r, aCols, '实习经历介绍'),
    rec1_tags: read(r, aCols, '推荐信1'),
    rec2_tags: read(r, aCols, '推荐信2'),
    rec3_tags: read(r, aCols, '推荐信3'),
    rec4_tags: read(r, aCols, '推荐信4'),
    rec5_tags: read(r, aCols, '推荐信5'),
    rec_notes: read(r, aCols, '推荐信介绍'),
    pub_top_first_author: read(r, aCols, 'published顶会一作'),
    pub_top_other_author: read(r, aCols, 'published顶会其他作者'),
    submission_top_first_author: read(r, aCols, '在投顶会一作'),
    submission_top_other_author: read(r, aCols, '在投顶会其他作者'),
    pub_notes: read(r, aCols, 'Pub情况'),
    other_soft_background: read(r, aCols, '其他软背景'),
    contact_info: read(r, aCols, '个人主页/联系方式'),
    created_at: read(r, { _ctime: { key: '_ctime', name: '_ctime', type: 'ctime' } }, '_ctime')
      ?? r._ctime ?? null,
    updated_at: r._mtime ?? null,
    locked_at: r._ctime ?? null,
  };
  applicantSql.push(insertRow('applicants', fields));
}
applicantSql.push('COMMIT;');
fs.writeFileSync(path.join(OUTPUT_DIR, '001-applicants.sql'), applicantSql.join('\n') + '\n');

// ---------- emit programs SQL ----------
const programSql = [
  '-- 002-programs.sql — Seatable 项目列表 → programs',
  '-- tier inherited from static/data/programs.json where (school, program) matched, else NULL.',
  '-- Duplicate (school, program) rows in Seatable are merged: first row wins, later rows skipped.',
  'BEGIN TRANSACTION;',
];
let programEmitted = 0;
for (const r of tProg.rows) {
  if (programDuplicateRows.has(r._id)) continue;
  const school = read(r, pCols, '学校');
  const program = read(r, pCols, '项目');
  const tier = programTierFromJson[r._id] || null;
  if (!tier) {
    manualReview.programs_unmapped_tier.push({
      seatable_row_id: r._id,
      assigned_id: programIdMap[r._id],
      school,
      program,
    });
  }
  const fields = {
    id: programIdMap[r._id],
    seatable_row_id: r._id,
    seatable_program_id: readAutoNumber(getCell(r, pCols['Program ID'])),
    school,
    program,
    degree: read(r, pCols, '学位'),
    country: read(r, pCols, '国家'),
    country_lat: readGeoLat(r, pCols, '国家'),
    country_lng: readGeoLng(r, pCols, '国家'),
    homepage_url: read(r, pCols, '官网链接'),
    tier,
    aliases: null,
    status: 'active',
    submitted_by: null,
    created_at: r._ctime || null,
  };
  programSql.push(insertRow('programs', fields));
  programEmitted++;
}
manualReview.programs_duplicate_pairs_merged = programDuplicatesReview;
programSql.push('COMMIT;');
fs.writeFileSync(path.join(OUTPUT_DIR, '002-programs.sql'), programSql.join('\n') + '\n');

// ---------- emit datapoints SQL ----------
const dpSql = [
  '-- 003-datapoints.sql — Seatable DataPoints → datapoints',
  '-- Drops the link-formula / formula columns (学位/国家/分数制/GPA/项目文本) — recompute via JOIN at query time.',
  '-- Rows missing applicant or program links require explicit --allow-skips (see manual-review.json).',
  'BEGIN TRANSACTION;',
];
let dpEmitted = 0;
function orphanDetails(row, applicantRowId, programRowId) {
  return {
    seatable_row_id: row._id,
    seatable_dp_id: readAutoNumber(getCell(row, dCols['DataPoints ID'])),
    applicant_row_id: applicantRowId || null,
    program_row_id: programRowId || null,
    result: read(row, dCols, '结果'),
    academic_year: read(row, dCols, '学年'),
    semester: read(row, dCols, '学期'),
    notified_at: read(row, dCols, '通知时间'),
    submitted_at: read(row, dCols, '网申提交时间'),
    notes: read(row, dCols, '补充说明 如面试/联系方式等'),
    creator: row._creator || null,
    created_at: row._ctime || null,
  };
}
for (const r of tDP.rows) {
  const applicantRowId = dpToApplicant[r._id];
  const programRowId = dpToProgram[r._id];
  if (!applicantRowId && !programRowId) {
    manualReview.datapoints_orphan_both.push(orphanDetails(r, applicantRowId, programRowId));
    continue;
  }
  if (!applicantRowId) {
    manualReview.datapoints_orphan_no_applicant.push(orphanDetails(r, applicantRowId, programRowId));
    continue;
  }
  if (!programRowId) {
    manualReview.datapoints_orphan_no_program.push(orphanDetails(r, applicantRowId, programRowId));
    continue;
  }
  const applicantId = applicantIdMap[applicantRowId];
  const programId = programIdMap[programRowId];
  if (!applicantId || !programId) {
    manualReview.datapoints_orphan_both.push({
      ...orphanDetails(r, applicantRowId, programRowId),
      reason: 'link target not found in id maps',
    });
    continue;
  }
  const fields = {
    id: ulid('dp_'),
    seatable_row_id: r._id,
    seatable_dp_id: readAutoNumber(getCell(r, dCols['DataPoints ID'])),
    applicant_id: applicantId,
    program_id: programId,
    result: read(r, dCols, '结果'),
    is_funded: read(r, dCols, '带奖'),
    is_final_destination: read(r, dCols, '最终去向'),
    academic_year: read(r, dCols, '学年'),
    semester: read(r, dCols, '学期'),
    notified_at: read(r, dCols, '通知时间'),
    submitted_at: read(r, dCols, '网申提交时间'),
    notes: read(r, dCols, '补充说明 如面试/联系方式等'),
    created_at: r._ctime || null,
    updated_at: r._mtime || null,
  };
  dpSql.push(insertRow('datapoints', fields));
  dpEmitted++;
}
dpSql.push('COMMIT;');
fs.writeFileSync(path.join(OUTPUT_DIR, '003-datapoints.sql'), dpSql.join('\n') + '\n');

// ---------- manual-review.json + summary.txt ----------
manualReview.migration_counts = {
  source_datapoints: tDP.rows.length,
  emitted_datapoints: dpEmitted,
  skipped_datapoints: tDP.rows.length - dpEmitted,
};
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'manual-review.json'),
  JSON.stringify(manualReview, null, 2) + '\n',
);

const summary = [
  '=== Migration summary ===',
  `applicants:  emitted=${tApp.rows.length}   expected=${EXPECTED_COUNTS.applicants}   ${tApp.rows.length === EXPECTED_COUNTS.applicants ? 'OK' : 'MISMATCH'}`,
  `programs:    emitted=${programEmitted}   merged-dupes=${programDuplicatesReview.length}   seatable-rows=${tProg.rows.length}   expected=${EXPECTED_COUNTS.programs}`,
  `datapoints:  source=${tDP.rows.length}   emitted=${dpEmitted}   skipped=${tDP.rows.length - dpEmitted}   expected=${EXPECTED_COUNTS.datapoints}`,
  '',
  '=== Manual-review queue ===',
  `programs without tier:             ${manualReview.programs_unmapped_tier.length}`,
  `programs duplicate-pairs merged:   ${manualReview.programs_duplicate_pairs_merged.length}`,
  `datapoints orphan (applicant only): ${manualReview.datapoints_orphan_no_applicant.length}`,
  `datapoints orphan (program only):   ${manualReview.datapoints_orphan_no_program.length}`,
  `datapoints orphan (both links):     ${manualReview.datapoints_orphan_both.length}`,
  `applicants with blank 本科学校名称:  ${manualReview.applicants_locked_school_name_blank.length}`,
].join('\n');
fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.txt'), summary + '\n');
console.log(summary);

const integrity = assessMigrationIntegrity({
  sourceDatapoints: tDP.rows.length,
  expectedDatapoints: EXPECTED_COUNTS.datapoints,
  emittedDatapoints: dpEmitted,
  orphanNoApplicant: manualReview.datapoints_orphan_no_applicant.length,
  orphanNoProgram: manualReview.datapoints_orphan_no_program.length,
  orphanBoth: manualReview.datapoints_orphan_both.length,
  blockingReviewItems:
    manualReview.programs_unmapped_tier.length
    + manualReview.applicants_locked_school_name_blank.length,
  allowSkips,
});
console.log(`\n${integrity.message}`);
console.log(`✔ output written to ${OUTPUT_DIR}`);
if (!integrity.ok) process.exitCode = 1;
