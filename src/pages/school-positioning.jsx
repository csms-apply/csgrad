import React, { useState, useMemo, useEffect } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { classify, TIERS } from '@site/src/lib/positioning/classifier';
import { FIELD_DEFINITIONS } from '@site/src/lib/positioning/profile-schema';
import { WORKER_BASE_URL } from '@site/src/lib/positioning/api';
import styles from './school-positioning.module.css';

const PRICE_CNY = 99;
const PRICE_LABEL = '¥99';

const COPY = {
  'zh-Hans': {
    pageTitle: 'MSCS 选校定位（付费）',
    pageDesc: '基于你的背景，给出 csgrad tier 档位预估与完整选校方案',
    backHome: '返回首页',
    heroTitle: 'MSCS 选校定位',
    heroLead: '填写背景后，我们用 csgrad 内部分类模型对你的档位进行评估。免费查看你所属的 tier 档位与评估理由，付费可解锁完整选校方案（reach / match / safety 三档具体院校与推荐理由）。',
    priceLine: '完整方案',
    canceled: '订单已取消。你可以再次提交以付费查看完整选校方案。',
    errorPrefix: '出错了：',
    profileSection: '你的背景档案',
    submitBtn: '生成档位预估（免费）',
    recomputeBtn: '重新评估',
    fillRequired: '请先填写必填字段',
    previewLabel: '预估档位',
    scoreLabel: '综合得分',
    rationaleLabel: '评估依据',
    paywallTitle: '解锁完整选校方案',
    paywallText: '付费后将获得：与你档位匹配的完整学校列表（reach / match / safety 三栏）、每所学校的推荐理由、对应项目页面链接。',
    payBtn: '付费查看完整方案',
    payNote: '安全支付由 Stripe 提供。如已付款无法返回，请直接通过结果页 URL 查看。',
    paying: '正在跳转到 Stripe…',
    yes: '是',
    no: '否',
    selectPlaceholder: '请选择',
  },
  en: {
    pageTitle: 'MSCS School Positioning (Paid)',
    pageDesc: 'Tier estimation and full school list based on your profile',
    backHome: 'Back to home',
    heroTitle: 'MSCS School Positioning',
    heroLead: 'Fill in your profile and we will estimate your csgrad tier using our internal classifier. The tier and reasoning are free. Pay to unlock the full school list across reach / match / safety.',
    priceLine: 'Full plan',
    canceled: 'Order canceled. You can submit again to pay and unlock the full plan.',
    errorPrefix: 'Error: ',
    profileSection: 'Your profile',
    submitBtn: 'Estimate my tier (free)',
    recomputeBtn: 'Re-evaluate',
    fillRequired: 'Please fill in the required fields first',
    previewLabel: 'Estimated tier',
    scoreLabel: 'Composite score',
    rationaleLabel: 'Why this tier',
    paywallTitle: 'Unlock the full school list',
    paywallText: 'After paying you get: the full list of schools matched to your tier (reach / match / safety), reasoning for each pick, and links to the program pages.',
    payBtn: 'Pay to view full plan',
    payNote: 'Secure checkout by Stripe. If you cannot return automatically, open the result page URL directly.',
    paying: 'Redirecting to Stripe…',
    yes: 'Yes',
    no: 'No',
    selectPlaceholder: 'Select…',
  },
};

function pickLocale(loc) {
  return loc === 'en' ? 'en' : 'zh-Hans';
}

function getLabel(node, locale) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  return node[locale] || node['zh-Hans'] || node.en || '';
}

function initialFieldValue(f) {
  if (f.type === 'select') {
    return f.options && f.options.length > 0 ? f.options[0].value : '';
  }
  if (f.type === 'number') return '';
  if (f.type === 'boolean') return false;
  if (f.type === 'group') {
    const obj = {};
    for (const sf of f.fields || []) {
      obj[sf.key] = initialFieldValue(sf);
    }
    return obj;
  }
  return '';
}

