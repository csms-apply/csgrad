// 直播报名表的选项。value 必须和后端 live-signups.js 的白名单一致。

export const SEASONS = [
  ['2027 Fall', '2027 Fall'],
  ['2028 Fall', '2028 Fall'],
  ['other', '其他 / 观望中'],
];

export const TOPICS = [
  ['positioning', '选校定位'],
  ['program-compare', 'CS / DS / AI 项目对比'],
  ['admission-cases', '申请难度与历史录取案例'],
  ['essays-recs', '文书与推荐信'],
  ['timeline', '申请时间线'],
  ['career', '就业与职业发展'],
];

export const MAJORS = [
  ['cs-se', 'CS / 软件工程'],
  ['ee-ece', 'EE / ECE'],
  ['math-stats', '数学 / 统计'],
  ['other', '其他 / 跨专业'],
];

export const DIRECTIONS = [
  ['cs', 'CS'],
  ['ds', 'DS'],
  ['ai-ml', 'AI / ML'],
  ['ece', 'ECE'],
  ['other', '其他'],
];

export const EXPERIENCES = [
  ['research', '科研 / 论文'],
  ['bigtech-intern', '大厂实习'],
  ['other-intern', '其他实习'],
  ['fulltime', '全职工作'],
  ['competition-oss', '竞赛 / 开源项目'],
  ['none', '暂无突出经历'],
];

export const CONSENTS = [
  ['anonymous', '同意匿名用于直播案例分析'],
  ['internal', '不同意公开展示，仅供内部了解'],
];

export function labelOf(list, value) {
  const hit = list.find(([v]) => v === value);
  return hit ? hit[1] : value;
}
