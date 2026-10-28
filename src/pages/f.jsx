import React, { useEffect, useState } from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import SignInButtons from '@site/src/lib/auth/SignInButtons';
import { startOAuth } from '@site/src/lib/auth/oauth';
import { getPublicForm, isVisible, submitResponse } from '@site/src/lib/forms/schema';
import styles from './live.module.css';

// 公开填写页：csgrad.com/f?id=<表单 id>，表单由 /forms-admin 创建。

const SIGN_IN_TEXT = { signInGoogle: '使用 Google 登录', signInGitHub: '使用 GitHub 登录' };
const ERRORS = {
  missing_answer: '这道题是必填项',
  invalid_answer: '这道题的格式不正确',
  form_closed: '这个表单已停止收集回复',
  unauthorized: '登录已过期，请重新登录后提交',
  not_found: '表单不存在',
};

function Chips({ options, value, onChange, multi }) {
  const selected = multi ? value || [] : [value];
  const toggle = (v) => {
    if (!multi) return onChange(v);
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  return (
    <div className={styles.chips} role={multi ? 'group' : 'radiogroup'}>
      {options.map((v) => (
        <button key={v} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={selected.includes(v)}
          className={selected.includes(v) ? `${styles.chip} ${styles.chipOn}` : styles.chip} onClick={() => toggle(v)}>
          {v}
        </button>
      ))}
    </div>
  );
}

const INPUT_TYPES = { short: 'text', email: 'email', url: 'url', number: 'number', date: 'date' };

function Question({ field, value, onChange, error }) {
  if (field.type === 'section') {
    return (
      <div>
        <h2 className={styles.section}>{field.label}</h2>
        {field.help && <p className={styles.hint}>{field.help}</p>}
      </div>
    );
  }
  let control;
  if (field.type === 'single' || field.type === 'multi') {
    control = <Chips multi={field.type === 'multi'} options={field.options} value={value} onChange={onChange} />;
  } else if (field.type === 'dropdown') {
    control = (
      <select className={styles.input} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">请选择</option>
        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  } else if (field.type === 'paragraph') {
    control = <textarea className={styles.textarea} rows={4} maxLength={5000} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  } else {
    control = (
      <input className={styles.input} type={INPUT_TYPES[field.type]} maxLength={1000}
        placeholder={field.type === 'url' ? 'https://' : undefined}
        value={value || ''} onChange={(e) => onChange(e.target.value)} />
    );
  }
  return (
    <div className={styles.field} id={`q-${field.id}`}>
      <div className={styles.label}>
        {field.label}
        {field.required && <span className={styles.req}> *</span>}
      </div>
      {field.help && <div className={styles.hint}>{field.help}</div>}
      {control}
      {error && <div className={styles.fieldError}>{error}</div>}
    </div>
  );
}

function missingRequired(form, answers) {
  return form.fields.find((f) => {
    if (f.type === 'section' || !f.required || !isVisible(f, answers)) return false;
    const v = answers[f.id];
    return Array.isArray(v) ? v.length === 0 : !String(v || '').trim();
  });
}

export default function FormPage() {
  const [id, setId] = useState('');
  const [data, setData] = useState(undefined); // undefined 加载中 | null 不存在 | { form, user, myAnswers }
  const [answers, setAnswers] = useState({});
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState({});

  useEffect(() => {
    const formId = new URLSearchParams(window.location.search).get('id') || '';
    setId(formId);
    if (!formId) return setData(null);
    getPublicForm(formId)
      .then((d) => { setData(d); setAnswers(d.myAnswers || {}); })
      .catch(() => setData(null));
  }, []);

  const set = (fieldId) => (v) => {
    setAnswers((a) => ({ ...a, [fieldId]: v }));
    setFieldError((e) => ({ ...e, [fieldId]: undefined }));
  };

  function showFieldError(fieldId, msg) {
    setFieldError({ [fieldId]: msg });
    document.getElementById(`q-${fieldId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const missing = missingRequired(data.form, answers);
    if (missing) return showFieldError(missing.id, ERRORS.missing_answer);
    // 隐藏题的答案不提交
    const visible = Object.fromEntries(
      data.form.fields.filter((f) => f.type !== 'section' && isVisible(f, answers) && answers[f.id] !== undefined)
        .map((f) => [f.id, answers[f.id]]),
    );
    setStatus('sending');
    try {
      await submitResponse(id, visible, website);
      setStatus('done');
    } catch (err) {
      setStatus('idle');
      if (err.field) return showFieldError(err.field, ERRORS[err.message] || err.message);
      if (err.status === 401) setData((d) => ({ ...d, user: null }));
      setError(ERRORS[err.message] || '提交失败，请稍后重试');
    }
  }

  async function signIn(provider) {
    setError('');
    try {
      await startOAuth(provider);
    } catch (err) {
      setError(`登录失败：${err.message}`);
    }
  }

  const form = data && data.form;
  let body;
  if (data === undefined) {
    body = <section className={styles.card}><p className={styles.intro}>加载中…</p></section>;
  } else if (!form) {
    body = <section className={styles.card}><h2 className={styles.doneTitle}>表单不存在</h2><p className={styles.intro}>请检查链接是否完整。</p></section>;
  } else if (form.status !== 'open') {
    body = <section className={styles.card}><h2 className={styles.doneTitle}>表单已关闭</h2><p className={styles.intro}>这个表单已停止收集回复。</p></section>;
  } else if (form.requireLogin && !data.user) {
    body = (
      <section className={styles.card}>
        <h2 className={styles.doneTitle}>登录后填写</h2>
        <p className={styles.intro}>这个表单需要先用 Google 或 GitHub 账号登录。登录后可以随时回来修改回答。</p>
        <SignInButtons t={SIGN_IN_TEXT} onSignIn={signIn} variant="group" />
        {error && <div className={styles.error} role="alert">{error}</div>}
      </section>
    );
  } else if (status === 'done') {
    body = (
      <section className={styles.card}>
        <h2 className={styles.doneTitle}>已提交，谢谢！🎉</h2>
        <p className={styles.intro}>
          {form.requireLogin ? '想修改的话，重新打开这个链接修改后再提交即可。' : '你的回答已记录。'}
        </p>
      </section>
    );
  } else {
    body = (
      <form className={styles.card} onSubmit={submit}>
        {data.user && form.requireLogin && (
          <p className={styles.hint}>当前登录：{data.user.email || '已登录'}</p>
        )}
        {data.myAnswers && <p className={styles.notice}>你已经提交过了，下面是上次的回答，修改后重新提交即可。</p>}
        {form.fields.filter((f) => isVisible(f, answers)).map((f) => (
          <Question key={f.id} field={f} value={answers[f.id]} onChange={set(f.id)} error={fieldError[f.id]} />
        ))}
        <input className={styles.trap} tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={website} onChange={(e) => setWebsite(e.target.value)} />
        {error && <div className={styles.error} role="alert">{error}</div>}
        <button className={styles.submit} type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? '提交中…' : '提交'}
        </button>
      </form>
    );
  }

  return (
    <Layout title={form ? form.title : 'CSGrad 表单'} description="CSGrad 表单">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <main className={styles.page}>
        <div className={styles.container}>
          {form && (
            <header className={styles.hero}>
              <div className={styles.heroTop}>
                <span className={styles.brand}>CSGrad</span>
                {form.requireLogin && <span className={styles.badge}>需登录</span>}
              </div>
              <h1 className={styles.title}>{form.title}</h1>
              {form.description && <p className={`${styles.sub} ${styles.preLine}`}>{form.description}</p>}
              <p className={styles.heroNote}>带 * 的题目为必填项</p>
            </header>
          )}
          {body}
        </div>
      </main>
    </Layout>
  );
}