function buildInitialProfile(fields) {
  const initial = {};
  for (const f of fields) {
    initial[f.key] = initialFieldValue(f);
  }
  return initial;
}

function getGpaBounds(profile) {
  const scale = String((profile && profile.gpaScale) ?? '');
  if (scale === '100') return { min: 0, max: 100 };
  if (scale === '5' || scale === '5.0') return { min: 0, max: 5 };
  if (scale === '4.3') return { min: 0, max: 4.3 };
  return { min: 0, max: 4 };
}

function validateOne(f, v, profile, t) {
  if (f.required) {
    const empty = v === '' || v === null || v === undefined;
    if (empty) return t.fillRequired;
  }
  if (f.type === 'number' && v !== '' && v !== null && v !== undefined) {
    const num = Number(v);
    if (Number.isNaN(num)) return t.fillRequired;
    if (f.key === 'gpa') {
      const { min, max } = getGpaBounds(profile);
      if (num < min || num > max) return `${min}–${max}`;
    } else if (typeof f.min === 'number' && num < f.min) {
      return `>= ${f.min}`;
    } else if (typeof f.max === 'number' && num > f.max) {
      return `<= ${f.max}`;
    }
  }
  return null;
}

function validate(profile, fields, t) {
  const errors = {};
  for (const f of fields) {
    if (f.type === 'group') {
      const sub = profile[f.key] || {};
      for (const sf of f.fields || []) {
        const e = validateOne(sf, sub[sf.key], profile, t);
        if (e) errors[`${f.key}.${sf.key}`] = e;
      }
      continue;
    }
    const e = validateOne(f, profile[f.key], profile, t);
    if (e) errors[f.key] = e;
  }
  return errors;
}

function coerceProfile(profile, fields) {
  const out = {};
  for (const f of fields) {
    const v = profile[f.key];
    if (f.type === 'number') {
      out[f.key] = v === '' || v === null || v === undefined ? null : Number(v);
    } else if (f.type === 'group') {
      const sub = v || {};
      const subOut = {};
      let hasValue = false;
      for (const sf of f.fields || []) {
        const sv = sub[sf.key];
        if (sf.type === 'number') {
          if (sv === '' || sv === null || sv === undefined) {
            subOut[sf.key] = null;
          } else {
            subOut[sf.key] = Number(sv);
            hasValue = true;
          }
        } else {
          subOut[sf.key] = sv;
          if (sv !== '' && sv !== null && sv !== undefined && sv !== false) hasValue = true;
        }
      }
      out[f.key] = hasValue ? subOut : null;
    } else {
      out[f.key] = v;
    }
  }
  return out;
}

