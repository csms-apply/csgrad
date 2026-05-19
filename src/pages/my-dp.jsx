import React, { useEffect, useState, useRef } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {
  DP_API_BASE, getMe, getMyApplicant, listMyDp,
  updateDp, deleteDp, signOut,
} from '@site/src/lib/dp/api';
import { RESULTS, SEMESTERS } from '@site/src/lib/dp/enums';
import styles from './my-dp.module.css';

const COPY = {
  'zh-Hans': {
    pageTitle: '我的 DataPoints',
    pageDesc: '管理你提交过的 csgrad DataPoints：查看、编辑、删除你的申请结果记录。',
    loading: '加载中…',
    needSignIn: '需要登录',
    signInTip: '登录后才能查看你自己提交过的 DataPoints。',
    signInGoogle: 'Google 登录',
    signInGithub: 'GitHub 登录',
    signInFail: '登录失败：',
    signOut: '登出',
    adminTag: ' · admin',
    heading: '我的 DataPoints',
    noApplicant: '你还没有创建申请者背景档案。',
    noApplicantLink: '去填写',
    noApplicantSuffix: '后才能提交 DP。',
    totalPrefix: '共 ',
    totalSuffix: ' 条已提交。',
    submitNew: '提交新的 DP →',
    emptyText: '还没有 DP 记录。',
    emptyLink: '现在提交第一条 →',
    updated: '已更新',
    deleted: '已删除',
    updateFail: '更新失败：',
    deleteFail: '删除失败：',
    confirmDelete: '确认删除这条 DataPoint？此操作不可撤销。',
    colSchoolProgram: '学校 · 项目',
    colTier: 'Tier',
    colResult: '结果',
    colFunded: '带奖',
    colFinal: '最终',
    colYearSem: '年份 / 学期',
    colNotified: '通知',
    colSubmitted: '提交',
    colNotes: '备注',
    colActions: '操作',
    edit: '编辑',
    remove: '删除',
    save: '保存',
    cancel: '取消',
    close: '关闭',
    modalTitle: '编辑 DataPoint',
    fResult: '结果',
    fFunded: '带奖',
    fFinal: '最终去向',
    fYear: '入学年份',
    fSemester: '学期',
    fNotified: '通知日期',
    fSubmitted: '提交日期',
    fNotes: '备注',
    placeholderNone: '—',
    editAria: '编辑 {school} {program}',
    deleteAria: '删除 {school} {program}',
  },
  en: {
    pageTitle: 'My DataPoints',
    pageDesc: 'Manage the csgrad DataPoints you have submitted: view, edit, and delete your application result records.',
    loading: 'Loading…',
    needSignIn: 'Sign in required',
    signInTip: 'You need to sign in to view DataPoints you have submitted.',
    signInGoogle: 'Sign in with Google',
    signInGithub: 'Sign in with GitHub',
    signInFail: 'Sign in failed: ',
    signOut: 'Sign out',
    adminTag: ' · admin',
    heading: 'My DataPoints',
    noApplicant: 'You have not created an applicant profile yet. ',
    noApplicantLink: 'Create one',
    noApplicantSuffix: ' before submitting a DP.',
    totalPrefix: 'Total ',
    totalSuffix: ' submitted.',
    submitNew: 'Submit a new DP →',
    emptyText: 'No DP records yet. ',
    emptyLink: 'Submit your first one →',
    updated: 'Updated',
    deleted: 'Deleted',
    updateFail: 'Update failed: ',
    deleteFail: 'Delete failed: ',
    confirmDelete: 'Delete this DataPoint? This action cannot be undone.',
    colSchoolProgram: 'School · Program',
    colTier: 'Tier',
    colResult: 'Result',
    colFunded: 'Funded',
    colFinal: 'Final',
    colYearSem: 'Year / Semester',
    colNotified: 'Notified',
    colSubmitted: 'Submitted',
    colNotes: 'Notes',
    colActions: 'Actions',
    edit: 'Edit',
    remove: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    modalTitle: 'Edit DataPoint',
    fResult: 'Result',
    fFunded: 'Funded',
    fFinal: 'Final destination',
    fYear: 'Entry year',
    fSemester: 'Semester',
    fNotified: 'Notified at',
    fSubmitted: 'Submitted at',
    fNotes: 'Notes',
    placeholderNone: '—',
    editAria: 'Edit {school} {program}',
    deleteAria: 'Delete {school} {program}',
  },
};

