// Pure helpers for the /tracker application tracker (a school list): share links, language cells and search.
// Kept free of React and Docusaurus so node --test can exercise them directly.

export const TIERS = ['SSS', 'SS', 'S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+'];
export const TIER_COLOR = {SSS: 'purple', SS: 'blue', S: 'green', 'A+': 'yellow', A: 'orange', 'A-': 'brown', 'B+': 'pink', B: 'gray', 'B-': 'gray', 'C+': 'gray'};
// GRE policy -> tag colour; the label is UI copy `gre_<policy>`.
export const GRE = {required: 'red', not_required: 'green', optional: 'yellow', not_accepted: 'blue', recommended: 'orange', waived_for_some: 'purple', unknown: 'gray'};
export const KIND = {hard_min: 'kindHard', subscores_only: 'kindSub', recommended: 'kindRec', typical_range: 'kindRange', none: 'kindNone', not_accepted: 'kindNo', not_stated: 'kindNotStated'};
export const isQuiet = (cell) => ['none', 'not_accepted', 'not_stated'].includes(cell?.kind);

// ----- share links: the selection is a bitset over `order`, written in base 62 as ?s=<code> -----
// ponytail: `order` in school-list.json is append-only; reordering it breaks links people already shared.
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function encodeShare(ids, order) {
  let n = BigInt(0);
  for (const id of ids) {
    const i = order.indexOf(id);
    if (i >= 0) n |= BigInt(1) << BigInt(i);
  }
  let code = '';
  do {
    code = B62[Number(n % BigInt(62))] + code;
    n /= BigInt(62);
  } while (n > 0);
  return code;
}

const idsFromBits = (has, order) => {
  const ids = order.filter((_, i) => has(i));
  return ids.length ? {ids: new Set(ids)} : null;
};

