import React, { useState } from 'react';
import Translate, { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';

const GPA_SCALES = [
  { value: '4.0', label: '4.0' },
  { value: '4.3', label: '4.3' },
  { value: '5.0', label: '5.0' },
  { value: '100', label: translate({ id: 'report.form.scale100', message: '百分制' }) },
];

const SCHOOL_TIERS = [
  { value: '清北', label: translate({ id: 'report.form.tier.qingbei', message: '清北' }) },
  { value: '华五', label: translate({ id: 'report.form.tier.huawu', message: '华五' }) },
  { value: '国科/上科/南科', label: translate({ id: 'report.form.tier.guoke', message: '国科/上科/南科' }) },
  { value: '10043', label: '10043' },
  { value: '985', label: '985' },
  { value: '211', label: '211' },
  { value: '双非', label: translate({ id: 'report.form.tier.shuangfei', message: '双非' }) },
  { value: '陆本中外合办院系（JI/ZJUI等）', label: translate({ id: 'report.form.tier.jointProgram', message: '陆本中外合办院系（JI/ZJUI等）' }) },
  { value: '中外合办校（XJTLU等）', label: translate({ id: 'report.form.tier.jointSchool', message: '中外合办校（XJTLU等）' }) },
  { value: '美本', label: translate({ id: 'report.form.tier.us', message: '美本' }) },
  { value: '加本', label: translate({ id: 'report.form.tier.ca', message: '加本' }) },
  { value: '英本', label: translate({ id: 'report.form.tier.uk', message: '英本' }) },
  { value: '港本', label: translate({ id: 'report.form.tier.hk', message: '港本' }) },
  { value: '海本', label: translate({ id: 'report.form.tier.overseas', message: '其他海本' }) },
];

const MAJORS = [
  { value: 'CS', label: 'CS' },
  { value: 'SE', label: 'SE' },
  { value: 'AI', label: 'AI' },
  { value: 'DS', label: 'DS' },
  { value: 'ECE', label: 'ECE' },
  { value: 'EE', label: 'EE' },
  { value: '自动化/Robotics', label: translate({ id: 'report.form.major.auto', message: '自动化/Robotics' }) },
  { value: 'Info System', label: 'Info System' },
  { value: 'Info Security', label: 'Info Security' },
  { value: 'Math/Stat', label: 'Math/Stat' },
  { value: 'CS交叉学科（bme等）', label: translate({ id: 'report.form.major.csCross', message: 'CS交叉学科（bme等）' }) },
  { value: '其他电类学科（精仪等）', label: translate({ id: 'report.form.major.otherEE', message: '其他电类学科（精仪等）' }) },
  { value: '其他理工科', label: translate({ id: 'report.form.major.otherStem', message: '其他理工科' }) },
  { value: '其他学科', label: translate({ id: 'report.form.major.other', message: '其他学科' }) },
];

const RESEARCH_COUNT_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3+', label: '3+' },
];

const RESEARCH_DURATION_OPTIONS = [
  { value: '<3个月', label: translate({ id: 'report.form.researchDuration.lt3m', message: '< 3个月' }) },
  { value: '3-6个月', label: translate({ id: 'report.form.researchDuration.3to6m', message: '3-6个月' }) },
  { value: '6-12个月', label: translate({ id: 'report.form.researchDuration.6to12m', message: '6-12个月' }) },
  { value: '>1年', label: translate({ id: 'report.form.researchDuration.gt1y', message: '> 1年' }) },
];

const PAPER_OPTIONS = [
  { value: '无', label: translate({ id: 'report.form.paper.none', message: '无' }) },
  { value: '在投', label: translate({ id: 'report.form.paper.submitted', message: '在投' }) },
  { value: 'CCF-A 一作', label: translate({ id: 'report.form.paper.ccfAFirst', message: 'CCF-A 一作' }) },
  { value: 'CCF-A 非一作', label: translate({ id: 'report.form.paper.ccfANonFirst', message: 'CCF-A 非一作' }) },
  { value: 'CCF-B 一作', label: translate({ id: 'report.form.paper.ccfBFirst', message: 'CCF-B 一作' }) },
  { value: 'CCF-B 非一作', label: translate({ id: 'report.form.paper.ccfBNonFirst', message: 'CCF-B 非一作' }) },
  { value: '其他发表', label: translate({ id: 'report.form.paper.other', message: '其他发表' }) },
];

