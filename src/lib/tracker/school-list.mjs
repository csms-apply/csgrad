// Pure helpers for the /tracker application tracker (a school list): share links, language cells and search.
// Kept free of React and Docusaurus so node --test can exercise them directly.

export const TIERS = ['SSS', 'SS', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+'];
export const TIER_COLOR = {SSS: 'purple', SS: 'blue', S: 'green', 'A+': 'yellow', A: 'orange', 'A-': 'brown', 'B+': 'pink', B: 'gray', 'B-': 'gray', 'C+': 'gray'};
// GRE policy -> tag colour; the label is UI copy `gre_<policy>`.
export const GRE = {required: 'red', not_required: 'green', optional: 'yellow', not_accepted: 'blue', recommended: 'orange', waived_for_some: 'purple', unknown: 'gray'};
export const KIND = {hard_min: 'kindHard', subscores_only: 'kindSub', recommended: 'kindRec', typical_range: 'kindRange', none: 'kindNone', not_accepted: 'kindNo', not_stated: 'kindNotStated'};
export const isQuiet = (cell) => ['none', 'not_accepted', 'not_stated'].includes(cell?.kind);

// ----- share links: the selection is a bitset over `order` in the URL hash (#pick-<base64url>) -----
// ponytail: `order` in school-list.json is append-only; reordering it breaks links people already shared.
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export function encodeShare(ids, order) {
  const bits = new Uint8Array(Math.ceil(order.length / 8));
  for (const id of ids) {
    const i = order.indexOf(id);
    if (i >= 0) bits[i >> 3] |= 1 << (i & 7);
  }
  return `pick-${b64url(bits)}`;
}

export function decodeShare(hash, order) {
  // Older links may end in ".<title>"; the title is no longer shown, so it is ignored.
  const m = /^#?pick-([A-Za-z0-9_-]+)(?:\.[A-Za-z0-9_-]+)?$/.exec(hash || '');
  if (!m) return null;
  try {
    const bits = unb64url(m[1]);
    const ids = order.filter((_, i) => bits[i >> 3] & (1 << (i & 7)));
    return ids.length ? {ids: new Set(ids)} : null;
  } catch {
    return null;
  }
}

// ----- language-requirement cells: stored in Simplified Chinese, e.g. "96(阅读26 口语22 其余24)" -----
const EN_CELL = [[/每项|各项/g, 'each '], [/其余/g, 'others '], [/口语/g, 'S '], [/写作/g, 'W '], [/阅读/g, 'R '], [/听力/g, 'L '],
  [/读写/g, 'Lit '], [/理解/g, 'Comp '], [/产出/g, 'Prod '], [/会话/g, 'Conv '], [/另有小分/g, '+ subscores'], [/小分/g, 'sub '],
  [/^无$/, 'None'], [/不接受/, 'Not accepted']];

export function enCell(s) {
  let x = s;
  for (const [a, b] of EN_CELL) x = x.replace(a, b);
  return x.replace(/\s+/g, ' ').replace(/\s*([)/,])/g, '$1').replace(/\(\s*/g, '(').trim();
}

// Table cells stay short: long section rules collapse to "96*" / "S 23*"; the side peek shows the full text.
export function shortCell(full, lang) {
  if (full.length <= (lang === 'en' ? 12 : 9)) return full;
  const num = /^\d+(?:\.\d+)?/.exec(full);
  return num ? `${num[0]}*` : `${full.split(/\s(?=[^\d\s])|(?<=\d)\s/)[0]}*`;
}

// ----- search: prefix match on words, plus substring match for Latin text ("mscs" finds "cmu mscs") -----
export const ALIAS = {cmu: '卡梅 卡内基梅隆 carnegie', stanford: '斯坦福 史丹佛', mit: '麻省理工', princeton: '普林斯顿', harvard: '哈佛', yale: '耶鲁', caltech: '加州理工',
  uiuc: '伊利诺伊 香槟 illinois', cornell: '康奈尔', berkeley: '伯克利 柏克莱 ucb', uta: '德州 奥斯汀 ut austin texas', gatech: '佐治亚理工 喬治亞理工 georgia tech gt', duke: '杜克',
  ucla: '洛杉矶', upenn: '宾大 賓大 penn', wisc: '威斯康星 麦迪逊 wisconsin', ucsd: '圣地亚哥', umd: '马里兰 maryland', umich: '密歇根 密西根 michigan', columbia: '哥大 哥伦比亚',
  uw: '华盛顿大学 华大 washington', nyu: '纽约大学', ucsb: '圣塔芭芭拉', brown: '布朗', jhu: '约翰霍普金斯 hopkins', uchicago: '芝加哥 芝大', nwu: '西北 northwestern',
  rice: '莱斯', uwt: '塔科马 tacoma', tamu: '德州农工', uci: '尔湾 irvine', emory: '埃默里', ncsu: '北卡州立', neu: '东北 northeastern', umass: '麻省大学 amherst',
  usc: '南加大', usu: '犹他州立 utah', scu: '圣塔克拉拉 santa clara', umn: '明尼苏达 minnesota', 'cornell tech': '康奈尔科技'};

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const words = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).flatMap((w) => w.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu) || []).filter(Boolean);

