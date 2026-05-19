import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { DP_API_BASE, getMe, listDp } from '@site/src/lib/dp/api';
import styles from './datapoints.module.css';

const PAGE_SIZE = 50;
const TIER_ORDER = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];
const RESULT_OPTIONS = ['Admit', 'Reject', 'Waitlist', '默拒', 'Withdraw'];

function Inner() {
  const dataUrl = useBaseUrl('/data/dp-snapshot.json');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);
  const [meChecked, setMeChecked] = useState(false);

  // Load snapshot for filter-options + client-side filtering (always).
  useEffect(() => {
    fetch(dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [dataUrl]);

  // Probe the live API for session state.
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

  if (error) return <div className={styles.errorBox}>加载数据失败：{error}</div>;
  if (!data) return <div className={styles.loading}>加载 DataPoints…</div>;
  return <Table data={data} me={me} meChecked={meChecked} />;
}

function SignInButton() {
  async function signIn(provider) {
    // better-auth expects POST /api/auth/sign-in/social with JSON body; it
    // returns { url, redirect } where url is the provider's consent page.
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
        alert(`登录失败：${data.message || 'unknown error'}`);
      }
    } catch (e) {
      alert(`登录失败：${e.message}`);
    }
  }
  return (
    <span className={styles.signInGroup}>
      <button className={styles.signInBtn} onClick={() => signIn('google')}>Google 登录</button>
      <button className={styles.signInBtn} onClick={() => signIn('github')}>GitHub 登录</button>
    </span>
  );
}

function MeBadge({ me }) {
  return (
    <span className={styles.meBadge}>
      👤 {me.nickname}{me.role === 'admin' ? ' · admin' : ''}
    </span>
  );
}

