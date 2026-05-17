#!/usr/bin/env node
// generate-v5.mjs — 纯代码规则生成 v5.md，无 LLM 推理
// 实现 cloudflare-worker/src/index.js 第 155-260 行的 handleResult 选校逻辑

import { classify, normalizeGpa } from '../src/lib/positioning/classifier.js';
import fs from 'node:fs';

const schoolLists = JSON.parse(fs.readFileSync(new URL('../src/lib/positioning/school-lists.json', import.meta.url), 'utf8'));
const profiles = JSON.parse(fs.readFileSync('/tmp/profiles.json', 'utf8'));

function computeSchoolList(profile) {
  const cls = classify(profile);
  const tier = cls.tier;
  const isCs = !!profile.isCsBackground;
  const careerGoal = profile.careerGoal;
  const isUs = profile.ugType === 'us-top' || profile.ugType === 'us-mid';

  let effGpa = profile.gpa;
  let effScale = profile.gpaScale;
  if (profile.hasUsStudyExperience && profile.usStudyGpa != null) {
    effGpa = profile.usStudyGpa;
    effScale = profile.usStudyGpaScale || '4.0';
  } else if (profile.isJointVenture && profile.jointForeignGpa != null) {
    effGpa = profile.jointForeignGpa;
    effScale = '4.0';
  }
  const userGpa4 = normalizeGpa(effGpa, effScale);

  const hasTag = (s, tag) => Array.isArray(s.tags) && s.tags.includes(tag);

  const hasResearchOutput = ['domestic-paper', 'top-conf-coauthor', 'top-conf-first'].includes(profile.research);

  const keep = (s) => {
    if (s.dontRecommend === true) return false;
    if (isCs && hasTag(s, 'non-cs-only')) return false;
    if (careerGoal !== 'us-phd' && hasTag(s, 'phd-only')) return false;
    if (!isCs && s.noCodingTransition === true) return false;
    if (s.requiresCvConf === true && profile.hasCvConfPaper !== true) return false;
    if (Array.isArray(s.requiresMajorBucket) && !s.requiresMajorBucket.includes(profile.major)) return false;
    if (Array.isArray(s.requiresTier) && !s.requiresTier.includes(tier)) return false;
    if (s.requiresResearch === true && !hasResearchOutput) return false;
    const floor = isUs ? s.gpaFloorUS : s.gpaFloorCN;
    if (floor != null && userGpa4 > 0 && userGpa4 < floor) return false;
    if (s.toeflMin != null && profile.toefl != null && profile.toefl > 0 && profile.toefl < s.toeflMin) return false;
    if (s.ieltsMin != null && profile.ielts != null && profile.ielts > 0 && profile.ielts < s.ieltsMin) return false;
    return true;
  };

  const rawList = schoolLists[tier] || { reach: [], match: [], safety: [] };
  let reach = (rawList.reach || []).filter(keep);
  let matchBucket = (rawList.match || []).filter(keep);
  let safetyAll = (rawList.safety || []).filter(keep);

  // Columbia MSCS reach → match for A+/A
  if (tier === 'A+' || tier === 'A') {
    const idx = reach.findIndex((s) => /columbia\s*mscs/i.test(s.school || ''));
    if (idx >= 0) {
      const [moved] = reach.splice(idx, 1);
      matchBucket.push(moved);
    }
  }
  // CMU MCDS match → reach for A+
  if (tier === 'A+') {
    const idx = matchBucket.findIndex((s) => /cmu\s*mcds/i.test(s.school || ''));
    if (idx >= 0) {
      const [moved] = matchBucket.splice(idx, 1);
      reach.push(moved);
    }
  }

  // codingTransitionRecommended merge when not CS background
  if (!isCs && schoolLists.codingTransitionRecommended) {
    const codingSchools = (schoolLists.codingTransitionRecommended.schools || []).filter(keep);
    const existing = new Set([...reach, ...matchBucket, ...safetyAll].map((s) => s.school));
    for (const s of codingSchools) {
      if (existing.has(s.school)) continue;
      const b = s.barIndex || 60;
      if (b >= 80) reach.push(s);
      else if (b >= 65) matchBucket.push(s);
      else safetyAll.push(s);
    }
  }

  // high-bar-no-safety: safety → match
  const movedToMatch = safetyAll.filter((s) => hasTag(s, 'high-bar-no-safety'));
  let safety = safetyAll.filter((s) => !hasTag(s, 'high-bar-no-safety'));
  let match = matchBucket.concat(movedToMatch);

  // safety >= 2 floor
  if (safety.length < 2 && match.length > 0) {
    const sorted = match.slice().sort((a, b) => (a.barIndex || 70) - (b.barIndex || 70));
    while (safety.length < 2 && sorted.length > 0) {
      const candidate = sorted.shift();
      if (hasTag(candidate, 'high-bar-no-safety')) continue;
      const i = match.indexOf(candidate);
      if (i >= 0) match.splice(i, 1);
      safety.push(candidate);
    }
  }

  // SS/S/A+ 顶档保底覆盖：MSML/MSEE 类不进保底；按身份替换为 UIUC MCS（美本）或 UW EE PMP + UWB MSCS（陆本）
  const safetyOverrideTiers = (schoolLists.safetyOverrides && Array.isArray(schoolLists.safetyOverrides.appliesToTiers)) ? schoolLists.safetyOverrides.appliesToTiers : [];
  if (safetyOverrideTiers.includes(tier)) {
    const moved = safety.filter((s) => s.topTierNoSafety === true);
    if (moved.length > 0) {
      safety = safety.filter((s) => s.topTierNoSafety !== true);
      for (const s of moved) {
        if (!match.some((m) => m.school === s.school)) match.push(s);
      }
    }
    const injectList = isUs ? (schoolLists.safetyOverrides.usUndergrad || []) : (schoolLists.safetyOverrides.cnUndergrad || []);
    const existing = new Set([...reach, ...match, ...safety].map((s) => s.school));
    for (const s of injectList) {
      if (existing.has(s.school)) continue;
      safety.push(s);
      existing.add(s.school);
    }
  }

  // 保底上限 = 4，按 bar 高 → 低排序后截断
  const SAFETY_CAP = 4;
  if (safety.length > SAFETY_CAP) {
    safety = safety.slice().sort((a, b) => (b.barIndex || 0) - (a.barIndex || 0)).slice(0, SAFETY_CAP);
  }

  // bar 排序（同栏内 bar 高的排前面）
  const byBarDesc = (a, b) => (b.barIndex || 0) - (a.barIndex || 0);
  reach.sort(byBarDesc);
  match.sort(byBarDesc);
  safety.sort(byBarDesc);

  // phdRecommended (careerGoal === 'us-phd')
  let phd = null;
  if (careerGoal === 'us-phd' && schoolLists.phdRecommended) {
    phd = (schoolLists.phdRecommended.schools || []).filter(keep).sort(byBarDesc);
  }

  return { tier, score: cls.score, warnings: cls.warnings, reach, match, safety, phd };
}

