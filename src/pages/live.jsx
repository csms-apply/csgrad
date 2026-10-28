import React, { useEffect, useState } from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { SITE_API_BASE } from '@site/src/lib/positioning/api';
import { SEASONS, TOPICS, MAJORS, DIRECTIONS, EXPERIENCES, CONSENTS } from '@site/src/lib/live/options';
import SignInButtons from '@site/src/lib/auth/SignInButtons';
import { startOAuth } from '@site/src/lib/auth/oauth';
import styles from './live.module.css';

const EMPTY = {
  email: '', season: '', topics: [], wantsAnalysis: null,
  school: '', major: '', gpa: '', directions: [], experiences: [],
  note: '', targets: '', resumeUrl: '', consent: '', question: '', website: '',
};

const ERRORS = {
  invalid_email: '邮箱格式不正确',
  invalid_season: '请选择申请季',
  missing_topics: '请至少选择一个关注话题',
  missing_profile: '申请现场分析需要填写完整背景（带 * 的题目）',
  invalid_resume_url: '简历链接需要以 http:// 或 https:// 开头',
};

const SIGN_IN_TEXT = { signInGoogle: '使用 Google 登录', signInGitHub: '使用 GitHub 登录' };

// 已提交的报名记录 → 表单字段（后端把 data JSON 展平后返回）
function fromSignup(s) {
  const pickKeys = Object.keys(EMPTY).filter((k) => s[k] !== undefined && s[k] !== null);
  return { ...EMPTY, ...Object.fromEntries(pickKeys.map((k) => [k, s[k]])), wantsAnalysis: Boolean(s.wantsAnalysis) };
}