function Table({ data, me, meChecked }) {
  const { applicants, programs, datapoints } = data;
  const [useLiveApi, setUseLiveApi] = useState(false);
  const [liveRows, setLiveRows] = useState(null);
  const [liveTotal, setLiveTotal] = useState(0);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);

  // ---------- enumerate filter options from data ----------
  const filterOpts = useMemo(() => {
    const schools = new Set();
    const tiers = new Set();
    const years = new Set();
    const ugCats = new Set();
    const majors = new Set();
    for (const p of Object.values(programs)) {
      if (p.school) schools.add(p.school);
      if (p.tier) tiers.add(p.tier);
    }
    for (const a of Object.values(applicants)) {
      if (a.ug_school_category) ugCats.add(a.ug_school_category);
      if (a.ug_major) majors.add(a.ug_major);
    }
    for (const d of datapoints) {
      if (d.academic_year) years.add(d.academic_year);
    }
    return {
      schools: [...schools].sort(),
      tiers: TIER_ORDER.filter((t) => tiers.has(t)),
      years: [...years].sort((a, b) => b - a),
      ugCats: [...ugCats].sort(),
      majors: [...majors].sort(),
    };
  }, [applicants, programs, datapoints]);

  // ---------- filter state ----------
  const [school, setSchool] = useState('');
  const [tier, setTier] = useState('');
  const [year, setYear] = useState('');
  const [result, setResult] = useState('');
  const [ugCat, setUgCat] = useState('');
  const [major, setMajor] = useState('');
  const [gpaMin, setGpaMin] = useState('');
  const [gpaMax, setGpaMax] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const deferredQuery = useDeferredValue(query);

  // ---------- joined + filtered rows ----------
  const rows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const gMin = gpaMin === '' ? null : Number(gpaMin);
    const gMax = gpaMax === '' ? null : Number(gpaMax);
    const out = [];
    for (const d of datapoints) {
      const p = programs[d.program_id];
      const a = applicants[d.applicant_id];
      if (!p || !a) continue;
      if (school && p.school !== school) continue;
      if (tier && p.tier !== tier) continue;
      if (year && d.academic_year !== Number(year)) continue;
      if (result && d.result !== result) continue;
      if (ugCat && a.ug_school_category !== ugCat) continue;
      if (major && a.ug_major !== major) continue;
      if (gMin !== null && (a.gpa == null || a.gpa < gMin)) continue;
      if (gMax !== null && (a.gpa == null || a.gpa > gMax)) continue;
      if (q) {
        const hay = `${p.school} ${p.program} ${a.ug_school_name || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      out.push({ d, p, a });
    }
    out.sort((x, y) => {
      const xd = x.d.notified_at || x.d.submitted_at || '';
      const yd = y.d.notified_at || y.d.submitted_at || '';
      return yd.localeCompare(xd);
    });
    return out;
  }, [
    datapoints,
    programs,
    applicants,
    school,
    tier,
    year,
    result,
    ugCat,
    major,
    gpaMin,
    gpaMax,
    deferredQuery,
  ]);

  useEffect(() => setPage(0), [school, tier, year, result, ugCat, major, gpaMin, gpaMax, deferredQuery, useLiveApi]);

  // ---------- live-API mode: fetch from /api/dp on filter change ----------
  useEffect(() => {
    if (!useLiveApi) {
      setLiveRows(null);
      setLiveError(null);
      return;
    }
    const handle = setTimeout(async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const res = await listDp({
          school: school || undefined,
          tier: tier || undefined,
          year: year || undefined,
          result: result || undefined,
          ugCategory: ugCat || undefined,
          major: major || undefined,
          gpaMin: gpaMin || undefined,
          gpaMax: gpaMax || undefined,
          q: deferredQuery || undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setLiveRows(res.rows);
        setLiveTotal(res.total);
        if (res.source === 'snapshot') {
          setLiveError('Live API 不可达，已降级到本地快照');
        }
      } catch (e) {
        setLiveError(String(e));
      } finally {
        setLiveLoading(false);
      }
    }, 250); // debounce
    return () => clearTimeout(handle);
  }, [useLiveApi, school, tier, year, result, ugCat, major, gpaMin, gpaMax, deferredQuery, page]);

  // ---------- compose final rows + total based on mode ----------
  const totalCount = useLiveApi ? liveTotal : rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paged = useLiveApi
    ? (liveRows || [])
    : rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function clear() {
    setSchool('');
    setTier('');
    setYear('');
    setResult('');
    setUgCat('');
    setMajor('');
    setGpaMin('');
    setGpaMax('');
    setQuery('');
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1>CS Application DataPoints</h1>
          <div className={styles.headerRight}>
            {meChecked && (me ? <MeBadge me={me} /> : <SignInButton />)}
          </div>
        </div>
        <p className={styles.meta}>
          共 <b>{data.counts.applicants}</b> 位申请者 · <b>{data.counts.programs}</b> 个项目 ·{' '}
          <b>{data.counts.datapoints}</b> 条录取数据 ·{' '}
          <span className={styles.beta}>新版预览 (beta)</span>
        </p>
        <p className={styles.note}>
          注：数据来源于历史 Seatable 归档，个人识别字段（联系方式 / 备注 / 推荐信详情等）已脱敏。
          <label className={styles.liveToggle}>
            <input
              type="checkbox"
              checked={useLiveApi}
              onChange={(e) => setUseLiveApi(e.target.checked)}
            />
            <span>使用 Live API（实时数据，需后端在线）</span>
          </label>
        </p>
        {useLiveApi && liveError ? <p className={styles.liveErr}>⚠️ {liveError}</p> : null}
        {useLiveApi && liveLoading ? <p className={styles.note}>正在从 API 拉数据…</p> : null}
      </header>

      <section className={styles.filters}>
        <input
          className={styles.search}
          placeholder="搜索学校 / 项目 / 本科名"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select label="学校" value={school} onChange={setSchool} options={filterOpts.schools} />
        <Select label="Tier" value={tier} onChange={setTier} options={filterOpts.tiers} />
        <Select label="年份" value={year} onChange={setYear} options={filterOpts.years} />
        <Select label="结果" value={result} onChange={setResult} options={RESULT_OPTIONS} />
        <Select label="本科类别" value={ugCat} onChange={setUgCat} options={filterOpts.ugCats} />
        <Select label="本科专业" value={major} onChange={setMajor} options={filterOpts.majors} />
        <div className={styles.gpaRange}>
          <span>GPA</span>
          <input
            type="number"
            step="0.01"
            placeholder="min"
            value={gpaMin}
            onChange={(e) => setGpaMin(e.target.value)}
          />
          <span>–</span>
          <input
            type="number"
            step="0.01"
            placeholder="max"
            value={gpaMax}
            onChange={(e) => setGpaMax(e.target.value)}
          />
        </div>
        <button className={styles.clearBtn} onClick={clear}>
          清除筛选
        </button>
      </section>

      <div className={styles.summary}>
        匹配 <b>{totalCount}</b> 条 · 第 {page + 1} / {totalPages} 页 ·{' '}
        <span className={styles.sourceBadge}>
          {useLiveApi ? (liveError ? '快照(降级)' : 'Live API') : '快照'}
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>结果</th>
              <th>项目</th>
              <th>年份</th>
              <th>本科 · 专业</th>
              <th>GPA</th>
              <th>科研</th>
              <th>实习</th>
              <th>Pub</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(({ d, p, a }) => (
              <tr key={d.id}>
                <td className={styles.resultCell}>
                  <span className={`${styles.pill} ${pillClass(d.result)}`}>{d.result || '—'}</span>
                  {d.is_funded ? <span className={styles.fundBadge} title="带奖">奖</span> : null}
                  {d.is_final_destination ? <span className={styles.finalBadge} title="最终去向">最终</span> : null}
                </td>
                <td className={styles.programCell}>
                  <div className={styles.schoolName}>{p.school}</div>
                  <div className={styles.programName}>
                    {p.program}
                    {p.tier ? <span className={`${styles.tierBadge} ${tierBadgeClass(p.tier)}`}>{p.tier}</span> : null}
                  </div>
                </td>
                <td className={styles.yearCell}>
                  <div>{d.academic_year || '—'}</div>
                  <div className={styles.muted}>{d.semester || ''}</div>
                  {d.notified_at ? <div className={styles.smallMuted}>{d.notified_at}</div> : null}
                </td>
                <td className={styles.ugCell}>
                  <div className={styles.ugRow}>
                    {a.ug_school_category ? (
                      <span className={`${styles.ugCatBadge} ${ugCatBadgeClass(a.ug_school_category)}`}>
                        {a.ug_school_category}
                      </span>
                    ) : null}
                    <span className={styles.ugName}>{a.ug_school_name || ''}</span>
                  </div>
                  {a.ug_major ? <div className={styles.majorTag}>{a.ug_major}</div> : null}
                </td>
                <td className={styles.gpaCell}>
                  {a.gpa != null ? (
                    <>
                      <span className={styles.gpaValue}>{a.gpa}</span>
                      <span className={styles.muted}>/{a.gpa_scale}</span>
                      {a.gpa_rank ? <div className={styles.gpaRank}>{a.gpa_rank}</div> : null}
                    </>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td className={styles.countCell}>
                  <CountInlineBadges
                    domestic={a.research_domestic_count}
                    overseas={a.research_overseas_count}
                  />
                </td>
                <td className={styles.countCell}>
                  <CountInlineBadges
                    domestic={a.internship_domestic_count}
                    overseas={a.internship_overseas_count}
                  />
                </td>
                <td className={styles.pubCell}>
                  <PubBadges a={a} />
                </td>
                <td className={styles.notesCell}>
                  <NotesCell d={d} a={a} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <div className={styles.empty}>没有匹配的数据。试着放宽筛选条件。</div>
        ) : null}
      </div>

      <div className={styles.pager}>
        <button disabled={page === 0} onClick={() => setPage(0)}>
          « 首页
        </button>
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          ‹ 上一页
        </button>
        <span>
          {page + 1} / {totalPages}
        </span>
        <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
          下一页 ›
        </button>
        <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
          末页 »
        </button>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className={styles.selectWrap}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">全部</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function pillClass(result) {
  switch (result) {
    case 'Admit':
      return styles.pillAdmit;
    case 'Reject':
    case '默拒':
      return styles.pillReject;
    case 'Waitlist':
      return styles.pillWait;
    case 'Withdraw':
      return styles.pillWithdraw;
    default:
      return styles.pillUnknown;
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
  // Heuristic groupings that map similar categories to similar colors.
  if (cat === '清北') return styles.ugRed;
  if (cat === '华五' || cat === '国科/上科/南科') return styles.ugRedAlt;
  if (cat === '10043' || cat === '985') return styles.ugBlue;
  if (cat === '211') return styles.ugCyan;
  if (cat === '双非' || cat === '陆本') return styles.ugGray;
  if (cat === '美本' || cat === '加本' || cat === '英本' || cat === '澳本' || cat === '港本' || cat === '坡本' || cat === '欧陆本' || cat === '海本') return styles.ugGreen;
  return styles.ugPurple; // 中外合办/JV
}

function CountInlineBadges({ domestic, overseas }) {
  const d = domestic ?? 0;
  const o = overseas ?? 0;
  if (d === 0 && o === 0) return <span className={styles.muted}>—</span>;
  return (
    <span className={styles.countBadges} title={`国内 ${d} 段 / 海外 ${o} 段`}>
      <span className={styles.countDomestic}>国 {d}</span>
      <span className={styles.countOverseas}>外 {o}</span>
    </span>
  );
}

function PubBadges({ a }) {
  const items = [
    { on: a.pub_top_first_author, label: 'P1', cls: styles.pubFilled, title: '已发表 · 顶会一作' },
    { on: a.pub_top_other_author, label: 'P*', cls: styles.pubFilledAlt, title: '已发表 · 顶会合作者' },
    { on: a.submission_top_first_author, label: 'S1', cls: styles.pubOutlined, title: '在投 · 顶会一作' },
    { on: a.submission_top_other_author, label: 'S*', cls: styles.pubOutlinedAlt, title: '在投 · 顶会合作者' },
  ];
  const active = items.filter((x) => x.on);
  if (active.length === 0) return <span className={styles.muted}>—</span>;
  return (
    <span className={styles.pubBadges}>
      {active.map((x) => (
        <span key={x.label} className={`${styles.pubBadge} ${x.cls}`} title={x.title}>
          {x.label}
        </span>
      ))}
    </span>
  );
}

function NotesCell({ d, a }) {
  const parts = [];
  if (d.notes) parts.push(['📝', d.notes]);
  if (a.research_notes) parts.push(['🔬', a.research_notes]);
  if (a.internship_notes) parts.push(['💼', a.internship_notes]);
  if (a.pub_notes) parts.push(['📄', a.pub_notes]);
  if (a.rec_notes) parts.push(['✉️', a.rec_notes]);
  if (a.other_soft_background) parts.push(['✨', a.other_soft_background]);
  if (a.education_notes) parts.push(['🎓', a.education_notes]);
  if (parts.length === 0) return <span className={styles.muted}>—</span>;
  // Show first 60 chars of first note; reveal full set on hover (title attr
  // shows everything for now; can swap to a popover later).
  const fullText = parts.map(([icon, text]) => `${icon} ${text}`).join('\n\n');
  const preview = parts[0][1].slice(0, 60) + (parts[0][1].length > 60 || parts.length > 1 ? '…' : '');
  return (
    <span className={styles.notesPreview} title={fullText}>
      {parts[0][0]} {preview}
      {parts.length > 1 ? <span className={styles.moreNotes}> +{parts.length - 1}</span> : null}
    </span>
  );
}

export default function DataPointsPage() {
  return (
    <Layout title="DataPoints" description="CS application DataPoints with filters">
      <BrowserOnly>{() => <Inner />}</BrowserOnly>
    </Layout>
  );
}