function FormBody() {
  const { i18n } = useDocusaurusContext();
  const locale = pickLocale(i18n.currentLocale);
  const t = COPY[locale];

  const fields = FIELD_DEFINITIONS || [];

  const [profile, setProfile] = useState(() => buildInitialProfile(fields));
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [paying, setPaying] = useState(false);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('canceled') === '1') {
      setCanceled(true);
    }
  }, []);

  const errors = useMemo(() => validate(profile, fields, t), [profile, fields, t]);
  const hasErrors = Object.keys(errors).length > 0;

  const setValue = (key, value) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const setGroupValue = (groupKey, subKey, value) => {
    setProfile((p) => ({
      ...p,
      [groupKey]: { ...(p[groupKey] || {}), [subKey]: value },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    setErrorMsg('');
    if (hasErrors) {
      setPreview(null);
      return;
    }
    try {
      const result = classify(coerceProfile(profile, fields));
      setPreview(result);
      setTimeout(() => {
        const el = document.getElementById('positioning-preview');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (err) {
      setErrorMsg(err && err.message ? err.message : String(err));
    }
  };

  const handlePay = async () => {
    setErrorMsg('');
    setPaying(true);
    try {
      const res = await fetch(WORKER_BASE_URL + '/api/positioning/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coerceProfile(profile, fields)),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data || !data.checkoutUrl) {
        throw new Error('No checkout URL returned');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setPaying(false);
      setErrorMsg(err && err.message ? err.message : String(err));
    }
  };

  const renderNumberInput = (f, value, onChange, hasErr) => {
    let min, max, step;
    if (f.key === 'gpa') {
      const b = getGpaBounds(profile);
      min = b.min;
      max = b.max;
      step = 0.01;
    } else {
      min = typeof f.min === 'number' ? f.min : undefined;
      max = typeof f.max === 'number' ? f.max : undefined;
      step = typeof f.step === 'number' ? f.step : 'any';
    }
    return (
      <input
        id={`f-${f.key}`}
        className={`${styles.input} ${hasErr ? styles.inputError : ''}`}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  };

  const renderField = (f) => {
    const label = getLabel(f.label, locale);
    const help = f.help ? getLabel(f.help, locale) : '';
    const errKey = touched ? errors[f.key] : undefined;
    const hasErr = Boolean(errKey);
    const inputCls = `${styles.input} ${hasErr ? styles.inputError : ''}`;
    const selectCls = `${styles.select} ${hasErr ? styles.inputError : ''}`;

    if (f.type === 'group') {
      const groupVal = profile[f.key] || {};
      return (
        <div key={f.key} className={styles.field} style={{ gridColumn: '1 / -1' }}>
          <label className={styles.label}>
            {label}
            {f.required && <span className={styles.required}>*</span>}
          </label>
          {help && <div className={styles.help} style={{ marginTop: 0, marginBottom: 8 }}>{help}</div>}
          <div className={styles.grid}>
            {(f.fields || []).map((sf) => {
              const subErr = touched ? errors[`${f.key}.${sf.key}`] : undefined;
              const subHasErr = Boolean(subErr);
              const subLabel = getLabel(sf.label, locale);
              return (
                <div key={sf.key} className={styles.field}>
                  <label htmlFor={`f-${f.key}-${sf.key}`} className={styles.label}>
                    {subLabel}
                  </label>
                  <input
                    id={`f-${f.key}-${sf.key}`}
                    className={`${styles.input} ${subHasErr ? styles.inputError : ''}`}
                    type={sf.type === 'number' ? 'number' : 'text'}
                    inputMode={sf.type === 'number' ? 'decimal' : undefined}
                    min={typeof sf.min === 'number' ? sf.min : undefined}
                    max={typeof sf.max === 'number' ? sf.max : undefined}
                    step={typeof sf.step === 'number' ? sf.step : (sf.type === 'number' ? 'any' : undefined)}
                    value={groupVal[sf.key] ?? ''}
                    onChange={(e) => setGroupValue(f.key, sf.key, e.target.value)}
                  />
                  {subHasErr && <div className={styles.errorText}>{subErr}</div>}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (f.type === 'boolean') {
      return (
        <div key={f.key} className={styles.field}>
          <div className={styles.checkboxRow}>
            <input
              id={`f-${f.key}`}
              className={styles.checkbox}
              type="checkbox"
              checked={Boolean(profile[f.key])}
              onChange={(e) => setValue(f.key, e.target.checked)}
            />
            <label htmlFor={`f-${f.key}`} className={styles.checkboxLabel}>
              {label}
              {f.required && <span className={styles.required}>*</span>}
            </label>
          </div>
          {help && <div className={styles.help}>{help}</div>}
        </div>
      );
    }

    if (f.type === 'select') {
      const opts = f.options || [];
      return (
        <div key={f.key} className={styles.field}>
          <label htmlFor={`f-${f.key}`} className={styles.label}>
            {label}
            {f.required && <span className={styles.required}>*</span>}
          </label>
          <select
            id={`f-${f.key}`}
            className={selectCls}
            value={profile[f.key] ?? ''}
            onChange={(e) => setValue(f.key, e.target.value)}
          >
            {opts.map((o) => (
              <option key={String(o.value)} value={o.value}>
                {getLabel(o.label, locale)}
              </option>
            ))}
          </select>
          {help && <div className={styles.help}>{help}</div>}
          {hasErr && <div className={styles.errorText}>{errKey}</div>}
        </div>
      );
    }

    if (f.type === 'number') {
      return (
        <div key={f.key} className={styles.field}>
          <label htmlFor={`f-${f.key}`} className={styles.label}>
            {label}
            {f.required && <span className={styles.required}>*</span>}
          </label>
          {renderNumberInput(f, profile[f.key], (v) => setValue(f.key, v), hasErr)}
          {help && <div className={styles.help}>{help}</div>}
          {hasErr && <div className={styles.errorText}>{errKey}</div>}
        </div>
      );
    }

    return (
      <div key={f.key} className={styles.field}>
        <label htmlFor={`f-${f.key}`} className={styles.label}>
          {label}
          {f.required && <span className={styles.required}>*</span>}
        </label>
        <input
          id={`f-${f.key}`}
          className={inputCls}
          type="text"
          value={profile[f.key] ?? ''}
          onChange={(e) => setValue(f.key, e.target.value)}
        />
        {help && <div className={styles.help}>{help}</div>}
        {hasErr && <div className={styles.errorText}>{errKey}</div>}
      </div>
    );
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <a href={locale === 'en' ? '/en/' : '/'} className={styles.backLink}>
          &larr; {t.backHome}
        </a>

        <div className={styles.hero}>
          <h1 className={styles.title}>{t.heroTitle}</h1>
          <p className={styles.lead}>{t.heroLead}</p>
          <span className={styles.pricePill}>
            {t.priceLine} <span className={styles.priceAmount}>{PRICE_LABEL}</span>
          </span>
        </div>

        {canceled && (
          <div className={`${styles.banner} ${styles.bannerCanceled}`}>{t.canceled}</div>
        )}
        {errorMsg && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            {t.errorPrefix}{errorMsg}
          </div>
        )}

        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <h2 className={styles.sectionTitle}>{t.profileSection}</h2>
          <div className={styles.grid}>
            {fields.map(renderField)}
          </div>
          <div className={styles.submitRow}>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={paying}
            >
              {preview ? t.recomputeBtn : t.submitBtn}
            </button>
          </div>
        </form>

        {preview && (
          <div id="positioning-preview" className={styles.previewCard}>
            <p className={styles.previewLabel}>{t.previewLabel}</p>
            <p className={styles.previewTier}>{preview.tier}</p>
            {typeof preview.score === 'number' && (
              <p className={styles.previewScore}>
                {t.scoreLabel}: {preview.score.toFixed(2)}
              </p>
            )}
            <div className={styles.rationale}>
              <strong>{t.rationaleLabel}</strong>
              {Array.isArray(preview.rationale) ? (
                <ul className={styles.rationaleList}>
                  {preview.rationale.map((r, i) => (
                    <li key={i}>{typeof r === 'string' ? r : getLabel(r, locale)}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '6px 0 0' }}>
                  {typeof preview.rationale === 'string'
                    ? preview.rationale
                    : getLabel(preview.rationale, locale)}
                </p>
              )}
            </div>

            <div className={styles.paywall}>
              <p className={styles.paywallTitle}>{t.paywallTitle}</p>
              <p className={styles.paywallText}>{t.paywallText}</p>
              <button
                type="button"
                className={styles.payBtn}
                onClick={handlePay}
                disabled={paying}
              >
                {paying ? t.paying : `${t.payBtn} · ${PRICE_LABEL}`}
              </button>
              <p className={styles.payNote}>{t.payNote}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SchoolPositioningPage() {
  return (
    <Layout
      title="MSCS School Positioning"
      description="Paid MSCS school positioning based on csgrad tier classifier"
    >
      <BrowserOnly fallback={<div className={styles.pageWrapper} />}>
        {() => <FormBody />}
      </BrowserOnly>
    </Layout>
  );
}
