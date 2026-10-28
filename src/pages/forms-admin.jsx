import React, { useEffect, useState } from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import {
  FIELD_TYPES, OPTION_TYPES, FORM_ID_RE, newField, isVisible, formLink,
  listForms, createForm, updateForm, deleteForm, listResponses, ADMIN_TOKEN_KEY,
} from '@site/src/lib/forms/schema';
import styles from './forms-admin.module.css';

const time = (s) => (s ? new Date(s * 1000).toLocaleString('zh-CN', { hour12: false }) : '');
const typeLabel = (t) => (FIELD_TYPES.find((x) => x.type === t) || {}).label || t;
const cellText = (v) => (Array.isArray(v) ? v.join('、') : v == null ? '' : String(v));
const errText = (err) => (err.status === 401 ? '令牌不正确' : err.status === 409 ? '这个 id 已被占用' : err.message);

function blankForm() {
  return { id: '', title: '', description: '', status: 'open', requireLogin: false, fields: [newField()] };
}

function downloadCsv(form, responses) {
  const cols = form.fields.filter((f) => f.type !== 'section');
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['提交时间', '登录邮箱', ...cols.map((f) => f.label)].map(esc).join(',')].concat(
    responses.map((r) => [time(r.createdAt), r.email || '匿名', ...cols.map((f) => cellText((r.answers || {})[f.id]))].map(esc).join(',')),
  );
  // BOM 让 Excel 正确识别中文
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${form.id}-responses-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.track} aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}

