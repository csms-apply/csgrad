import React, { useEffect, useId, useMemo, useState } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  getMe,
  getMyApplicant,
  createMyApplicant,
  updateMyApplicant,
  createDp,
  listPrograms,
} from '@site/src/lib/dp/api';
import {
  UG_CATEGORIES, UG_MAJORS, CS_COURSES,
  GPA_SCALES, GPA_RANKS, REC_TAGS, REC_TAGS_WITH_NONE,
  RESULTS, SEMESTERS,
} from '@site/src/lib/dp/enums';
import SignInButtons from '@site/src/lib/auth/SignInButtons';
import { startOAuth } from '@site/src/lib/auth/oauth';
import styles from './submit-dp.module.css';

// ---------- i18n ----------

const COPY = {
  'zh-Hans': {
    pageTitle: '提交 DataPoints',
    pageDesc: 'csgrad DataPoints 提交：先填申请者背景档案，再提交录取数据点。',
    loading: '加载中…',
    needSignIn: '需要登录',
    signInLead: '用 Google 或 GitHub 登录后才能提交 DataPoints。',
    signInGoogle: 'Google 登录',
    signInGitHub: 'GitHub 登录',
    signInFail: '登录失败',
    closeDialog: '关闭',
    youAre: '👤',
    adminTag: 'admin',
    heroLead1: '先填一次',
    heroLeadBold: '申请者背景档案',
    heroLead2: '，再提交每个项目的录取数据点。档案保存后可以随时回来修改。',
    step1: '步骤 1 · 申请者背景档案',
    step2: '步骤 2 · 提交 DataPoints',
    step2Long: '步骤 2 · 提交 DataPoints（可重复提交多条）',
    saveFirst: '请先保存上方的背景档案。',
    goToStep1: '📋 跳到步骤 1 / Go to step 1',
    progress: '导航',
    saved: '已保存',
    created: '档案已创建。下面可以提交 DP 了。',
    saveFail: '保存失败',
    submitFail: '提交失败',
    submitted: '已提交',
    placeholderSelect: '（请选择）',
    btnSaving: '保存中…',
    btnUpdate: '更新档案',
    btnCreate: '创建档案',
    hasGre: '我考过 GRE',
    hasInternship: '我有实习经历',
    langTabToefl: 'TOEFL',
    langTabIelts: 'IELTS',
    contactPublicWarning: '⚠️ 这里填的内容对所有人公开可见（会显示在你提交的 DP 详情里）。不希望公开的联系方式请不要填。',
    otherSoftPlaceholder: '比如：美本毕业卖掉自己的 startup、GitHub 2k+ followers、Kaggle Grandmaster、Topcoder Red、知名开源项目核心 maintainer 等',
    btnSubmittingDp: '提交中…',
    btnSubmitDp: '提交这条 DP',
    viewMyDp: '查看我提交过的 DP →',
    recentTitle: '本次会话刚提交的',
    errFillRequired: '请填写必填字段',
    errSelectProgram: '请先选择项目',
    errSelectResult: '请选择结果',
    badgeFunded: '奖',
    badgeFinal: '最终',
    progSearchLabel: '项目（搜学校或 program 名）',
    progSearchPlaceholder: '如 stanford mscs / CMU MIIS',
    groups: {
      edu: '教育背景',
      courses: '核心课程修读',
      gpa: 'GPA',
      lang: '语言考试 (TOEFL / IELTS)',
      toefl: 'TOEFL',
      ielts: 'IELTS',
      gre: 'GRE',
      research: '科研经历',
      internship: '实习经历',
      rec: '推荐信（每封信可勾多个标签）',
      pub: '科研产出',
      other: '其他',
    },
    labels: {
      ug_school_category: '本科学校类别',
      ug_school_name: '本科学校名称',
      graduation_year: '毕业年份',
      ug_major: '本科专业',
      honors_college: '荣誉学院',
      exchange_abroad: '海外交换',
      dual_degree: '陆本海本双学位',
      education_notes: '教育背景备注',
      gpa_scale: '本科分数制',
      gpa: '本科 GPA',
      gpa_rank: '本科 GPA 排名',
      gpa_notes: 'GPA 备注',
      total: '总分',
      reading: '阅读',
      listening: '听力',
      speaking: '口语',
      writing: '写作',
      gre_quant: '数学',
      gre_verbal: '语文',
      research_domestic_count: '国内段数',
      research_overseas_count: '海外段数',
      research_notes: '科研经历介绍',
      internship_domestic_count: '国内段数',
      internship_overseas_count: '海外段数',
      internship_notes: '实习经历介绍',
      pub_top_first_author: '已发表顶会一作',
      pub_top_other_author: '已发表顶会其他作者',
      submission_top_first_author: '在投顶会一作',
      submission_top_other_author: '在投顶会其他作者',
      pub_notes: 'Pub 情况',
      other_soft_background: '其他软背景',
      contact_info: '个人主页 / 联系方式（公开可见）',
      rec_notes: '推荐信介绍',
      recLetter: '推荐信',
      result: '结果',
      academic_year: '学年',
      semester: '学期',
      is_funded: '带奖',
      is_final_destination: '最终去向',
      notified_at: '通知时间',
      submitted_at: '网申提交时间',
      notes: '补充说明 / 面试 / 联系等',
    },
  },
  en: {
    pageTitle: 'Submit DataPoints',
    pageDesc: 'csgrad DataPoints submission: fill out your applicant profile, then submit each admission data point.',
    loading: 'Loading…',
    needSignIn: 'Sign in required',
    signInLead: 'Sign in with Google or GitHub to submit DataPoints.',
    signInGoogle: 'Sign in with Google',
    signInGitHub: 'Sign in with GitHub',
    signInFail: 'Sign-in failed',
    closeDialog: 'Close',
    youAre: '👤',
    adminTag: 'admin',
    heroLead1: 'First fill in your ',
    heroLeadBold: 'applicant profile',
    heroLead2: ' once, then submit each program admission data point. You can come back and edit your profile any time after saving.',
    step1: 'Step 1 · Applicant profile',
    step2: 'Step 2 · Submit DataPoints',
    step2Long: 'Step 2 · Submit DataPoints (multiple entries allowed)',
    saveFirst: 'Please save your applicant profile above first.',
    goToStep1: '📋 Go to step 1',
    progress: 'Sections',
    saved: 'Saved',
    created: 'Profile created. You can now submit DPs below.',
    saveFail: 'Save failed',
    submitFail: 'Submission failed',
    submitted: 'Submitted',
    placeholderSelect: '(select)',
    btnSaving: 'Saving…',
    btnUpdate: 'Update profile',
    btnCreate: 'Create profile',
    hasGre: 'I have GRE scores',
    hasInternship: 'I have internship experience',
    langTabToefl: 'TOEFL',
    langTabIelts: 'IELTS',
    contactPublicWarning: '⚠️ Anything you put here is PUBLIC (it will show next to your submitted DPs). Do not enter contact info you do not want publicly visible.',
    otherSoftPlaceholder: 'e.g. sold my startup after a US undergrad, 2k+ GitHub followers, Kaggle Grandmaster, Topcoder Red, core maintainer of a well-known OSS project, etc.',
    btnSubmittingDp: 'Submitting…',
    btnSubmitDp: 'Submit this DP',
    viewMyDp: 'View my submitted DPs →',
    recentTitle: 'Just submitted in this session',
    errFillRequired: 'Please fill in required fields',
    errSelectProgram: 'Please select a program first',
    errSelectResult: 'Please pick a result',
    badgeFunded: 'Funded',
    badgeFinal: 'Final',
    progSearchLabel: 'Program (search school or program name)',
    progSearchPlaceholder: 'e.g. stanford mscs / CMU MIIS',
    groups: {
      edu: 'Education',
      courses: 'Core CS courses taken',
      gpa: 'GPA',
      lang: 'Language tests (TOEFL / IELTS)',
      toefl: 'TOEFL',
      ielts: 'IELTS',
      gre: 'GRE',
      research: 'Research',
      internship: 'Internship',
      rec: 'Recommendation letters (multiple tags per letter)',
      pub: 'Publications',
      other: 'Other',
    },
    labels: {
      ug_school_category: 'Undergrad school tier',
      ug_school_name: 'Undergrad school name',
      graduation_year: 'Graduation year',
      ug_major: 'Undergrad major',
      honors_college: 'Honors college',
      exchange_abroad: 'Exchange abroad',
      dual_degree: 'Dual degree (CN + overseas)',
      education_notes: 'Education notes',
      gpa_scale: 'GPA scale',
      gpa: 'Undergrad GPA',
      gpa_rank: 'GPA rank',
      gpa_notes: 'GPA notes',
      total: 'Total',
      reading: 'Reading',
      listening: 'Listening',
      speaking: 'Speaking',
      writing: 'Writing',
      gre_quant: 'Quant',
      gre_verbal: 'Verbal',
      research_domestic_count: 'Domestic count',
      research_overseas_count: 'Overseas count',
      research_notes: 'Research details',
      internship_domestic_count: 'Domestic count',
      internship_overseas_count: 'Overseas count',
      internship_notes: 'Internship details',
      pub_top_first_author: 'Published top-venue first author',
      pub_top_other_author: 'Published top-venue co-author',
      submission_top_first_author: 'In-submission top-venue first author',
      submission_top_other_author: 'In-submission top-venue co-author',
      pub_notes: 'Publication notes',
      other_soft_background: 'Other soft background',
      contact_info: 'Homepage / contact (publicly visible)',
      rec_notes: 'Recommendation notes',
      recLetter: 'Letter',
      result: 'Result',
      academic_year: 'Year',
      semester: 'Semester',
      is_funded: 'Funded',
      is_final_destination: 'Final destination',
      notified_at: 'Decision date',
      submitted_at: 'Application submitted',
      notes: 'Notes / interview / contact',
    },
  },
};

