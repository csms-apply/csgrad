import React, { useState } from 'react';
import Translate, { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';

const CATEGORY_CONFIG = {
  safety: {
    label: () => translate({ id: 'report.results.safety', message: '保底 Safety' }),
    color: '#45b060',
    bg: '#e8f5ec',
    darkBg: '#1e3025',
    icon: '🟢',
  },
  target: {
    label: () => translate({ id: 'report.results.target', message: '主申 Target' }),
    color: '#e8a830',
    bg: '#fef8e8',
    darkBg: '#302818',
    icon: '🟡',
  },
  reach: {
    label: () => translate({ id: 'report.results.reach', message: '冲刺 Reach' }),
    color: '#e05040',
    bg: '#fdeeed',
    darkBg: '#301818',
    icon: '🔴',
  },
  insufficient: {
    label: () => translate({ id: 'report.results.insufficient', message: '数据不足' }),
    color: '#999',
    bg: '#f0f0f0',
    darkBg: '#252525',
    icon: '⚪',
  },
};

function ProgramCard({ program, config, isReach }) {
  const [expanded, setExpanded] = useState(false);
  const hasDatapoints = program.datapoints && program.datapoints.length > 0;

  return (
    <div className={styles.programCard}>
      <div
        className={styles.programHeader}
        onClick={() => hasDatapoints && setExpanded(!expanded)}
        style={{ cursor: hasDatapoints ? 'pointer' : 'default' }}
      >
        <div className={styles.programInfo}>
          <span className={styles.programSchool}>{program.school}</span>
          <span className={styles.programName}>{program.program}</span>
        </div>
        <div className={styles.programStats}>
          {!isReach && (
            <>
              <span className={styles.rateLabel}>
                {translate({ id: 'report.results.admissionRate', message: '录取率' })}
              </span>
              <span
                className={styles.rateValue}
                style={{ color: config.color }}
              >
                {program.admissionRate}%
              </span>
              <span className={styles.rateFraction}>
                ({program.admittedCount}/{program.totalApplicants})
              </span>
            </>
          )}
          {hasDatapoints && (
            <span className={styles.expandIcon}>{expanded ? '▾' : '▸'}</span>
          )}
        </div>
      </div>

      {expanded && hasDatapoints && (
        <div className={styles.datapointsList}>
          <div className={styles.datapointsHeader}>
            <span><Translate id="report.results.dp.applicant">申请者</Translate></span>
            <span>GPA</span>
            <span><Translate id="report.results.dp.schoolTier">本科档次</Translate></span>
            <span><Translate id="report.results.dp.internships">实习</Translate></span>
            <span><Translate id="report.results.dp.result">结果</Translate></span>
          </div>
          {program.datapoints.map((dp, i) => (
            <div key={i} className={styles.datapointRow}>
              <span>{dp.applicantLabel}</span>
              <span>{dp.applicantGpa ?? '-'}</span>
              <span>{dp.applicantSchoolTier ?? '-'}</span>
              <span>{dp.internships ?? '-'}</span>
              <span className={dp.admitted ? styles.resultAdmit : styles.resultReject}>
                {dp.result}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category, programs }) {
  const config = CATEGORY_CONFIG[category];
  if (!programs || programs.length === 0) return null;
  const isReach = category === 'reach';

  return (
    <div className={styles.categorySection}>
      <div
        className={styles.categoryHeader}
        style={{ borderLeftColor: config.color }}
      >
        <span className={styles.categoryIcon}>{config.icon}</span>
        <span className={styles.categoryLabel}>{config.label()}</span>
        <span className={styles.categoryCount}>
          {programs.length} {translate({ id: 'report.results.programs', message: '个项目' })}
        </span>
      </div>
      {isReach && (
        <p className={styles.reachNote}>
          <Translate id="report.results.reachNote">
            冲刺项目的录取比较 case by case，不能简单刻舟求剑，以下仅供参考
          </Translate>
        </p>
      )}
      <div className={styles.categoryBody}>
        {programs.map((p, i) => (
          <ProgramCard key={`${p.school}-${p.program}-${i}`} program={p} config={config} isReach={isReach} />
        ))}
      </div>
    </div>
  );
}

function ProfileSummary({ userProfile }) {
  if (!userProfile) return null;

  const parts = [];
  if (userProfile.schoolTier) parts.push(userProfile.schoolTier);
  if (userProfile.major) parts.push(userProfile.major);

  const gpaScale = userProfile.gpaScale || '4.0';
  if (userProfile.gpa) {
    parts.push(`GPA ${userProfile.gpa}/${gpaScale}`);
  }

  if (userProfile.researchCount && userProfile.researchCount !== '0') {
    let researchText = translate({ id: 'report.results.profile.research', message: '科研{count}段' }).replace('{count}', userProfile.researchCount);
    if (userProfile.researchDuration) {
      researchText += `(${userProfile.researchDuration})`;
    }
    parts.push(researchText);
  }
  if (userProfile.paper && userProfile.paper !== '无') {
    parts.push(
      translate({ id: 'report.results.profile.paper', message: '论文: {status}' }).replace('{status}', userProfile.paper)
    );
  }
  if (userProfile.lorStrength) {
    parts.push(userProfile.lorStrength);
  }
  if (userProfile.bigCompanyIntern) {
    parts.push(translate({ id: 'report.results.profile.bigIntern', message: '有大厂实习' }));
  }
  if (userProfile.toefl) {
    parts.push(`TOEFL ${userProfile.toefl}`);
  }
  if (userProfile.gre) {
    parts.push(`GRE ${userProfile.gre}`);
  }

  if (parts.length === 0) return null;

  return (
    <div className={styles.profileSummary}>
      {parts.join(' · ')}
    </div>
  );
}

export default function ReportResults({ report, userProfile }) {
  const { stats, gpaRange, disclaimer } = report;

  return (
    <div className={styles.results}>
      {/* Summary Stats */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.totalApplicants}</span>
          <span className={styles.statLabel}>
            <Translate id="report.results.similarApplicants">相似申请者</Translate>
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.totalPrograms}</span>
          <span className={styles.statLabel}>
            <Translate id="report.results.totalPrograms">涉及项目</Translate>
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.totalDatapoints}</span>
          <span className={styles.statLabel}>
            <Translate id="report.results.totalDatapoints">数据点</Translate>
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            {gpaRange[0].toFixed(2)} - {gpaRange[1].toFixed(2)}
          </span>
          <span className={styles.statLabel}>
            <Translate id="report.results.gpaRange">GPA 匹配范围</Translate>
          </span>
        </div>
      </div>

      {/* User Profile Summary */}
      <ProfileSummary userProfile={userProfile} />

      {/* Categorized Results */}
      <CategorySection category="reach" programs={report.reach} />
      <CategorySection category="target" programs={report.target} />
      <CategorySection category="safety" programs={report.safety} />

      {/* Disclaimer */}
      <p className={styles.disclaimer}>{disclaimer}</p>
    </div>
  );
}