// ---------------- 题目卡片 ----------------
function FieldCard({ field, index, total, prior, onChange, onMove, onCopy, onRemove }) {
  const set = (patch) => onChange({ ...field, ...patch });
  const hasOptions = OPTION_TYPES.includes(field.type);

  function changeType(type) {
    const next = { id: field.id, type, label: field.label, help: field.help, required: field.required };
    if (field.showIf) next.showIf = field.showIf;
    if (OPTION_TYPES.includes(type)) next.options = field.options && field.options.length ? field.options : ['选项 1'];
    if (next.help === undefined) delete next.help;
    onChange(next);
  }

  const setOption = (i, v) => set({ options: field.options.map((o, j) => (j === i ? v : o)) });
  const condSource = prior.find((f) => f.id === (field.showIf || {}).field);

  return (
    <div className={styles.fieldCard}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldNo}>{index + 1}</span>
        <select className={styles.select} value={field.type} onChange={(e) => changeType(e.target.value)} aria-label="题型">
          {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <div className={styles.iconRow}>
          <button type="button" className={styles.icon} disabled={index === 0} onClick={() => onMove(-1)} title="上移">↑</button>
          <button type="button" className={styles.icon} disabled={index === total - 1} onClick={() => onMove(1)} title="下移">↓</button>
          <button type="button" className={styles.icon} onClick={onCopy} title="复制">复制</button>
          <button type="button" className={`${styles.icon} ${styles.danger}`} onClick={onRemove} title="删除">删除</button>
        </div>
      </div>

      <input className={styles.input} placeholder={field.type === 'section' ? '分节标题' : '题目'}
        value={field.label} onChange={(e) => set({ label: e.target.value })} />
      <input className={`${styles.input} ${styles.mt8}`} placeholder="说明（可选）"
        value={field.help || ''} onChange={(e) => set({ help: e.target.value })} />

      {hasOptions && (
        <div className={styles.options}>
          {field.options.map((o, i) => (
            <div key={i} className={styles.optionRow}>
              <span className={styles.bullet}>{field.type === 'multi' ? '☐' : field.type === 'single' ? '○' : `${i + 1}.`}</span>
              <input className={styles.input} value={o} onChange={(e) => setOption(i, e.target.value)} aria-label={`选项 ${i + 1}`} />
              <button type="button" className={styles.icon} disabled={field.options.length <= 1}
                onClick={() => set({ options: field.options.filter((_, j) => j !== i) })} title="删除选项">×</button>
            </div>
          ))}
          <button type="button" className={styles.link}
            onClick={() => set({ options: [...field.options, `选项 ${field.options.length + 1}`] })}>+ 添加选项</button>
        </div>
      )}

      <div className={styles.fieldFoot}>
        {field.type !== 'section' && (
          <Toggle checked={!!field.required} onChange={(v) => set({ required: v })}>必填</Toggle>
        )}
        <div className={styles.cond}>
          <span className={styles.muted}>条件显示：</span>
          {prior.length === 0 ? (
            <span className={styles.muted}>前面没有单选/多选/下拉题</span>
          ) : (
            <>
              <select className={styles.select} value={(field.showIf || {}).field || ''}
                onChange={(e) => {
                  const src = prior.find((f) => f.id === e.target.value);
                  if (!src) { const { showIf, ...rest } = field; onChange(rest); return; }
                  set({ showIf: { field: src.id, equals: src.options[0] } });
                }}>
                <option value="">总是显示</option>
                {prior.map((f) => <option key={f.id} value={f.id}>当「{f.label || '未命名题目'}」</option>)}
              </select>
              {condSource && (
                <select className={styles.select} value={field.showIf.equals}
                  onChange={(e) => set({ showIf: { field: condSource.id, equals: e.target.value } })}>
                  {condSource.options.map((o, i) => <option key={i} value={o}>{condSource.type === 'multi' ? '包含' : '选'}「{o}」</option>)}
                </select>
              )}
              {field.showIf && (
                <button type="button" className={styles.link} onClick={() => { const { showIf, ...rest } = field; onChange(rest); }}>清除</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- 预览 ----------------
function Preview({ form }) {
  const [answers, setAnswers] = useState({});
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));

  return (
    <div className={styles.preview}>
      <div className={styles.previewTag}>预览（可点选测试条件显示，不会提交）</div>
      <h2 className={styles.previewTitle}>{form.title || '未命名表单'}</h2>
      {form.description && <p className={styles.previewDesc}>{form.description}</p>}
      {form.fields.filter((f) => isVisible(f, answers)).map((f) => {
        if (f.type === 'section') {
          return (
            <div key={f.id} className={styles.pSection}>
              <h3>{f.label || '分节标题'}</h3>
              {f.help && <p className={styles.muted}>{f.help}</p>}
            </div>
          );
        }
        const v = answers[f.id];
        let control;
        if (f.type === 'single' || f.type === 'multi') {
          control = (
            <div className={styles.pOptions}>
              {f.options.map((o, i) => {
                const on = f.type === 'multi' ? (v || []).includes(o) : v === o;
                return (
                  <label key={i} className={styles.pOption}>
                    <input type={f.type === 'multi' ? 'checkbox' : 'radio'} name={`p_${f.id}`} checked={on}
                      onChange={() => set(f.id, f.type === 'multi' ? (on ? v.filter((x) => x !== o) : [...(v || []), o]) : o)} />
                    {o}
                  </label>
                );
              })}
            </div>
          );
        } else if (f.type === 'dropdown') {
          control = (
            <select className={styles.select} value={v || ''} onChange={(e) => set(f.id, e.target.value)}>
              <option value="">请选择</option>
              {f.options.map((o, i) => <option key={i} value={o}>{o}</option>)}
            </select>
          );
        } else if (f.type === 'paragraph') {
          control = <textarea className={styles.input} rows={3} value={v || ''} onChange={(e) => set(f.id, e.target.value)} />;
        } else {
          const t = { email: 'email', url: 'url', number: 'number', date: 'date' }[f.type] || 'text';
          control = <input className={styles.input} type={t} value={v || ''} onChange={(e) => set(f.id, e.target.value)} />;
        }
        return (
          <div key={f.id} className={styles.pField}>
            <div className={styles.pLabel}>{f.label || '未命名题目'}{f.required && <span className={styles.req}> *</span>}</div>
            {f.help && <div className={styles.pHelp}>{f.help}</div>}
            {control}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- 编辑器 ----------------
function Editor({ token, initial, isNew, onDone, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setFields = (fn) => setForm((f) => ({ ...f, fields: fn(f.fields) }));

  function move(i, d) {
    setFields((fs) => { const a = [...fs]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; });
  }

  // 被删或移到后面的题目，指向它的 showIf 会失效；保存前清掉，避免后端拒收
  function cleanFields(fields) {
    return fields.map((f, i) => {
      if (!f.showIf) return f;
      const src = fields.slice(0, i).find((p) => p.id === f.showIf.field && OPTION_TYPES.includes(p.type) && p.options.includes(f.showIf.equals));
      if (src) return f;
      const { showIf, ...rest } = f;
      return rest;
    });
  }

  async function save() {
    setError('');
    if (!form.title.trim()) return setError('请填写表单标题');
    if (!FORM_ID_RE.test(form.id)) return setError('表单 id 只能用小写字母、数字、横线，3-60 位');
    const bad = form.fields.findIndex((f) => !f.label.trim());
    if (bad >= 0) return setError(`第 ${bad + 1} 题没有填写${form.fields[bad].type === 'section' ? '分节标题' : '题目'}`);
    const badOpt = form.fields.findIndex((f) => OPTION_TYPES.includes(f.type) && f.options.some((o) => !o.trim()));
    if (badOpt >= 0) return setError(`第 ${badOpt + 1} 题有空选项`);
    setSaving(true);
    try {
      const payload = { ...form, fields: cleanFields(form.fields) };
      await (isNew ? createForm(token, payload) : updateForm(token, payload));
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`确定删除表单「${form.title || form.id}」吗？\n会同时删除它的所有回复，且不可恢复。`)) return;
    try {
      await deleteForm(token, form.id);
      onDone();
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <>
      <div className={styles.bar}>
        <button type="button" className={styles.ghost} onClick={onCancel}>← 返回列表</button>
        <h1 className={styles.h1}>{isNew ? '新建表单' : '编辑表单'}</h1>
        <div className={styles.barRight}>
          {!isNew && <button type="button" className={`${styles.ghost} ${styles.danger}`} onClick={remove}>删除表单</button>}
          <button type="button" className={styles.primary} onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.editorGrid}>
        <div>
          <div className={`${styles.card} ${styles.headCard}`}>
            <label className={styles.lbl}>表单 id</label>
            <input className={styles.input} value={form.id} readOnly={!isNew} placeholder="例如 fall-2027-survey"
              onChange={(e) => set({ id: e.target.value.trim() })} />
            <div className={styles.hint}>
              {isNew ? '小写字母、数字、横线，3-60 位，会出现在链接里' : '创建后不可修改'}
              {isNew && form.id && !FORM_ID_RE.test(form.id) && <span className={styles.req}>（格式不对）</span>}
            </div>
            <label className={styles.lbl}>标题 <span className={styles.req}>*</span></label>
            <input className={`${styles.input} ${styles.titleInput}`} value={form.title} placeholder="表单标题"
              onChange={(e) => set({ title: e.target.value })} />
            <label className={styles.lbl}>说明</label>
            <textarea className={styles.input} rows={3} value={form.description || ''} placeholder="填写者会在表单顶部看到"
              onChange={(e) => set({ description: e.target.value })} />
            <div className={styles.toggles}>
              <Toggle checked={form.status === 'open'} onChange={(v) => set({ status: v ? 'open' : 'closed' })}>收集回复</Toggle>
              <Toggle checked={!!form.requireLogin} onChange={(v) => set({ requireLogin: v })}>必须用 Google/GitHub 登录才能填写</Toggle>
            </div>
          </div>

          {form.fields.map((f, i) => (
            <FieldCard key={f.id} field={f} index={i} total={form.fields.length}
              prior={form.fields.slice(0, i).filter((p) => OPTION_TYPES.includes(p.type))}
              onChange={(nf) => setFields((fs) => fs.map((x, j) => (j === i ? nf : x)))}
              onMove={(d) => move(i, d)}
              onCopy={() => setFields((fs) => [...fs.slice(0, i + 1), { ...f, id: newField().id, options: f.options && [...f.options] }, ...fs.slice(i + 1)])}
              onRemove={() => setFields((fs) => fs.filter((_, j) => j !== i))} />
          ))}
          <button type="button" className={styles.addField} onClick={() => setFields((fs) => [...fs, newField('short')])}>+ 添加题目</button>
        </div>
        <Preview form={form} />
      </div>
    </>
  );
}

// ---------------- 回复 ----------------
function Responses({ token, id, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listResponses(token, id).then(setData).catch((err) => setError(errText(err)));
  }, [token, id]);

  const cols = data ? data.form.fields.filter((f) => f.type !== 'section') : [];

  return (
    <>
      <div className={styles.bar}>
        <button type="button" className={styles.ghost} onClick={onBack}>← 返回列表</button>
        <h1 className={styles.h1}>{data ? data.form.title : id} · 回复</h1>
        {data && (
          <div className={styles.barRight}>
            <span className={styles.stat}>共 {data.responses.length} 条回复</span>
            <button type="button" className={styles.ghost} onClick={() => downloadCsv(data.form, data.responses)}>导出 CSV</button>
          </div>
        )}
      </div>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {!data && !error && <p className={styles.muted}>加载中…</p>}
      {data && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>提交时间</th><th>登录邮箱</th>{cols.map((f) => <th key={f.id}>{f.label}</th>)}</tr>
            </thead>
            <tbody>
              {data.responses.map((r) => (
                <tr key={r.id}>
                  <td>{time(r.createdAt)}</td>
                  <td>{r.email || <span className={styles.muted}>匿名</span>}</td>
                  {cols.map((f) => {
                    const v = (r.answers || {})[f.id];
                    return (
                      <td key={f.id}>
                        {f.type === 'url' && typeof v === 'string' && /^https?:\/\//i.test(v)
                          ? <a href={v} target="_blank" rel="noopener noreferrer">打开</a>
                          : cellText(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {data.responses.length === 0 && <p className={styles.empty}>还没有回复</p>}
        </div>
      )}
    </>
  );
}

// ---------------- 页面 ----------------
export default function FormsAdminPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState('');
  const [forms, setForms] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState({ name: 'list' });
  const [copied, setCopied] = useState('');

  async function load(t) {
    setError('');
    try {
      const r = await listForms(t);
      setForms(r.forms || []);
      setAuthed(t);
      try { localStorage.setItem(ADMIN_TOKEN_KEY, t); } catch (e) {}
    } catch (err) {
      setError(err.status === 401 ? '令牌不正确' : `加载失败：${err.message}`);
    }
  }

  useEffect(() => {
    let saved = '';
    try { saved = localStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch (e) {}
    if (saved) { setToken(saved); load(saved); }
  }, []);

  async function copy(id) {
    try {
      await navigator.clipboard.writeText(formLink(id));
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? '' : c)), 1500);
    } catch (e) {
      window.prompt('复制失败，请手动复制：', formLink(id));
    }
  }

  const backToList = () => { setView({ name: 'list' }); load(authed); };

  let body;
  if (!authed) {
    body = (
      <>
        <h1 className={styles.h1}>表单后台</h1>
        <form className={styles.login} onSubmit={(e) => { e.preventDefault(); load(token); }}>
          <input className={styles.input} type="password" placeholder="管理员令牌" autoComplete="current-password"
            value={token} onChange={(e) => setToken(e.target.value)} />
          <button className={styles.primary} type="submit">进入</button>
        </form>
      </>
    );
  } else if (view.name === 'edit') {
    body = <Editor key={view.form.id || 'new'} token={authed} initial={view.form} isNew={view.isNew}
      onDone={backToList} onCancel={() => setView({ name: 'list' })} />;
  } else if (view.name === 'responses') {
    body = <Responses token={authed} id={view.id} onBack={backToList} />;
  } else {
    body = (
      <>
        <div className={styles.bar}>
          <h1 className={styles.h1}>表单后台</h1>
          <div className={styles.barRight}>
            <button type="button" className={styles.ghost} onClick={() => load(authed)}>刷新</button>
            <button type="button" className={styles.primary} onClick={() => setView({ name: 'edit', isNew: true, form: blankForm() })}>+ 新建表单</button>
          </div>
        </div>
        <div className={styles.list}>
          {(forms || []).map((f) => (
            <div key={f.id} className={styles.row}>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>
                  {f.title}
                  <span className={f.status === 'open' ? styles.badgeOn : styles.badgeOff}>{f.status === 'open' ? '收集中' : '已关闭'}</span>
                  {f.requireLogin && <span className={styles.badgeOff}>需登录</span>}
                </div>
                <div className={styles.rowMeta}>
                  <code>{f.id}</code> · {f.responseCount || 0} 条回复 · 更新于 {time(f.updatedAt)}
                </div>
              </div>
              <div className={styles.rowActions}>
                <button type="button" className={styles.ghost}
                  onClick={() => setView({ name: 'edit', isNew: false, form: { id: f.id, title: f.title, description: f.description || '', status: f.status, requireLogin: !!f.requireLogin, fields: f.fields || [] } })}>编辑</button>
                <button type="button" className={styles.ghost} onClick={() => setView({ name: 'responses', id: f.id })}>查看回复</button>
                <button type="button" className={styles.ghost} onClick={() => copy(f.id)}>{copied === f.id ? '已复制' : '复制链接'}</button>
                <a className={styles.ghost} href={formLink(f.id)} target="_blank" rel="noopener noreferrer">打开</a>
              </div>
            </div>
          ))}
          {forms && forms.length === 0 && <p className={styles.empty}>还没有表单，点右上角新建一个。</p>}
        </div>
      </>
    );
  }

  return (
    <Layout title="表单后台" description="CSGrad 表单管理">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <main className={styles.page}>
        <div className={styles.container}>
          {body}
          {error && <div className={styles.error} role="alert">{error}</div>}
        </div>
      </main>
    </Layout>
  );
}