// Reads ?s=<code>; also opens the older #pick-<base64url>[.<title>] links.
export function decodeShare(search, hash, order) {
  const code = new URLSearchParams(search || '').get('s');
  if (code !== null) {
    if (!/^[0-9A-Za-z]{1,20}$/.test(code)) return null;
    let n = BigInt(0);
    for (const c of code) n = n * BigInt(62) + BigInt(B62.indexOf(c));
    return idsFromBits((i) => (n >> BigInt(i)) & BigInt(1), order);
  }
  const m = /^#?pick-([A-Za-z0-9_-]+)(?:\.[A-Za-z0-9_-]+)?$/.exec(hash || '');
  if (!m) return null;
  try {
    const s = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const bits = Uint8Array.from(atob(s + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
    return idsFromBits((i) => bits[i >> 3] & (1 << (i & 7)), order);
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
  if (full.length <= (['en', 'ko', 'vi'].includes(lang) ? 12 : 9)) return full;
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
  ko: {
    title: '지원 트래커', pageTitle: '지원 트래커: 북미 CS 석사 마감일과 어학 요건',
    desc: '{cycle} 입학 · 북미 CS 관련 석사 프로그램 {n}개의 지원 마감일, GRE 및 어학 요건',
    edited: '{d} 업데이트', verified: '공식 사이트 확인일 {d}',
    tabAll: '전체 프로그램', tabMine: '내 지원 목록', tabShared: '공유된 목록',
    searchPh: '학교 또는 프로그램 검색…', filter: '필터', sort: '정렬', search: '검색', close: '닫기', select: '선택', peekAria: '프로그램 상세', tableAria: '지원 트래커 표',
    colName: '프로그램', colTier: '티어', colR1: '1차 마감', colR2: '2차 마감', colR3: '3차 마감', colGre: 'GRE',
    colToeflOld: '토플(구)', colToeflNew: '토플(신)', colIelts: 'IELTS', colApply: '지원 사이트',
    legend: '총점 기준이며 괄호 안은 영역별 최소 점수입니다(S = 말하기, W = 쓰기, R = 읽기, L = 듣기). *가 붙은 행을 열면 전체 규정, 필수 점수인지 권장 점수인지, 점수 전송 코드를 볼 수 있습니다',
    halt: '이번 시즌 모집 중단', daysLeft: '{n}일 남음', past: '마감', pickAria: '{name}을(를) 내 지원 목록에 추가',
    emptyShared: '이 공유 링크에서 인식할 수 있는 프로그램이 없습니다', emptyMine: '아직 선택한 프로그램이 없습니다. 전체 프로그램으로 돌아가 각 행 왼쪽의 체크박스를 선택하세요.', emptyNone: '조건에 맞는 프로그램이 없습니다',
    sharedBanner: '공유받은 지원 목록입니다. 프로그램 {n}개.',
    allSaved: '모두 내 지원 목록에 있음', saveShared: '내 지원 목록에 저장', seeAll: '전체 프로그램 보기',
    sumPicked: '선택한 프로그램', sumTiers: '티어 분포', sumFees: '지원비 합계', sumFeesMissing: '{n}개는 지원비 미공개', sumNext: '가장 가까운 마감', sumNote: '참고', sumHalt: '이번 시즌 모집 중단 {n}개',
    share: '목록 공유', copyList: '목록 복사', clear: '비우기',
    shareLink: '공유 링크', copyLink: '링크 복사',
    shareHint: '링크를 받은 사람은 로그인 없이 이 프로그램 {n}개를 볼 수 있고, 한 번의 클릭으로 자신의 목록에 저장할 수 있습니다.',
    copied: '복사됨', selectManual: '선택되었습니다. 직접 복사해 주세요', roundN: '{n}차', roundDdl: '{n}차 마감',
    sortTier: '티어 높은 순', sortR1: '1차 마감 빠른 순', sortNext: '가장 가까운 미마감 일정', sortToefl: '토플 요건 높은 순', sortName: '프로그램 이름',
    hideHalt: '이번 시즌 모집 중단 프로그램 숨기기', resetFilters: '필터 초기화',
    kindHard: '필수 최소 점수', kindSub: '영역별 점수만 요구', kindRec: '권장 점수', kindRange: '합격자 범위 하한', kindNone: '공식 최소 점수 없음', kindNo: '불인정', kindNotStated: '미공개',
    status: '모집 상태', fee: '지원비', site: '프로그램 사이트', programPage: 'csgrad 소개', deadlines: '마감 일정', otherDates: '기타 일정',
    otherDatesHint: '해외 거주 국제학생에게 해당되지 않거나, 특정 지원자 한정이거나, 지난 시즌 기준입니다.', tests: '시험 및 어학', code: '코드 {c}',
    addMine: '+ 내 지원 목록에 추가', inMine: '✓ 내 지원 목록에 있음', count: '개수',
    gre_required: '필수', gre_not_required: '불필요', gre_optional: '선택', gre_not_accepted: '불인정', gre_recommended: '권장', gre_waived_for_some: '면제 가능', gre_unknown: '미공개',
  },
  vi: {
    title: 'Theo dõi hồ sơ', pageTitle: 'Theo dõi hồ sơ: hạn nộp và yêu cầu tiếng Anh thạc sĩ CS Bắc Mỹ',
    desc: 'Nhập học {cycle} · hạn nộp, yêu cầu GRE và tiếng Anh của {n} chương trình thạc sĩ liên quan CS ở Bắc Mỹ',
    edited: 'Cập nhật {d}', verified: 'Đã đối chiếu trang chính thức {d}',
    tabAll: 'Tất cả chương trình', tabMine: 'Danh sách của tôi', tabShared: 'Danh sách được chia sẻ',
    searchPh: 'Tìm trường hoặc chương trình…', filter: 'Lọc', sort: 'Sắp xếp', search: 'Tìm kiếm', close: 'Đóng', select: 'Chọn', peekAria: 'Chi tiết chương trình', tableAria: 'Bảng theo dõi hồ sơ',
    colName: 'Chương trình', colTier: 'Hạng', colR1: 'Vòng 1', colR2: 'Vòng 2', colR3: 'Vòng 3', colGre: 'GRE',
    colToeflOld: 'TOEFL (cũ)', colToeflNew: 'TOEFL (mới)', colIelts: 'IELTS', colApply: 'Nộp hồ sơ',
    legend: 'Điểm tổng, điểm tối thiểu từng kỹ năng trong ngoặc (S = Nói, W = Viết, R = Đọc, L = Nghe). Mở dòng có dấu * để xem quy định đầy đủ, là mức tối thiểu bắt buộc hay khuyến nghị, và mã gửi điểm',
    halt: 'Ngừng tuyển', daysLeft: 'Còn {n} ngày', past: 'đã qua', pickAria: 'Thêm {name} vào danh sách của tôi',
    emptyShared: 'Liên kết chia sẻ này không có chương trình nào nhận dạng được', emptyMine: 'Chưa chọn chương trình nào. Quay lại Tất cả chương trình và đánh dấu ô bên trái mỗi dòng.', emptyNone: 'Không có chương trình phù hợp',
    sharedBanner: 'Danh sách trường được chia sẻ với bạn: {n} chương trình.',
    allSaved: 'Đã có hết trong danh sách', saveShared: 'Lưu vào danh sách của tôi', seeAll: 'Xem tất cả chương trình',
    sumPicked: 'Đã chọn', sumTiers: 'Phân bố hạng', sumFees: 'Tổng phí nộp hồ sơ', sumFeesMissing: '{n} chương trình chưa công bố phí', sumNext: 'Hạn gần nhất', sumNote: 'Lưu ý', sumHalt: '{n} chương trình ngừng tuyển mùa này',
    share: 'Chia sẻ danh sách', copyList: 'Sao chép danh sách', clear: 'Xóa hết',
    shareLink: 'Liên kết chia sẻ', copyLink: 'Sao chép liên kết',
    shareHint: 'Ai có liên kết đều xem được {n} chương trình này mà không cần đăng nhập, và có thể lưu vào danh sách của mình chỉ với một cú nhấp.',
    copied: 'Đã sao chép', selectManual: 'Đã chọn, hãy sao chép thủ công', roundN: 'Vòng {n}', roundDdl: 'Hạn vòng {n}',
    sortTier: 'Hạng từ cao đến thấp', sortR1: 'Hạn vòng 1 sớm nhất', sortNext: 'Hạn còn mở gần nhất', sortToefl: 'Yêu cầu TOEFL từ cao đến thấp', sortName: 'Tên chương trình',
    hideHalt: 'Ẩn chương trình ngừng tuyển mùa này', resetFilters: 'Xóa bộ lọc',
    kindHard: 'tối thiểu bắt buộc', kindSub: 'chỉ yêu cầu từng kỹ năng', kindRec: 'khuyến nghị', kindRange: 'mức thấp của khoảng trúng tuyển', kindNone: 'không có mức tối thiểu chính thức', kindNo: 'không chấp nhận', kindNotStated: 'chưa công bố',
    status: 'Tình trạng tuyển sinh', fee: 'Phí nộp hồ sơ', site: 'Trang chương trình', programPage: 'Giới thiệu trên csgrad', deadlines: 'Hạn nộp', otherDates: 'Mốc khác',
    otherDatesHint: 'Không áp dụng cho ứng viên quốc tế ở nước ngoài, chỉ dành cho một số ứng viên, hoặc thuộc mùa trước.', tests: 'Bài thi và tiếng Anh', code: 'Mã {c}',
    addMine: '+ Thêm vào danh sách', inMine: '✓ Đã trong danh sách', count: 'Số lượng',
    gre_required: 'bắt buộc', gre_not_required: 'không bắt buộc', gre_optional: 'tùy chọn', gre_not_accepted: 'không chấp nhận', gre_recommended: 'khuyến nghị', gre_waived_for_some: 'có thể miễn', gre_unknown: 'chưa rõ',
  },
  ja: {
    title: '出願トラッカー', pageTitle: '出願トラッカー：北米 CS 修士の締切と語学要件',
    desc: '{cycle} 入学 · 北米の CS 関連修士プログラム {n} 件の締切、GRE・語学スコア要件',
    edited: '{d} 更新', verified: '公式サイト確認日 {d}',
    tabAll: 'すべてのプログラム', tabMine: '自分のリスト', tabShared: '共有リスト',
    searchPh: '大学・プログラムを検索…', filter: 'フィルター', sort: '並べ替え', search: '検索', close: '閉じる', select: '選択', peekAria: 'プログラムの詳細', tableAria: '出願トラッカー表',
    colName: 'プログラム', colTier: 'ティア', colR1: '第1締切', colR2: '第2締切', colR3: '第3締切', colGre: 'GRE',
    colToeflOld: 'TOEFL（旧）', colToeflNew: 'TOEFL（新）', colIelts: 'IELTS', colApply: '出願サイト',
    legend: '総合スコアで、括弧内はセクション別の最低点です（S = スピーキング、W = ライティング、R = リーディング、L = リスニング）。* の付いた行を開くと、規定の全文、必須か推奨か、スコア送付コードを確認できます',
    halt: '今期は募集停止', daysLeft: '残り {n} 日', past: '締切済み', pickAria: '{name} を自分のリストに追加',
    emptyShared: 'この共有リンクには認識できるプログラムがありません', emptyMine: 'まだ選択されていません。「すべてのプログラム」に戻り、各行左のチェックボックスを選んでください。', emptyNone: '該当するプログラムはありません',
    sharedBanner: '共有された出願リストです（{n} プログラム）。',
    allSaved: 'すべて自分のリストに追加済み', saveShared: '自分のリストに保存', seeAll: 'すべてのプログラムを見る',
    sumPicked: '選択済み', sumTiers: 'ティア内訳', sumFees: '出願料の合計', sumFeesMissing: '{n} 件は出願料未公表', sumNext: '直近の締切', sumNote: '注', sumHalt: '今期募集停止 {n} 件',
    share: 'リストを共有', copyList: 'リストをコピー', clear: 'クリア',
    shareLink: '共有リンク', copyLink: 'リンクをコピー',
    shareHint: 'リンクを受け取った人はログインなしでこの {n} 件のプログラムを閲覧でき、ワンクリックで自分のリストに保存できます。',
    copied: 'コピーしました', selectManual: '選択しました。手動でコピーしてください', roundN: '第{n}ラウンド', roundDdl: '第{n}締切',
    sortTier: 'ティアの高い順', sortR1: '第1締切の早い順', sortNext: '直近の未締切日', sortToefl: 'TOEFL 要件の高い順', sortName: 'プログラム名',
    hideHalt: '今期募集停止のプログラムを隠す', resetFilters: 'フィルターをクリア',
    kindHard: '必須の最低点', kindSub: 'セクション別最低点のみ', kindRec: '推奨スコア', kindRange: '合格者レンジの下限', kindNone: '公式の最低点なし', kindNo: '受け付けない', kindNotStated: '未公表',
    status: '募集状況', fee: '出願料', site: 'プログラムサイト', programPage: 'csgrad ガイド', deadlines: '締切', otherDates: 'その他の日程',
    otherDatesHint: '海外在住の留学生向けではない、特定の出願者に限る、または過去の出願期のものです。', tests: '試験・語学', code: 'コード {c}',
    addMine: '+ 自分のリストに追加', inMine: '✓ 自分のリストに追加済み', count: '件数',
    gre_required: '必須', gre_not_required: '不要', gre_optional: '任意', gre_not_accepted: '受け付けない', gre_recommended: '推奨', gre_waived_for_some: '免除可', gre_unknown: '不明',
  },
};
