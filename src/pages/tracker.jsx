import React, {useEffect, useMemo, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useIsBrowser from '@docusaurus/useIsBrowser';
import {STORAGE_KEYS} from '../lib/storage-keys';
import {localizedInternalPath} from '../lib/seo/localizedAlternates.mjs';
import {toTraditional} from '../lib/i18n/traditional';
import DATA from '../lib/tracker/school-list.json';
import {
  TIERS, TIER_COLOR, GRE, KIND, UI, ALIAS, isQuiet, encodeShare, decodeShare, enCell, shortCell,
  searchIndex, matches, picksFromLegacyCards, fill,
} from '../lib/tracker/school-list.mjs';
import styles from './tracker.module.css';

const ROWS = DATA.rows;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hantCache = new Map();
const hant = (s) => {
  if (!hantCache.has(s)) hantCache.set(s, toTraditional(s));
  return hantCache.get(s);
};
const slash = (s) => s.replace(/-/g, '/');
const host = (u) => {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, '');
  } catch {
    return u;
  }
};
const cx = (...names) => names.filter(Boolean).map((n) => styles[n]).join(' ');
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// All copy and data strings for one table language. Data is stored in Simplified Chinese.
function makeText(lang) {
  const t = (key, vars) => {
    const k = lang === 'en' && vars?.n === 1 && UI.en[`${key}One`] ? `${key}One` : key;
    return fill(lang === 'hant' ? hant(UI.zh[k]) : UI[lang][k], vars);
  };
  const tr = (s) => (!s || lang === 'zh' ? s : lang === 'hant' ? hant(s) : DATA.en[s] ?? s);
  const cell = (s) => (!s || lang === 'zh' ? s : lang === 'hant' ? hant(s) : enCell(s));
  const ord = (i) => (lang === 'en' ? String(i + 1) : '一二三四五'[i]);
  return {lang, t, tr, cell, ord};
}

// Fill a template whose placeholders are React nodes, e.g. a bold count inside a sentence.
function rich(template, vars) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <React.Fragment key={i}>{m ? vars[m[1]] : part}</React.Fragment>;
  });
}

function copyText(text, onDone, onFail) {
  try {
    navigator.clipboard.writeText(text).then(onDone, onFail);
  } catch {
    onFail();
  }
}

const Icon = {
  select: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M5.5 7l2.5 2.5L10.5 7" /></svg>,
  cal: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></svg>,
  text: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="M2.5 4h11M2.5 8h11M2.5 12h7" /></svg>,
  link: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1-1a3 3 0 014.2 4.2l-1 1M9 11.5l-1 1a3 3 0 01-4.2-4.2l1-1" /></svg>,
  num: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><path d="M5.5 2.5l-1.5 11M11.5 2.5l-1.5 11M2.5 6h11M2 10.5h11" /></svg>,
  aa: <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><text x="0" y="12.5" fontSize="11.5" fontFamily="Georgia, serif">Aa</text></svg>,
  doc: <svg className={styles.doc} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v9a1 1 0 01-1 1h-7.5a1 1 0 01-1-1v-11a1 1 0 011-1z" /><path d="M9.5 1.5v3h3" /></svg>,
};

