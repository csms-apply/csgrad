import React, { useEffect, useState } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {
  DP_API_BASE, getMe, getMyApplicant, listMyDp,
  updateDp, deleteDp, signOut,
} from '@site/src/lib/dp/api';
import { RESULTS, SEMESTERS } from '@site/src/lib/dp/enums';
import styles from './my-dp.module.css';

function Inner() {
  const [me, setMe] = useState(null);
  const [meChecked, setMeChecked] = useState(false);
  const [applicant, setApplicant] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // dp id being edited
  const [draft, setDraft] = useState(null);
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

  if (!meChecked) return <div className={styles.loading}>加载中…</div>;
  if (!me) {
    return (
      <div className={styles.gate}>
        <h2>需要登录</h2>
        <p>登录后才能查看你自己提交过的 DataPoints。</p>
        <SignInButtons />
      </div>
    );
  }

  function startEdit(row) {
    setEditing(row.d.id);
    setDraft({
      result: row.d.result || '',
      is_funded: !!row.d.is_funded,
      is_final_destination: !!row.d.is_final_destination,
      academic_year: row.d.academic_year ?? '',
      semester: row.d.semester || '',
      notified_at: row.d.notified_at || '',
      submitted_at: row.d.submitted_at || '',
      notes: row.d.notes || '',
    });
  }

  async function saveEdit(id) {
    try {
      const payload = { ...draft };
      if (payload.academic_year === '') payload.academic_year = null;
      else payload.academic_year = Number(payload.academic_year);
      for (const k of ['result', 'semester', 'notified_at', 'submitted_at', 'notes']) {
        if (payload[k] === '') payload[k] = null;
      }
      await updateDp(id, payload);
      setMsg({ type: 'ok', text: '已更新' });
      setEditing(null);
      setDraft(null);
      reload();
    } catch (e) {
      setMsg({ type: 'err', text: `更新失败：${e.message}` });
    }
  }

  async function remove(id) {
    if (!confirm('确认删除这条 DataPoint？此操作不可撤销。')) return;
    try {
      await deleteDp(id);
      setMsg({ type: 'ok', text: '已删除' });
      reload();
    } catch (e) {
      setMsg({ type: 'err', text: `删除失败：${e.message}` });
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
          <h1>我的 DataPoints</h1>
          <div className={styles.headerRight}>
            <span className={styles.meBadge}>👤 {me.nickname}{me.role === 'admin' ? ' · admin' : ''}</span>
            <button className={styles.linkBtn} onClick={handleSignOut}>登出</button>
          </div>
        </div>
        {!applicant ? (
          <p className={styles.notice}>
            你还没有创建申请者背景档案。<a href="/submit-dp">去填写</a>后才能提交 DP。
          </p>
        ) : (
          <p className={styles.lead}>
            共 <b>{rows.length}</b> 条已提交。<a href="/submit-dp">提交新的 DP →</a>
          </p>
        )}
        {msg ? <p className={msg.type === 'ok' ? styles.ok : styles.err}>{msg.text}</p> : null}
      </header>

      {loading ? <div className={styles.loading}>加载中…</div> : null}
      {error ? <div className={styles.err}>{error}</div> : null}

      {!loading && applicant && rows.length === 0 ? (
        <div className={styles.empty}>
          还没有 DP 记录。<a href="/submit-dp">现在提交第一条 →</a>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>学校 · 项目</th>
                <th>Tier</th>
                <th>结果</th>
                <th>带奖</th>
                <th>最终</th>
                <th>年份 / 学期</th>
                <th>通知</th>
                <th>提交</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editing === row.d.id;
                return (
                  <tr key={row.d.id}>
                    <td>
                      <b>{row.p.school}</b>
                      <br />
                      <span className={styles.muted}>{row.p.program}</span>
                    </td>
                    <td>{row.p.tier || <span className={styles.muted}>—</span>}</td>
                    <td>
                      {isEditing ? (
                        <select
                          value={draft.result}
                          onChange={(e) => setDraft({ ...draft, result: e.target.value })}
                          className={styles.cellInput}
                        >
                          <option value="">—</option>
                          {RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className={`${styles.pill} ${pillClass(row.d.result)}`}>{row.d.result || '—'}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="checkbox" checked={draft.is_funded} onChange={(e) => setDraft({ ...draft, is_funded: e.target.checked })} />
                      ) : row.d.is_funded ? '✓' : ''}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="checkbox" checked={draft.is_final_destination} onChange={(e) => setDraft({ ...draft, is_final_destination: e.target.checked })} />
                      ) : row.d.is_final_destination ? '✓' : ''}
                    </td>
                    <td>
                      {isEditing ? (
                        <>
                          <input type="number" value={draft.academic_year} onChange={(e) => setDraft({ ...draft, academic_year: e.target.value })} className={styles.cellInput} style={{ width: 70 }} />
                          <select value={draft.semester} onChange={(e) => setDraft({ ...draft, semester: e.target.value })} className={styles.cellInput}>
                            <option value="">—</option>
                            {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </>
                      ) : (
                        <>{row.d.academic_year} {row.d.semester}</>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="date" value={draft.notified_at} onChange={(e) => setDraft({ ...draft, notified_at: e.target.value })} className={styles.cellInput} />
                      ) : (row.d.notified_at || <span className={styles.muted}>—</span>)}
                    </td>
                    <td>
                      {isEditing ? (
                        <input type="date" value={draft.submitted_at} onChange={(e) => setDraft({ ...draft, submitted_at: e.target.value })} className={styles.cellInput} />
                      ) : (row.d.submitted_at || <span className={styles.muted}>—</span>)}
                    </td>
                    <td className={styles.notesCell}>
                      {isEditing ? (
                        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={styles.cellInput} rows={2} />
                      ) : (row.d.notes || <span className={styles.muted}>—</span>)}
                    </td>
                    <td className={styles.actionsCell}>
                      {isEditing ? (
                        <>
                          <button className={styles.smallBtn} onClick={() => saveEdit(row.d.id)}>保存</button>
                          <button className={styles.smallBtn} onClick={() => { setEditing(null); setDraft(null); }}>取消</button>
                        </>
                      ) : (
                        <>
                          <button className={styles.smallBtn} onClick={() => startEdit(row)}>编辑</button>
                          <button className={`${styles.smallBtn} ${styles.dangerBtn}`} onClick={() => remove(row.d.id)}>删除</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function SignInButtons() {
  async function signIn(provider) {
    const r = await fetch(`${DP_API_BASE}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider, callbackURL: window.location.href }),
    });
    const data = await r.json();
    if (data.url) window.location.href = data.url;
    else alert(`登录失败：${data.message || 'unknown'}`);
  }
  return (
    <div className={styles.signInGroup}>
      <button className={styles.signInBtn} onClick={() => signIn('google')}>Google 登录</button>
      <button className={styles.signInBtn} onClick={() => signIn('github')}>GitHub 登录</button>
    </div>
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

export default function MyDp() {
  return (
    <Layout title="我的 DataPoints" description="manage your csgrad DataPoints">
      <BrowserOnly>{() => <Inner />}</BrowserOnly>
    </Layout>
  );
}