function Chips({ options, value, onChange, multi }) {
  const selected = multi ? value : [value];
  const toggle = (v) => {
    if (!multi) return onChange(v);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div className={styles.chips} role={multi ? 'group' : 'radiogroup'}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role={multi ? 'checkbox' : 'radio'}
          aria-checked={selected.includes(v)}
          className={selected.includes(v) ? `${styles.chip} ${styles.chipOn}` : styles.chip}
          onClick={() => toggle(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.label}>
        {label}
        {required && <span className={styles.req}> *</span>}
      </div>
      {hint && <div className={styles.hint}>{hint}</div>}
      {children}
    </div>
  );
}

export default function LivePage() {
  const [form, setForm] = useState(EMPTY);
  const [me, setMe] = useState(undefined); // undefined 加载中 | null 未登录 | { accountEmail, signup }
  const [status, setStatus] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${SITE_API_BASE}/api/live-signup/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        setMe(data);
        if (data) setForm(data.signup ? fromSignup(data.signup) : { ...EMPTY, email: data.accountEmail });
      });
  }, []);

  async function signIn(provider) {
    setError('');
    try {
      await startOAuth(provider);
    } catch (err) {
      setError(`登录失败：${err.message}`);
    }
  }
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v && v.target ? v.target.value : v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.season) return setError(ERRORS.invalid_season);
    if (!form.topics.length) return setError(ERRORS.missing_topics);
    if (form.wantsAnalysis === null) return setError('请选择是否参加现场选校分析');
    setError('');
    setStatus('sending');
    try {
      const r = await fetch(`${SITE_API_BASE}/api/live-signup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (r.status === 401) {
        setMe(null);
        throw new Error('登录已过期，请重新登录后提交');
      }
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(ERRORS[json.error] || '提交失败，请稍后重试');
      setStatus('done');
    } catch (err) {
      setError(err.message || '网络异常，请稍后重试');
      setStatus('idle');
    }
  }

  return (
    <Layout title="CSGrad 直播报名" description="CSGrad 免费直播报名：真实录取案例、项目避坑与现场选校分析。">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.hero}>
            <div className={styles.heroTop}>
              <span className={styles.brand}>CSGrad</span>
              <span className={styles.badge}>免费直播</span>
            </div>
            <div className={styles.kicker}>2027 FALL · 首场直播</div>
            <h1 className={styles.title}>你的背景，到底能申上什么 CS 硕士？</h1>
            <p className={styles.sub}>真实录取案例 · 项目避坑 · 现场选校分析</p>
            <ul className={styles.meta}>
              <li>预计 2026 年 11 月 10 日左右</li>
              <li>约 2 分钟完成报名</li>
            </ul>
          </header>

          {me === undefined ? (
            <section className={styles.card}><p className={styles.intro}>加载中…</p></section>
          ) : me === null ? (
            <section className={styles.card}>
              <h2 className={styles.doneTitle}>登录后报名</h2>
              <p className={styles.intro}>
                报名需要先用 Google 或 GitHub 账号登录。登录后可以随时回来修改报名信息。
              </p>
              <SignInButtons t={SIGN_IN_TEXT} onSignIn={signIn} variant="group" />
              {error && <div className={styles.error} role="alert">{error}</div>}
            </section>
          ) : status === 'done' ? (
            <section className={styles.card}>
              <h2 className={styles.doneTitle}>报名成功 🎉</h2>
              <p className={styles.sub}>
                直播时间和观看链接会发到 <b>{form.email}</b>。想修改信息的话，重新打开本页修改后再提交即可。
              </p>
            </section>
          ) : (
            <form className={styles.card} onSubmit={submit}>
              <p className={styles.intro}>
                填写报名信息，获取直播通知。希望参加现场选校分析的同学，可以补充个人申请背景。带 * 的题目为必填项。
              </p>
              {me.signup && <p className={styles.notice}>你已经报过名了，下面是上次填写的内容，修改后重新提交即可。</p>}

              <h2 className={styles.section}><span>01</span>基本报名信息</h2>
              <Field label="邮箱地址" required hint="用于发送直播时间、观看链接和相关通知，默认使用登录邮箱，可修改。">
                <input className={styles.input} type="email" required placeholder="yourname@example.com"
                  value={form.email} onChange={set('email')} autoComplete="email" />
              </Field>
              <Field label="申请季" required>
                <Chips options={SEASONS} value={form.season} onChange={set('season')} />
              </Field>
              <Field label="你最关注哪些话题？" required hint="可多选">
                <Chips multi options={TOPICS} value={form.topics} onChange={set('topics')} />
              </Field>

              <h2 className={styles.section}><span>02</span>现场选校分析</h2>
              <Field label="是否希望你的申请背景有机会被选中进行直播分析？" required>
                <Chips
                  options={[['yes', '是，我想参加现场选校分析'], ['no', '否，我只想观看直播']]}
                  value={form.wantsAnalysis === null ? '' : form.wantsAnalysis ? 'yes' : 'no'}
                  onChange={(v) => set('wantsAnalysis')(v === 'yes')}
                />
              </Field>

              {form.wantsAnalysis && (
                <div className={styles.reveal}>
                  <Field label="本科院校" required>
                    <input className={styles.input} required maxLength={120} value={form.school} onChange={set('school')} />
                  </Field>
                  <Field label="本科专业" required>
                    <Chips options={MAJORS} value={form.major} onChange={set('major')} />
                  </Field>
                  <Field label="GPA" required hint="例如 3.7/4.0 或 88/100">
                    <input className={styles.input} required maxLength={40} value={form.gpa} onChange={set('gpa')} />
                  </Field>
                  <Field label="申请方向" required hint="可多选">
                    <Chips multi options={DIRECTIONS} value={form.directions} onChange={set('directions')} />
                  </Field>
                  <Field label="你有哪些相关经历？" required hint="可多选">
                    <Chips multi options={EXPERIENCES} value={form.experiences} onChange={set('experiences')} />
                  </Field>
                  <Field label="背景补充（选填）">
                    <textarea className={styles.textarea} maxLength={2000} rows={3} value={form.note} onChange={set('note')} />
                  </Field>
                  <Field label="目标学校及项目（选填）">
                    <textarea className={styles.textarea} maxLength={1000} rows={2} value={form.targets} onChange={set('targets')} />
                  </Field>
                  <Field label="简历链接（选填）" hint="支持 Google Drive、OneDrive、Dropbox 等分享链接。请确保链接可访问，并建议提前隐藏电话、住址等敏感信息。">
                    <input className={styles.input} type="url" maxLength={500} placeholder="https://"
                      value={form.resumeUrl} onChange={set('resumeUrl')} />
                  </Field>
                  <Field label="是否同意匿名展示申请背景？" required>
                    <Chips options={CONSENTS} value={form.consent} onChange={set('consent')} />
                  </Field>
                </div>
              )}

              <h2 className={styles.section}><span>03</span>想问 CSGrad 的问题</h2>
              <Field label="你最希望直播解答什么问题？（选填）">
                <textarea className={styles.textarea} maxLength={2000} rows={3} value={form.question} onChange={set('question')} />
              </Field>

              {/* 蜜罐：真人看不到 */}
              <input className={styles.trap} tabIndex={-1} autoComplete="off" aria-hidden="true"
                value={form.website} onChange={set('website')} />

              {error && <div className={styles.error} role="alert">{error}</div>}
              <button className={styles.submit} type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? '提交中…' : '提交报名'}
              </button>
            </form>
          )}
        </div>
      </main>
    </Layout>
  );
}
