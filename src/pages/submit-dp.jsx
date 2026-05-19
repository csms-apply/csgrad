import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {
  DP_API_BASE,
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
import styles from './submit-dp.module.css';

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
  // serialize arrays to JSON strings (backend stores TEXT)
  for (const k of ['cs_courses', 'rec1_tags', 'rec2_tags', 'rec3_tags', 'rec4_tags', 'rec5_tags']) {
    payload[k] = JSON.stringify(f[k] || []);
  }
  // empty strings → null
  for (const k of Object.keys(payload)) {
    if (payload[k] === '') payload[k] = null;
  }
  return payload;
}

function Inner() {
  const [me, setMe] = useState(null);
  const [meChecked, setMeChecked] = useState(false);
  const [applicant, setApplicant] = useState(null);
  const [form, setForm] = useState(EMPTY_APPLICANT);
  const [savingApplicant, setSavingApplicant] = useState(false);
  const [msg, setMsg] = useState(null);

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
        } catch (e) {
          // not signed in → 401 — already handled above
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!meChecked) return <div className={styles.loading}>加载中…</div>;
  if (!me) return <SignInGate />;

  const locked = Boolean(applicant?.lockedAt && me.role !== 'admin');

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function toggleArrayValue(k, value) {
    setForm((prev) => {
      const arr = prev[k] || [];
      const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
      return { ...prev, [k]: next };
    });
  }

  async function saveApplicant() {
    setSavingApplicant(true);
    setMsg(null);
    try {
      const payload = formToPayload(form);
      if (applicant) {
        await updateMyApplicant(payload);
        setMsg({ type: 'ok', text: '已保存（如已锁定需要 admin 解锁才能再改）' });
      } else {
        const r = await createMyApplicant(payload);
        setApplicant(r.row);
        setMsg({ type: 'ok', text: '档案已创建并锁定。下面可以提交 DP 了。' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: `保存失败：${e.message}` });
    } finally {
      setSavingApplicant(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1>提交 DataPoints</h1>
          <span className={styles.meBadge}>👤 {me.nickname}{me.role === 'admin' ? ' · admin' : ''}</span>
        </div>
        <p className={styles.lead}>
          先填一次<strong>申请者背景档案</strong>，再提交每个项目的录取数据点。
          档案一经保存即锁定（防止历史 DP 背景信息漂移），如需修改请联系 admin。
        </p>
        {msg ? <p className={msg.type === 'ok' ? styles.ok : styles.err}>{msg.text}</p> : null}
      </header>

      <ApplicantForm
        form={form}
        setField={setField}
        toggleArrayValue={toggleArrayValue}
        locked={locked}
        onSave={saveApplicant}
        saving={savingApplicant}
        hasExisting={Boolean(applicant)}
      />

      {applicant ? (
        <DpAddArea applicantId={applicant.id} />
      ) : (
        <section className={styles.section}>
          <h2>步骤 2 · 提交 DataPoints</h2>
          <p className={styles.muted}>请先保存上方的背景档案。</p>
        </section>
      )}
    </div>
  );
}

function SignInGate() {
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
    <div className={styles.gate}>
      <h2>需要登录</h2>
      <p>用 Google 或 GitHub 登录后才能提交 DataPoints。</p>
      <div className={styles.signInGroup}>
        <button className={styles.signInBtn} onClick={() => signIn('google')}>Google 登录</button>
        <button className={styles.signInBtn} onClick={() => signIn('github')}>GitHub 登录</button>
      </div>
    </div>
  );
}

// ---------- applicant form ----------

function ApplicantForm({ form, setField, toggleArrayValue, locked, onSave, saving, hasExisting }) {
  return (
    <section className={styles.section}>
      <h2>步骤 1 · 申请者背景档案 {locked ? <span className={styles.lockBadge}>🔒 已锁定</span> : null}</h2>

      <fieldset disabled={locked} className={styles.fieldset}>
        <Group title="教育背景">
          <Select label="本科学校类别" value={form.ug_school_category} onChange={(v) => setField('ug_school_category', v)} options={UG_CATEGORIES} />
          <Text label="本科学校名称" value={form.ug_school_name} onChange={(v) => setField('ug_school_name', v)} />
          <Number label="毕业年份" value={form.graduation_year} onChange={(v) => setField('graduation_year', v)} />
          <Select label="本科专业" value={form.ug_major} onChange={(v) => setField('ug_major', v)} options={UG_MAJORS} />
          <Check label="荣誉学院" value={form.honors_college} onChange={(v) => setField('honors_college', v)} />
          <Check label="海外交换" value={form.exchange_abroad} onChange={(v) => setField('exchange_abroad', v)} />
          <Check label="陆本海本双学位" value={form.dual_degree} onChange={(v) => setField('dual_degree', v)} />
          <LongText label="教育背景备注" value={form.education_notes} onChange={(v) => setField('education_notes', v)} />
        </Group>

        <Group title="核心课程修读">
          <MultiCheck options={CS_COURSES} value={form.cs_courses} onToggle={(o) => toggleArrayValue('cs_courses', o)} />
        </Group>

        <Group title="GPA">
          <Select label="本科分数制" value={form.gpa_scale} onChange={(v) => setField('gpa_scale', v)} options={GPA_SCALES} />
          <Number label="本科 GPA" value={form.gpa} onChange={(v) => setField('gpa', v)} step="0.01" />
          <Select label="本科 GPA 排名" value={form.gpa_rank} onChange={(v) => setField('gpa_rank', v)} options={GPA_RANKS} />
          <LongText label="GPA 备注" value={form.gpa_notes} onChange={(v) => setField('gpa_notes', v)} />
        </Group>

        <Group title="TOEFL">
          <Number label="总分" value={form.toefl_total} onChange={(v) => setField('toefl_total', v)} />
          <Number label="阅读" value={form.toefl_reading} onChange={(v) => setField('toefl_reading', v)} />
          <Number label="听力" value={form.toefl_listening} onChange={(v) => setField('toefl_listening', v)} />
          <Number label="口语" value={form.toefl_speaking} onChange={(v) => setField('toefl_speaking', v)} />
          <Number label="写作" value={form.toefl_writing} onChange={(v) => setField('toefl_writing', v)} />
        </Group>

        <Group title="IELTS">
          <Number label="总分" value={form.ielts_total} onChange={(v) => setField('ielts_total', v)} step="0.5" />
          <Number label="阅读" value={form.ielts_reading} onChange={(v) => setField('ielts_reading', v)} step="0.5" />
          <Number label="听力" value={form.ielts_listening} onChange={(v) => setField('ielts_listening', v)} step="0.5" />
          <Number label="口语" value={form.ielts_speaking} onChange={(v) => setField('ielts_speaking', v)} step="0.5" />
          <Number label="写作" value={form.ielts_writing} onChange={(v) => setField('ielts_writing', v)} step="0.5" />
        </Group>

        <Group title="GRE">
          <Number label="总分" value={form.gre_total} onChange={(v) => setField('gre_total', v)} />
          <Number label="数学" value={form.gre_quant} onChange={(v) => setField('gre_quant', v)} />
          <Number label="语文" value={form.gre_verbal} onChange={(v) => setField('gre_verbal', v)} />
          <Number label="写作" value={form.gre_writing} onChange={(v) => setField('gre_writing', v)} step="0.5" />
        </Group>

        <Group title="科研经历">
          <Number label="国内段数" value={form.research_domestic_count} onChange={(v) => setField('research_domestic_count', v)} />
          <Number label="海外段数" value={form.research_overseas_count} onChange={(v) => setField('research_overseas_count', v)} />
          <LongText label="科研经历介绍" value={form.research_notes} onChange={(v) => setField('research_notes', v)} />
        </Group>

        <Group title="实习经历">
          <Number label="国内段数" value={form.internship_domestic_count} onChange={(v) => setField('internship_domestic_count', v)} />
          <Number label="海外段数" value={form.internship_overseas_count} onChange={(v) => setField('internship_overseas_count', v)} />
          <LongText label="实习经历介绍" value={form.internship_notes} onChange={(v) => setField('internship_notes', v)} />
        </Group>

        <Group title="推荐信（每封信可勾多个标签）">
          {[1, 2, 3, 4, 5].map((n) => (
            <RecLetterRow
              key={n}
              num={n}
              value={form[`rec${n}_tags`]}
              onToggle={(o) => toggleArrayValue(`rec${n}_tags`, o)}
            />
          ))}
          <LongText label="推荐信介绍" value={form.rec_notes} onChange={(v) => setField('rec_notes', v)} />
        </Group>

        <Group title="科研产出">
          <Check label="已发表顶会一作" value={form.pub_top_first_author} onChange={(v) => setField('pub_top_first_author', v)} />
          <Check label="已发表顶会其他作者" value={form.pub_top_other_author} onChange={(v) => setField('pub_top_other_author', v)} />
          <Check label="在投顶会一作" value={form.submission_top_first_author} onChange={(v) => setField('submission_top_first_author', v)} />
          <Check label="在投顶会其他作者" value={form.submission_top_other_author} onChange={(v) => setField('submission_top_other_author', v)} />
          <LongText label="Pub 情况" value={form.pub_notes} onChange={(v) => setField('pub_notes', v)} />
        </Group>

        <Group title="其他">
          <LongText label="其他软背景" value={form.other_soft_background} onChange={(v) => setField('other_soft_background', v)} />
          <LongText label="个人主页 / 联系方式（仅 admin 可见）" value={form.contact_info} onChange={(v) => setField('contact_info', v)} />
        </Group>
      </fieldset>

      <div className={styles.actions}>
        <button className={styles.primaryBtn} disabled={locked || saving} onClick={onSave}>
          {saving ? '保存中…' : hasExisting ? '更新档案' : '创建档案（一次性，提交即锁定）'}
        </button>
      </div>
    </section>
  );
}

function RecLetterRow({ num, value, onToggle }) {
  const opts = num >= 4 ? REC_TAGS_WITH_NONE : REC_TAGS;
  return (
    <div className={styles.recRow}>
      <div className={styles.recLabel}>推荐信 {num}</div>
      <div className={styles.tagWrap}>
        {opts.map((o) => (
          <button
            key={o}
            type="button"
            className={`${styles.tag} ${(value || []).includes(o) ? styles.tagActive : ''}`}
            onClick={() => onToggle(o)}
            title={o}
          >
            {o.length > 20 ? o.slice(0, 18) + '…' : o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- DP add area ----------

function DpAddArea({ applicantId }) {
  const [programs, setPrograms] = useState([]);
  const [progQuery, setProgQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [dp, setDp] = useState({
    result: '', is_funded: false, is_final_destination: false,
    academic_year: new Date().getFullYear(),
    semester: 'Fall',
    notified_at: '', submitted_at: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recent, setRecent] = useState([]);

  // initial programs load (small page; rely on search for full list)
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

  async function submit() {
    if (!selectedProgram) {
      setMsg({ type: 'err', text: '请先选择项目' });
      return;
    }
    if (!dp.result) {
      setMsg({ type: 'err', text: '请选择结果' });
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
      setMsg({ type: 'ok', text: `已提交：${selectedProgram.school} ${selectedProgram.program} → ${dp.result}` });
      // reset for next entry, keep year/semester
      setSelectedProgram(null);
      setProgQuery('');
      setDp((prev) => ({ ...prev, result: '', is_funded: false, is_final_destination: false, notified_at: '', submitted_at: '', notes: '' }));
    } catch (e) {
      setMsg({ type: 'err', text: `提交失败：${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.section}>
      <h2>步骤 2 · 提交 DataPoints（可重复提交多条）</h2>
      {msg ? <p className={msg.type === 'ok' ? styles.ok : styles.err}>{msg.text}</p> : null}

      <div className={styles.dpForm}>
        <div className={styles.programSearch}>
          <label>项目（搜学校或 program 名）</label>
          <input
            className={styles.input}
            placeholder="如 stanford mscs / CMU MIIS"
            value={selectedProgram ? `${selectedProgram.school} · ${selectedProgram.program}` : progQuery}
            onChange={(e) => { setSelectedProgram(null); setProgQuery(e.target.value); }}
          />
          {!selectedProgram && progQuery && filteredPrograms.length > 0 ? (
            <ul className={styles.progDropdown}>
              {filteredPrograms.map((p) => (
                <li key={p.id} onClick={() => { setSelectedProgram(p); setProgQuery(''); }}>
                  <b>{p.school}</b> · {p.program}
                  {p.tier ? <span className={styles.tierBadge}>{p.tier}</span> : null}
                  {p.degree ? <span className={styles.muted}> {p.degree}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className={styles.row}>
          <Select label="结果" value={dp.result} onChange={(v) => setDp({ ...dp, result: v })} options={RESULTS} />
          <Number label="学年" value={dp.academic_year} onChange={(v) => setDp({ ...dp, academic_year: v })} />
          <Select label="学期" value={dp.semester} onChange={(v) => setDp({ ...dp, semester: v })} options={SEMESTERS} />
          <Check label="带奖" value={dp.is_funded} onChange={(v) => setDp({ ...dp, is_funded: v })} />
          <Check label="最终去向" value={dp.is_final_destination} onChange={(v) => setDp({ ...dp, is_final_destination: v })} />
        </div>
        <div className={styles.row}>
          <Date label="通知时间" value={dp.notified_at} onChange={(v) => setDp({ ...dp, notified_at: v })} />
          <Date label="网申提交时间" value={dp.submitted_at} onChange={(v) => setDp({ ...dp, submitted_at: v })} />
        </div>
        <LongText label="补充说明 / 面试 / 联系等" value={dp.notes} onChange={(v) => setDp({ ...dp, notes: v })} />

        <div className={styles.actions}>
          <button className={styles.primaryBtn} disabled={saving} onClick={submit}>
            {saving ? '提交中…' : '提交这条 DP'}
          </button>
          <a className={styles.secondaryLink} href="/my-dp">查看我提交过的 DP →</a>
        </div>
      </div>

      {recent.length > 0 ? (
        <div className={styles.recentList}>
          <h3>本次会话刚提交的</h3>
          <ul>
            {recent.map((r) => (
              <li key={r.id}>
                <span className={styles.pillSmall}>{r.result}</span> {r.programSchool} · {r.programName}
                {r.is_funded ? <span className={styles.badge}>奖</span> : null}
                {r.is_final_destination ? <span className={styles.badge}>最终</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

// ---------- form primitives ----------

function Group({ title, children }) {
  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <div className={styles.groupBody}>{children}</div>
    </div>
  );
}

function Text({ label, value, onChange }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input className={styles.input} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Number({ label, value, onChange, step }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input type="number" step={step || '1'} className={styles.input} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Date({ label, value, onChange }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input type="date" className={styles.input} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select className={styles.input} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">（请选择）</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Check({ label, value, onChange }) {
  return (
    <label className={styles.checkField}>
      <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function LongText({ label, value, onChange }) {
  return (
    <label className={`${styles.field} ${styles.longTextField}`}>
      <span>{label}</span>
      <textarea className={styles.textarea} rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function MultiCheck({ options, value, onToggle }) {
  return (
    <div className={styles.multiCheck}>
      {options.map((o) => (
        <label key={o} className={styles.multiCheckItem}>
          <input type="checkbox" checked={(value || []).includes(o)} onChange={() => onToggle(o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

export default function SubmitDp() {
  return (
    <Layout title="提交 DataPoints" description="csgrad DataPoints submission form">
      <BrowserOnly>{() => <Inner />}</BrowserOnly>
    </Layout>
  );
}