function pickLocale(loc) {
  return loc === 'en' ? 'en' : 'zh-Hans';
}

// Enum display translations. Underlying values are unchanged (backend expects exact strings).
const ENUM_DISPLAY = {
  UG_CATEGORIES: {
    '清北': { 'zh-Hans': '清北', en: 'Tsinghua / PKU' },
    '华五': { 'zh-Hans': '华五', en: 'C9 (Fudan / SJTU / ZJU / USTC / NJU)' },
    '国科/上科/南科': { 'zh-Hans': '国科/上科/南科', en: 'UCAS / ShanghaiTech / SUSTech' },
    '10043': { 'zh-Hans': '10043', en: 'Top-43 (985+)' },
    '985': { 'zh-Hans': '985', en: '985' },
    '211': { 'zh-Hans': '211', en: '211' },
    '双非': { 'zh-Hans': '双非', en: 'Non-985/211 (CN)' },
    '陆本': { 'zh-Hans': '陆本', en: 'Mainland CN (other)' },
    '美本': { 'zh-Hans': '美本', en: 'US undergrad' },
    '加本': { 'zh-Hans': '加本', en: 'Canada undergrad' },
    '英本': { 'zh-Hans': '英本', en: 'UK undergrad' },
    '澳本': { 'zh-Hans': '澳本', en: 'Australia undergrad' },
    '港本': { 'zh-Hans': '港本', en: 'HK undergrad' },
    '坡本': { 'zh-Hans': '坡本', en: 'Singapore undergrad' },
    '欧陆本': { 'zh-Hans': '欧陆本', en: 'Continental EU undergrad' },
    '海本': { 'zh-Hans': '海本', en: 'Overseas (other)' },
    '中外合办校（XJTLU等）': { 'zh-Hans': '中外合办校（XJTLU等）', en: 'CN-foreign joint school (XJTLU etc.)' },
    '陆本中外合办院系（JI/ZJUI等）': { 'zh-Hans': '陆本中外合办院系（JI/ZJUI等）', en: 'Joint dept inside CN school (JI / ZJUI etc.)' },
  },
  UG_MAJORS: {
    'CS': { 'zh-Hans': 'CS', en: 'CS' },
    'SE': { 'zh-Hans': 'SE', en: 'SE' },
    'AI': { 'zh-Hans': 'AI', en: 'AI' },
    'DS': { 'zh-Hans': 'DS', en: 'DS' },
    'ECE': { 'zh-Hans': 'ECE', en: 'ECE' },
    'EE': { 'zh-Hans': 'EE', en: 'EE' },
    '自动化/Robotics': { 'zh-Hans': '自动化/Robotics', en: 'Automation / Robotics' },
    'Info System': { 'zh-Hans': 'Info System', en: 'Info System' },
    'Info Security': { 'zh-Hans': 'Info Security', en: 'Info Security' },
    'CS交叉学科（bme等）': { 'zh-Hans': 'CS交叉学科（bme等）', en: 'CS-adjacent (BME etc.)' },
    '其他电类学科（精仪等）': { 'zh-Hans': '其他电类学科（精仪等）', en: 'Other EE-adjacent' },
    'Math/Stat': { 'zh-Hans': 'Math/Stat', en: 'Math / Stat' },
    '其他理工科': { 'zh-Hans': '其他理工科', en: 'Other STEM' },
    '其他学科': { 'zh-Hans': '其他学科', en: 'Other' },
  },
  CS_COURSES: {
    '高等数学/微积分/数学分析': { 'zh-Hans': '高等数学/微积分/数学分析', en: 'Calculus / Math analysis' },
    '离散数学': { 'zh-Hans': '离散数学', en: 'Discrete math' },
    '线性代数': { 'zh-Hans': '线性代数', en: 'Linear algebra' },
    '概率论': { 'zh-Hans': '概率论', en: 'Probability' },
    '程序设计': { 'zh-Hans': '程序设计', en: 'Programming' },
    '数据结构': { 'zh-Hans': '数据结构', en: 'Data structures' },
    '操作系统': { 'zh-Hans': '操作系统', en: 'Operating systems' },
    '计算机网络': { 'zh-Hans': '计算机网络', en: 'Computer networks' },
    '体系结构/计算机组成': { 'zh-Hans': '体系结构/计算机组成', en: 'Computer architecture' },
    '软件工程': { 'zh-Hans': '软件工程', en: 'Software engineering' },
    '数据库': { 'zh-Hans': '数据库', en: 'Databases' },
    '计算机科学导论': { 'zh-Hans': '计算机科学导论', en: 'Intro to CS' },
  },
  GPA_SCALES: {
    '100': { 'zh-Hans': '100', en: '100' },
    '4.0': { 'zh-Hans': '4.0', en: '4.0' },
    '4.3': { 'zh-Hans': '4.3', en: '4.3' },
    '5.0': { 'zh-Hans': '5.0', en: '5.0' },
    '英制100': { 'zh-Hans': '英制100', en: 'UK 100' },
    '德制1.0': { 'zh-Hans': '德制1.0', en: 'German 1.0' },
    '7': { 'zh-Hans': '7', en: '7' },
    '其他': { 'zh-Hans': '其他', en: 'Other' },
  },
  GPA_RANKS: {
    '1%': { 'zh-Hans': '1%', en: '1%' },
    '3%': { 'zh-Hans': '3%', en: '3%' },
    '5%': { 'zh-Hans': '5%', en: '5%' },
    '10%': { 'zh-Hans': '10%', en: '10%' },
    '15%': { 'zh-Hans': '15%', en: '15%' },
    '20%': { 'zh-Hans': '20%', en: '20%' },
    '30%': { 'zh-Hans': '30%', en: '30%' },
    '40%': { 'zh-Hans': '40%', en: '40%' },
    '50%': { 'zh-Hans': '50%', en: '50%' },
    '50%+': { 'zh-Hans': '50%+', en: '50%+' },
  },
  RESULTS: {
    'Admit': { 'zh-Hans': 'Admit', en: 'Admit' },
    'Reject': { 'zh-Hans': 'Reject', en: 'Reject' },
    'Waitlist': { 'zh-Hans': 'Waitlist', en: 'Waitlist' },
    '默拒': { 'zh-Hans': '默拒', en: 'Silent reject' },
    'Withdraw': { 'zh-Hans': 'Withdraw', en: 'Withdraw' },
  },
  SEMESTERS: {
    'Fall': { 'zh-Hans': 'Fall', en: 'Fall' },
    'Spring': { 'zh-Hans': 'Spring', en: 'Spring' },
    'Winter': { 'zh-Hans': 'Winter', en: 'Winter' },
    'Summer': { 'zh-Hans': 'Summer', en: 'Summer' },
  },
  REC_TAGS: {
    '科研推': { 'zh-Hans': '科研推', en: 'Research letter' },
    '实习推': { 'zh-Hans': '实习推', en: 'Internship letter' },
    '全职工作推': { 'zh-Hans': '全职工作推', en: 'Full-time work letter' },
    '课程推': { 'zh-Hans': '课程推', en: 'Course letter' },
    'TA推': { 'zh-Hans': 'TA推', en: 'TA letter' },
    '暑研推': { 'zh-Hans': '暑研推', en: 'Summer research letter' },
    '黑推（提及缺点，或者量表评分给的太低，在30%甚至更低的推荐信）': {
      'zh-Hans': '黑推（提及缺点，或者量表评分给的太低，在30%甚至更低的推荐信）',
      en: 'Negative letter (mentions weaknesses or low rating, ≤30%)',
    },
    '平推（模板推，或整体积极，但和学生没有过多交集，学生的工作比较trivial，无法言之有物地表扬）': {
      'zh-Hans': '平推（模板推，或整体积极，但和学生没有过多交集，学生的工作比较trivial，无法言之有物地表扬）',
      en: 'Neutral letter (templated or limited contact)',
    },
    '强推（和学生非常熟悉，言之有物地赞扬学生的工作；量表评分很高，评价为"该年最好"及以上）': {
      'zh-Hans': '强推（和学生非常熟悉，言之有物地赞扬学生的工作；量表评分很高，评价为"该年最好"及以上）',
      en: 'Strong letter (well-known student, top-rated)',
    },
    '普通推（admission officer大概率不认识该推荐人）': {
      'zh-Hans': '普通推（admission officer大概率不认识该推荐人）',
      en: 'Unknown recommender (AO unlikely to know)',
    },
    '小牛推（小领域内较为知名的学者推荐，相同小领域的PhD学生和教授很可能认识该推荐人）': {
      'zh-Hans': '小牛推（小领域内较为知名的学者推荐，相同小领域的PhD学生和教授很可能认识该推荐人）',
      en: 'Subfield-known recommender',
    },
    '大牛推（大领域内较为知名的学者推荐，相同大领域的PhD学生和教授很可能认识该推荐人）': {
      'zh-Hans': '大牛推（大领域内较为知名的学者推荐，相同大领域的PhD学生和教授很可能认识该推荐人）',
      en: 'Field-known recommender',
    },
    '无': { 'zh-Hans': '无', en: 'None' },
  },
};

