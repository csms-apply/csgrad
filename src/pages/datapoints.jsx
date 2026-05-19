import React, { useEffect, useMemo, useState, useDeferredValue, useRef, useCallback } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { DP_API_BASE, getMe, listDp, getFilterOptions, getCounts } from '@site/src/lib/dp/api';
import styles from './datapoints.module.css';

const PAGE_SIZE = 50;
const RESULT_OPTIONS = ['Admit', 'Reject', 'Waitlist', '默拒', 'Withdraw'];
const MOBILE_BREAKPOINT = 768;

// Pre-hydration / no-JS fallback counts. Refresh when snapshot regenerates.
const STATIC_COUNTS = { datapoints: 1908, applicants: 317, programs: 280 };

const COPY = {
  'zh-Hans': {
    pageTitle: 'DataPoints',
    pageDesc: 'CS / MSCS 申请历史 DataPoints — 可按学校、Tier、年份、结果、本科背景筛选',
    headerTitle: 'CS Application DataPoints',
    metaApplicants: '位申请者',
    metaPrograms: '个项目',
    metaDatapoints: '条录取数据',
    beta: '新版预览 (beta)',
    dataNote: '注：数据来源于历史 Seatable 归档，个人识别字段（联系方式 / 备注 / 推荐信详情等）已脱敏。',
    loadingData: '加载 DataPoints…',
    loadFail: '加载数据失败：',
    searchPlaceholder: '搜索学校 / 项目',
    searchLabel: '搜索',
    filterSchool: '学校',
    filterTier: 'Tier',
    filterYear: '年份',
    filterResult: '结果',
    filterUgCat: '本科类别',
    filterMajor: '本科专业',
    filterAll: '全部',
    gpaLabel: 'GPA',
    clearBtn: '清除筛选',
    shareBtn: '复制分享链接',
    shareCopied: '已复制！',
    summaryMatched: '匹配',
    summaryRows: '条',
    summaryPage: '页',
    thResult: '结果',
    thProgram: '项目',
    thYear: '年份',
    thUgCategory: '档次',
    thUgSchool: '本科',
    thMajor: '专业',
    thGpa: 'GPA',
    thResearch: '科研',
    thInternship: '实习',
    thPub: 'Pub',
    thNotes: '备注',
    funded: '带奖',
    finalDest: '最终去向',
    countDomestic: '国内',
    countOverseas: '国外',
    countLabel: (d, o) => `国内 ${d} 段 / 国外 ${o} 段`,
    pubP1: '已发表 · 顶会一作',
    pubPstar: '已发表 · 顶会合作者',
    pubS1: '在投 · 顶会一作',
    pubSstar: '在投 · 顶会合作者',
    notesTitle: '查看备注详情',
    notesDialog: '备注详情',
    closeDialog: '关闭',
    rowClickHint: '点击查看该申请者的所有 DataPoints',
    applicantDpsTitle: '该申请者的全部 DataPoints',
    notesLabel: {
      dp: 'DP 备注',
      research: '科研',
      internship: '实习',
      pub: '论文',
      rec: '推荐信',
      soft: '软背景',
      education: '教育',
    },
    submitBtn: '提交 DataPoints',
    myDpBtn: '我的 DataPoints',
    emptyTitle: '没有匹配的数据。',
    emptyHint: '试着放宽筛选条件：',
    emptyClearAll: '清除全部筛选',
    activeFilters: '当前筛选：',
    pageFirst: '首页',
    pagePrev: '上一页',
    pageNext: '下一页',
    pageLast: '末页',
    pageFirstAria: '跳到第一页',
    pagePrevAria: '上一页',
    pageNextAria: '下一页',
    pageLastAria: '跳到最后一页',
    signInGoogle: 'Google 登录',
    signInGitHub: 'GitHub 登录',
    signInFailed: '登录失败：',
    adminLabel: 'admin',
    cardLabelResult: '结果',
    cardLabelYear: '年份',
    cardLabelUg: '本科',
    cardLabelMajor: '专业',
    cardLabelGpa: 'GPA',
    cardLabelResearch: '科研',
    cardLabelInternship: '实习',
    cardLabelPub: '论文',
    cardLabelNotes: '备注',
  },
  en: {
    pageTitle: 'DataPoints',
    pageDesc: 'CS / MSCS application DataPoints — filterable by school, tier, year, result, and undergrad background',
    headerTitle: 'CS Application DataPoints',
    metaApplicants: 'applicants',
    metaPrograms: 'programs',
    metaDatapoints: 'datapoints',
    beta: 'new preview (beta)',
    dataNote: 'Note: data comes from a historical Seatable archive. Personally identifying fields (contacts / private notes / reference details) have been redacted.',
    loadingData: 'Loading DataPoints…',
    loadFail: 'Failed to load data: ',
    searchPlaceholder: 'Search school / program',
    searchLabel: 'Search',
    filterSchool: 'School',
    filterTier: 'Tier',
    filterYear: 'Year',
    filterResult: 'Result',
    filterUgCat: 'Undergrad type',
    filterMajor: 'Undergrad major',
    filterAll: 'All',
    gpaLabel: 'GPA',
    clearBtn: 'Clear filters',
    shareBtn: 'Copy share link',
    shareCopied: 'Copied!',
    summaryMatched: 'Matched',
    summaryRows: 'rows',
    summaryPage: 'page',
    thResult: 'Result',
    thProgram: 'Program',
    thYear: 'Year',
    thUgCategory: 'Tier',
    thUgSchool: 'Undergrad',
    thMajor: 'Major',
    thGpa: 'GPA',
    thResearch: 'Research',
    thInternship: 'Internship',
    thPub: 'Pub',
    thNotes: 'Notes',
    funded: 'Funded',
    finalDest: 'Final destination',
    countDomestic: 'Domestic',
    countOverseas: 'Overseas',
    countLabel: (d, o) => `${d} domestic / ${o} overseas`,
    pubP1: 'Published · top venue, first author',
    pubPstar: 'Published · top venue, co-author',
    pubS1: 'Under submission · top venue, first author',
    pubSstar: 'Under submission · top venue, co-author',
    notesTitle: 'View notes',
    notesDialog: 'Notes',
    closeDialog: 'Close',
    rowClickHint: 'Click to see all DataPoints from this applicant',
    applicantDpsTitle: "Applicant's full DataPoints",
    emptyTitle: 'No matching datapoints.',
    emptyHint: 'Try relaxing your filters:',
    emptyClearAll: 'Clear all filters',
    activeFilters: 'Active filters:',
    pageFirst: 'First',
    pagePrev: 'Prev',
    pageNext: 'Next',
    pageLast: 'Last',
    pageFirstAria: 'Go to first page',
    pagePrevAria: 'Previous page',
    pageNextAria: 'Next page',
    pageLastAria: 'Go to last page',
    signInGoogle: 'Sign in with Google',
    signInGitHub: 'Sign in with GitHub',
    signInFailed: 'Sign-in failed: ',
    adminLabel: 'admin',
    cardLabelResult: 'Result',
    cardLabelYear: 'Year',
    cardLabelUg: 'Undergrad',
    cardLabelMajor: 'Major',
    cardLabelGpa: 'GPA',
    cardLabelResearch: 'Research',
    cardLabelInternship: 'Internship',
    cardLabelPub: 'Pub',
    cardLabelNotes: 'Notes',
  },
};

