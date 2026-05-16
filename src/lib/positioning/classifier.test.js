import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, TIERS, tierIndex } from './classifier.js';

function baseProfile(overrides = {}) {
  return {
    ugType: 'cn-985',
    gpaScale: '4.0',
    gpa: 3.7,
    major: 'cs',
    isCsBackground: true,
    toefl: 100,
    gre: null,
    research: 'none',
    internships: 1,
    bigTechIntern: false,
    strongRecs: 0,
    targetTrack: 'cs-general',
    needScholarship: false,
    locationPref: 'flexible',
    ...overrides,
  };
}

test('SSS tier: 清华 rk1 + 顶会一作 + 大厂实习 + 强推', () => {
  const result = classify(baseProfile({
    ugType: 'cn-985-top',
    gpaScale: '4.0',
    gpa: 3.98,
    research: 'top-conf-first',
    internships: 3,
    bigTechIntern: true,
    strongRecs: 3,
    toefl: 115,
    gre: { total: 335, q: 170, v: 165, aw: 5 },
  }));
  assert.ok(tierIndex(result.tier) <= tierIndex('SS'), `expected SSS or SS, got ${result.tier}`);
  assert.ok(result.score >= 88);
  assert.equal(typeof result.rationale, 'string');
});

test('SS tier: 清北华5 高 GPA + 顶会合作 + 大厂', () => {
  const result = classify(baseProfile({
    ugType: 'cn-985-top',
    gpa: 3.92,
    research: 'top-conf-coauthor',
    internships: 2,
    bigTechIntern: true,
    strongRecs: 2,
    toefl: 110,
  }));
  assert.ok(['SSS', 'SS', 'S'].includes(result.tier), `expected SSS/SS/S, got ${result.tier}`);
});

test('S tier: 普通 985 cs 科班 + 高 GPA + 不错的实习', () => {
  const result = classify(baseProfile({
    ugType: 'cn-985',
    gpa: 3.9,
    research: 'domestic-paper',
    internships: 2,
    bigTechIntern: true,
    strongRecs: 1,
    toefl: 105,
  }));
  assert.ok(['S', 'A+', 'A'].includes(result.tier), `expected S/A+/A, got ${result.tier}`);
});

test('A tier: 211 cs 科班 + 中等 GPA + 一段实习', () => {
  const result = classify(baseProfile({
    ugType: 'cn-211',
    gpa: 3.75,
    research: 'none',
    internships: 1,
    bigTechIntern: false,
    strongRecs: 0,
    toefl: 100,
  }));
  assert.ok(['A', 'A-', 'B+'].includes(result.tier), `expected A/A-/B+, got ${result.tier}`);
});

test('B tier: 双非转码 + 一般 GPA + 无实习', () => {
  const result = classify(baseProfile({
    ugType: 'cn-双非',
    gpa: 3.5,
    major: 'other',
    isCsBackground: false,
    research: 'none',
    internships: 0,
    bigTechIntern: false,
    strongRecs: 0,
    toefl: 95,
    targetTrack: 'cs-general',
  }));
  assert.ok(['B', 'B-', 'C+'].includes(result.tier), `expected B/B-/C+, got ${result.tier}`);
});

test('A-/B+ tier: 美本 top 100 水 GPA + 一段实习', () => {
  const result = classify(baseProfile({
    ugType: 'us-mid',
    gpaScale: '4.0',
    gpa: 3.4,
    major: 'cs',
    isCsBackground: true,
    research: 'none',
    internships: 1,
    bigTechIntern: false,
    strongRecs: 0,
    toefl: null,
  }));
  assert.ok(['A-', 'B+', 'B'].includes(result.tier), `expected A-/B+/B, got ${result.tier}`);
});

test('breakdown 返回每个维度贡献', () => {
  const result = classify(baseProfile());
  const b = result.breakdown;
  assert.ok('ugBase' in b);
  assert.ok('gpa' in b);
  assert.ok('research' in b);
  assert.ok('internship' in b);
  assert.ok('recommendations' in b);
  assert.ok('tests' in b);
  assert.ok('major' in b);
  assert.ok('gpa4' in b);
});

test('百分制 GPA 正确折算', () => {
  const a = classify(baseProfile({ gpaScale: '100', gpa: 92 }));
  const b = classify(baseProfile({ gpaScale: '4.0', gpa: 3.85 }));
  assert.ok(Math.abs(a.breakdown.gpa4 - b.breakdown.gpa4) < 0.15,
    `92 should normalize close to 3.85 4.0; got ${a.breakdown.gpa4} vs ${b.breakdown.gpa4}`);
});

test('tier 返回值在 TIERS 列表里', () => {
  const result = classify(baseProfile());
  assert.ok(TIERS.includes(result.tier));
});

test('美本 Top 30 高 GPA 哪怕没科研也能进 S 或更高', () => {
  const result = classify(baseProfile({
    ugType: 'us-top',
    gpaScale: '4.0',
    gpa: 3.95,
    research: 'none',
    internships: 2,
    bigTechIntern: true,
    strongRecs: 1,
    toefl: null,
  }));
  assert.ok(tierIndex(result.tier) <= tierIndex('A+'), `expected SSS/SS/S/A+, got ${result.tier}`);
});

test('双非科班 GPA 极高也最多到 B+', () => {
  const result = classify(baseProfile({
    ugType: 'cn-双非',
    gpaScale: '4.0',
    gpa: 3.95,
    research: 'none',
    internships: 1,
    bigTechIntern: false,
    strongRecs: 0,
  }));
  assert.ok(tierIndex(result.tier) >= tierIndex('A-'),
    `双非 should not exceed A-; got ${result.tier}`);
});