function dispEnum(group, value, locale) {
  if (value == null || value === '') return value;
  const map = ENUM_DISPLAY[group];
  if (!map) return value;
  const entry = map[value];
  if (!entry) return value;
  return entry[locale] || entry['zh-Hans'] || value;
}

// ---------- model ----------

const EMPTY_APPLICANT = {
  ug_school_category: '', ug_school_name: '', graduation_year: '', ug_major: '',
  honors_college: false, exchange_abroad: false, dual_degree: false,
  education_notes: '', cs_courses: [],
  gpa_scale: '', gpa: '', gpa_rank: '', gpa_notes: '',
  toefl_total: '', toefl_reading: '', toefl_listening: '', toefl_speaking: '', toefl_writing: '',
  ielts_total: '', ielts_reading: '', ielts_listening: '', ielts_speaking: '', ielts_writing: '',
  gre_total: '', gre_quant: '', gre_verbal: '', gre_writing: '',
  research_domestic_count: '', research_overseas_count: '', research_notes: '',
  internship_domestic_count: '', internship_overseas_count: '', internship_notes: '',
  rec1_tags: [], rec2_tags: [], rec3_tags: [], rec4_tags: [], rec5_tags: [], rec_notes: '',
  pub_top_first_author: false, pub_top_other_author: false,
  submission_top_first_author: false, submission_top_other_author: false,
  pub_notes: '',
  other_soft_background: '', contact_info: '',
};

const REQUIRED_FIELDS = ['ug_school_category', 'ug_school_name', 'graduation_year', 'ug_major'];