// `extra` lets the page add the Traditional spelling of the aliases.
export function searchIndex(row, extra = '') {
  const hay = `${row.name} ${row.school} ${row.program} ${row.official} ${row.schoolFull} ${ALIAS[row.name.split('@')[1]] || ''} ${extra}`;
  return {compact: norm(hay), words: words(hay)};
}

export function matches(index, q) {
  return words(q).every((w0) => index.words.some((w) => w.startsWith(w0)) || (!/\p{Script=Han}/u.test(w0) && index.compact.includes(w0)));
}

// Old kanban tracker cards (STORAGE_KEYS.trackerData) that came from the program library become picks.
export function picksFromLegacyCards(raw, rows) {
  try {
    const cards = JSON.parse(raw);
    if (!Array.isArray(cards)) return [];
    // Cards keep the slug from when they were added; a later tier change (e.g. /B+/UCLA MENG -> /A+/) only moves the tier segment.
    const tail = (slug) => (typeof slug === 'string' ? slug.split('/').slice(2).join('/') : '');
    const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
    const byTail = new Map(rows.map((r) => [tail(r.slug), r.id]));
    return [...new Set(cards.map((c) => bySlug.get(c?.slug) || (tail(c?.slug) && byTail.get(tail(c.slug)))).filter(Boolean))];
  } catch {
    return [];
  }
}

