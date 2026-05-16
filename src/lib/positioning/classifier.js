export const TIERS = ['SSS', 'SS', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+'];

const UG_BASE = {
  'us-top': 64,
  'cn-985-top': 62,
  'us-mid': 52,
  'cn-985': 46,
  'overseas': 44,
  'cn-211': 38,
  'cn-双非': 26,
};

function normalizeGpa(gpa, scale) {
  if (gpa == null || isNaN(gpa)) return 0;
  if (scale === '4.0') return Math.max(0, Math.min(4.0, gpa));
  if (scale === '4.3') return Math.max(0, Math.min(4.0, (gpa / 4.3) * 4.0));
  if (scale === '5.0') return Math.max(0, Math.min(4.0, (gpa / 5.0) * 4.0));
  if (scale === '100') {
    if (gpa >= 95) return 4.0;
    if (gpa >= 90) return 3.85 + (gpa - 90) * 0.03;
    if (gpa >= 85) return 3.6 + (gpa - 85) * 0.05;
    if (gpa >= 80) return 3.3 + (gpa - 80) * 0.06;
    if (gpa >= 70) return 2.7 + (gpa - 70) * 0.06;
    return Math.max(0, (gpa / 100) * 4);
  }
  return Math.max(0, Math.min(4.0, gpa));
}

function gpaScore(gpa4) {
  if (gpa4 >= 3.95) return 20;
  if (gpa4 >= 3.9) return 17;
  if (gpa4 >= 3.85) return 14;
  if (gpa4 >= 3.8) return 10;
  if (gpa4 >= 3.7) return 6;
  if (gpa4 >= 3.5) return 1;
  if (gpa4 >= 3.3) return -4;
  if (gpa4 >= 3.0) return -10;
  return -16;
}

function researchScore(research) {
  switch (research) {
    case 'top-conf-first': return 14;
    case 'top-conf-coauthor': return 8;
    case 'domestic-paper': return 3;
    default: return 0;
  }
}

function internshipScore(n, bigTech) {
  let s = 0;
  if (n >= 4) s += 6;
  else if (n >= 2) s += 4;
  else if (n >= 1) s += 2;
  if (bigTech) s += 3;
  return s;
}

function recScore(strongRecs) {
  if (strongRecs >= 3) return 5;
  if (strongRecs >= 2) return 3;
  if (strongRecs >= 1) return 1;
  return 0;
}

function testScore(toefl, gre) {
  let s = 0;
  if (toefl != null) {
    if (toefl >= 110) s += 2;
    else if (toefl >= 100) s += 1;
    else if (toefl > 0 && toefl < 90) s -= 2;
  }
  if (gre && gre.total) {
    if (gre.total >= 328) s += 2;
    else if (gre.total >= 320) s += 1;
    else if (gre.total > 0 && gre.total < 310) s -= 1;
  }
  return s;
}

function majorAdjust(profile) {
  if (profile.isCsBackground) return 0;
  if (profile.major === 'ee/ece' || profile.major === 'math' || profile.major === 'physics') return -2;
  if (profile.major === 'other-eng') return -5;
  return -8;
}

function scoreToTier(score) {
  if (score >= 95) return 'SSS';
  if (score >= 85) return 'SS';
  if (score >= 77) return 'S';
  if (score >= 70) return 'A+';
  if (score >= 62) return 'A';
  if (score >= 54) return 'A-';
  if (score >= 46) return 'B+';
  if (score >= 36) return 'B';
  if (score >= 26) return 'B-';
  return 'C+';
}

function applyHardCaps(tier, profile, gpa4) {
  const ti = (t) => TIERS.indexOf(t);
  const cap = (t) => (ti(tier) < ti(t) ? t : tier);

  if (profile.research !== 'top-conf-first') {
    tier = cap('SS');
  }
  if (profile.ugType !== 'cn-985-top' && profile.ugType !== 'us-top') {
    tier = cap('SS');
  }
  if (gpa4 < 3.85 && profile.research === 'none') {
    tier = cap('S');
  }
  if (profile.ugType === 'cn-双非') {
    if (!profile.bigTechIntern && profile.research === 'none') tier = cap('A-');
    else tier = cap('A');
  }
  if (profile.ugType === 'cn-211' && profile.research === 'none' && !profile.bigTechIntern) {
    tier = cap('A');
  }
  if (gpa4 < 3.3 && profile.research === 'none' && !profile.bigTechIntern) {
    tier = cap('B+');
  }
  if (profile.gpa == null || profile.gpa === 0) {
    tier = cap('B');
  }
  return tier;
}

function rationaleFor(profile, tier, breakdown) {
  const parts = [];
  const ugLabel = {
    'us-top': '美本Top30',
    'us-mid': '美本中游',
    'cn-985-top': '清北华5',
    'cn-985': '985',
    'cn-211': '211',
    'cn-双非': '双非',
    'overseas': '海外院校',
  }[profile.ugType] || profile.ugType;
  parts.push(`${ugLabel}背景`);
  parts.push(`GPA折算约${breakdown.gpa4.toFixed(2)}/4.0`);
  if (!profile.isCsBackground) parts.push('非科班');
  if (profile.research && profile.research !== 'none') {
    const r = {
      'domestic-paper': '有国内论文',
      'top-conf-coauthor': '有顶会合作',
      'top-conf-first': '有顶会一作',
    }[profile.research];
    if (r) parts.push(r);
  }
  if (profile.bigTechIntern) parts.push('有大厂实习');
  else if (profile.internships >= 1) parts.push(`${profile.internships}段实习`);
  if (profile.strongRecs >= 2) parts.push('强推到位');
  return `综合判断属于${tier}档位（${parts.join('、')}）。`;
}

export function classify(profile) {
  const ugBase = UG_BASE[profile.ugType] ?? 35;
  const gpa4 = normalizeGpa(profile.gpa, profile.gpaScale);
  const gpaContrib = gpaScore(gpa4);
  const researchContrib = researchScore(profile.research);
  const internshipContrib = internshipScore(profile.internships || 0, !!profile.bigTechIntern);
  const recContrib = recScore(profile.strongRecs || 0);
  const testContrib = testScore(profile.toefl, profile.gre);
  const majorContrib = majorAdjust(profile);

  let trackAdjust = 0;
  if (profile.targetTrack === 'ml-ai' && profile.research === 'none' && profile.internships < 1) trackAdjust -= 2;
  if (profile.targetTrack === 'systems' && !profile.isCsBackground) trackAdjust -= 2;
  if (profile.targetTrack === 'ds' && (profile.major === 'math' || profile.major === 'other')) trackAdjust += 1;

  let raw = ugBase + gpaContrib + researchContrib + internshipContrib + recContrib + testContrib + majorContrib + trackAdjust;

  if (gpa4 >= 3.95 && (profile.ugType === 'cn-985-top' || profile.ugType === 'us-top') && profile.research === 'top-conf-first') {
    raw += 4;
  }
  if (profile.ugType === 'cn-双非' && gpa4 < 3.5 && !profile.bigTechIntern) {
    raw -= 4;
  }

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  let tier = scoreToTier(score);
  tier = applyHardCaps(tier, profile, gpa4);

  const breakdown = {
    ugBase,
    gpa4: Number(gpa4.toFixed(3)),
    gpa: gpaContrib,
    research: researchContrib,
    internship: internshipContrib,
    recommendations: recContrib,
    tests: testContrib,
    major: majorContrib,
    track: trackAdjust,
    raw: Number(raw.toFixed(2)),
  };

  const rationale = rationaleFor(profile, tier, breakdown);

  return { tier, score, breakdown, rationale };
}

export function tierIndex(tier) {
  return TIERS.indexOf(tier);
}
