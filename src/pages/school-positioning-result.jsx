import React, { useEffect, useState, useRef } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { WORKER_BASE_URL } from '@site/src/lib/positioning/api';
import styles from './school-positioning-result.module.css';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

const COPY = {
  'zh-Hans': {
    pageTitle: '选校定位结果',
    pageDesc: '你的完整选校方案',
    backHome: '返回首页',
    backForm: '返回填写页',
    tierLabel: '你的档位',
    bucketReach: '冲刺',
    bucketReachSub: 'Reach',
    bucketMatch: '匹配',
    bucketMatchSub: 'Match',
    bucketSafety: '保底',
    bucketSafetySub: 'Safety',
    emptyBucket: '该档暂无推荐',
    viewDetail: '了解详情',
    pendingTitle: '订单处理中',
    pendingText: 'Stripe 正在确认你的付款，请稍候…',
    missingTitle: '缺少 session id',
    missingText: '请通过付款后的回跳链接打开本页面。',
    timeoutTitle: '查询超时',
    timeoutText: '订单还未完成，可能仍在处理中。请稍后通过相同链接重新打开本页面。',
    errorTitle: '加载失败',
    retry: '重试',
  },
  en: {
    pageTitle: 'Positioning Result',
    pageDesc: 'Your full school plan',
    backHome: 'Back to home',
    backForm: 'Back to form',
    tierLabel: 'Your tier',
    bucketReach: 'Reach',
    bucketReachSub: 'Reach',
    bucketMatch: 'Match',
    bucketMatchSub: 'Match',
    bucketSafety: 'Safety',
    bucketSafetySub: 'Safety',
    emptyBucket: 'No picks in this bucket',
    viewDetail: 'Learn more',
    pendingTitle: 'Processing your order',
    pendingText: 'Stripe is confirming your payment, please wait…',
    missingTitle: 'Missing session id',
    missingText: 'Please open this page via the redirect link after payment.',
    timeoutTitle: 'Polling timed out',
    timeoutText: 'The order is not finalized yet, it may still be processing. Try reopening this link in a moment.',
    errorTitle: 'Failed to load',
    retry: 'Retry',
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

function SchoolCard({ school, locale, t }) {
  const name = getLabel(school.school || school.name, locale);
  const program = getLabel(school.program, locale);
  const reason = getLabel(school.reason, locale);
  const rawHref = school.doc || school.slug || school.url || school.link;
  const href = rawHref ? encodeURI(rawHref) : null;
  return (
    <div className={styles.schoolCard}>
      <h4 className={styles.schoolName}>{name || '—'}</h4>
      {program && <p className={styles.schoolProgram}>{program}</p>}
      {reason && <p className={styles.schoolReason}>{reason}</p>}
      {href && (
        <a className={styles.schoolLink} href={href}>
          {t.viewDetail} &rarr;
        </a>
      )}
    </div>
  );
}

function Bucket({ items, title, subtitle, variantClass, locale, t }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className={`${styles.bucket} ${variantClass}`}>
      <div className={styles.bucketHeader}>
        <h3 className={styles.bucketTitle}>
          {title}
          <span className={styles.bucketSubtitle}>{subtitle}</span>
        </h3>
        <span className={styles.bucketCount}>{list.length}</span>
      </div>
      <div className={styles.schoolList}>
        {list.length === 0 ? (
          <div className={styles.emptyBucket}>{t.emptyBucket}</div>
        ) : (
          list.map((s, i) => (
            <SchoolCard key={s.id || s.slug || i} school={s} locale={locale} t={t} />
          ))
        )}
      </div>
    </div>
  );
}

function ResultBody() {
  const { i18n } = useDocusaurusContext();
  const locale = pickLocale(i18n.currentLocale);
  const t = COPY[locale];

  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('init');
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id') || params.get('sessionId');
    if (!sid) {
      setStatus('missing');
      return;
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    cancelledRef.current = false;
    let count = 0;

    const poll = async () => {
      if (cancelledRef.current) return;
      count += 1;
      setAttempt(count);
      try {
        const url = WORKER_BASE_URL + '/api/positioning/result?sessionId=' + encodeURIComponent(sessionId);
        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(text || `HTTP ${res.status}`);
        }
        const body = await res.json();
        if (cancelledRef.current) return;
        if (body && body.status === 'paid') {
          setData(body);
          setStatus('paid');
          return;
        }
        if (count >= MAX_POLLS) {
          setStatus('timeout');
          return;
        }
        setStatus('pending');
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelledRef.current) return;
        if (count >= MAX_POLLS) {
          setErrorMsg(err && err.message ? err.message : String(err));
          setStatus('error');
          return;
        }
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sessionId]);

  const retry = () => {
    setStatus('init');
    setErrorMsg('');
    setData(null);
    setAttempt(0);
    if (sessionId) {
      setSessionId(null);
      setTimeout(() => setSessionId(sessionId), 0);
    }
  };

  const formHref = locale === 'en' ? '/en/school-positioning' : '/school-positioning';
  const homeHref = locale === 'en' ? '/en/' : '/';

  if (status === 'missing') {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <a href={formHref} className={styles.backLink}>&larr; {t.backForm}</a>
          <div className={styles.statusCard}>
            <h2 className={styles.statusTitle}>{t.missingTitle}</h2>
            <p className={styles.statusText}>{t.missingText}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'paid' && data) {
    const list = data.schoolList || {};
    const tierName = data.tier || '';
    const summary = getLabel(list.summary, locale);
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <a href={homeHref} className={styles.backLink}>&larr; {t.backHome}</a>
          <div className={styles.tierHeader}>
            <p className={styles.tierLabel}>{t.tierLabel}</p>
            <h1 className={styles.tierName}>{tierName}</h1>
            {summary && <p className={styles.summary}>{summary}</p>}
          </div>
          <div className={styles.bucketsGrid}>
            <Bucket
              items={list.reach}
              title={t.bucketReach}
              subtitle={t.bucketReachSub}
              variantClass={styles.bucketReach}
              locale={locale}
              t={t}
            />
            <Bucket
              items={list.match}
              title={t.bucketMatch}
              subtitle={t.bucketMatchSub}
              variantClass={styles.bucketMatch}
              locale={locale}
              t={t}
            />
            <Bucket
              items={list.safety}
              title={t.bucketSafety}
              subtitle={t.bucketSafetySub}
              variantClass={styles.bucketSafety}
              locale={locale}
              t={t}
            />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <a href={formHref} className={styles.backLink}>&larr; {t.backForm}</a>
          <div className={styles.statusCard}>
            <h2 className={styles.statusTitle}>{t.errorTitle}</h2>
            <p className={styles.statusText}>{errorMsg}</p>
            <button className={styles.retryBtn} onClick={retry}>{t.retry}</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.container}>
          <a href={formHref} className={styles.backLink}>&larr; {t.backForm}</a>
          <div className={styles.statusCard}>
            <h2 className={styles.statusTitle}>{t.timeoutTitle}</h2>
            <p className={styles.statusText}>{t.timeoutText}</p>
            <button className={styles.retryBtn} onClick={retry}>{t.retry}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <a href={formHref} className={styles.backLink}>&larr; {t.backForm}</a>
        <div className={styles.statusCard}>
          <div className={styles.spinner} />
          <h2 className={styles.statusTitle}>{t.pendingTitle}</h2>
          <p className={styles.statusText}>
            {t.pendingText}
            {attempt > 0 ? ` (${attempt}/${MAX_POLLS})` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SchoolPositioningResultPage() {
  return (
    <Layout
      title="MSCS Positioning Result"
      description="Your full school list after positioning checkout"
    >
      <BrowserOnly fallback={<div className={styles.pageWrapper} />}>
        {() => <ResultBody />}
      </BrowserOnly>
    </Layout>
  );
}