// `courses` is filtered out for CS / SE majors at render time.
const SECTION_DEFS = [
  { id: 'edu', labelKey: 'edu' },
  { id: 'courses', labelKey: 'courses' },
  { id: 'gpa', labelKey: 'gpa' },
  { id: 'lang', labelKey: 'lang' },
  { id: 'gre', labelKey: 'gre' },
  { id: 'research', labelKey: 'research' },
  { id: 'internship', labelKey: 'internship' },
  { id: 'rec', labelKey: 'rec' },
  { id: 'pub', labelKey: 'pub' },
  { id: 'other', labelKey: 'other' },
];

const MAJORS_HIDE_CORE_COURSES = new Set(['CS', 'SE']);
const GRE_FIELDS = ['gre_total', 'gre_quant', 'gre_verbal', 'gre_writing'];
const INTERNSHIP_FIELDS = ['internship_domestic_count', 'internship_overseas_count', 'internship_notes'];
const TOEFL_FIELDS = ['toefl_total', 'toefl_reading', 'toefl_listening', 'toefl_speaking', 'toefl_writing'];
const IELTS_FIELDS = ['ielts_total', 'ielts_reading', 'ielts_listening', 'ielts_speaking', 'ielts_writing'];

function anyFilled(obj, keys) {
  return keys.some((k) => {
    const v = obj?.[k];
    return v !== '' && v !== null && v !== undefined;
  });
}

function applicantToForm(a) {
  if (!a) return EMPTY_APPLICANT;
  const out = { ...EMPTY_APPLICANT };
  for (const k of Object.keys(EMPTY_APPLICANT)) {
    if (a[k] == null) continue;
    if (Array.isArray(EMPTY_APPLICANT[k])) {
      try { out[k] = typeof a[k] === 'string' ? JSON.parse(a[k]) : a[k]; }
      catch { out[k] = []; }
    } else if (typeof EMPTY_APPLICANT[k] === 'boolean') {
      out[k] = Boolean(a[k]);
    } else {
      out[k] = a[k] ?? '';
    }
  }
  return out;
}

function formToPayload(f) {
  const payload = { ...f };
  for (const k of ['cs_courses', 'rec1_tags', 'rec2_tags', 'rec3_tags', 'rec4_tags', 'rec5_tags']) {
    payload[k] = JSON.stringify(f[k] || []);
  }
  for (const k of Object.keys(payload)) {
    if (payload[k] === '') payload[k] = null;
  }
  return payload;
}

// ---------- root ----------

