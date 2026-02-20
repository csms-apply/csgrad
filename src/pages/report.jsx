import React, { useState, useEffect } from 'react';
import Layout from '@theme/Layout';
import Translate, { translate } from '@docusaurus/Translate';
import ReportForm from '../components/ReportForm';
import RedemptionCodeModal from '../components/RedemptionCodeModal';
import ProgramCloud from '../components/ProgramCloud';
import ReportResults from '../components/ReportResults';
import styles from './report.module.css';

const API_BASE = 'https://csgrad-report-api.capsfly7.workers.dev';

// State machine: form → code → loading → report → error
const STEPS = { FORM: 'form', CODE: 'code', LOADING: 'loading', REPORT: 'report', ERROR: 'error' };

export default function ReportPage() {
  const [step, setStep] = useState(STEPS.FORM);
  const [userProfile, setUserProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [report, setReport] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Restore token from session storage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('csgrad_report_token');
    if (saved) setToken(saved);
  }, []);

  // Step 1: User fills in background → proceed to code verification
  function handleFormSubmit(profile) {
    setUserProfile(profile);
    if (token) {
      // Already have a valid token, go straight to loading
      generateReport(profile, token);
    } else {
      setStep(STEPS.CODE);
    }
  }

  // Step 2: Code verified → token received → generate report
  function handleCodeSuccess(newToken) {
    setToken(newToken);
    generateReport(userProfile, newToken);
  }

  // Step 3: Call API to generate report
  async function generateReport(profile, authToken) {
    setStep(STEPS.LOADING);
    setErrorMsg('');

    try {
      const resp = await fetch(`${API_BASE}/api/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(profile),
      });

      const data = await resp.json();

      if (!resp.ok) {
        // If auth expired, clear token and ask for code again
        if (resp.status === 401) {
          setToken(null);
          sessionStorage.removeItem('csgrad_report_token');
          setStep(STEPS.CODE);
          return;
        }
        throw new Error(data.error || 'Unknown error');
      }

      setReport(data.report);
      setStep(STEPS.REPORT);
    } catch (err) {
      setErrorMsg(err.message);
      setStep(STEPS.ERROR);
    }
  }

  function handleReset() {
    setStep(STEPS.FORM);
    setReport(null);
    setUserProfile(null);
    setErrorMsg('');
  }

  return (
    <Layout
      title={translate({ id: 'report.page.title', message: '选校定位报告' })}
      description={translate({
        id: 'report.page.description',
        message: '基于相似背景的精准选校定位分析',
      })}
    >
      <div className={styles.pageWrapper}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            <Translate id="report.header.title">智能选校定位报告</Translate>
          </h1>
          <p className={styles.subtitle}>
            <Translate id="report.header.subtitle">
              基于相似背景的历史申请者数据，为你精准分析 Reach / Target / Safety
            </Translate>
          </p>
        </div>

        {/* Form Step */}
        {step === STEPS.FORM && (
          <ReportForm onSubmit={handleFormSubmit} />
        )}

        {/* Code Modal */}
        {step === STEPS.CODE && (
          <RedemptionCodeModal
            onSuccess={handleCodeSuccess}
            onCancel={() => setStep(STEPS.FORM)}
          />
        )}

        {/* Loading */}
        {step === STEPS.LOADING && (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>
              <Translate id="report.loading.text">
                正在分析相似背景数据，生成定位报告...
              </Translate>
            </p>
          </div>
        )}

        {/* Report */}
        {step === STEPS.REPORT && report && (
          <div className={styles.reportContainer}>
            <ProgramCloud report={report} />
            <ReportResults report={report} userProfile={userProfile} />
            <div className={styles.resetRow}>
              <button className={styles.resetBtn} onClick={handleReset}>
                <Translate id="report.action.regenerate">重新生成报告</Translate>
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {step === STEPS.ERROR && (
          <div className={styles.errorContainer}>
            <p className={styles.errorIcon}>!</p>
            <p className={styles.errorMessage}>{errorMsg}</p>
            <button className={styles.resetBtn} onClick={handleReset}>
              <Translate id="report.action.retry">返回重试</Translate>
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