function getDocLabel(doc) {
  if (!doc) return '';
  const parts = doc.split('/').filter(Boolean);
  return parts[0] || '';
}

let md = '# CS Grad 选校分享 v5 — 代码规则生成\n\n';
md += '> 本文件由 `scripts/generate-v5.mjs` **纯代码规则**生成，无 LLM 推理。规则更新后重跑脚本即可。\n\n';
md += '> 选校来源：`src/lib/positioning/school-lists.json` 经 worker `handleResult` 同款逻辑（classify → keep filter → 重排 → 保底 ≥2 → bar 排序）过滤后输出。\n\n';
md += '---\n\n';

const tierCounts = {};
let totalReach = 0, totalMatch = 0, totalSafety = 0;
const warningCases = {};

for (const e of profiles) {
  const r = computeSchoolList(e.profile);
  tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;
  totalReach += r.reach.length;
  totalMatch += r.match.length;
  totalSafety += r.safety.length;
  for (const w of r.warnings) {
    if (!warningCases[w.type]) warningCases[w.type] = [];
    warningCases[w.type].push(e.num);
  }

  md += `## #${e.num} ${e.emailShort} · ${e.schoolLabel}\n\n`;

  const p = e.profile;
  const ugLabel = {
    'us-top': '美本 Top 30', 'us-mid': '美本 Top 30-100', 'overseas-top': '顶尖海外',
    'cn-tsinghua-pku': '清北', 'cn-sustech-shtech': '上科大/南科大', 'cn-hua5': '华5',
    'cn-985': '其他 985', 'cn-211': '211', 'cn-双非': '双非', 'overseas': '其他海外',
    'cn-985-top': '清北华5',
  }[p.ugType] || p.ugType;
  const gpaStr = p.isJointVenture && p.jointForeignGpa != null
    ? `${p.gpa}（陆本，${p.gpaScale}）/ ${p.jointForeignGpa}（海外段，4.0）`
    : `${p.gpa}（${p.gpaScale} 制）`;
  const toeflStr = p.toefl != null ? `托福 ${p.toefl}` : '无托福';
  const ieltsStr = p.ielts != null ? `雅思 ${p.ielts}` : '';
  const greStr = p.gre && p.gre.total ? `GRE ${p.gre.total}` : '无 GRE';
  const triStr = [toeflStr, ieltsStr, greStr].filter(Boolean).join(' / ');
  const researchLabel = {
    'none': '无', 'domestic-paper': '国内论文', 'top-conf-coauthor': '顶会合作', 'top-conf-first': '顶会一作',
  }[p.research] || p.research;
  const recsLabel = p.strongRecs === 'unknown' ? '不确定' : `${p.strongRecs} 段`;
  const goalLabel = {
    'us-job': '美国找工', 'cn-job': '回国找工', 'us-phd': '美国读博', 'unsure': '未明确',
  }[p.careerGoal] || p.careerGoal;

  md += '| 项 | 内容 |\n|---|---|\n';
  md += `| 本科 / 档 | ${ugLabel}${p.isJointVenture ? '（中外合办）' : ''} |\n`;
  md += `| GPA | ${gpaStr} |\n`;
  md += `| 专业 / 科班 | ${p.major}${p.isCsBackground ? ' / 科班' : ' / 非科班（已修 CS 课 ' + (p.csCoursesCompleted || 0) + ' 门 / 总 ' + (p.csCoursesTakenCount || 0) + ' 门）'} |\n`;
  md += `| 三维 | ${triStr} |\n`;
  md += `| 科研 / 顶会 | ${researchLabel}${p.hasCvConfPaper ? '（含 CV 顶会）' : ''} |\n`;
  md += `| 实习 | ${p.internships} 段${p.bigTechIntern ? '（含大厂）' : ''}${p.hasFullTime ? ' + 有 ≥1 年全职' : ''} |\n`;
  md += `| 强推 | ${recsLabel} |\n`;
  md += `| 方向 / 目标 | ${p.targetTrack} / ${goalLabel} |\n\n`;

  md += `**我的判断：${r.tier} 档**\n\n`;

  if (r.warnings.length > 0) {
    md += '**Warnings**:\n';
    for (const w of r.warnings) {
      md += `- [${w.type}] ${w.message}\n`;
    }
    md += '\n';
  }

  md += '**冲刺**:\n';
  if (r.reach.length === 0) md += '- _(无)_\n';
  for (const s of r.reach) {
    md += `- [${getDocLabel(s.doc)}] ${s.school} — ${s.reason}\n`;
  }
  md += '\n**主申**:\n';
  if (r.match.length === 0) md += '- _(无)_\n';
  for (const s of r.match) {
    md += `- [${getDocLabel(s.doc)}] ${s.school} — ${s.reason}\n`;
  }
  md += '\n**保底**:\n';
  if (r.safety.length === 0) md += '- _(无)_\n';
  for (const s of r.safety) {
    md += `- [${getDocLabel(s.doc)}] ${s.school} — ${s.reason}\n`;
  }

  if (r.phd && r.phd.length > 0) {
    md += '\n**读博推荐**:\n';
    for (const s of r.phd) {
      md += `- [${getDocLabel(s.doc)}] ${s.school} — ${s.reason}\n`;
    }
  }

  md += '\n如果需要申请美国硕士 MSCS 辅导，可以加我微信 capsfly。\n\n---\n\n';
}

