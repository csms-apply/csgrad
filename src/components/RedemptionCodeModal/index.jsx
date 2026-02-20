import React, { useState } from 'react';
import Translate, { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';

const API_BASE = 'https://csgrad-report-api.capsfly7.workers.dev';

export default function RedemptionCodeModal({ onSuccess, onCancel }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) {
      setError(translate({ id: 'report.code.errorEmpty', message: '请输入兑换码' }));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resp = await fetch(`${API_BASE}/api/validate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || translate({ id: 'report.code.errorGeneric', message: '验证失败，请重试' }));
        return;
      }

      // Store token in sessionStorage
      sessionStorage.setItem('csgrad_report_token', data.token);
      onSuccess(data.token);
    } catch {
      setError(translate({ id: 'report.code.errorNetwork', message: '网络错误，请检查网络连接' }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">
          &times;
        </button>

        <h3 className={styles.title}>
          <Translate id="report.code.title">输入兑换码</Translate>
        </h3>
        <p className={styles.desc}>
          <Translate id="report.code.desc">
            请输入你的兑换码以生成选校定位报告
          </Translate>
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className={`${styles.codeInput} ${error ? styles.inputError : ''}`}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder={translate({ id: 'report.code.placeholder', message: '请输入兑换码' })}
            autoFocus
            maxLength={20}
          />
          {error && <p className={styles.errorText}>{error}</p>}

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading
              ? translate({ id: 'report.code.verifying', message: '验证中...' })
              : translate({ id: 'report.code.verify', message: '验证' })}
          </button>
        </form>
      </div>
    </div>
  );
}