const LOR_OPTIONS = [
  { value: '有大牛强推', label: translate({ id: 'report.form.lor.strongBigName', message: '有大牛强推' }) },
  { value: '有强推', label: translate({ id: 'report.form.lor.strong', message: '有强推' }) },
  { value: '普通推荐', label: translate({ id: 'report.form.lor.normal', message: '普通推荐' }) },
];

export default function ReportForm({ onSubmit }) {
  const [form, setForm] = useState({
    gpa: '',
    gpaScale: '4.0',
    gre: '',
    schoolTier: '',
    major: '',
    researchCount: '0',
    researchDuration: '',
    paper: '无',
    lorStrength: '',
    bigCompanyIntern: false,
    toefl: '',
  });

  const [errors, setErrors] = useState({});

  function validate() {
    const errs = {};
    const gpa = parseFloat(form.gpa);
    if (!form.gpa || isNaN(gpa)) {
      errs.gpa = translate({ id: 'report.form.error.gpaRequired', message: '请输入 GPA' });
    } else {
      const maxGpa = { '4.0': 4.0, '4.3': 4.3, '5.0': 5.0, '100': 100 }[form.gpaScale] || 4.0;
      if (gpa < 0 || gpa > maxGpa) {
        errs.gpa = translate({ id: 'report.form.error.gpaRange', message: 'GPA 超出范围' });
      }
    }
    if (form.gre) {
      const gre = parseInt(form.gre, 10);
      if (isNaN(gre) || gre < 260 || gre > 340) {
        errs.gre = translate({ id: 'report.form.error.greRange', message: 'GRE 应在 260-340 之间' });
      }
    }
    if (form.toefl) {
      const toefl = parseInt(form.toefl, 10);
      if (isNaN(toefl) || toefl < 0 || toefl > 120) {
        errs.toefl = translate({ id: 'report.form.error.toeflRange', message: 'TOEFL/IELTS 总分超出范围' });
      }
    }
    if (!form.schoolTier) {
      errs.schoolTier = translate({ id: 'report.form.error.schoolTierRequired', message: '请选择本科学校档次' });
    }
    if (!form.major) {
      errs.major = translate({ id: 'report.form.error.majorRequired', message: '请选择专业' });
    }
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSubmit({
        ...form,
        gpa: parseFloat(form.gpa),
        gre: form.gre ? parseInt(form.gre, 10) : null,
        toefl: form.toefl ? parseInt(form.toefl, 10) : null,
      });
    }
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.formTitle}>
        <Translate id="report.form.title" description="Form title">
          填写你的背景信息
        </Translate>
      </h2>
      <p className={styles.formSubtitle}>
        <Translate id="report.form.subtitle" description="Form subtitle">
          我们将基于相似背景的历史申请者数据，为你生成精准定位分析
        </Translate>
      </p>

      {/* GPA + Scale */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            GPA <span className={styles.required}>*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={{ '4.0': 4.0, '4.3': 4.3, '5.0': 5.0, '100': 100 }[form.gpaScale] || 4.0}
            className={`${styles.input} ${errors.gpa ? styles.inputError : ''}`}
            value={form.gpa}
            onChange={(e) => handleChange('gpa', e.target.value)}
            placeholder={form.gpaScale === '100' ? 'e.g. 88' : 'e.g. 3.7'}
          />
          {errors.gpa && <span className={styles.errorText}>{errors.gpa}</span>}
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            <Translate id="report.form.gpaScale">GPA 制</Translate>{' '}
            <span className={styles.required}>*</span>
          </label>
          <select
            className={styles.select}
            value={form.gpaScale}
            onChange={(e) => handleChange('gpaScale', e.target.value)}
          >
            {GPA_SCALES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* School Tier */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          <Translate id="report.form.schoolTier">本科学校档次</Translate>{' '}
          <span className={styles.required}>*</span>
        </label>
        <select
          className={`${styles.select} ${errors.schoolTier ? styles.inputError : ''}`}
          value={form.schoolTier}
          onChange={(e) => handleChange('schoolTier', e.target.value)}
        >
          <option value="">{translate({ id: 'report.form.selectPlaceholder', message: '请选择...' })}</option>
          {SCHOOL_TIERS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {errors.schoolTier && <span className={styles.errorText}>{errors.schoolTier}</span>}
      </div>

      {/* Major */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          <Translate id="report.form.major">专业</Translate>{' '}
          <span className={styles.required}>*</span>
        </label>
        <select
          className={`${styles.select} ${errors.major ? styles.inputError : ''}`}
          value={form.major}
          onChange={(e) => handleChange('major', e.target.value)}
        >
          <option value="">{translate({ id: 'report.form.selectPlaceholder', message: '请选择...' })}</option>
          {MAJORS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {errors.major && <span className={styles.errorText}>{errors.major}</span>}
      </div>

      {/* Research Count + Duration — side by side */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            <Translate id="report.form.researchCount">科研经历段数</Translate>
          </label>
          <select
            className={styles.select}
            value={form.researchCount}
            onChange={(e) => handleChange('researchCount', e.target.value)}
          >
            {RESEARCH_COUNT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            <Translate id="report.form.researchDuration">科研总时长</Translate>
          </label>
          <select
            className={styles.select}
            value={form.researchDuration}
            onChange={(e) => handleChange('researchDuration', e.target.value)}
          >
            <option value="">{translate({ id: 'report.form.selectPlaceholder', message: '请选择...' })}</option>
            {RESEARCH_DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Paper */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          <Translate id="report.form.paper">论文发表</Translate>
        </label>
        <select
          className={styles.select}
          value={form.paper}
          onChange={(e) => handleChange('paper', e.target.value)}
        >
          {PAPER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* LOR Strength */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          <Translate id="report.form.lorStrength">推荐信强度</Translate>
        </label>
        <select
          className={styles.select}
          value={form.lorStrength}
          onChange={(e) => handleChange('lorStrength', e.target.value)}
        >
          <option value="">{translate({ id: 'report.form.selectPlaceholder', message: '请选择...' })}</option>
          {LOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* GRE + TOEFL — side by side */}
      <div className={styles.fieldRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>GRE</label>
          <input
            type="number"
            min="260"
            max="340"
            className={`${styles.input} ${errors.gre ? styles.inputError : ''}`}
            value={form.gre}
            onChange={(e) => handleChange('gre', e.target.value)}
            placeholder="e.g. 325"
          />
          {errors.gre && <span className={styles.errorText}>{errors.gre}</span>}
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>TOEFL/IELTS</label>
          <input
            type="number"
            min="0"
            max="120"
            className={`${styles.input} ${errors.toefl ? styles.inputError : ''}`}
            value={form.toefl}
            onChange={(e) => handleChange('toefl', e.target.value)}
            placeholder="e.g. 105"
          />
          {errors.toefl && <span className={styles.errorText}>{errors.toefl}</span>}
        </div>
      </div>

      {/* Big Company Intern */}
      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.bigCompanyIntern}
            onChange={(e) => handleChange('bigCompanyIntern', e.target.checked)}
          />
          <Translate id="report.form.bigCompanyIntern">有知名公司实习</Translate>
        </label>
        <span className={styles.fieldHint}>
          <Translate id="report.form.bigCompanyInternHint">
            Google/Microsoft/Meta/TikTok/Apple/Amazon 等
          </Translate>
        </span>
      </div>

      <button type="submit" className={styles.submitBtn}>
        <Translate id="report.form.submit">生成定位报告</Translate>
      </button>
    </form>
  );
}