export const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// UI copy. zh-Hant is converted from zh at runtime with OpenCC, like the other pages.
export const UI = {
  zh: {
    title: '申请追踪', pageTitle: '申请追踪：北美 CS 硕士申请截止与语言要求',
    desc: '{cycle} 入学 · {n} 个北美 CS 相关硕士项目的申请截止、GRE 与语言要求',
    edited: '更新于 {d}', verified: '官网核实于 {d}',
    tabAll: '全部项目', tabMine: '我的选校', tabShared: '分享的名单',
    searchPh: '搜索学校或项目…', filter: '筛选', sort: '排序', search: '搜索', close: '关闭', select: '选择', peekAria: '项目详情', tableAria: '申请追踪表',
    colName: '项目', colTier: '梯队', colR1: '第一轮 ddl', colR2: '第二轮 ddl', colR3: '第三轮 ddl', colGre: 'GRE要求',
    colToeflOld: '旧版托福', colToeflNew: '新版托福', colIelts: '雅思', colApply: '申请官网',
    legend: '写总分，括号里是单项；带 * 的点开看完整要求、是硬性分还是建议分，以及送分代码',
    halt: '本季停招', daysLeft: '还有 {n} 天', past: '已过', pickAria: '把 {name} 加入我的选校',
    emptyShared: '这个分享链接里没有可识别的项目', emptyMine: '还没有选项目。回到「全部项目」，勾选每行最左边的方框。', emptyNone: '没有符合条件的项目',
    sharedBanner: '这是别人分享的选校名单，共 {n} 个项目。',
    allSaved: '已全部在我的选校', saveShared: '存到我的选校', seeAll: '查看全部项目',
    sumPicked: '已选项目', sumTiers: '梯队分布', sumFees: '申请费合计', sumFeesMissing: '另有 {n} 个未列费用', sumNext: '最近的 ddl', sumNote: '注意', sumHalt: '{n} 个本季停招',
    share: '分享选校', copyList: '复制名单', clear: '清空',
    shareLink: '分享链接', copyLink: '复制链接',
    shareHint: '任何人打开链接都能直接看到这 {n} 个项目，不用登录，还能一键存到自己的选校。',
    copied: '已复制', selectManual: '已选中，请手动复制', roundN: '第{n}轮', roundDdl: '第{n}轮 ddl',
    sortTier: '梯队从高到低', sortR1: '第一轮 ddl 从早到晚', sortNext: '最近一个未截止的 ddl', sortToefl: '托福要求从高到低', sortName: '项目名称',
    hideHalt: '隐藏本季停招的项目', resetFilters: '清除筛选',
    kindHard: '硬性最低分', kindSub: '只卡单项', kindRec: '官网建议分', kindRange: '录取者区间下限', kindNone: '官方不设最低分', kindNo: '不接受', kindNotStated: '官网未公布',
    status: '招生状态', fee: '申请费', site: '项目主页', programPage: 'csgrad 介绍', deadlines: '截止轮次', otherDates: '其他日期',
    otherDatesHint: '不适用于境外国际生、仅限特定申请人，或是往年参考。', tests: '考试与语言', code: '送分代码 {c}',
    addMine: '＋ 加入我的选校', inMine: '✓ 已在我的选校', count: '数量',
    gre_required: '必须', gre_not_required: '不要求', gre_optional: '可选', gre_not_accepted: '不接受', gre_recommended: '推荐', gre_waived_for_some: '可豁免', gre_unknown: '未公布',
  },
  en: {
    title: 'Application Tracker', pageTitle: 'Application Tracker: CS Master\'s Deadlines and English Requirements',
    desc: '{cycle} entry · deadlines, GRE and English test requirements for {n} North American CS-related master\'s programs',
    edited: 'Updated {d}', verified: 'Verified on official sites {d}',
    tabAll: 'All programs', tabMine: 'My list', tabShared: 'Shared list',
    searchPh: 'Search schools or programs…', filter: 'Filter', sort: 'Sort', search: 'Search', close: 'Close', select: 'Select', peekAria: 'Program details', tableAria: 'Application tracker',
    colName: 'Program', colTier: 'Tier', colR1: 'Round 1', colR2: 'Round 2', colR3: 'Round 3', colGre: 'GRE',
    colToeflOld: 'TOEFL (old)', colToeflNew: 'TOEFL (new)', colIelts: 'IELTS', colApply: 'Apply',
    legend: 'Total score, section minimums in brackets (S = Speaking, W = Writing, R = Reading, L = Listening). Open a row marked * for the full rule, whether it is a hard minimum or a recommendation, and score codes',
    halt: 'Not admitting', daysLeft: '{n} days left', past: 'passed', pickAria: 'Add {name} to my list',
    emptyShared: 'No recognizable programs in this share link', emptyMine: 'Nothing picked yet. Go back to All programs and tick the box at the left of a row.', emptyNone: 'No programs match',
    sharedBanner: 'A school list shared with you: {n} programs.',
    allSaved: 'All in my list', saveShared: 'Save to my list', seeAll: 'See all programs',
    sumPicked: 'Picked', sumTiers: 'Tiers', sumFees: 'Total app fees', sumFeesMissing: '{n} without a listed fee', sumNext: 'Next deadline', sumNote: 'Note', sumHalt: '{n} not admitting this cycle',
    share: 'Share list', copyList: 'Copy list', clear: 'Clear',
    shareLink: 'Share link', copyLink: 'Copy link',
    shareHint: 'Anyone with the link sees these {n} programs without signing in, and can save them to their own list in one click.',
    copied: 'Copied', selectManual: 'Selected, copy it manually', roundN: 'Round {n}', roundDdl: 'Round {n}',
    sortTier: 'Tier, high to low', sortR1: 'Round 1 deadline, earliest first', sortNext: 'Next open deadline', sortToefl: 'TOEFL requirement, high to low', sortName: 'Program name',
    hideHalt: 'Hide programs not admitting this cycle', resetFilters: 'Clear filters',
    kindHard: 'hard minimum', kindSub: 'section minimums only', kindRec: 'recommended', kindRange: 'low end of admitted range', kindNone: 'no official minimum', kindNo: 'not accepted', kindNotStated: 'not published',
    status: 'Admission status', fee: 'App fee', site: 'Program site', programPage: 'csgrad guide', deadlines: 'Deadlines', otherDates: 'Other dates',
    otherDatesHint: 'Not for international applicants abroad, limited to specific applicants, or from a past cycle.', tests: 'Tests and English', code: 'Code {c}',
    addMine: '+ Add to my list', inMine: '✓ In my list', count: 'Count',
    gre_required: 'required', gre_not_required: 'not required', gre_optional: 'optional', gre_not_accepted: 'not accepted', gre_recommended: 'recommended', gre_waived_for_some: 'waivable', gre_unknown: 'unknown',
    // Singular forms, picked by makeText when n === 1.
    daysLeftOne: '1 day left', sharedBannerOne: 'A school list shared with you: 1 program.', shareHintOne: 'Anyone with the link sees this program without signing in, and can save it to their own list in one click.',
  },
};