export default function TrackerPage() {
  const {i18n: {currentLocale}} = useDocusaurusContext();
  const lang = currentLocale === 'en' ? 'en' : currentLocale === 'zh-Hant' ? 'hant' : 'zh';
  const {t, tr, cell, ord} = useMemo(() => makeText(lang), [lang]);

  // Share links, dates and saved picks only exist in the browser; the first render must match the static HTML.
  const isBrowser = useIsBrowser();
  const {search, hash} = useLocation();
  const shared = useMemo(() => (isBrowser ? decodeShare(search, hash, DATA.order) : null), [search, hash, isBrowser]);
  const today = useMemo(() => (isBrowser ? startOfToday() : null), [isBrowser]);
  const [starred, setStarred] = useState(() => new Set());
  const [view, setView] = useState('all');
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [gre, setGre] = useState(() => new Set());
  const [tiers, setTiers] = useState(() => new Set());
  const [hideHalt, setHideHalt] = useState(false);
  const [sort, setSort] = useState('tier');
  const [menu, setMenu] = useState(null);
  const [peekId, setPeekId] = useState(null);
  const [sharePanel, setSharePanel] = useState(false);
  const [flash, setFlash] = useState({});
  const [copyFallback, setCopyFallback] = useState(null);
  useEffect(() => setCopyFallback(null), [view, starred]);
  const toolsRef = useRef(null);
  const closeRef = useRef(null);
  const qRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    let picks = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.trackerPicks);
      if (saved !== null) picks = JSON.parse(saved);
      else {
        const legacy = localStorage.getItem(STORAGE_KEYS.trackerData);
        if (legacy) picks = picksFromLegacyCards(legacy, ROWS);
      }
    } catch {}
    if (Array.isArray(picks)) setStarred(new Set(picks.filter((id) => ROWS.some((r) => r.id === id))));
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEYS.trackerPicks, JSON.stringify([...starred]));
    } catch {}
  }, [starred]);
  useEffect(() => setView(shared ? 'shared' : 'all'), [shared]);

  useEffect(() => {
    if (!menu) return undefined;
    const onDoc = (e) => {
      if (!toolsRef.current?.contains(e.target)) setMenu(null);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [menu]);

  const lastRow = useRef(null);
  const openPeek = (id) => {
    lastRow.current = id;
    setPeekId(id);
  };
  useEffect(() => {
    if (peekId) closeRef.current?.focus();
  }, [peekId]);
  const closePeek = () => {
    setPeekId(null);
    const id = lastRow.current;
    if (id) document.querySelector(`tr[data-id="${CSS.escape(id)}"]`)?.focus();
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (peekId) closePeek();
      else setMenu(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const index = useMemo(() => new Map(ROWS.map((r) => {
    const alias = ALIAS[r.name.split('@')[1]] || '';
    return [r.id, searchIndex(r, alias && hant(alias))];
  })), []);

  const daysTo = (s) => (today ? Math.round((new Date(`${s}T00:00:00`) - today) / 86400000) : null);
  const dateClass = (s) => {
    const d = daysTo(s);
    return d === null ? null : d < 0 ? 'past' : d <= 14 ? 'soon' : null;
  };
  const left = (s) => {
    const d = daysTo(s);
    return d === null ? '' : d >= 0 ? t('daysLeft', {n: d}) : t('past');
  };
  const firstUpcoming = (r) => (r.rounds.find((x) => (daysTo(x.date) ?? 0) >= 0) || {}).date || '9999';
  const toeflNum = (r) => parseFloat(r.lang?.toefl_old?.cell) || -1;
  const SORTS = {
    tier: ['sortTier', (a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || (!!a.halt - !!b.halt) || (a.rounds[0]?.date || '9').localeCompare(b.rounds[0]?.date || '9')],
    r1: ['sortR1', (a, b) => (!!a.halt - !!b.halt) || (a.rounds[0]?.date || '9').localeCompare(b.rounds[0]?.date || '9')],
    next: ['sortNext', (a, b) => (!!a.halt - !!b.halt) || firstUpcoming(a).localeCompare(firstUpcoming(b))],
    toefl: ['sortToefl', (a, b) => toeflNum(b) - toeflNum(a)],
    name: ['sortName', (a, b) => a.name.localeCompare(b.name)],
  };

  const inView = (r) => view === 'all' || (view === 'mine' ? starred.has(r.id) : shared?.ids.has(r.id));
  const list = ROWS.filter((r) => inView(r) && (!gre.size || gre.has(r.gre)) && (!tiers.size || tiers.has(r.tier)) &&
    (!hideHalt || !r.halt) && matches(index.get(r.id), q)).sort(SORTS[sort][1]);

  const toggle = (setter, value) => setter((prev) => {
    const next = new Set(prev);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  });
  const showFlash = (key, text) => {
    setFlash((f) => ({...f, [key]: text}));
    setTimeout(() => setFlash((f) => ({...f, [key]: null})), 1600);
  };

  const greTag = (r) => {
    const k = r.gre in GRE ? r.gre : 'unknown';
    return <span className={cx('tag', `c-${GRE[k]}`)}>{t(`gre_${k}`)}</span>;
  };
  const tierTag = (tier) => <span className={cx('tag', `c-${TIER_COLOR[tier] || 'gray'}`)}>{tier}</span>;
  const langCell = (c) => {
    if (!c) return <span className={cx('score', 'muted')}>—</span>;
    const full = cell(c.cell);
    return <span className={cx('score', isQuiet(c) && 'muted')} title={`${full} · ${t(KIND[c.kind])}`}>{shortCell(full, lang)}</span>;
  };
  const dateCell = (r, i) => {
    if (r.halt) return i === 0 ? <span className={cx('tag', 'c-red')}>{t('halt')}</span> : null;
    const x = r.rounds[i];
    if (!x) return null;
    return (
      <>
        <span className={cx('date', dateClass(x.date))} title={[tr(x.label), left(x.date)].filter(Boolean).join(' · ')}>{slash(x.date)}</span>
        {i === 2 && r.rounds.length > 3 && <span className={styles.more}>+{r.rounds.length - 3}</span>}
      </>
    );
  };

  // ----- summary for "my list" and shared lists -----
  const summaryIds = view === 'mine' ? starred : view === 'shared' && shared ? shared.ids : null;
  const picked = summaryIds ? ROWS.filter((r) => summaryIds.has(r.id)).sort(SORTS.tier[1]) : [];
  const shareLink = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}?s=${encodeShare([...starred], DATA.order)}`;
  const listText = () => picked.map((r) => [r.name, r.tier,
    ...(r.halt ? [t('halt')] : r.rounds.map((x, i) => `${t('roundN', {n: ord(i)})} ${slash(x.date)}`)),
    `${t('colGre')} ${t(`gre_${r.gre in GRE ? r.gre : 'unknown'}`)}`,
    `${t('colToeflOld')} ${cell(r.lang?.toefl_old?.cell) || '—'}`, `${t('colToeflNew')} ${cell(r.lang?.toefl_new?.cell) || '—'}`,
    `${t('colIelts')} ${cell(r.lang?.ielts?.cell) || '—'}`, r.apply].join(' | ')).join('\n');

  function renderSummary() {
    if (!summaryIds?.size) return null;
    const fees = picked.filter((r) => r.fee != null);
    const next = picked.flatMap((r) => r.rounds.map((x) => ({r, x}))).filter(({x}) => (daysTo(x.date) ?? 0) >= 0).sort((a, b) => a.x.date.localeCompare(b.x.date))[0];
    const halted = picked.filter((r) => r.halt).length;
    const mine = view === 'mine';
    return (
      <section className={styles.summary}>
        <div className={styles.box}>
          <div><span className={styles.k}>{t('sumPicked')}</span><span className={styles.v}>{picked.length}</span></div>
          <div><span className={styles.k}>{t('sumTiers')}</span><span className={styles.tiers}>{TIERS.map((x) => [x, picked.filter((r) => r.tier === x).length]).filter(([, n]) => n).map(([x, n]) => <span key={x} className={cx('tag', `c-${TIER_COLOR[x]}`)}>{x} × {n}</span>)}</span></div>
          <div><span className={styles.k}>{t('sumFees')}</span><span className={styles.v}>${fees.reduce((s, r) => s + r.fee, 0)}</span>{fees.length < picked.length && <span className={styles.k}>{t('sumFeesMissing', {n: picked.length - fees.length})}</span>}</div>
          <div><span className={styles.k}>{t('sumNext')}</span><span className={styles.v}>{next ? `${slash(next.x.date)} · ${next.r.name}` : '—'}</span>{next && today && <span className={styles.k}>{left(next.x.date)}</span>}</div>
          {halted > 0 && <div><span className={styles.k}>{t('sumNote')}</span><span className={styles.v} style={{color: 'var(--soon)'}}>{t('sumHalt', {n: halted})}</span></div>}
          <span className={styles.grow} />
          <div className={styles.act}>
            {mine && <button type="button" className={cx('btn', 'primary')} aria-expanded={sharePanel} onClick={() => setSharePanel((v) => !v)}>{t('share')}</button>}
            <button type="button" className={styles.btn} onClick={() => copyText(listText(), () => showFlash('list', t('copied')), () => { setCopyFallback(listText()); showFlash('list', t('selectManual')); })}>{flash.list || t('copyList')}</button>
            {mine && <button type="button" className={styles.btn} onClick={() => setStarred(new Set())}>{t('clear')}</button>}
          </div>
          {mine && sharePanel && (
            <div className={styles.sharePanel}>
              <label htmlFor="share-link">{t('shareLink')}</label>
              <div className={styles.row2}>
                <input type="text" id="share-link" readOnly value={shareLink} onFocus={(e) => e.target.select()} />
                <button type="button" className={cx('btn', 'primary')} onClick={() => copyText(shareLink, () => showFlash('link', t('copied')), () => { document.getElementById('share-link')?.select(); showFlash('link', t('selectManual')); })}>{flash.link || t('copyLink')}</button>
              </div>
              <span className={styles.hint}>{t('shareHint', {n: picked.length})}</span>
            </div>
          )}
          {copyFallback && <textarea className={styles.copybox} rows={6} readOnly value={copyFallback} onFocus={(e) => e.target.select()} autoFocus />}
        </div>
      </section>
    );
  }

  function renderShareBar() {
    if (view !== 'shared' || !shared) return null;
    const allSaved = [...shared.ids].every((id) => starred.has(id));
    return (
      <section className={styles.sharebar}>
        <div className={styles.box}>
          <span>{rich(t('sharedBanner', {n: shared.ids.size === 1 ? 1 : '{n}'}), {n: <b>{shared.ids.size}</b>})}</span>
          <span className={styles.grow} />
          <button type="button" className={cx('btn', 'primary')} onClick={() => setStarred((prev) => new Set([...prev, ...shared.ids]))}>{allSaved ? t('allSaved') : t('saveShared')}</button>
          <button type="button" className={styles.btn} onClick={() => setView('all')}>{t('seeAll')}</button>
        </div>
      </section>
    );
  }

  function renderPeek() {
    const r = ROWS.find((x) => x.id === peekId);
    const ex = r?.exam || {};
    const code = (c) => (c ? t('code', {c: tr(c)}) : '');
    const prop = (icon, k, v) => <React.Fragment key={k}><div className={styles.k}>{icon}{k}</div><div className={styles.v}>{v}</div></React.Fragment>;
    const langRow = (k, c, cd) => (
      <tr><th>{k}</th><td>{cell(c?.cell) || '—'}{c && !isQuiet(c) && <span className={styles.kind}>{t(KIND[c.kind])}</span>}</td><td className={styles.code}>{code(cd)}</td></tr>
    );
    const guide = r && localizedInternalPath(r.slug, currentLocale); // the selector switches the table, not the site
    return (
      <>
        <div className={cx('scrim', r && 'on')} onClick={closePeek} />
        <aside className={cx('peek', r && 'on')} aria-hidden={!r} aria-label={t('peekAria')}>
          <div className={styles.peekBar}>
            <button type="button" className={styles.iconBtn} ref={closeRef} onClick={closePeek} aria-label={t('close')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
            <span className={styles.grow} />
            {r && <button type="button" className={styles.starBtn} aria-pressed={starred.has(r.id)} onClick={() => toggle(setStarred, r.id)}>{starred.has(r.id) ? t('inMine') : t('addMine')}</button>}
          </div>
          {r && (
            <div className={styles.peekBody}>
              <h2>{r.name}</h2>
              <p className={styles.sub}>{r.official}</p>
              <div className={styles.props}>
                {prop(Icon.select, t('colTier'), tierTag(r.tier))}
                {r.halt ? prop(Icon.cal, t('status'), <span className={cx('tag', 'c-red')}>{t('halt')}</span>)
                  : r.rounds.map((x, i) => prop(Icon.cal, t('roundDdl', {n: ord(i)}), <span className={styles.date}>{slash(x.date)}</span>))}
                {prop(Icon.select, t('colGre'), greTag(r))}
                {prop(Icon.num, t('fee'), r.fee != null ? `$${r.fee}` : '—')}
                {prop(Icon.link, t('colApply'), <a className={styles.url} href={r.apply} target="_blank" rel="noopener noreferrer">{host(r.apply)}</a>)}
                {r.site && r.site !== r.apply && prop(Icon.link, t('site'), <a className={styles.url} href={r.site} target="_blank" rel="noopener noreferrer">{host(r.site)}</a>)}
                {prop(Icon.link, t('programPage'), <a className={styles.url} href={guide}>{decodeURI(r.slug)}</a>)}
              </div>
              {r.halt && <div className={styles.block}><h3>{t('status')}</h3><p>{tr(ex.halt || r.haltNote)}</p></div>}
              {r.rounds.length > 0 && (
                <div className={styles.block}>
                  <h3>{t('deadlines')}</h3>
                  <ul className={styles.rounds}>
                    {r.rounds.map((x, i) => {
                      const short = ex.rounds?.find((y) => y.date === x.date)?.short;
                      return (
                        <li key={x.date + i}>
                          <b className={cx('date', dateClass(x.date))}>{slash(x.date)}</b>
                          <div>
                            <div className={styles.lab}>{t('roundN', {n: ord(i)})} · {tr(x.label)}{today && <span className={styles.muted}> · {left(x.date)}</span>}</div>
                            {short && <div className={styles.note}>{tr(short)}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {r.otherDates?.length > 0 && (
                <div className={styles.block}>
                  <h3>{t('otherDates')}</h3>
                  <p className={styles.muted}>{t('otherDatesHint')}</p>
                  <ul className={styles.rounds}>
                    {r.otherDates.map((x, i) => <li key={x.date + i}><b className={styles.date}>{slash(x.date)}</b><div><div className={styles.lab}>{tr(x.label)} <span className={styles.muted}>· {x.cycle}</span></div></div></li>)}
                  </ul>
                </div>
              )}
              <div className={styles.block}>
                <h3>{t('tests')}</h3>
                <table className={styles.exam}>
                  <tbody>
                    <tr><th>GRE</th><td>{tr(ex.gre?.req) || t(`gre_${r.gre in GRE ? r.gre : 'unknown'}`)}</td><td className={styles.code}>{code(ex.gre?.code)}</td></tr>
                    {langRow(t('colToeflOld'), r.lang?.toefl_old, ex.toefl?.code)}
                    {langRow(t('colToeflNew'), r.lang?.toefl_new)}
                    {langRow(t('colIelts'), r.lang?.ielts)}
                    {langRow('Duolingo', r.lang?.duolingo, ex.duolingo?.code)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </aside>
      </>
    );
  }

  const [, mm, dd] = DATA.generated.split('-').map(Number);
  const edited = lang === 'en' ? `${MONTHS[mm - 1]} ${dd}` : `${mm}月${dd}日`;
  const filtered = gre.size || tiers.size || hideHalt;
  const emptyText = view === 'shared' ? t('emptyShared') : view === 'mine' && !starred.size ? t('emptyMine') : t('emptyNone');
  const pageTitle = t('pageTitle');
  const pageDesc = t('desc', {cycle: DATA.cycle, n: ROWS.length});

  return (
    <Layout title={pageTitle} description={pageDesc}>
      <Head>
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="website" />
      </Head>
      <main className={styles.root}>
        <div className={styles.head}>
          <div className={styles.headTop}>
            <span className={styles.edited}>{t('edited', {d: edited})}</span>
          </div>
          <h1>{t('title')}</h1>
          <p className={styles.desc}>{t('desc', {cycle: DATA.cycle, n: ROWS.length})}</p>
          <div className={styles.viewbar}>
            <div className={styles.tabs} role="tablist">
              <button type="button" className={styles.tab} role="tab" aria-selected={view === 'all'} onClick={() => setView('all')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M1.5 6h13M1.5 9.5h13M6 6v7.5" /></svg>{t('tabAll')}
              </button>
              <button type="button" className={styles.tab} role="tab" aria-selected={view === 'mine'} onClick={() => setView('mine')}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M5 8.2l2 2 4-4.4" /></svg>{t('tabMine')}{starred.size > 0 && ` ${starred.size}`}
              </button>
              {shared && (
                <button type="button" className={styles.tab} role="tab" aria-selected={view === 'shared'} onClick={() => setView('shared')}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true"><circle cx="4" cy="8" r="1.8" /><circle cx="12" cy="3.5" r="1.8" /><circle cx="12" cy="12.5" r="1.8" /><path d="M5.6 7.1l4.8-2.7M5.6 8.9l4.8 2.7" /></svg>{t('tabShared')} {shared.ids.size}
                </button>
              )}
            </div>
            <div className={styles.tools} ref={toolsRef}>
              {(searchOpen || q) && (
                <label className={styles.search}>
                  <input ref={qRef} type="search" autoComplete="off" placeholder={t('searchPh')} aria-label={t('search')} value={q}
                    onChange={(e) => setQ(e.target.value)} onBlur={() => !q && setSearchOpen(false)} />
                </label>
              )}
              <button type="button" className={cx('iconBtn', filtered && 'active')} aria-label={t('filter')} aria-expanded={menu === 'filter'} onClick={() => setMenu((m) => (m === 'filter' ? null : 'filter'))}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3" /></svg>
              </button>
              <button type="button" className={styles.iconBtn} aria-label={t('sort')} aria-expanded={menu === 'sort'} onClick={() => setMenu((m) => (m === 'sort' ? null : 'sort'))}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13V3M2.5 5.5L5 3l2.5 2.5M11 3v10M8.5 10.5L11 13l2.5-2.5" /></svg>
              </button>
              <button type="button" className={styles.iconBtn} aria-label={t('search')} onClick={() => { setSearchOpen(true); requestAnimationFrame(() => qRef.current?.focus()); }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" strokeLinecap="round" /></svg>
              </button>
              {menu === 'sort' && (
                <div className={styles.menu}>
                  <h5>{t('sort')}</h5>
                  {Object.entries(SORTS).map(([k, [label]]) => (
                    <button key={k} type="button" className={styles.opt} onClick={() => { setSort(k); setMenu(null); }}>{t(label)}{sort === k && <span className={styles.chk}>✓</span>}</button>
                  ))}
                </div>
              )}
              {menu === 'filter' && (
                <div className={styles.menu}>
                  <h5>{t('colGre')}</h5>
                  {Object.entries(GRE).filter(([k]) => ROWS.some((r) => r.gre === k)).map(([k, color]) => (
                    <label key={k} className={styles.opt}><input type="checkbox" checked={gre.has(k)} onChange={() => toggle(setGre, k)} /><span className={cx('tag', `c-${color}`)}>{t(`gre_${k}`)}</span></label>
                  ))}
                  <div className={styles.sep} />
                  <h5>{t('colTier')}</h5>
                  {TIERS.map((x) => <label key={x} className={styles.opt}><input type="checkbox" checked={tiers.has(x)} onChange={() => toggle(setTiers, x)} />{tierTag(x)}</label>)}
                  <div className={styles.sep} />
                  <label className={styles.opt}><input type="checkbox" checked={hideHalt} onChange={(e) => setHideHalt(e.target.checked)} />{t('hideHalt')}</label>
                  <button type="button" className={cx('opt', 'reset')} onClick={() => { setGre(new Set()); setTiers(new Set()); setHideHalt(false); setMenu(null); }}>{t('resetFilters')}</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {renderShareBar()}
        {renderSummary()}

        <div className={styles.tableWrap}>
          <div className={styles.scroller}>
            <table className={styles.grid} aria-label={t('tableAria')}>
              <colgroup>
                <col style={{width: 36}} /><col style={{width: 200}} /><col style={{width: 82}} /><col style={{width: 132}} /><col style={{width: 132}} /><col style={{width: 132}} />
                <col style={{width: 140}} /><col style={{width: 104}} /><col style={{width: 104}} /><col style={{width: 96}} /><col />
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.sel} aria-label={t('select')} />
                  <th className={styles.name}><span className={styles.h}>{Icon.aa}{t('colName')}</span></th>
                  <th><span className={styles.h}>{Icon.select}{t('colTier')}</span></th>
                  <th><span className={styles.h}>{Icon.cal}{t('colR1')}</span></th>
                  <th><span className={styles.h}>{Icon.cal}{t('colR2')}</span></th>
                  <th><span className={styles.h}>{Icon.cal}{t('colR3')}</span></th>
                  <th><span className={styles.h}>{Icon.select}{t('colGre')}</span></th>
                  <th><span className={styles.h}>{Icon.text}{t('colToeflOld')}</span></th>
                  <th><span className={styles.h}>{Icon.text}{t('colToeflNew')}</span></th>
                  <th><span className={styles.h}>{Icon.text}{t('colIelts')}</span></th>
                  <th><span className={styles.h}>{Icon.link}{t('colApply')}</span></th>
                </tr>
              </thead>
              <tbody>
                {list.length ? list.map((r) => (
                  <tr key={r.id} data-id={r.id} tabIndex={0} className={starred.has(r.id) ? styles.picked : undefined}
                    onClick={(e) => { if (!e.target.closest('[data-stop]')) openPeek(r.id); }}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openPeek(r.id); } }}>
                    <td className={styles.sel} data-stop><input type="checkbox" checked={starred.has(r.id)} onChange={() => toggle(setStarred, r.id)} aria-label={t('pickAria', {name: r.name})} /></td>
                    <td className={styles.name}><div className={styles.nameIn}>{Icon.doc}<span className={styles.nameText}>{r.name}</span><button type="button" className={styles.openPill} tabIndex={-1}>OPEN</button></div></td>
                    <td>{tierTag(r.tier)}</td>
                    <td>{dateCell(r, 0)}</td><td>{dateCell(r, 1)}</td><td>{dateCell(r, 2)}</td>
                    <td>{greTag(r)}</td>
                    <td>{langCell(r.lang?.toefl_old)}</td><td>{langCell(r.lang?.toefl_new)}</td><td>{langCell(r.lang?.ielts)}</td>
                    <td><a className={styles.url} href={r.apply} target="_blank" rel="noopener noreferrer" data-stop>{host(r.apply)}</a></td>
                  </tr>
                )) : (
                  <tr><td className={styles.sel} /><td className={styles.empty} colSpan={10}>{emptyText}</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr><td className={styles.sel} /><td className={styles.name}>{t('count')}<b>{list.length}</b></td><td colSpan={9} /></tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className={styles.legend}>
          <span>{t('legend')}</span>
          <span>{t('verified', {d: DATA.generated})}</span>
        </div>
        {renderPeek()}
      </main>
    </Layout>
  );
}