function pickLocale(loc) {
  return loc === 'en' ? 'en' : 'zh-Hans';
}

function fmt(template, vars) {
  return Object.keys(vars).reduce(
    (acc, k) => acc.replace(`{${k}}`, vars[k] || ''),
    template,
  );
}

function pillClass(result) {
  switch (result) {
    case 'Admit': return styles.pillAdmit;
    case 'Reject': case '默拒': return styles.pillReject;
    case 'Waitlist': return styles.pillWait;
    case 'Withdraw': return styles.pillWithdraw;
    default: return styles.pillUnknown;
  }
}

function rowToDraft(row) {
  return {
    result: row.d.result || '',
    is_funded: !!row.d.is_funded,
    is_final_destination: !!row.d.is_final_destination,
    academic_year: row.d.academic_year ?? '',
    semester: row.d.semester || '',
    notified_at: row.d.notified_at || '',
    submitted_at: row.d.submitted_at || '',
    notes: row.d.notes || '',
  };
}

function draftToPayload(draft) {
  const payload = { ...draft };
  payload.academic_year = payload.academic_year === ''
    ? null
    : Number(payload.academic_year);
  for (const k of ['result', 'semester', 'notified_at', 'submitted_at', 'notes']) {
    if (payload[k] === '') payload[k] = null;
  }
  return payload;
}