md += '# 处理统计\n\n';
md += `- 共处理 35 个表单条目（含 2 组重复提交：#4 = #3、#18 = #17）\n`;
md += `- 档位分布：\n`;
const tierOrder = ['SSS', 'SS', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+'];
for (const t of tierOrder) {
  if (tierCounts[t]) md += `  - ${t}：${tierCounts[t]} 人\n`;
}
md += `- 平均冲刺：${(totalReach / profiles.length).toFixed(1)} 所；主申：${(totalMatch / profiles.length).toFixed(1)} 所；保底：${(totalSafety / profiles.length).toFixed(1)} 所\n`;
md += `- Warnings 触发：\n`;
for (const [type, nums] of Object.entries(warningCases)) {
  md += `  - ${type}：#${nums.join(', #')}\n`;
}

fs.writeFileSync('/Users/capsfly/Desktop/csgrad/test-data-replied.v5.md', md);
console.log('Written test-data-replied.v5.md');
console.log('Tier distribution:', tierCounts);
console.log('Avg reach/match/safety:', (totalReach / profiles.length).toFixed(2), (totalMatch / profiles.length).toFixed(2), (totalSafety / profiles.length).toFixed(2));
console.log('Warnings:', Object.fromEntries(Object.entries(warningCases).map(([k, v]) => [k, v.length])));