function Inner() {
  const { i18n } = useDocusaurusContext();
  const locale = pickLocale(i18n.currentLocale);
  const t = COPY[locale];

  const [me, setMe] = useState(null);
  const [meChecked, setMeChecked] = useState(false);
  const [applicant, setApplicant] = useState(null);
  const [form, setForm] = useState(EMPTY_APPLICANT);
  const [savingApplicant, setSavingApplicant] = useState(false);
  const [msg, setMsg] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInError, setSignInError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meRes = await getMe();
      if (cancelled) return;
      setMe(meRes.user);
      setMeChecked(true);
      if (meRes.user) {
        try {
          const r = await getMyApplicant();
          if (cancelled) return;
          setApplicant(r.applicant);
          if (r.applicant) setForm(applicantToForm(r.applicant));
          // Restore draft saved before OAuth redirect (if any).
          try {
            const draft = localStorage.getItem('dp_applicant_draft');
            if (draft && !r.applicant) {
              setForm((prev) => ({ ...prev, ...JSON.parse(draft) }));
            }
            localStorage.removeItem('dp_applicant_draft');
          } catch {}
        } catch (e) {
          // ignore: 401 happens when getMyApplicant is called pre-auth in some race
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!meChecked) return <div className={styles.loading}>{t.loading}</div>;

  const hideCourses = MAJORS_HIDE_CORE_COURSES.has(form.ug_major);
  const visibleSections = hideCourses
    ? SECTION_DEFS.filter((s) => s.id !== 'courses')
    : SECTION_DEFS;

  const onSignIn = async (provider) => {
    setSignInError(null);
    try {
      await startOAuth(provider, {
        draftKey: 'dp_applicant_draft',
        draftValue: form,
      });
    } catch (e) {
      setSignInError(e.message || String(e));
    }
  };

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (fieldErrors[k]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  function toggleArrayValue(k, value) {
    setForm((prev) => {
      const arr = prev[k] || [];
      const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
      return { ...prev, [k]: next };
    });
  }

  function validateApplicant() {
    const errs = {};
    for (const k of REQUIRED_FIELDS) {
      const v = form[k];
      if (v === '' || v === null || v === undefined) {
        errs[k] = t.errFillRequired;
      }
    }
    return errs;
  }

  async function saveApplicant() {
    const errs = validateApplicant();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setMsg({ type: 'err', text: t.errFillRequired });
      const firstKey = Object.keys(errs)[0];
      const el = document.getElementById(`f-${firstKey}`);
      if (el) el.focus({ preventScroll: false });
      return;
    }
    if (!me) {
      setShowSignInModal(true);
      return;
    }
    setSavingApplicant(true);
    setMsg(null);
    try {
      const payload = formToPayload(form);
      if (applicant) {
        await updateMyApplicant(payload);
        setMsg({ type: 'ok', text: t.saved });
      } else {
        const r = await createMyApplicant(payload);
        setApplicant(r.applicant);
        setMsg({ type: 'ok', text: t.created });
      }
    } catch (e) {
      setMsg({ type: 'err', text: `${t.saveFail}: ${e.message}` });
    } finally {
      setSavingApplicant(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1>{t.pageTitle}</h1>
          {me ? (
            <span className={styles.meBadge}>
              {t.youAre} {me.nickname}{me.role === 'admin' ? ` · ${t.adminTag}` : ''}
            </span>
          ) : (
            <SignInButtons t={t} onSignIn={onSignIn} variant="group" />
          )}
        </div>
        <p className={styles.lead}>
          {t.heroLead1}<strong>{t.heroLeadBold}</strong>{t.heroLead2}
        </p>
        {msg ? <p className={msg.type === 'ok' ? styles.ok : styles.err} role={msg.type === 'err' ? 'alert' : 'status'}>{msg.text}</p> : null}
        {!me && signInError ? (
          <p className={styles.err} role="alert">{t.signInFail}: {signInError}</p>
        ) : null}
      </header>

      <ProgressNav t={t} sections={visibleSections} />

      <ApplicantForm
        t={t}
        locale={locale}
        form={form}
        setForm={setForm}
        setField={setField}
        toggleArrayValue={toggleArrayValue}
        hideCourses={hideCourses}
        onSave={saveApplicant}
        saving={savingApplicant}
        hasExisting={Boolean(applicant)}
        fieldErrors={fieldErrors}
      />

      {applicant ? (
        <DpAddArea t={t} locale={locale} applicantId={applicant.id} />
      ) : (
        <section id="dp-area" className={styles.section}>
          <h2>{t.step2}</h2>
          <p className={styles.muted}>{t.saveFirst}</p>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              const el = document.getElementById('section-edu');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            {t.goToStep1}
          </button>
        </section>
      )}

      {showSignInModal ? (
        <SignInPromptModal
          t={t}
          onSignIn={onSignIn}
          signInError={signInError}
          onClose={() => { setShowSignInModal(false); setSignInError(null); }}
        />
      ) : null}
    </div>
  );
}

// ---------- progress sidebar ----------

function ProgressNav({ t, sections }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observed = sections
      .map((s) => document.getElementById(`section-${s.id}`))
      .filter(Boolean);
    if (observed.length === 0) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id.replace(/^section-/, '');
          setActive(id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );
    observed.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  function onJump(e, id) {
    e.preventDefault();
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav
      aria-label={t.progress}
      style={{
        position: 'sticky',
        top: 12,
        zIndex: 5,
        margin: '12px 0',
        padding: '8px 10px',
        background: 'var(--ifm-background-surface-color, var(--ifm-background-color))',
        border: '1px solid var(--ifm-color-emphasis-200)',
        borderRadius: 8,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        backdropFilter: 'saturate(140%) blur(4px)',
      }}
    >
      {sections.map((s) => {
        const isActive = active === s.id;
        return (
          <a
            key={s.id}
            href={`#section-${s.id}`}
            onClick={(e) => onJump(e, s.id)}
            aria-current={isActive ? 'true' : undefined}
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 12,
              textDecoration: 'none',
              color: isActive ? 'var(--ifm-color-white)' : 'var(--ifm-color-emphasis-800)',
              background: isActive ? 'var(--ifm-color-primary)' : 'var(--ifm-color-emphasis-100)',
              border: '1px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {t.groups[s.labelKey]}
          </a>
        );
      })}
    </nav>
  );
}

// ---------- sign-in prompt modal ----------
//
// The Google / GitHub button row + the underlying OAuth call live in
// src/lib/auth/. This modal is a thin container that hosts the shared
// SignInButtons and renders inline errors instead of using alert().

function SignInPromptModal({ t, onSignIn, signInError, onClose }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const tm = setTimeout(() => ref.current?.querySelector('button')?.focus(), 0);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(tm); };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--ifm-background-surface-color, #fff)',
          color: 'var(--ifm-font-color-base)',
          borderRadius: 8, maxWidth: 420, width: '100%',
          padding: 24, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <h3 id="signin-modal-title" style={{ marginTop: 0, marginBottom: 8 }}>{t.needSignIn}</h3>
        <p style={{ marginTop: 0, marginBottom: 16, color: 'var(--ifm-color-emphasis-700)' }}>
          {t.signInLead}
        </p>
        <SignInButtons t={t} onSignIn={onSignIn} variant="group" />
        {signInError ? (
          <p role="alert" style={{ marginTop: 12, marginBottom: 0, color: 'var(--ifm-color-danger, #c0392b)', fontSize: 13 }}>
            {t.signInFail}: {signInError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 16, background: 'transparent', border: 0,
            color: 'var(--ifm-color-emphasis-600)', cursor: 'pointer',
            fontSize: 12, padding: 0,
          }}
        >
          {t.closeDialog}
        </button>
      </div>
    </div>
  );
}

// ---------- applicant form ----------

function ApplicantForm({ t, locale, form, setForm, setField, toggleArrayValue, hideCourses, onSave, saving, hasExisting, fieldErrors }) {
  const L = t.labels;

  // Tab + toggle state — derived from form contents on mount, then user-driven.
  // Default lang tab: whichever side has data (TOEFL preferred if both empty / both have data).
  const [langTab, setLangTab] = useState(() => {
    if (anyFilled(form, TOEFL_FIELDS)) return 'toefl';
    if (anyFilled(form, IELTS_FIELDS)) return 'ielts';
    return 'toefl';
  });
  const [greHas, setGreHas] = useState(() => anyFilled(form, GRE_FIELDS));
  const [internshipHas, setInternshipHas] = useState(() => anyFilled(form, INTERNSHIP_FIELDS));

  // When the loaded applicant data lands later (form was empty on first render),
  // re-derive the toggles so existing data shows the right expanded state.
  const formGreSig = GRE_FIELDS.map((k) => form[k]).join('|');
  const formIntSig = INTERNSHIP_FIELDS.map((k) => form[k]).join('|');
  const formToeflSig = TOEFL_FIELDS.map((k) => form[k]).join('|');
  const formIeltsSig = IELTS_FIELDS.map((k) => form[k]).join('|');
  useEffect(() => {
    if (anyFilled(form, GRE_FIELDS)) setGreHas(true);
  }, [formGreSig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (anyFilled(form, INTERNSHIP_FIELDS)) setInternshipHas(true);
  }, [formIntSig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (anyFilled(form, TOEFL_FIELDS) && !anyFilled(form, IELTS_FIELDS)) setLangTab('toefl');
    else if (anyFilled(form, IELTS_FIELDS) && !anyFilled(form, TOEFL_FIELDS)) setLangTab('ielts');
  }, [formToeflSig, formIeltsSig]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearFields(keys) {
    setForm((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = '';
      return next;
    });
  }

  function onToggleGre(v) {
    setGreHas(v);
    if (!v) clearFields(GRE_FIELDS);
  }
  function onToggleInternship(v) {
    setInternshipHas(v);
    if (!v) clearFields(INTERNSHIP_FIELDS);
  }

  const tabBtnStyle = (active) => ({
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 6,
    border: `1px solid var(--ifm-color-emphasis-${active ? '400' : '200'})`,
    background: active ? 'var(--ifm-color-primary)' : 'transparent',
    color: active ? 'var(--ifm-color-white)' : 'var(--ifm-color-emphasis-800)',
    cursor: 'pointer',
  });

  return (
    <section className={styles.section}>
      <h2>{t.step1}</h2>

      <fieldset className={styles.fieldset}>
        <Group id="section-edu" title={t.groups.edu}>
          <Select id="ug_school_category" label={L.ug_school_category} value={form.ug_school_category} onChange={(v) => setField('ug_school_category', v)} options={UG_CATEGORIES} enumGroup="UG_CATEGORIES" locale={locale} t={t} required error={fieldErrors.ug_school_category} />
          <Text id="ug_school_name" label={L.ug_school_name} value={form.ug_school_name} onChange={(v) => setField('ug_school_name', v)} required error={fieldErrors.ug_school_name} />
          <NumberInput id="graduation_year" label={L.graduation_year} value={form.graduation_year} onChange={(v) => setField('graduation_year', v)} required error={fieldErrors.graduation_year} />
          <Select id="ug_major" label={L.ug_major} value={form.ug_major} onChange={(v) => setField('ug_major', v)} options={UG_MAJORS} enumGroup="UG_MAJORS" locale={locale} t={t} required error={fieldErrors.ug_major} />
          <Check id="honors_college" label={L.honors_college} value={form.honors_college} onChange={(v) => setField('honors_college', v)} />
          <Check id="exchange_abroad" label={L.exchange_abroad} value={form.exchange_abroad} onChange={(v) => setField('exchange_abroad', v)} />
          <Check id="dual_degree" label={L.dual_degree} value={form.dual_degree} onChange={(v) => setField('dual_degree', v)} />
          <LongText id="education_notes" label={L.education_notes} value={form.education_notes} onChange={(v) => setField('education_notes', v)} />
        </Group>

        {!hideCourses ? (
          <Group id="section-courses" title={t.groups.courses}>
            <MultiCheck options={CS_COURSES} value={form.cs_courses} onToggle={(o) => toggleArrayValue('cs_courses', o)} enumGroup="CS_COURSES" locale={locale} />
          </Group>
        ) : null}

        <Group id="section-gpa" title={t.groups.gpa}>
          <Select id="gpa_scale" label={L.gpa_scale} value={form.gpa_scale} onChange={(v) => setField('gpa_scale', v)} options={GPA_SCALES} enumGroup="GPA_SCALES" locale={locale} t={t} />
          <NumberInput id="gpa" label={L.gpa} value={form.gpa} onChange={(v) => setField('gpa', v)} step="0.01" />
          <Select id="gpa_rank" label={L.gpa_rank} value={form.gpa_rank} onChange={(v) => setField('gpa_rank', v)} options={GPA_RANKS} enumGroup="GPA_RANKS" locale={locale} t={t} />
          <LongText id="gpa_notes" label={L.gpa_notes} value={form.gpa_notes} onChange={(v) => setField('gpa_notes', v)} />
        </Group>

        <Group id="section-lang" title={t.groups.lang}>
          <div role="tablist" aria-label={t.groups.lang} style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" role="tab" aria-selected={langTab === 'toefl'} onClick={() => setLangTab('toefl')} style={tabBtnStyle(langTab === 'toefl')}>
              {t.langTabToefl}
            </button>
            <button type="button" role="tab" aria-selected={langTab === 'ielts'} onClick={() => setLangTab('ielts')} style={tabBtnStyle(langTab === 'ielts')}>
              {t.langTabIelts}
            </button>
          </div>
          {langTab === 'toefl' ? (
            <>
              <NumberInput id="toefl_total" label={L.total} value={form.toefl_total} onChange={(v) => setField('toefl_total', v)} />
              <NumberInput id="toefl_reading" label={L.reading} value={form.toefl_reading} onChange={(v) => setField('toefl_reading', v)} />
              <NumberInput id="toefl_listening" label={L.listening} value={form.toefl_listening} onChange={(v) => setField('toefl_listening', v)} />
              <NumberInput id="toefl_speaking" label={L.speaking} value={form.toefl_speaking} onChange={(v) => setField('toefl_speaking', v)} />
              <NumberInput id="toefl_writing" label={L.writing} value={form.toefl_writing} onChange={(v) => setField('toefl_writing', v)} />
            </>
          ) : (
            <>
              <NumberInput id="ielts_total" label={L.total} value={form.ielts_total} onChange={(v) => setField('ielts_total', v)} step="0.5" />
              <NumberInput id="ielts_reading" label={L.reading} value={form.ielts_reading} onChange={(v) => setField('ielts_reading', v)} step="0.5" />
              <NumberInput id="ielts_listening" label={L.listening} value={form.ielts_listening} onChange={(v) => setField('ielts_listening', v)} step="0.5" />
              <NumberInput id="ielts_speaking" label={L.speaking} value={form.ielts_speaking} onChange={(v) => setField('ielts_speaking', v)} step="0.5" />
              <NumberInput id="ielts_writing" label={L.writing} value={form.ielts_writing} onChange={(v) => setField('ielts_writing', v)} step="0.5" />
            </>
          )}
        </Group>

        <Group id="section-gre" title={t.groups.gre}>
          <Check id="gre_has" label={t.hasGre} value={greHas} onChange={onToggleGre} />
          {greHas ? (
            <>
              <NumberInput id="gre_total" label={L.total} value={form.gre_total} onChange={(v) => setField('gre_total', v)} />
              <NumberInput id="gre_quant" label={L.gre_quant} value={form.gre_quant} onChange={(v) => setField('gre_quant', v)} />
              <NumberInput id="gre_verbal" label={L.gre_verbal} value={form.gre_verbal} onChange={(v) => setField('gre_verbal', v)} />
              <NumberInput id="gre_writing" label={L.writing} value={form.gre_writing} onChange={(v) => setField('gre_writing', v)} step="0.5" />
            </>
          ) : null}
        </Group>

        <Group id="section-research" title={t.groups.research}>
          <NumberInput id="research_domestic_count" label={L.research_domestic_count} value={form.research_domestic_count} onChange={(v) => setField('research_domestic_count', v)} />
          <NumberInput id="research_overseas_count" label={L.research_overseas_count} value={form.research_overseas_count} onChange={(v) => setField('research_overseas_count', v)} />
          <LongText id="research_notes" label={L.research_notes} value={form.research_notes} onChange={(v) => setField('research_notes', v)} />
        </Group>

        <Group id="section-internship" title={t.groups.internship}>
          <Check id="internship_has" label={t.hasInternship} value={internshipHas} onChange={onToggleInternship} />
          {internshipHas ? (
            <>
              <NumberInput id="internship_domestic_count" label={L.internship_domestic_count} value={form.internship_domestic_count} onChange={(v) => setField('internship_domestic_count', v)} />
              <NumberInput id="internship_overseas_count" label={L.internship_overseas_count} value={form.internship_overseas_count} onChange={(v) => setField('internship_overseas_count', v)} />
              <LongText id="internship_notes" label={L.internship_notes} value={form.internship_notes} onChange={(v) => setField('internship_notes', v)} />
            </>
          ) : null}
        </Group>

        <Group id="section-rec" title={t.groups.rec}>
          {[1, 2, 3].map((n) => (
            <RecLetterRow
              key={n}
              num={n}
              value={form[`rec${n}_tags`]}
              onToggle={(o) => toggleArrayValue(`rec${n}_tags`, o)}
              locale={locale}
              t={t}
            />
          ))}
          <LongText id="rec_notes" label={L.rec_notes} value={form.rec_notes} onChange={(v) => setField('rec_notes', v)} />
        </Group>

        <Group id="section-pub" title={t.groups.pub}>
          <Check id="pub_top_first_author" label={L.pub_top_first_author} value={form.pub_top_first_author} onChange={(v) => setField('pub_top_first_author', v)} />
          <Check id="pub_top_other_author" label={L.pub_top_other_author} value={form.pub_top_other_author} onChange={(v) => setField('pub_top_other_author', v)} />
          <Check id="submission_top_first_author" label={L.submission_top_first_author} value={form.submission_top_first_author} onChange={(v) => setField('submission_top_first_author', v)} />
          <Check id="submission_top_other_author" label={L.submission_top_other_author} value={form.submission_top_other_author} onChange={(v) => setField('submission_top_other_author', v)} />
          <LongText id="pub_notes" label={L.pub_notes} value={form.pub_notes} onChange={(v) => setField('pub_notes', v)} />
        </Group>

        <Group id="section-other" title={t.groups.other}>
          <LongText
            id="other_soft_background"
            label={L.other_soft_background}
            value={form.other_soft_background}
            onChange={(v) => setField('other_soft_background', v)}
            placeholder={t.otherSoftPlaceholder}
          />
          <LongText
            id="contact_info"
            label={L.contact_info}
            value={form.contact_info}
            onChange={(v) => setField('contact_info', v)}
            hint={t.contactPublicWarning}
          />
        </Group>
      </fieldset>

      <div className={styles.actions}>
        <button className={styles.primaryBtn} disabled={saving} onClick={onSave}>
          {saving ? t.btnSaving : hasExisting ? t.btnUpdate : t.btnCreate}
        </button>
      </div>
    </section>
  );
}

function RecLetterRow({ num, value, onToggle, locale, t }) {
  const opts = num >= 4 ? REC_TAGS_WITH_NONE : REC_TAGS;
  return (
    <div className={styles.recRow}>
      <div className={styles.recLabel}>{t.labels.recLetter} {num}</div>
      <div className={styles.tagWrap}>
        {opts.map((o) => {
          const disp = dispEnum('REC_TAGS', o, locale);
          const display = disp.length > 20 ? `${disp.slice(0, 18)}…` : disp;
          return (
            <button
              key={o}
              type="button"
              className={`${styles.tag} ${(value || []).includes(o) ? styles.tagActive : ''}`}
              onClick={() => onToggle(o)}
              title={disp}
              aria-pressed={(value || []).includes(o)}
              aria-label={disp}
            >
              {display}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- DP add area ----------

function DpAddArea({ t, locale, applicantId }) {
  const [programs, setPrograms] = useState([]);
  const [progQuery, setProgQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [progError, setProgError] = useState(null);
  const [dp, setDp] = useState({
    result: '', is_funded: false, is_final_destination: false,
    academic_year: new Date().getFullYear(),
    semester: 'Fall',
    notified_at: '', submitted_at: '', notes: '',
  });
  const [dpErrors, setDpErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    listPrograms({ limit: 500 }).then((r) => setPrograms(r.rows || [])).catch(() => {});
  }, []);

  const filteredPrograms = useMemo(() => {
    const q = progQuery.trim().toLowerCase();
    if (!q) return programs.slice(0, 20);
    return programs
      .filter((p) => `${p.school} ${p.program}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [programs, progQuery]);

  function setDpField(k, v) {
    setDp((prev) => ({ ...prev, [k]: v }));
    if (dpErrors[k]) {
      setDpErrors((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  async function submit() {
    const errs = {};
    if (!selectedProgram) setProgError(t.errSelectProgram); else setProgError(null);
    if (!dp.result) errs.result = t.errSelectResult;
    if (!selectedProgram || Object.keys(errs).length > 0) {
      setDpErrors(errs);
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const r = await createDp({
        program_id: selectedProgram.id,
        result: dp.result,
        is_funded: dp.is_funded,
        is_final_destination: dp.is_final_destination,
        academic_year: dp.academic_year ? Number(dp.academic_year) : null,
        semester: dp.semester || null,
        notified_at: dp.notified_at || null,
        submitted_at: dp.submitted_at || null,
        notes: dp.notes || null,
      });
      setRecent((prev) => [{ ...r.row, programSchool: selectedProgram.school, programName: selectedProgram.program }, ...prev]);
      setMsg({ type: 'ok', text: `${t.submitted}: ${selectedProgram.school} ${selectedProgram.program} → ${dispEnum('RESULTS', dp.result, locale)}` });
      setSelectedProgram(null);
      setProgQuery('');
      setProgError(null);
      setDpErrors({});
      setDp((prev) => ({ ...prev, result: '', is_funded: false, is_final_destination: false, notified_at: '', submitted_at: '', notes: '' }));
    } catch (e) {
      setMsg({ type: 'err', text: `${t.submitFail}: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  const progLabelId = useId();

  return (
    <section id="dp-area" className={styles.section}>
      <h2>{t.step2Long}</h2>
      {msg ? <p className={msg.type === 'ok' ? styles.ok : styles.err} role={msg.type === 'err' ? 'alert' : 'status'}>{msg.text}</p> : null}

      <div className={styles.dpForm}>
        <div className={styles.programSearch}>
          <label id={progLabelId} htmlFor={`${progLabelId}-input`}>
            {t.progSearchLabel}
            <span aria-hidden="true" style={{ color: '#b91c1c', marginLeft: 4 }}>*</span>
          </label>
          <input
            id={`${progLabelId}-input`}
            className={styles.input}
            placeholder={t.progSearchPlaceholder}
            value={selectedProgram ? `${selectedProgram.school} · ${selectedProgram.program}` : progQuery}
            onChange={(e) => { setSelectedProgram(null); setProgQuery(e.target.value); if (progError) setProgError(null); }}
            aria-required="true"
            aria-invalid={progError ? 'true' : undefined}
            style={progError ? { borderColor: '#b91c1c' } : undefined}
          />
          {progError ? (
            <p style={{ color: '#b91c1c', fontSize: 11, margin: '4px 0 0' }}>{progError}</p>
          ) : null}
          {!selectedProgram && progQuery && filteredPrograms.length > 0 ? (
            <ul className={styles.progDropdown}>
              {filteredPrograms.map((p) => (
                <li key={p.id} onClick={() => { setSelectedProgram(p); setProgQuery(''); setProgError(null); }}>
                  <b>{p.school}</b> · {p.program}
                  {p.tier ? <span className={styles.tierBadge} aria-label={`tier ${p.tier}`}>{p.tier}</span> : null}
                  {p.degree ? <span className={styles.muted}> {p.degree}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.row}>
          <Select id="dp_result" label={t.labels.result} value={dp.result} onChange={(v) => setDpField('result', v)} options={RESULTS} enumGroup="RESULTS" locale={locale} t={t} required error={dpErrors.result} />
          <NumberInput id="dp_year" label={t.labels.academic_year} value={dp.academic_year} onChange={(v) => setDpField('academic_year', v)} />
          <Select id="dp_semester" label={t.labels.semester} value={dp.semester} onChange={(v) => setDpField('semester', v)} options={SEMESTERS} enumGroup="SEMESTERS" locale={locale} t={t} />
          <Check id="dp_funded" label={t.labels.is_funded} value={dp.is_funded} onChange={(v) => setDpField('is_funded', v)} />
          <Check id="dp_final" label={t.labels.is_final_destination} value={dp.is_final_destination} onChange={(v) => setDpField('is_final_destination', v)} />
        </div>
        <div className={styles.row}>
          <DateInput id="dp_notified" label={t.labels.notified_at} value={dp.notified_at} onChange={(v) => setDpField('notified_at', v)} />
          <DateInput id="dp_submitted" label={t.labels.submitted_at} value={dp.submitted_at} onChange={(v) => setDpField('submitted_at', v)} />
        </div>
        <LongText id="dp_notes" label={t.labels.notes} value={dp.notes} onChange={(v) => setDpField('notes', v)} />

        <div className={styles.actions}>
          <button className={styles.primaryBtn} disabled={saving} onClick={submit}>
            {saving ? t.btnSubmittingDp : t.btnSubmitDp}
          </button>
          <a className={styles.secondaryLink} href="/my-dp">{t.viewMyDp}</a>
        </div>
      </div>

      {recent.length > 0 ? (
        <div className={styles.recentList}>
          <h3>{t.recentTitle}</h3>
          <ul>
            {recent.map((r) => {
              const resultDisp = dispEnum('RESULTS', r.result, locale);
              return (
                <li key={r.id}>
                  <span className={styles.pillSmall} aria-label={`${t.labels.result}: ${resultDisp}`}>{resultDisp}</span>
                  {' '}{r.programSchool} · {r.programName}
                  {r.is_funded ? <span className={styles.badge} aria-label={t.labels.is_funded}>{t.badgeFunded}</span> : null}
                  {r.is_final_destination ? <span className={styles.badge} aria-label={t.labels.is_final_destination}>{t.badgeFinal}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

// ---------- form primitives ----------

function Group({ id, title, children }) {
  return (
    <div id={id} className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <div className={styles.groupBody}>{children}</div>
    </div>
  );
}

function fieldId(explicit, fallback) {
  return explicit ? `f-${explicit}` : fallback;
}

function ErrorText({ id, text }) {
  if (!text) return null;
  return (
    <span id={id} style={{ color: '#b91c1c', fontSize: 11 }}>{text}</span>
  );
}

function Text({ id, label, value, onChange, required, error }) {
  const reactId = useId();
  const inputId = fieldId(id, reactId);
  const errId = `${inputId}-err`;
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span>
        {label}
        {required ? <span aria-hidden="true" style={{ color: '#b91c1c', marginLeft: 4 }}>*</span> : null}
      </span>
      <input
        id={inputId}
        className={styles.input}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errId : undefined}
        style={error ? { borderColor: '#b91c1c' } : undefined}
      />
      <ErrorText id={errId} text={error} />
    </label>
  );
}

function NumberInput({ id, label, value, onChange, step, required, error }) {
  const reactId = useId();
  const inputId = fieldId(id, reactId);
  const errId = `${inputId}-err`;
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span>
        {label}
        {required ? <span aria-hidden="true" style={{ color: '#b91c1c', marginLeft: 4 }}>*</span> : null}
      </span>
      <input
        id={inputId}
        type="number"
        step={step || '1'}
        className={styles.input}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errId : undefined}
        style={error ? { borderColor: '#b91c1c' } : undefined}
      />
      <ErrorText id={errId} text={error} />
    </label>
  );
}

function DateInput({ id, label, value, onChange }) {
  const reactId = useId();
  const inputId = fieldId(id, reactId);
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span>{label}</span>
      <input
        id={inputId}
        type="date"
        className={styles.input}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Select({ id, label, value, onChange, options, enumGroup, locale, t, required, error }) {
  const reactId = useId();
  const inputId = fieldId(id, reactId);
  const errId = `${inputId}-err`;
  return (
    <label className={styles.field} htmlFor={inputId}>
      <span>
        {label}
        {required ? <span aria-hidden="true" style={{ color: '#b91c1c', marginLeft: 4 }}>*</span> : null}
      </span>
      <select
        id={inputId}
        className={styles.input}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errId : undefined}
        style={error ? { borderColor: '#b91c1c' } : undefined}
      >
        <option value="">{t ? t.placeholderSelect : '(select)'}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {enumGroup ? dispEnum(enumGroup, o, locale) : o}
          </option>
        ))}
      </select>
      <ErrorText id={errId} text={error} />
    </label>
  );
}

function Check({ id, label, value, onChange }) {
  const reactId = useId();
  const inputId = fieldId(id, reactId);
  return (
    <label className={styles.checkField} htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function LongText({ id, label, value, onChange, placeholder, hint }) {
  const reactId = useId();
  const inputId = fieldId(id, reactId);
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <label className={`${styles.field} ${styles.longTextField}`} htmlFor={inputId}>
      <span>{label}</span>
      <textarea
        id={inputId}
        className={styles.textarea}
        rows={3}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || undefined}
        aria-describedby={hintId}
      />
      {hint ? (
        <span
          id={hintId}
          style={{
            display: 'block',
            marginTop: 4,
            fontSize: 12,
            lineHeight: 1.4,
            color: 'var(--ifm-color-warning-darker, #92400e)',
            background: 'var(--ifm-color-warning-contrast-background, #fef3c7)',
            border: '1px solid var(--ifm-color-warning-contrast-foreground, #fbbf24)',
            borderRadius: 6,
            padding: '6px 10px',
          }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function MultiCheck({ options, value, onToggle, enumGroup, locale }) {
  const base = useId();
  return (
    <div className={styles.multiCheck}>
      {options.map((o, idx) => {
        const inputId = `${base}-${idx}`;
        return (
          <label key={o} className={styles.multiCheckItem} htmlFor={inputId}>
            <input
              id={inputId}
              type="checkbox"
              checked={(value || []).includes(o)}
              onChange={() => onToggle(o)}
            />
            <span>{enumGroup ? dispEnum(enumGroup, o, locale) : o}</span>
          </label>
        );
      })}
    </div>
  );
}

// ---------- page shell ----------

export default function SubmitDp() {
  const { i18n } = useDocusaurusContext();
  const t = COPY[pickLocale(i18n.currentLocale)];
  const fallback = (
    <div className={styles.wrap} style={{ paddingBottom: 0 }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>{t.pageTitle}</h1>
      <p className={styles.lead}>{t.pageDesc}</p>
    </div>
  );
  return (
    <Layout title={t.pageTitle} description={t.pageDesc}>
      <Head>
        <meta name="description" content={t.pageDesc} />
        <meta property="og:title" content={t.pageTitle} />
        <meta property="og:description" content={t.pageDesc} />
        <meta name="robots" content="noindex" />
      </Head>
      <BrowserOnly fallback={fallback}>
        {() => <Inner />}
      </BrowserOnly>
    </Layout>
  );
}
