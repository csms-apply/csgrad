// Fuzzy search for the DataPoints program picker.
// Matches school + program + aliases ignoring case, spaces and punctuation, in any
// token order; tolerates skipped letters ("gtech") and small typos ("stanfrod");
// and knows common full / Chinese names for schools stored as abbreviations.

// Keyed by normalized school name, so "UT Austin" / "UT-Austin" share one entry.
// The DB `aliases` column is also searched when it is filled in.
const SCHOOL_ALIASES = {
  asu: 'arizona state 亚利桑那州立',
  berkeley: 'ucb uc berkeley 伯克利',
  bu: 'boston university 波士顿大学 波大',
  brown: '布朗',
  caltech: 'california institute of technology 加州理工',
  cmu: 'carnegie mellon 卡梅 卡内基梅隆',
  columbia: '哥大 哥伦比亚',
  cornell: '康奈尔 康村',
  cornelltech: '康奈尔科技 康奈尔 纽约',
  dartmouth: '达特茅斯',
  duke: '杜克',
  emory: '埃默里 埃默里大学',
  epfl: '洛桑联邦理工 洛桑',
  eth: 'eth zurich 苏黎世联邦理工 苏黎世',
  gatech: 'georgia tech gt 佐治亚理工 乔治亚理工 佐治亚',
  harvard: '哈佛',
  hkust: '港科大 香港科技大学',
  ic: 'imperial college 帝国理工',
  jhu: 'johns hopkins 约翰霍普金斯 霍普金斯',
  mit: 'massachusetts institute of technology 麻省理工',
  ncsu: 'nc state 北卡州立',
  neu: 'northeastern 东北大学 美东北',
  ntu: 'nanyang 南洋理工',
  nus: 'national university of singapore 新国立 新加坡国立',
  nwu: 'northwestern 西北大学',
  nyu: 'new york university 纽约大学',
  pitt: 'pittsburgh 匹兹堡大学',
  princeton: '普林斯顿 普林',
  purdue: '普渡',
  rice: '莱斯',
  rutgers: '罗格斯',
  sbu: 'stony brook 石溪',
  scu: 'santa clara 圣塔克拉拉',
  stanford: '斯坦福',
  stanforduniversity: '斯坦福',
  tamu: 'texas a&m 德州农工',
  tufts: '塔夫茨',
  ubc: 'british columbia 英属哥伦比亚',
  uchi: 'uchicago university of chicago 芝加哥大学 芝大',
  uchicago: 'university of chicago 芝加哥大学 芝大',
  uci: 'uc irvine 尔湾',
  ucl: 'university college london 伦敦大学学院',
  ucla: 'uc los angeles 洛杉矶 加州大学洛杉矶',
  ucsb: 'uc santa barbara 圣塔芭芭拉',
  ucsd: 'uc san diego 圣地亚哥 加州大学圣地亚哥',
  uiuc: 'illinois urbana champaign 伊利诺伊 香槟 uiuc',
  umd: 'maryland 马里兰',
  umich: 'michigan 密歇根 密西根',
  unc: 'north carolina chapel hill 北卡教堂山',
  uoft: 'toronto 多伦多',
  upenn: 'penn university of pennsylvania 宾大 宾夕法尼亚',
  usc: 'southern california 南加大 南加州',
  utaustin: 'texas austin ut 德州奥斯汀 奥斯汀',
  uva: 'virginia 弗吉尼亚',
  uw: 'washington seattle 华盛顿大学 华大',
  vt: 'virginia tech 弗吉尼亚理工',
  waterloo: '滑铁卢',
  wisc: 'wisconsin madison 威斯康星 麦迪逊',
  wustl: 'washington university st louis 圣路易斯华盛顿',
  yale: '耶鲁',
};

const SEPARATORS = /[^\p{L}\p{N}]+/u;
const normalize = (value) => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Split into words, also separating Chinese runs from Latin runs ("卡梅mscs" -> 卡梅, mscs).
function words(text) {
  return String(text ?? '').toLowerCase().split(SEPARATORS)
    .flatMap((part) => part.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu) || [])
    .filter(Boolean);
}

function isSubsequence(needle, haystack) {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i += 1;
  return i === needle.length;
}

function withinEdits(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev2 = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // Adjacent transposition ("stanfrod") counts as one edit.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length] <= max;
}

function index(program) {
  const aliases = [program.aliases, SCHOOL_ALIASES[normalize(program.school)]]
    .flat().filter(Boolean).join(' ');
  const all = `${program.school} ${program.program} ${aliases}`;
  return { school: normalize(program.school), compact: normalize(all), words: words(all) };
}

const isHan = (token) => /\p{Script=Han}/u.test(token);

// Literal match: 0 when a word starts with the token, 0.5 when it only appears
// mid-word ("cs" inside "physics"). Chinese tokens must start a word, otherwise
// "哥大" would match "芝加哥大学".
function literalScore(token, entry) {
  if (entry.words.some((w) => w.startsWith(token))) return 0;
  if (!isHan(token) && entry.compact.includes(token)) return 0.5;
  return null;
}

// Lower is better; null means the token does not match. Skipped letters and typos
// are only tried for tokens that match no program literally, so "mscs" never pulls
// in MSDS and "cmu" never matches "Computing".
function tokenScore(token, entry, literalSomewhere) {
  const literal = literalScore(token, entry);
  if (literal != null || literalSomewhere || isHan(token) || token.length < 4) return literal;
  if (entry.words.some((w) => w[0] === token[0] && w.length <= token.length + 3 && isSubsequence(token, w))) return 1;
  const max = token.length >= 8 ? 2 : 1;
  if (entry.words.some((w) => withinEdits(token, w, max))) return 2;
  return null;
}

export function searchPrograms(programs, query) {
  const tokens = words(query);
  if (!tokens.length) return programs;
  const entries = programs.map(index);
  const literal = tokens.map((t) => entries.some((e) => literalScore(t, e) != null));
  const joined = tokens.join('');
  const results = [];
  entries.forEach((entry, order) => {
    let score = 0;
    // The whole query typed without spaces ("cmumscs") is the strongest signal.
    if (tokens.length > 1 && entry.compact.includes(joined)) score = -1;
    else {
      for (const [i, token] of tokens.entries()) {
        const s = tokenScore(token, entry, literal[i]);
        if (s == null) return;
        score += s;
      }
    }
    if (entry.school.startsWith(tokens[0])) score -= 0.5;
    results.push({ program: programs[order], score, order });
  });
  return results.sort((a, b) => a.score - b.score || a.order - b.order).map((r) => r.program);
}
