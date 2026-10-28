import React, { useEffect, useState } from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { SITE_API_BASE } from '@site/src/lib/positioning/api';
import { SEASONS, TOPICS, MAJORS, DIRECTIONS, EXPERIENCES, CONSENTS, labelOf } from '@site/src/lib/live/options';
import styles from './live.module.css';

const TOKEN_KEY = 'csgrad.liveAdminToken';
const labels = (list, values) => (values || []).map((v) => labelOf(list, v)).join('、');
const time = (s) => new Date(s * 1000).toLocaleString('zh-CN', { hour12: false });

const COLUMNS = [
  ['提交时间', (r) => time(r.updatedAt)],
  ['邮箱', (r) => r.email],
  ['申请季', (r) => labelOf(SEASONS, r.season)],
  ['关注话题', (r) => labels(TOPICS, r.topics)],
  ['现场分析', (r) => (r.wantsAnalysis ? '是' : '否')],
  ['本科院校', (r) => r.school || ''],
  ['专业', (r) => (r.major ? labelOf(MAJORS, r.major) : '')],
  ['GPA', (r) => r.gpa || ''],
  ['方向', (r) => labels(DIRECTIONS, r.directions)],
  ['经历', (r) => labels(EXPERIENCES, r.experiences)],
  ['背景补充', (r) => r.note || ''],
  ['目标项目', (r) => r.targets || ''],
  ['简历', (r) => r.resumeUrl || ''],
  ['展示授权', (r) => (r.consent ? labelOf(CONSENTS, r.consent) : '')],
  ['问题', (r) => r.question || ''],
];

function downloadCsv(rows) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [COLUMNS.map(([h]) => esc(h)).join(',')]
    .concat(rows.map((r) => COLUMNS.map(([, f]) => esc(f(r))).join(',')));
  // BOM 让 Excel 正确识别中文
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `live-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function LiveAdminPage() {
  const [token, setToken] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [onlyAnalysis, setOnlyAnalysis] = useState(false);

  async function load(t) {
    setError('');
    try {
      const r = await fetch(`${SITE_API_BASE}/api/admin/live-signups`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (r.status === 401) throw new Error('令牌不正确');
      if (!r.ok) throw new Error(`加载失败（HTTP ${r.status}）`);
      setRows((await r.json()).rows);
      try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
    } catch (err) {
      setRows(null);
      setError(err.message);
    }
  }

  useEffect(() => {
    let saved = '';
    try { saved = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
    if (saved) { setToken(saved); load(saved); }
  }, []);

  const shown = rows ? rows.filter((r) => !onlyAnalysis || r.wantsAnalysis) : [];

  return (
    <Layout title="直播报名后台" description="CSGrad 直播报名管理">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <main className={styles.page}>
        <div className={styles.adminContainer}>
          <h1 className={styles.title}>直播报名后台</h1>
          <form className={styles.toolbar} onSubmit={(e) => { e.preventDefault(); load(token); }}>
            <input className={styles.input} type="password" placeholder="管理员令牌"
              value={token} onChange={(e) => setToken(e.target.value)} />
            <button className={styles.submit} type="submit">{rows ? '刷新' : '进入'}</button>
          </form>
          {error && <div className={styles.error} role="alert">{error}</div>}

          {rows && (
            <>
              <div className={styles.toolbar}>
                <span className={styles.stat}>共 {rows.length} 人报名 · 申请现场分析 {rows.filter((r) => r.wantsAnalysis).length} 人</span>
                <label className={styles.hint}>
                  <input type="checkbox" checked={onlyAnalysis} onChange={(e) => setOnlyAnalysis(e.target.checked)} /> 只看申请现场分析
                </label>
                <button className={styles.ghost} type="button" onClick={() => downloadCsv(shown)}>导出 CSV</button>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr>{COLUMNS.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id}>
                        {COLUMNS.map(([h, f]) => (
                          <td key={h}>
                            {h === '简历' && r.resumeUrl
                              ? <a href={r.resumeUrl} target="_blank" rel="noopener noreferrer">打开</a>
                              : f(r)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </Layout>
  );
}
