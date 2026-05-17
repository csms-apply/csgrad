export const TIERS = ['SSS', 'SS', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+'];

const UG_BASE = {
  'cn-tsinghua-pku': 65,
  'us-top': 64,
  'cn-sustech-shtech': 61,
  'cn-hua5': 60,
  'overseas-top': 58,
  'us-mid': 52,
  'cn-985': 46,
  'overseas': 44,
  'cn-211': 38,
  'cn-双非': 26,
  'cn-985-top': 62,
};

export function normalizeGpa(gpa, scale) {
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

function normalizeToefl(t) {
  if (t == null || isNaN(t)) return null;
  if (t <= 0) return null;
  if (t <= 6) {
    if (t >= 6.0) return 117;
    if (t >= 5.5) return 110;
    if (t >= 5.0) return 100;
    if (t >= 4.5) return 90;
    if (t >= 4.0) return 78;
    if (t >= 3.5) return 65;
    if (t >= 3.0) return 50;
    if (t >= 2.5) return 38;
    if (t >= 2.0) return 28;
    if (t >= 1.5) return 16;
    return 5;
  }
  return t;
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

function normalizeStrongRecs(v) {
  if (typeof v === 'number') return v;
  if (v == null || v === 'unknown') return 0;
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

function recScore(strongRecs) {
  const n = normalizeStrongRecs(strongRecs);
  if (n >= 3) return 5;
  if (n >= 2) return 3;
  if (n >= 1) return 1;
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
  let penalty;
  if (profile.major === 'ee/ece' || profile.major === 'math' || profile.major === 'physics') penalty = 2;
  else if (profile.major === 'other-eng') penalty = 5;
  else penalty = 8;
  if ((profile.csCoursesCompleted ?? 0) >= 4) penalty = Math.ceil(penalty / 2);
  return -penalty;
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
  const sssEligible = ['cn-tsinghua-pku', 'us-top', 'cn-985-top'];
  if (!sssEligible.includes(profile.ugType)) {
    tier = cap('SS');
  }
  if (gpa4 < 3.85 && profile.research === 'none') {
    tier = cap('S');
  }
  if (profile.ugType === 'overseas-top' && gpa4 <= 3.7) {
    tier = cap('A+');
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
    'overseas-top': '顶尖海外',
    'cn-tsinghua-pku': '清北',
    'cn-sustech-shtech': '上科大/南科大',
    'cn-hua5': '华5',
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
  if (profile.hasFullTime === true) parts.push('有全职工作经历');
  if (normalizeStrongRecs(profile.strongRecs) >= 2) parts.push('强推到位');
  return `综合判断属于${tier}档位（${parts.join('、')}）。`;
}

export function classify(profileInput) {
  const normalizedToefl = normalizeToefl(profileInput.toefl);
  let effectiveGpa = profileInput.gpa;
  let effectiveScale = profileInput.gpaScale;
  if (profileInput.hasUsStudyExperience && profileInput.usStudyGpa != null) {
    effectiveGpa = profileInput.usStudyGpa;
    effectiveScale = profileInput.usStudyGpaScale || '4.0';
  } else if (profileInput.isJointVenture && profileInput.jointForeignGpa != null) {
    effectiveGpa = profileInput.jointForeignGpa;
    effectiveScale = '4.0';
  }
  const profile = { ...profileInput, toefl: normalizedToefl, gpa: effectiveGpa, gpaScale: effectiveScale };
  const ugBase = UG_BASE[profile.ugType] ?? 35;
  const gpa4 = normalizeGpa(effectiveGpa, effectiveScale);
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

  const topUg = ['cn-tsinghua-pku', 'cn-hua5', 'us-top', 'overseas-top', 'cn-985-top'];
  if (gpa4 >= 3.95 && topUg.includes(profile.ugType) && profile.research === 'top-conf-first') {
    raw += 4;
  }
  if (profile.ugType === 'cn-双非' && gpa4 < 3.5 && !profile.bigTechIntern) {
    raw -= 4;
  }

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  let tier = scoreToTier(score);
  tier = applyHardCaps(tier, profile, gpa4);

  const warnings = [];
  const cnUg = ['cn-tsinghua-pku', 'cn-sustech-shtech', 'cn-hua5', 'cn-985', 'cn-985-top', 'cn-211', 'cn-双非'];
  const toeflLow = profile.toefl != null && profile.toefl > 0 && profile.toefl < 100;
  const ieltsLow = profile.ielts != null && profile.ielts > 0 && profile.ielts < 7;
  if (cnUg.includes(profile.ugType) && (toeflLow || ieltsLow)) {
    const idx = TIERS.indexOf(tier);
    if (idx >= 0 && idx < TIERS.length - 1) {
      tier = TIERS[idx + 1];
    }
    const which = toeflLow && ieltsLow ? '托福 < 100 且雅思 < 7' : (toeflLow ? '托福 < 100' : '雅思 < 7');
    warnings.push({
      type: 'language-low',
      severity: 'high',
      message: `你的语言成绩${which}，对陆本同学是 admission 硬伤——已按规则把你的档位下调一档。强烈建议尽快重考到托福 105+ / 雅思 7+，否则会被绝大部分美研 MSCS 项目卡门槛。`,
    });
  }

  if (gpa4 < 3.3) {
    warnings.push({
      type: 'low-gpa-extension',
      severity: 'info',
      message: `你的 GPA（4.0 制折算后约 ${gpa4.toFixed(2)}）偏低，对申请有较大影响。建议申请前通过 UCSD Extension / ASU 在线课程多修几门 CS 课程拿 A，把整体 GPA 拉到 3.3+ 再申请。`,
    });
  }

  if (profile.isCsBackground === false && (profile.csCoursesCompleted ?? 0) < 4) {
    warnings.push({
      type: 'transition-courses-needed',
      severity: 'high',
      message: '你是转码方向但已修 CS 课程不足 4 门。强烈建议申请前补齐 DS&A、操作系统、数据库、计算机网络 4 门核心课（可通过 CC / UCSD Extension / ASU 在线），否则大部分 MSCS 项目会因先修课不达标拒掉。',
    });
  }

  if (profile.gre && profile.gre.total && profile.gre.total > 0 && profile.gre.total < 320) {
    warnings.push({
      type: 'gre-low',
      severity: 'info',
      message: `你的 GRE 总分 ${profile.gre.total} 偏低（320- 在 admission 上算反向信号）。非必要建议不要提交这个分数；如果不想交，申请时让所有 GRE-optional 项目选 "will not submit"。`,
    });
  }

  if (profile.hasFullTime === true) {
    warnings.push({
      type: 'fulltime-prefer-one-year',
      severity: 'info',
      message: '你有全职工作经历，建议优先一年制项目：UCB EECS MEng（必修 capstone）/ Wisc CS PMP（实质要求全职经验）/ Cornell CS MEng（一年完成）。一年制项目能让你尽快回到职场。',
    });
  }

  if (profile.research === 'top-conf-first') {
    warnings.push({
      type: 'top-paper-no-internship',
      severity: 'info',
      message: '顶会一作背景下，**不必再补实习**。把当前科研推到 paper accept 是最重要的（顶会一作 + accepted 状态打开 SSS 申请之门）。',
    });
  }

  if ((profile.targetTrack === 'ece-hw' || profile.targetTrack === 'ee-signal') &&
      (profile.research === 'top-conf-first' || profile.research === 'top-conf-coauthor')) {
    warnings.push({
      type: 'hardware-prefer-msee',
      severity: 'info',
      message: '你是硬件 / 信号方向 + 顶会背景，**建议优先 Stanford MSEE 而不是 MSCS**（MSEE 更 match 你的硬件 bg，admission 也更友好）。',
    });
  }

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

  return { tier, score, breakdown, rationale, warnings };
}

export function tierIndex(tier) {
  return TIERS.indexOf(tier);
}