function pickLocale(loc) {
  return loc === 'en' ? 'en' : 'zh-Hans';
}

// ---------- URL <-> filter state helpers ----------

const URL_KEYS = ['school', 'tier', 'year', 'result', 'ugCat', 'major', 'q'];

function readFiltersFromUrl() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out = {};
  for (const k of URL_KEYS) {
    const v = params.get(k);
    if (v != null && v !== '') out[k] = v;
  }
  return out;
}

function writeFiltersToUrl(filters) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  for (const k of URL_KEYS) {
    const v = filters[k];
    if (v === '' || v == null) params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', next);
}

// ---------- Static SEO shell ----------

function StaticHero({ t, counts }) {
  return (
    <header className={styles.header} aria-label="page-header-shell">
      <div className={styles.headerTop}>
        <h1>{t.headerTitle}</h1>
      </div>
      <p className={styles.meta}>
        <b>{counts.datapoints}</b> {t.metaDatapoints} · <b>{counts.applicants}</b> {t.metaApplicants} ·{' '}
        <b>{counts.programs}</b> {t.metaPrograms} · <span className={styles.beta}>{t.beta}</span>
      </p>
    </header>
  );
}

// ---------- Inner: data load orchestration ----------

function Inner({ t }) {
  const [counts, setCounts] = useState(null);
  const [filterOpts, setFilterOpts] = useState(null);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);
  const [meChecked, setMeChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCounts(), getFilterOptions()])
      .then(([c, o]) => {
        if (cancelled) return;
        setCounts(c);
        setFilterOpts(o);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((r) => {
        if (!cancelled) {
          setMe(r.user);
          setMeChecked(true);
        }
      })
      .catch(() => setMeChecked(true));
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className={styles.errorBox}>{t.loadFail}{error}</div>;
  if (!counts || !filterOpts) return <div className={styles.loading}>{t.loadingData}</div>;
  return <Table counts={counts} filterOpts={filterOpts} me={me} meChecked={meChecked} t={t} />;
}

function SignInButton({ t }) {
  async function signIn(provider) {
    const callbackURL = window.location.href;
    try {
      const r = await fetch(`${DP_API_BASE}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, callbackURL }),
      });
      const data = await r.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(`${t.signInFailed}${data.message || 'unknown error'}`);
      }
    } catch (e) {
      alert(`${t.signInFailed}${e.message}`);
    }
  }
  return (
    <span className={styles.signInGroup}>
      <button className={styles.signInBtn} onClick={() => signIn('google')}>{t.signInGoogle}</button>
      <button className={styles.signInBtn} onClick={() => signIn('github')}>{t.signInGitHub}</button>
    </span>
  );
}

function MeBadge({ me, t }) {
  return (
    <span className={styles.meBadge}>
      <span aria-hidden="true">👤 </span>{me.nickname}{me.role === 'admin' ? ` · ${t.adminLabel}` : ''}
    </span>
  );
}

// ---------- Mobile viewport detection ----------

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

// ---------- Main Table component ----------

function Table({ counts, filterOpts, me, meChecked, t }) {
  const isMobile = useIsMobile();
  const [openApplicantId, setOpenApplicantId] = useState(null);

  const initial = useMemo(() => readFiltersFromUrl(), []);
  const [school, setSchool] = useState(initial.school || '');
  const [tier, setTier] = useState(initial.tier || '');
  const [year, setYear] = useState(initial.year || '');
  const [result, setResult] = useState(initial.result || '');
  const [ugCat, setUgCat] = useState(initial.ugCat || '');
  const [major, setMajor] = useState(initial.major || '');
  const [query, setQuery] = useState(initial.q || '');
  const [page, setPage] = useState(0);

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    writeFiltersToUrl({ school, tier, year, result, ugCat, major, q: deferredQuery });
  }, [school, tier, year, result, ugCat, major, deferredQuery]);

  useEffect(() => setPage(0), [school, tier, year, result, ugCat, major, deferredQuery]);

  // Fetch rows from API on filter/page change. Keep previous rows visible
  // while a new fetch is in flight so the table doesn't blink.
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      setApiError(null);
      try {
        const res = await listDp({
          school: school || undefined,
          tier: tier || undefined,
          year: year || undefined,
          result: result || undefined,
          ugCategory: ugCat || undefined,
          major: major || undefined,
          q: deferredQuery || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        if (cancelled) return;
        setRows(res.rows || []);
        setTotalCount(res.total || 0);
      } catch (e) {
        if (!cancelled) setApiError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [school, tier, year, result, ugCat, major, deferredQuery, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paged = rows;

  const activeFilters = useMemo(() => {
    const items = [];
    if (school) items.push({ key: 'school', label: t.filterSchool, value: school });
    if (tier) items.push({ key: 'tier', label: t.filterTier, value: tier });
    if (year) items.push({ key: 'year', label: t.filterYear, value: year });
    if (result) items.push({ key: 'result', label: t.filterResult, value: result });
    if (ugCat) items.push({ key: 'ugCat', label: t.filterUgCat, value: ugCat });
    if (major) items.push({ key: 'major', label: t.filterMajor, value: major });
    if (deferredQuery) items.push({ key: 'q', label: t.searchLabel, value: deferredQuery });
    return items;
  }, [school, tier, year, result, ugCat, major, deferredQuery, t]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1>{t.headerTitle}</h1>
          <div className={styles.headerRight}>
            <a href="/submit-dp" className={styles.signInBtn} style={{ textDecoration: 'none' }}>
              {t.submitBtn}
            </a>
            {meChecked && me ? (
              <>
                <a href="/my-dp" className={styles.signInBtn} style={{ textDecoration: 'none' }}>
                  {t.myDpBtn}
                </a>
                <MeBadge me={me} t={t} />
              </>
            ) : null}
          </div>
        </div>
        <p className={styles.meta}>
          <b>{counts.datapoints}</b> {t.metaDatapoints} · <b>{counts.applicants}</b> {t.metaApplicants} ·{' '}
          <b>{counts.programs}</b> {t.metaPrograms} · <span className={styles.beta}>{t.beta}</span>
        </p>
        <p className={styles.note}>{t.dataNote}</p>
        {apiError ? <p className={styles.liveErr} role="status"><span aria-hidden="true">⚠️ </span>{t.loadFail}{apiError}</p> : null}
      </header>

      <section className={styles.filters} aria-label={t.searchLabel}>
        <label className={styles.selectWrap}>
          <span>{t.searchLabel}</span>
          <input
            type="search"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t.searchLabel}
          />
        </label>
        <Select label={t.filterSchool} value={school} onChange={setSchool} options={filterOpts.schools} allText={t.filterAll} />
        <Select label={t.filterTier} value={tier} onChange={setTier} options={filterOpts.tiers} allText={t.filterAll} />
        <Select label={t.filterYear} value={year} onChange={setYear} options={filterOpts.years} allText={t.filterAll} />
        <Select label={t.filterResult} value={result} onChange={setResult} options={RESULT_OPTIONS} allText={t.filterAll} />
        <Select label={t.filterUgCat} value={ugCat} onChange={setUgCat} options={filterOpts.ugCats} allText={t.filterAll} />
        <Select label={t.filterMajor} value={major} onChange={setMajor} options={filterOpts.majors} allText={t.filterAll} />
      </section>

      <div className={styles.summary} role="status" aria-live="polite">
        {t.summaryMatched} <b>{totalCount}</b> {t.summaryRows} · {page + 1} / {totalPages} {t.summaryPage}
      </div>

      {paged.length === 0 ? (
        <EmptyState t={t} activeFilters={activeFilters} />
      ) : isMobile ? (
        <MobileCards rows={paged} t={t} onCardClick={setOpenApplicantId} />
      ) : (
        <DesktopTable rows={paged} t={t} onRowClick={setOpenApplicantId} />
      )}

      {openApplicantId ? (
        <ApplicantDpsModal
          applicantId={openApplicantId}
          t={t}
          onClose={() => setOpenApplicantId(null)}
        />
      ) : null}

      <nav className={styles.pager} aria-label="pagination">
        <button
          disabled={page === 0}
          onClick={() => setPage(0)}
          aria-label={t.pageFirstAria}
          type="button"
        >
          <span aria-hidden="true">« </span>{t.pageFirst}
        </button>
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          aria-label={t.pagePrevAria}
          type="button"
        >
          <span aria-hidden="true">‹ </span>{t.pagePrev}
        </button>
        <span aria-live="polite">
          {page + 1} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
          aria-label={t.pageNextAria}
          type="button"
        >
          {t.pageNext}<span aria-hidden="true"> ›</span>
        </button>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => setPage(totalPages - 1)}
          aria-label={t.pageLastAria}
          type="button"
        >
          {t.pageLast}<span aria-hidden="true"> »</span>
        </button>
      </nav>
    </div>
  );
}

// ---------- Empty state ----------

function EmptyState({ t, activeFilters, onClear }) {
  return (
    <div className={styles.empty} role="status">
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{t.emptyTitle}</div>
      {activeFilters.length > 0 ? (
        <>
          <div style={{ marginBottom: 6 }}>{t.activeFilters}</div>
          <ul style={{ display: 'flex', gap: 6, flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
            {activeFilters.map((f) => (
              <li key={f.key} style={{ background: 'var(--ifm-color-emphasis-100)', padding: '3px 8px', borderRadius: 4, fontSize: 13 }}>
                <b>{f.label}:</b> {f.value}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div style={{ marginBottom: 12 }}>{t.emptyHint}</div>
      )}
    </div>
  );
}

// ---------- Desktop table ----------

function DesktopTable({ rows, t, onRowClick }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t.thResult}</th>
            <th scope="col">{t.thProgram}</th>
            <th scope="col">{t.thYear}</th>
            <th scope="col">{t.thUgCategory}</th>
            <th scope="col">{t.thUgSchool}</th>
            <th scope="col">{t.thMajor}</th>
            <th scope="col">{t.thGpa}</th>
            <th scope="col">{t.thResearch}</th>
            <th scope="col">{t.thInternship}</th>
            <th scope="col">{t.thPub}</th>
            <th scope="col">{t.thNotes}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ d, p, a }) => (
            <tr
              key={d.id}
              onClick={() => onRowClick(a.id)}
              style={{ cursor: 'pointer' }}
              title={t.rowClickHint}
            >
              <td className={styles.resultCell}>
                <ResultPills d={d} t={t} />
              </td>
              <td className={styles.programCell}>
                <div className={styles.schoolName}>{p.school}</div>
                <div className={styles.programName}>{p.program}</div>
              </td>
              <td className={styles.yearCell}>
                {d.academic_year || '—'}{d.semester ? ` ${d.semester}` : ''}
              </td>
              <td>
                {a.ug_school_category ? (
                  <span className={`${styles.ugCatBadge} ${ugCatBadgeClass(a.ug_school_category)}`}>
                    {a.ug_school_category}
                  </span>
                ) : <span className={styles.muted}>—</span>}
              </td>
              <td>
                <span className={styles.ugName}>{a.ug_school_name || <span className={styles.muted}>—</span>}</span>
              </td>
              <td>
                {a.ug_major ? <span className={styles.majorTag}>{a.ug_major}</span> : <span className={styles.muted}>—</span>}
              </td>
              <td className={styles.gpaCell}>
                <GpaCell a={a} />
              </td>
              <td className={styles.countCell}>
                <CountInlineBadges domestic={a.research_domestic_count} overseas={a.research_overseas_count} t={t} />
              </td>
              <td className={styles.countCell}>
                <CountInlineBadges domestic={a.internship_domestic_count} overseas={a.internship_overseas_count} t={t} />
              </td>
              <td className={styles.pubCell}>
                <PubBadges a={a} t={t} />
              </td>
              <td className={styles.notesCell} onClick={(e) => e.stopPropagation()}>
                <NotesCell d={d} a={a} t={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApplicantDpsModal({ applicantId, t, onClose }) {
  const dialogRef = useRef(null);
  const [myDps, setMyDps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listDp({ applicantId, limit: 200 })
      .then((res) => {
        if (cancelled) return;
        const sorted = [...(res.rows || [])].sort((x, y) => {
          const xd = x.d.notified_at || x.d.submitted_at || '';
          const yd = y.d.notified_at || y.d.submitted_at || '';
          return yd.localeCompare(xd);
        });
        setMyDps(sorted);
      })
      .catch((e) => !cancelled && setErrorMsg(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [applicantId]);

  const applicant = myDps[0]?.a || null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const timer = setTimeout(() => {
      dialogRef.current?.querySelector('[data-close]')?.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.applicantDpsTitle}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--ifm-background-surface-color, #fff)',
          color: 'var(--ifm-font-color-base)',
          borderRadius: 8,
          maxWidth: 700, width: '100%',
          maxHeight: '85vh', overflow: 'auto',
          padding: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{t.applicantDpsTitle}（{myDps.length}）</h3>
          <button
            data-close
            type="button"
            onClick={onClose}
            aria-label={t.closeDialog}
            style={{
              background: 'transparent',
              border: '1px solid var(--ifm-color-emphasis-300)',
              borderRadius: 4,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            {t.closeDialog} ✕
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ifm-color-emphasis-700)', marginBottom: 12 }}>
          {applicant ? (
            <>
              {applicant.ug_school_category ? `${applicant.ug_school_category} · ` : ''}
              {applicant.ug_school_name || ''}
              {applicant.ug_major ? ` · ${applicant.ug_major}` : ''}
              {applicant.gpa != null ? ` · GPA ${applicant.gpa}` : ''}
            </>
          ) : loading ? t.loadingData : errorMsg ? `${t.loadFail}${errorMsg}` : ''}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>{t.thProgram}</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>{t.thResult}</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--ifm-color-emphasis-200)' }}>{t.thYear}</th>
            </tr>
          </thead>
          <tbody>
            {myDps.map(({ d, p }) => (
              <tr key={d.id}>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--ifm-color-emphasis-100)' }}>
                  <b>{p.school}</b> · {p.program}
                </td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--ifm-color-emphasis-100)' }}>
                  <ResultPills d={d} t={t} />
                </td>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--ifm-color-emphasis-100)' }}>
                  {d.academic_year || '—'}{d.semester ? ` ${d.semester}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Mobile card layout ----------

function MobileCards({ rows, t, onCardClick }) {
  const card = {
    border: '1px solid var(--ifm-color-emphasis-200)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    background: 'var(--ifm-background-surface-color, transparent)',
    cursor: 'pointer',
  };
  const row = { display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, fontSize: 14 };
  const labelStyle = { color: 'var(--ifm-color-emphasis-600)', flexShrink: 0 };
  return (
    <div style={{ marginBottom: 16 }}>
      {rows.map(({ d, p, a }) => (
        <article key={d.id} style={card} onClick={() => onCardClick(a.id)} title={t.rowClickHint}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>{p.school}</div>
            <ResultPills d={d} t={t} />
          </div>
          <div style={{ marginTop: 4, fontSize: 14 }}>{p.program}</div>
          <div style={row}>
            <span style={labelStyle}>{t.cardLabelYear}</span>
            <span>{d.academic_year || '—'} {d.semester || ''}</span>
          </div>
          <div style={row}>
            <span style={labelStyle}>{t.cardLabelUg}</span>
            <span style={{ textAlign: 'right' }}>
              {a.ug_school_category ? (
                <span className={`${styles.ugCatBadge} ${ugCatBadgeClass(a.ug_school_category)}`} style={{ marginRight: 4 }}>
                  {a.ug_school_category}
                </span>
              ) : null}
              {a.ug_school_name || ''}
              {a.ug_major ? <div className={styles.majorTag}>{a.ug_major}</div> : null}
            </span>
          </div>
          <div style={row}>
            <span style={labelStyle}>{t.cardLabelGpa}</span>
            <span><GpaCell a={a} /></span>
          </div>
          <div style={row}>
            <span style={labelStyle}>{t.cardLabelResearch}</span>
            <span><CountInlineBadges domestic={a.research_domestic_count} overseas={a.research_overseas_count} t={t} /></span>
          </div>
          <div style={row}>
            <span style={labelStyle}>{t.cardLabelInternship}</span>
            <span><CountInlineBadges domestic={a.internship_domestic_count} overseas={a.internship_overseas_count} t={t} /></span>
          </div>
          <div style={row}>
            <span style={labelStyle}>{t.cardLabelPub}</span>
            <span><PubBadges a={a} t={t} /></span>
          </div>
          <div style={{ ...row, alignItems: 'flex-start' }}>
            <span style={labelStyle}>{t.cardLabelNotes}</span>
            <span style={{ textAlign: 'right', maxWidth: '70%' }}><NotesCell d={d} a={a} t={t} /></span>
          </div>
        </article>
      ))}
    </div>
  );
}

// ---------- Small presentational helpers ----------

function ResultPills({ d, t }) {
  return (
    <>
      <span className={`${styles.pill} ${pillClass(d.result)}`}>{d.result || '—'}</span>
      {d.is_funded ? (
        <span className={styles.fundBadge} role="img" aria-label={t.funded} title={t.funded}>奖</span>
      ) : null}
      {d.is_final_destination ? (
        <span className={styles.finalBadge} role="img" aria-label={t.finalDest} title={t.finalDest}>最终</span>
      ) : null}
    </>
  );
}

function GpaCell({ a }) {
  if (a.gpa == null) return <span className={styles.muted}>—</span>;
  return (
    <>
      <span className={styles.gpaValue}>{a.gpa}</span>
      {a.gpa_rank ? <div className={styles.gpaRank}>{a.gpa_rank}</div> : null}
    </>
  );
}

function Select({ label, value, onChange, options, allText }) {
  return (
    <label className={styles.selectWrap}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{allText}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function pillClass(result) {
  switch (result) {
    case 'Admit': return styles.pillAdmit;
    case 'Reject':
    case '默拒': return styles.pillReject;
    case 'Waitlist': return styles.pillWait;
    case 'Withdraw': return styles.pillWithdraw;
    default: return styles.pillUnknown;
  }
}

function tierBadgeClass(tier) {
  switch (tier) {
    case 'SSS': return styles.tierSSS;
    case 'SS': return styles.tierSS;
    case 'S': return styles.tierS;
    case 'A': return styles.tierA;
    case 'B': return styles.tierB;
    default: return styles.tierDefault;
  }
}

function ugCatBadgeClass(cat) {
  if (cat === '清北') return styles.ugRed;
  if (cat === '华五' || cat === '国科/上科/南科') return styles.ugRedAlt;
  if (cat === '10043' || cat === '985') return styles.ugBlue;
  if (cat === '211') return styles.ugCyan;
  if (cat === '双非' || cat === '陆本') return styles.ugGray;
  if (cat === '美本' || cat === '加本' || cat === '英本' || cat === '澳本' || cat === '港本' || cat === '坡本' || cat === '欧陆本' || cat === '海本') return styles.ugGreen;
  return styles.ugPurple;
}

function CountInlineBadges({ domestic, overseas, t }) {
  const d = domestic ?? 0;
  const o = overseas ?? 0;
  if (d === 0 && o === 0) return <span className={styles.muted}>—</span>;
  const label = t.countLabel(d, o);
  return (
    <span className={styles.countBadges} title={label} aria-label={label}>
      <span className={styles.countDomestic}>{t.countDomestic} {d}</span>
      <span className={styles.countOverseas}>{t.countOverseas} {o}</span>
    </span>
  );
}

function PubBadges({ a, t }) {
  const items = [
    { on: a.pub_top_first_author, label: 'P1', cls: styles.pubFilled, title: t.pubP1 },
    { on: a.pub_top_other_author, label: 'P*', cls: styles.pubFilledAlt, title: t.pubPstar },
    { on: a.submission_top_first_author, label: 'S1', cls: styles.pubOutlined, title: t.pubS1 },
    { on: a.submission_top_other_author, label: 'S*', cls: styles.pubOutlinedAlt, title: t.pubSstar },
  ];
  const active = items.filter((x) => x.on);
  if (active.length === 0) return <span className={styles.muted}>—</span>;
  return (
    <span className={styles.pubBadges}>
      {active.map((x) => (
        <span key={x.label} className={`${styles.pubBadge} ${x.cls}`} title={x.title} aria-label={x.title}>
          {x.label}
        </span>
      ))}
    </span>
  );
}

// Click-to-expand dialog; keeps `title=` so non-JS / hover users still see content.
function NotesCell({ d, a, t }) {
  const parts = useMemo(() => {
    const out = [];
    if (d.notes) out.push([t.notesLabel.dp, d.notes]);
    if (a.research_notes) out.push([t.notesLabel.research, a.research_notes]);
    if (a.internship_notes) out.push([t.notesLabel.internship, a.internship_notes]);
    if (a.pub_notes) out.push([t.notesLabel.pub, a.pub_notes]);
    if (a.rec_notes) out.push([t.notesLabel.rec, a.rec_notes]);
    if (a.other_soft_background) out.push([t.notesLabel.soft, a.other_soft_background]);
    if (a.education_notes) out.push([t.notesLabel.education, a.education_notes]);
    return out;
  }, [d, a, t]);

  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const timer = setTimeout(() => {
      dialogRef.current?.querySelector('[data-close]')?.focus();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [open]);

  if (parts.length === 0) return <span className={styles.muted}>—</span>;
  const fullText = parts.map(([label, text]) => `[${label}] ${text}`).join('\n\n');
  const preview = parts[0][1].slice(0, 60) + (parts[0][1].length > 60 || parts.length > 1 ? '…' : '');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={fullText}
        aria-label={t.notesTitle}
        aria-haspopup="dialog"
        style={{
          background: 'transparent',
          border: 0,
          padding: 0,
          font: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        className={styles.notesPreview}
      >
        <span className={styles.muted}>[{parts[0][0]}]</span> {preview}
        {parts.length > 1 ? <span className={styles.moreNotes}> +{parts.length - 1}</span> : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.notesDialog}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--ifm-background-surface-color, #fff)',
              color: 'var(--ifm-font-color-base)',
              borderRadius: 8,
              maxWidth: 600,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 20,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{t.notesDialog}</h3>
              <button
                data-close
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.closeDialog}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--ifm-color-emphasis-300)',
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                {t.closeDialog} ✕
              </button>
            </div>
            <div>
              {parts.map(([label, text], i) => (
                <div key={i} style={{ marginBottom: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, marginRight: 6, color: 'var(--ifm-color-emphasis-700)' }}>[{label}]</span>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ---------- Page entry ----------

export default function DataPointsPage() {
  const { i18n } = useDocusaurusContext();
  const locale = pickLocale(i18n.currentLocale);
  const t = COPY[locale];
  return (
    <Layout title={t.pageTitle} description={t.pageDesc}>
      <Head>
        <meta name="description" content={t.pageDesc} />
        <meta property="og:title" content={t.pageTitle} />
        <meta property="og:description" content={t.pageDesc} />
        <meta property="og:type" content="website" />
      </Head>
      <noscript>
        <StaticHero t={t} counts={STATIC_COUNTS} />
      </noscript>
      <BrowserOnly fallback={<StaticHero t={t} counts={STATIC_COUNTS} />}>
        {() => <Inner t={t} />}
      </BrowserOnly>
    </Layout>
  );
}