function EditModal({ row, t, onClose, onSave }) {
  const [draft, setDraft] = useState(() => rowToDraft(row));
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const lastActiveRef = useRef(null);

  useEffect(() => {
    lastActiveRef.current = document.activeElement;
    const tm = setTimeout(() => {
      if (firstFieldRef.current) firstFieldRef.current.focus();
    }, 0);
    return () => {
      clearTimeout(tm);
      if (lastActiveRef.current && typeof lastActiveRef.current.focus === 'function') {
        lastActiveRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  function set(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draftToPayload(draft));
    } finally {
      setSaving(false);
    }
  }

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '5vh 16px',
    zIndex: 1000,
    overflowY: 'auto',
  };
  const dialogStyle = {
    background: 'var(--ifm-background-color)',
    color: 'var(--ifm-font-color-base)',
    border: '1px solid var(--ifm-color-emphasis-200)',
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
    width: '100%',
    maxWidth: 560,
    padding: 20,
  };
  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  };
  const titleStyle = { margin: 0, fontSize: 18 };
  const subTitleStyle = {
    margin: '0 0 14px',
    color: 'var(--ifm-color-emphasis-700)',
    fontSize: 13,
  };
  const closeBtnStyle = {
    background: 'transparent',
    border: 0,
    fontSize: 22,
    lineHeight: 1,
    cursor: 'pointer',
    color: 'var(--ifm-color-emphasis-700)',
    padding: '0 4px',
  };
  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 };
  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--ifm-color-emphasis-700)',
  };
  const inputStyle = {
    padding: '6px 8px',
    border: '1px solid var(--ifm-color-emphasis-300)',
    borderRadius: 6,
    fontSize: 13,
    background: 'var(--ifm-background-color)',
    color: 'var(--ifm-font-color-base)',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  };
  const rowGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
  const checkRowStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13 };
  const footerStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid var(--ifm-color-emphasis-200)',
  };

  const titleId = `dp-edit-title-${row.d.id}`;

  return (
    <div
      style={backdropStyle}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={dialogStyle}
      >
        <div style={headerStyle}>
          <h2 id={titleId} style={titleStyle}>{t.modalTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            style={closeBtnStyle}
            aria-label={t.close}
          >×</button>
        </div>
        <p style={subTitleStyle}>
          <b>{row.p.school}</b> · {row.p.program}
        </p>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor={`edit-result-${row.d.id}`}>{t.fResult}</label>
          <select
            ref={firstFieldRef}
            id={`edit-result-${row.d.id}`}
            value={draft.result}
            onChange={(e) => set('result', e.target.value)}
            style={inputStyle}
          >
            <option value="">—</option>
            {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={draft.is_funded}
            onChange={(e) => set('is_funded', e.target.checked)}
          />
          {t.fFunded}
        </label>
        <label style={checkRowStyle}>
          <input
            type="checkbox"
            checked={draft.is_final_destination}
            onChange={(e) => set('is_final_destination', e.target.checked)}
          />
          {t.fFinal}
        </label>

        <div style={rowGridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor={`edit-year-${row.d.id}`}>{t.fYear}</label>
            <input
              id={`edit-year-${row.d.id}`}
              type="number"
              value={draft.academic_year}
              onChange={(e) => set('academic_year', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor={`edit-sem-${row.d.id}`}>{t.fSemester}</label>
            <select
              id={`edit-sem-${row.d.id}`}
              value={draft.semester}
              onChange={(e) => set('semester', e.target.value)}
              style={inputStyle}
            >
              <option value="">—</option>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={rowGridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor={`edit-notified-${row.d.id}`}>{t.fNotified}</label>
            <input
              id={`edit-notified-${row.d.id}`}
              type="date"
              value={draft.notified_at}
              onChange={(e) => set('notified_at', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor={`edit-submitted-${row.d.id}`}>{t.fSubmitted}</label>
            <input
              id={`edit-submitted-${row.d.id}`}
              type="date"
              value={draft.submitted_at}
              onChange={(e) => set('submitted_at', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor={`edit-notes-${row.d.id}`}>{t.fNotes}</label>
          <textarea
            id={`edit-notes-${row.d.id}`}
            rows={3}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
          />
        </div>

        <div style={footerStyle}>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={onClose}
            disabled={saving}
          >{t.cancel}</button>
          <button
            type="button"
            className={styles.smallBtn}
            onClick={handleSave}
            disabled={saving}
          >{t.save}</button>
        </div>
      </div>
    </div>
  );
}

function Inner({ t }) {
  const [me, setMe] = useState(null);
  const [meChecked, setMeChecked] = useState(false);
  const [applicant, setApplicant] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [msg, setMsg] = useState(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const meRes = await getMe();
      setMe(meRes.user);
      setMeChecked(true);
      if (!meRes.user) return;
      const ap = await getMyApplicant();
      setApplicant(ap.applicant);
      if (ap.applicant) {
        const dpRes = await listMyDp(ap.applicant.id);
        setRows(dpRes.rows);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  if (!meChecked) return <div className={styles.loading}>{t.loading}</div>;
  if (!me) {
    return (
      <div className={styles.gate}>
        <h2>{t.needSignIn}</h2>
        <p>{t.signInTip}</p>
        <SignInButtons t={t} />
      </div>
    );
  }

  async function handleSaveEdit(payload) {
    try {
      await updateDp(editingRow.d.id, payload);
      setMsg({ type: 'ok', text: t.updated });
      setEditingRow(null);
      reload();
    } catch (e) {
      setMsg({ type: 'err', text: `${t.updateFail}${e.message}` });
    }
  }

  async function remove(row) {
    if (!confirm(t.confirmDelete)) return;
    try {
      await deleteDp(row.d.id);
      setMsg({ type: 'ok', text: t.deleted });
      reload();
    } catch (e) {
      setMsg({ type: 'err', text: `${t.deleteFail}${e.message}` });
    }
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/datapoints';
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1>{t.heading}</h1>
          <div className={styles.headerRight}>
            <span className={styles.meBadge}>👤 {me.nickname}{me.role === 'admin' ? t.adminTag : ''}</span>
            <button className={styles.linkBtn} onClick={handleSignOut}>{t.signOut}</button>
          </div>
        </div>
        {!applicant ? (
          <p className={styles.notice}>
            {t.noApplicant}<a href="/submit-dp">{t.noApplicantLink}</a>{t.noApplicantSuffix}
          </p>
        ) : (
          <p className={styles.lead}>
            {t.totalPrefix}<b>{rows.length}</b>{t.totalSuffix} <a href="/submit-dp">{t.submitNew}</a>
          </p>
        )}
        {msg ? <p className={msg.type === 'ok' ? styles.ok : styles.err}>{msg.text}</p> : null}
      </header>

      {loading ? <div className={styles.loading}>{t.loading}</div> : null}
      {error ? <div className={styles.err}>{error}</div> : null}

      {!loading && applicant && rows.length === 0 ? (
        <div className={styles.empty}>
          {t.emptyText}<a href="/submit-dp">{t.emptyLink}</a>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.colSchoolProgram}</th>
                <th>{t.colTier}</th>
                <th>{t.colResult}</th>
                <th>{t.colFunded}</th>
                <th>{t.colFinal}</th>
                <th>{t.colYearSem}</th>
                <th>{t.colNotified}</th>
                <th>{t.colSubmitted}</th>
                <th>{t.colNotes}</th>
                <th>{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowLabel = { school: row.p.school, program: row.p.program };
                return (
                  <tr key={row.d.id}>
                    <td>
                      <b>{row.p.school}</b>
                      <br />
                      <span className={styles.muted}>{row.p.program}</span>
                    </td>
                    <td>{row.p.tier || <span className={styles.muted}>{t.placeholderNone}</span>}</td>
                    <td>
                      <span className={`${styles.pill} ${pillClass(row.d.result)}`}>
                        {row.d.result || t.placeholderNone}
                      </span>
                    </td>
                    <td>{row.d.is_funded ? '✓' : ''}</td>
                    <td>{row.d.is_final_destination ? '✓' : ''}</td>
                    <td>{row.d.academic_year} {row.d.semester}</td>
                    <td>{row.d.notified_at || <span className={styles.muted}>{t.placeholderNone}</span>}</td>
                    <td>{row.d.submitted_at || <span className={styles.muted}>{t.placeholderNone}</span>}</td>
                    <td className={styles.notesCell}>
                      {row.d.notes || <span className={styles.muted}>{t.placeholderNone}</span>}
                    </td>
                    <td className={styles.actionsCell}>
                      <button
                        className={styles.smallBtn}
                        onClick={() => setEditingRow(row)}
                        aria-label={fmt(t.editAria, rowLabel)}
                      >{t.edit}</button>
                      <button
                        className={`${styles.smallBtn} ${styles.dangerBtn}`}
                        onClick={() => remove(row)}
                        aria-label={fmt(t.deleteAria, rowLabel)}
                      >{t.remove}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {editingRow ? (
        <EditModal
          row={editingRow}
          t={t}
          onClose={() => setEditingRow(null)}
          onSave={handleSaveEdit}
        />
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 6 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 6 }}>
      <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
}

function SignInButtons({ t }) {
  async function signIn(provider) {
    const r = await fetch(`${DP_API_BASE}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider, callbackURL: window.location.href }),
    });
    const data = await r.json();
    if (data.url) window.location.href = data.url;
    else alert(`${t.signInFail}${data.message || 'unknown'}`);
  }
  return (
    <div className={styles.signInGroup}>
      <button type="button" className={styles.signInBtn} onClick={() => signIn('google')}>
        <GoogleIcon />{t.signInGoogle}
      </button>
      <button type="button" className={styles.signInBtn} onClick={() => signIn('github')}>
        <GitHubIcon />{t.signInGithub}
      </button>
    </div>
  );
}

export default function MyDp() {
  const { i18n } = useDocusaurusContext();
  const locale = pickLocale(i18n.currentLocale);
  const t = COPY[locale];
  return (
    <Layout title={t.pageTitle} description={t.pageDesc}>
      <Head>
        <meta name="description" content={t.pageDesc} />
        <meta name="robots" content="noindex" />
      </Head>
      <BrowserOnly>{() => <Inner t={t} />}</BrowserOnly>
    </Layout>
  );
}
