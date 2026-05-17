#!/usr/bin/env node
// 从 test-data-replied.v5.md 反推 profiles.json — 仅用于重跑 generate-v5.mjs
// 每段 ## #N {emailShort} · {schoolLabel} 后跟一个标准表格
import fs from 'node:fs';

const md = fs.readFileSync('/Users/capsfly/Desktop/csgrad/test-data-replied.v5.md', 'utf8');
const sections = md.split(/\n## /).slice(1);

const ugMap = {
  '美本 Top 30': 'us-top',
  '美本 Top 30-100': 'us-mid',
  '顶尖海外': 'overseas-top',
  '清北': 'cn-tsinghua-pku',
  '上科大/南科大': 'cn-sustech-shtech',
  '华5': 'cn-hua5',
  '其他 985': 'cn-985',
  '211': 'cn-211',
  '双非': 'cn-双非',
  '其他海外': 'overseas',
  '清北华5': 'cn-985-top',
};
const researchMap = {
  '无': 'none',
  '国内论文': 'domestic-paper',
  '顶会合作': 'top-conf-coauthor',
  '顶会一作': 'top-conf-first',
};
const goalMap = {
  '美国找工': 'us-job',
  '回国找工': 'cn-job',
  '美国读博': 'us-phd',
  '未明确': 'unsure',
};

const profiles = [];
for (const sec of sections) {
  const headerEnd = sec.indexOf('\n');
  const header = sec.slice(0, headerEnd).trim();
  // 跳过非编号 section（如「处理统计」）
  const m = header.match(/^#?(\d+)\s+(\S+)\s+·\s+(.+)$/);
  if (!m) continue;
  const num = parseInt(m[1], 10);
  const emailShort = m[2];
  const schoolLabel = m[3].replace(/\s*c[:：].*$/, '').replace(/\s*cc[前后].*$/, '').trim();

  const row = (label) => {
    const re = new RegExp(`\\|\\s*${label.replace(/[/]/g, '\\/')}\\s*\\|\\s*([^|\\n]+)\\s*\\|`);
    const mm = sec.match(re);
    return mm ? mm[1].trim() : '';
  };

  const ugRaw = row('本科 / 档');
  let ugType = 'cn-985';
  let isJointVenture = ugRaw.includes('（中外合办）') || ugRaw.includes('中外合办');
  const ugClean = ugRaw.replace(/（.*?）/g, '').trim();
  ugType = ugMap[ugClean] || 'cn-985';

  const gpaRaw = row('GPA');
  let gpa = 0, gpaScale = '4.0', jointForeignGpa = null;
  const jvMatch = gpaRaw.match(/^([0-9.]+)（陆本，([0-9.]+)）.*?([0-9.]+)（海外段，([0-9.]+)）/);
  if (jvMatch) {
    gpa = parseFloat(jvMatch[1]);
    gpaScale = jvMatch[2];
    jointForeignGpa = parseFloat(jvMatch[3]);
  } else {
    const gm = gpaRaw.match(/^([0-9.]+)（([0-9.]+)\s*制?）/);
    if (gm) { gpa = parseFloat(gm[1]); gpaScale = gm[2]; }
  }

  const majorRaw = row('专业 / 科班');
  const majorM = majorRaw.split('/')[0].trim();
  const isCsBackground = majorRaw.includes('科班') && !majorRaw.includes('非科班');
  const csCoursesMatch = majorRaw.match(/已修 CS 课\s*(\d+)\s*门\s*\/\s*总\s*(\d+)\s*门/);
  const csCoursesCompleted = csCoursesMatch ? parseInt(csCoursesMatch[1], 10) : null;
  const csCoursesTakenCount = csCoursesMatch ? parseInt(csCoursesMatch[2], 10) : null;

  const triRaw = row('三维');
  let toefl = null, ielts = null, gre = null;
  const tm = triRaw.match(/托福\s*(\d+)/);
  if (tm) toefl = parseInt(tm[1], 10);
  const im = triRaw.match(/雅思\s*([0-9.]+)/);
  if (im) ielts = parseFloat(im[1]);
  const grm = triRaw.match(/GRE\s*(\d+)/);
  if (grm) gre = { total: parseInt(grm[1], 10) };

  const researchRaw = row('科研 / 顶会');
  const hasCvConfPaper = researchRaw.includes('CV 顶会');
  const researchClean = researchRaw.replace(/（.*?）/g, '').trim();
  const research = researchMap[researchClean] || 'none';

  const internRaw = row('实习');
  const internMatch = internRaw.match(/(\d+)\s*段/);
  const internships = internMatch ? parseInt(internMatch[1], 10) : 0;
  const bigTechIntern = internRaw.includes('大厂');
  const hasFullTime = internRaw.includes('全职');

  const recsRaw = row('强推');
  let strongRecs = 0;
  if (recsRaw.includes('不确定')) strongRecs = 'unknown';
  else { const rm = recsRaw.match(/(\d+)/); if (rm) strongRecs = parseInt(rm[1], 10); }

  const goalRaw = row('方向 / 目标');
  const [trackPart, goalPart] = goalRaw.split('/').map((s) => s.trim());
  const targetTrack = trackPart || 'cs-general';
  const careerGoal = goalMap[goalPart] || 'unsure';

  profiles.push({
    num,
    emailShort,
    schoolLabel,
    profile: {
      ugType, isJointVenture, gpa, gpaScale, jointForeignGpa,
      major: majorM, isCsBackground, csCoursesCompleted, csCoursesTakenCount,
      toefl, ielts, gre, research, hasCvConfPaper,
      internships, bigTechIntern, hasFullTime,
      strongRecs, targetTrack, careerGoal,
    },
  });
}

fs.writeFileSync('/tmp/profiles.json', JSON.stringify(profiles, null, 2));
console.log(`Parsed ${profiles.length} profiles → /tmp/profiles.json`);
