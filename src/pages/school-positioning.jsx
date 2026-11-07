import {getLocaleMessages, localizeMessages} from '@site/src/lib/i18n/traditional';
import {localizedInternalPath} from '@site/src/lib/seo/localizedAlternates.mjs';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { FIELD_DEFINITIONS } from '@site/src/lib/positioning/profile-schema';
import { POSITIONING_API_BASE } from '@site/src/lib/positioning/api';
import {trackSeoEvent} from '@site/src/lib/analytics/events.mjs';
import styles from './school-positioning.module.css';


const COPY = {
  'zh-Hans': {
    pageTitle: 'MSCS 选校定位',
    pageDesc: '选校定位评估：基于你的背景，给出 csgrad tier 档位预估与完整选校方案',
    backHome: '返回首页',
    heroTitle: 'MSCS 选校定位',
    heroLead: '按你的原始成绩制式、课程与经历评估选校方向。先免费检查资料，再决定是否购买报告。',
    canceled: '订单已取消。',
    errorPrefix: '出错了：',
    profileSection: '你的背景档案',
    submitBtn: '免费检查与预览',
    recomputeBtn: '重新评估',
    fillRequired: '请先填写必填字段',
    errInvalidNumber: '请输入有效数字',
    errRange: '请填写 {min}–{max} 范围内的值',
    errInteger: '该字段必须为整数',
    previewLabel: '预估档位',
    scoreLabel: '综合得分',
    rationaleLabel: '评估依据',
    deliveryTitle: '预计报告内容',
    deliveryCount: '主列表预计包含 {count} 个项目',
    deliveryBuckets: '冲刺 {reach} · 主申 {match} · 备选 {safety}',
    deliveryUnavailable: '当前资料或项目覆盖不足，暂不能生成可购买的自动报告。请补充资料或选择人工核验。',
    needsReview: '资料需要补充或人工核验，暂不能付款。请查看以下提示。',
    stalePreview: '请先使用当前资料重新预览，再付款。',
    requestFailed: '暂时无法处理请求，请稍后重试；请勿重复付款。',
    paywallTitle: '查看完整项目适配报告',
    paywallText: '报告按你提供的资料说明项目适配依据、待核验事项和申请准备清单。推荐不保证录取，不提供个人录取概率。',
    paywallBullets: [
      { lead: '项目候选与理由', body: '：逐项解释课程、方向与经历的匹配，资料不足的地方明确标注。' },
      { lead: '申请核验清单', body: '：区分已知资料和仍需确认的条件，项目详情链接供进一步查阅。' },
      { lead: '可保存的报告', body: '：付款后查看结果页并下载PDF，便于与导师或家人讨论。' },
    ],
    payBtn: '🚀 立即解锁我的完整选校方案 →',
    payNote: '安全支付由 Stripe 提供。如已付款无法返回，请直接通过结果页 URL 查看。',
    paying: '正在跳转到 Stripe…',
    yes: '是',
    no: '否',
    selectPlaceholder: '请选择',
    offlineStatus: '暂时下线',
    offlineTitle: '选校定位暂时下线',
    offlineLead: '我们正在调整定位模型与结果质量，暂时停止新的定位和支付。',
    offlineExisting: '已购买用户仍可通过付款后收到的结果链接查看和下载报告。',
  },
  en: {
    pageTitle: 'MSCS School Positioning',
    pageDesc: 'Find the school tier that matches your background — tier estimation and full school list based on your profile',
    backHome: 'Back to home',
    heroTitle: 'MSCS School Positioning',
    heroLead: 'Use your original grading system, coursework and experience to explore programs. Check your profile free before purchasing a report.',
    canceled: 'Order canceled.',
    errorPrefix: 'Error: ',
    profileSection: 'Your profile',
    submitBtn: 'Check profile and preview',
    recomputeBtn: 'Re-evaluate',
    fillRequired: 'Please fill in the required fields first',
    errInvalidNumber: 'Please enter a valid number',
    errRange: 'Value must be between {min} and {max}',
    errInteger: 'Must be an integer',
    previewLabel: 'Estimated tier',
    scoreLabel: 'Composite score',
    rationaleLabel: 'Why this tier',
    deliveryTitle: 'Expected report contents',
    deliveryCount: 'Expected main list: {count} programs',
    deliveryBuckets: 'Reach {reach} · Match {match} · Alternatives {safety}',
    deliveryUnavailable: 'Your information or program coverage is insufficient for a paid automatic report. Please provide more information or request manual review.',
    needsReview: 'More information or manual review is needed. Checkout is unavailable; review the guidance below.',
    stalePreview: 'Preview your current profile before proceeding to checkout.',
    requestFailed: 'We could not process this request. Please retry later; do not pay again.',
    paywallTitle: 'Unlock the full program fit report',
    paywallText: 'Your report explains program fit, information that needs checking, and next steps using the profile you provide. It does not guarantee admission or estimate your personal admission probability.',
    paywallBullets: [
      { lead: 'Program options and reasons', body: ': see how coursework, interests and experience relate to each option, with uncertainty clearly stated.' },
      { lead: 'Application checklist', body: ': distinguish available evidence from requirements that still need verification, with links for further research.' },
      { lead: 'A report you can keep', body: ': open your paid result and download a PDF to discuss with mentors or family.' },
    ],
    payBtn: '🚀 Unlock my full school plan →',
    payNote: 'Secure checkout by Stripe. If you cannot return automatically, open the result page URL directly.',
    paying: 'Redirecting to Stripe…',
    yes: 'Yes',
    no: 'No',
    selectPlaceholder: 'Select…',
    offlineStatus: 'Temporarily unavailable',
    offlineTitle: 'School positioning is temporarily offline',
    offlineLead: 'We are improving the positioning model and result quality. New assessments and payments are paused for now.',
    offlineExisting: 'Existing customers can still open and download their report from the result link received after payment.',
  },
  ko: {
    pageTitle: 'MSCS 학교 포지셔닝',
    pageDesc: '내 배경에 맞는 학교 등급을 찾아보세요 — 프로필 기반 등급 추정 및 전체 학교 리스트',
    backHome: '홈으로 돌아가기',
    heroTitle: 'MSCS 학교 포지셔닝',
    heroLead: '원래 성적 체계, 수강 과목, 경험을 바탕으로 프로그램을 탐색하세요. 리포트를 구매하기 전에 프로필을 무료로 확인할 수 있습니다.',
    canceled: '주문이 취소되었습니다.',
    errorPrefix: '오류: ',
    profileSection: '내 프로필',
    submitBtn: '프로필 확인 및 미리보기',
    recomputeBtn: '다시 평가',
    fillRequired: '먼저 필수 항목을 입력해 주세요',
    errInvalidNumber: '올바른 숫자를 입력해 주세요',
    errRange: '값은 {min}에서 {max} 사이여야 합니다',
    errInteger: '정수여야 합니다',
    previewLabel: '추정 등급',
    scoreLabel: '종합 점수',
    rationaleLabel: '이 등급인 이유',
    deliveryTitle: '리포트 예상 구성',
    deliveryCount: '예상 주요 리스트: 프로그램 {count}개',
    deliveryBuckets: '도전 {reach} · 적정 {match} · 대안 {safety}',
    deliveryUnavailable: '입력하신 정보 또는 프로그램 범위가 유료 자동 리포트를 제공하기에 충분하지 않습니다. 더 많은 정보를 제공하거나 수동 검토를 요청해 주세요.',
    needsReview: '추가 정보 또는 수동 검토가 필요합니다. 결제는 이용할 수 없으니 아래 안내를 확인하세요.',
    stalePreview: '결제를 진행하기 전에 현재 프로필로 미리보기를 확인해 주세요.',
    requestFailed: '요청을 처리하지 못했습니다. 나중에 다시 시도해 주세요. 다시 결제하지 마세요.',
    paywallTitle: '전체 프로그램 적합도 리포트 열기',
    paywallText: '리포트는 입력하신 프로필을 바탕으로 프로그램 적합도, 확인이 필요한 정보, 다음 단계를 설명합니다. 합격을 보장하거나 개인별 합격 확률을 추정하지 않습니다.',
    paywallBullets: [
      { lead: '프로그램 옵션과 이유', body: ': 수강 과목, 관심 분야, 경험이 각 옵션과 어떻게 연결되는지, 불확실한 부분과 함께 확인하세요.' },
      { lead: '지원 체크리스트', body: ': 확보된 근거와 아직 확인이 필요한 요건을 구분하고, 추가 조사를 위한 링크를 제공합니다.' },
      { lead: '보관 가능한 리포트', body: ': 결제한 결과를 열어 PDF로 내려받아 멘토나 가족과 상의할 수 있습니다.' },
    ],
    payBtn: '🚀 내 전체 학교 플랜 열기 →',
    payNote: 'Stripe의 안전한 결제입니다. 자동으로 돌아오지 않으면 결과 페이지 URL을 직접 여세요.',
    paying: 'Stripe로 이동 중…',
    yes: '예',
    no: '아니요',
    selectPlaceholder: '선택…',
    offlineStatus: '일시적으로 이용할 수 없음',
    offlineTitle: '학교 포지셔닝이 일시적으로 중단되었습니다',
    offlineLead: '포지셔닝 모델과 결과 품질을 개선하고 있습니다. 새로운 평가와 결제는 당분간 중단됩니다.',
    offlineExisting: '기존 고객은 결제 후 받은 결과 링크에서 리포트를 열고 내려받을 수 있습니다.',
  },
  vi: {
    pageTitle: 'Định vị trường MSCS',
    pageDesc: 'Tìm hạng trường phù hợp với hồ sơ của bạn — ước tính hạng và danh sách trường đầy đủ dựa trên hồ sơ',
    backHome: 'Về trang chủ',
    heroTitle: 'Định vị trường MSCS',
    heroLead: 'Dùng thang điểm gốc, các môn đã học và kinh nghiệm của bạn để khám phá chương trình. Kiểm tra hồ sơ miễn phí trước khi mua báo cáo.',
    canceled: 'Đơn hàng đã bị hủy.',
    errorPrefix: 'Lỗi: ',
    profileSection: 'Hồ sơ của bạn',
    submitBtn: 'Kiểm tra hồ sơ và xem trước',
    recomputeBtn: 'Đánh giá lại',
    fillRequired: 'Vui lòng điền các trường bắt buộc trước',
    errInvalidNumber: 'Vui lòng nhập số hợp lệ',
    errRange: 'Giá trị phải từ {min} đến {max}',
    errInteger: 'Phải là số nguyên',
    previewLabel: 'Hạng ước tính',
    scoreLabel: 'Điểm tổng hợp',
    rationaleLabel: 'Vì sao ở hạng này',
    deliveryTitle: 'Nội dung báo cáo dự kiến',
    deliveryCount: 'Danh sách chính dự kiến: {count} chương trình',
    deliveryBuckets: 'Thử sức {reach} · Phù hợp {match} · Dự phòng {safety}',
    deliveryUnavailable: 'Thông tin của bạn hoặc phạm vi chương trình chưa đủ để tạo báo cáo tự động trả phí. Vui lòng bổ sung thông tin hoặc yêu cầu xem xét thủ công.',
    needsReview: 'Cần thêm thông tin hoặc xem xét thủ công. Hiện chưa thể thanh toán; hãy xem hướng dẫn bên dưới.',
    stalePreview: 'Hãy xem trước với hồ sơ hiện tại trước khi thanh toán.',
    requestFailed: 'Chúng tôi chưa xử lý được yêu cầu này. Vui lòng thử lại sau; đừng thanh toán lại.',
    paywallTitle: 'Mở khóa báo cáo đánh giá chương trình đầy đủ',
    paywallText: 'Báo cáo giải thích mức độ phù hợp với từng chương trình, thông tin cần kiểm tra và các bước tiếp theo dựa trên hồ sơ bạn cung cấp. Báo cáo không đảm bảo trúng tuyển và không ước tính xác suất trúng tuyển của cá nhân bạn.',
    paywallBullets: [
      { lead: 'Lựa chọn chương trình và lý do', body: ': xem các môn học, mối quan tâm và kinh nghiệm liên quan thế nào đến từng lựa chọn, kèm nêu rõ điểm chưa chắc chắn.' },
      { lead: 'Danh sách kiểm tra hồ sơ', body: ': phân biệt bằng chứng đã có với yêu cầu còn cần xác minh, kèm liên kết để tìm hiểu thêm.' },
      { lead: 'Báo cáo để lưu lại', body: ': mở kết quả đã thanh toán và tải PDF để trao đổi với người hướng dẫn hoặc gia đình.' },
    ],
    payBtn: '🚀 Mở khóa kế hoạch chọn trường đầy đủ →',
    payNote: 'Thanh toán an toàn qua Stripe. Nếu không tự động quay lại, hãy mở trực tiếp URL trang kết quả.',
    paying: 'Đang chuyển đến Stripe…',
    yes: 'Có',
    no: 'Không',
    selectPlaceholder: 'Chọn…',
    offlineStatus: 'Tạm thời không khả dụng',
    offlineTitle: 'Định vị trường tạm ngừng hoạt động',
    offlineLead: 'Chúng tôi đang cải thiện mô hình định vị và chất lượng kết quả. Tạm dừng đánh giá mới và thanh toán.',
    offlineExisting: 'Khách hàng cũ vẫn có thể mở và tải báo cáo từ liên kết kết quả nhận được sau khi thanh toán.',
  },
  ja: {
    pageTitle: 'MSCS 志望校ポジショニング',
    pageDesc: 'あなたの経歴に合う大学ランクを見つけましょう — プロフィールに基づくランク推定と全志望校リスト',
    backHome: 'ホームに戻る',
    heroTitle: 'MSCS 志望校ポジショニング',
    heroLead: '元の成績評価、履修科目、経験をもとにプログラムを探せます。レポート購入前にプロフィールを無料でチェックできます。',
    canceled: '注文はキャンセルされました。',
    errorPrefix: 'エラー：',
    profileSection: 'あなたのプロフィール',
    submitBtn: 'プロフィールを確認してプレビュー',
    recomputeBtn: '再評価',
    fillRequired: '先に必須項目を入力してください',
    errInvalidNumber: '有効な数値を入力してください',
    errRange: '{min} から {max} の間で入力してください',
    errInteger: '整数で入力してください',
    previewLabel: '推定ランク',
    scoreLabel: '総合スコア',
    rationaleLabel: 'このランクの理由',
    deliveryTitle: 'レポートの予定内容',
    deliveryCount: 'メインリスト予定：{count} プログラム',
    deliveryBuckets: 'チャレンジ {reach} · 実力相応 {match} · 代替候補 {safety}',
    deliveryUnavailable: '入力情報またはプログラムのカバー範囲が、有料の自動レポートには不足しています。情報を追加するか、手動レビューをご依頼ください。',
    needsReview: '追加情報または手動レビューが必要です。決済はご利用いただけません。以下の案内をご確認ください。',
    stalePreview: '決済に進む前に、現在のプロフィールでプレビューしてください。',
    requestFailed: 'リクエストを処理できませんでした。後でもう一度お試しください。再度の支払いはしないでください。',
    paywallTitle: 'プログラム適合レポートの全文を見る',
    paywallText: 'レポートでは、入力されたプロフィールをもとに、プログラムとの適合性、確認が必要な情報、次のステップを説明します。合格を保証したり、個人の合格確率を推定したりするものではありません。',
    paywallBullets: [
      { lead: 'プログラムの選択肢と理由', body: '：履修科目・関心分野・経験が各選択肢とどう関わるかを、不確かな点も明示して確認できます。' },
      { lead: '出願チェックリスト', body: '：確認済みの根拠と、まだ確認が必要な要件を区別し、さらに調べるためのリンクも示します。' },
      { lead: '手元に残せるレポート', body: '：購入した結果を開いて PDF をダウンロードし、メンターや家族と相談できます。' },
    ],
    payBtn: '🚀 志望校プランの全体を見る →',
    payNote: 'Stripe による安全な決済です。自動で戻らない場合は、結果ページの URL を直接開いてください。',
    paying: 'Stripe に移動中…',
    yes: 'はい',
    no: 'いいえ',
    selectPlaceholder: '選択…',
    offlineStatus: '一時的に利用できません',
    offlineTitle: '志望校ポジショニングは一時停止中です',
    offlineLead: 'ポジショニングモデルと結果の品質を改善しています。新規の評価と決済は現在停止しています。',
    offlineExisting: '既存のお客様は、決済後に受け取った結果リンクから引き続きレポートを開いてダウンロードできます。',
  },
};

function pickLocale(loc) {
  return ['en', 'zh-Hant', 'ko', 'vi', 'ja'].includes(loc) ? loc : 'zh-Hans';
}

function getLabel(node, locale) {
  if (!node) return '';
  if (typeof node === 'string') return localizeMessages(node, locale);
  return localizeMessages(node[locale] || (['ko', 'vi', 'ja'].includes(locale) ? node.en : '') || node['zh-Hans'] || node.en || '', locale);
}

function OfflineNotice({ locale, t }) {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <a href={localizedInternalPath('/', locale)} className={styles.backLink}>
          &larr; {t.backHome}
        </a>
        <section className={styles.hero} aria-labelledby="positioning-offline-title">
          <span className={styles.offlineStatus}>{t.offlineStatus}</span>
          <h1 id="positioning-offline-title" className={styles.title}>{t.offlineTitle}</h1>
          <p className={styles.lead}>{t.offlineLead}</p>
          <p className={styles.offlineExisting}>{t.offlineExisting}</p>
        </section>
      </div>
    </div>
  );
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

export function buildInitialProfile(fields) {
  const initial = {};
  for (const f of fields) {
    initial[f.key] = initialFieldValue(f);
  }
  return initial;
}

export function getGpaBoundsByScale(scale) {
  const s = String(scale ?? '');
  if (s === 'german-5') return { min: 1, max: 5 };
  if (s === '10.0') return { min: 0, max: 10 };
  if (s === '100' || s === 'uk-100') return { min: 0, max: 100 };
  if (s === '5' || s === '5.0') return { min: 0, max: 5 };
  if (s === '4.3') return { min: 0, max: 4.3 };
  return { min: 0, max: 4 };
}

function getEffectiveBounds(f, profile) {
  if (f.key === 'gpa') return getGpaBoundsByScale(profile && profile.gpaScale);
  if (f.key === 'jointForeignGpa') return getGpaBoundsByScale(profile && profile.jointForeignGpaScale);
  return {
    min: typeof f.min === 'number' ? f.min : null,
    max: typeof f.max === 'number' ? f.max : null,
  };
}

function formatRange(template, min, max) {
  return template.replace('{min}', String(min)).replace('{max}', String(max));
}

function isRequired(f, profile) {
  if (typeof f.requiredIf === 'function') return !!f.requiredIf(profile);
  return !!f.required;
}

function resolveLabel(f, profile) {
  if (typeof f.labelOverride === 'function') {
    const override = f.labelOverride(profile);
    if (override) return override;
  }
  return f.label;
}

export function validateOne(f, v, profile, t) {
  if (isRequired(f, profile)) {
    const empty = v === '' || v === null || v === undefined;
    if (empty) return t.fillRequired;
  }
  if (f.type === 'select' && v && !f.options.some(o => o.value === v && isVisible(o, profile))) return t.fillRequired;
  if (f.type === 'number' && v !== '' && v !== null && v !== undefined) {
    const num = Number(v);
    if (!Number.isFinite(num)) return t.errInvalidNumber;
    const { min, max } = getEffectiveBounds(f, profile);
    if (typeof min === 'number' && num < min) {
      return formatRange(t.errRange, min, max);
    }
    if (typeof max === 'number' && num > max) {
      return formatRange(t.errRange, min, max);
    }
    if (f.step === 1 && !Number.isInteger(num)) {
      return t.errInteger;
    }
  }
  return null;
}

function isVisible(f, profile) {
  return typeof f.showIf !== 'function' || f.showIf(profile);
}

function validate(profile, fields, t) {
  const errors = {};
  for (const f of fields) {
    if (!isVisible(f, profile)) continue;
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

export function coerceProfile(profile, fields) {
  const out = {};
  for (const f of fields) {
    const visible = isVisible(f, profile);
    const v = profile[f.key];
    if (!visible) {
      // 隐藏字段不入 payload，让 backend 按缺省值处理
      continue;
    }
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
  // major === 'cs' 视为科班 CS 背景（不再有独立 isCsBackground 字段）
  out.isCsBackground = out.major === 'cs';
  return out;
}

export function positioningPayload(profile, fields, locale) {
  return { ...coerceProfile(profile, fields), locale: ['ko', 'vi', 'ja'].includes(pickLocale(locale)) ? 'en' : pickLocale(locale) };
}

export function canCheckout(preview, hasErrors) {
  return !!preview && preview.needsReview !== true && preview.status !== 'needsReview'
    && preview.deliverySummary?.ready !== false
    && !hasErrors && !!preview.tier && !Object.keys(preview.fieldErrors || {}).length
    && !(Array.isArray(preview.errors) && preview.errors.length);
}

export function DeliverySummary({ summary, locale }) {
  if (!summary || typeof summary !== 'object') return null;
  const t = getLocaleMessages(COPY, pickLocale(locale));
  const validCount = n => Number.isInteger(n) && n >= 0;
  const counts = summary.bucketCounts || {};
  const hasCounts = ['reach', 'match', 'safety'].every(k => validCount(counts[k]));
  return <section aria-label={t.deliveryTitle} className={styles.rationale}>
    <strong>{t.deliveryTitle}</strong>
    {validCount(summary.mainListCount) && <p>{t.deliveryCount.replace('{count}', String(summary.mainListCount))}</p>}
    {hasCounts && <p>{t.deliveryBuckets.replace('{reach}', String(counts.reach)).replace('{match}', String(counts.match)).replace('{safety}', String(counts.safety))}</p>}
    {summary.ready === false && <p role="alert">{t.deliveryUnavailable}</p>}
  </section>;
}

export async function readPositioningResponse(res, locale) {
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = {}; }
  if (!res.ok) {
    const error = new Error(getLabel(data.message || data.error, locale) || getLocaleMessages(COPY, pickLocale(locale)).requestFailed);
    error.fieldErrors = data.fieldErrors || data.errors || {};
    throw error;
  }
  return data;
}

export function localizedFieldErrors(errors, locale) {
  if (!errors || typeof errors !== 'object') return {};
  const entries = Array.isArray(errors) ? errors.map(e => [e.field, e.message]) : Object.entries(errors);
  return Object.fromEntries(entries.filter(([key]) => typeof key === 'string').map(([key, value]) => [key,
    Array.isArray(value) ? value.map(v => getLabel(v, locale)).filter(Boolean).join(' ') : getLabel(value, locale)]));
}

function FormBody() {
  const { i18n } = useDocusaurusContext();
  const locale = pickLocale(i18n.currentLocale);
  const t = getLocaleMessages(COPY, locale);

  const fields = FIELD_DEFINITIONS || [];

  const [profile, setProfile] = useState(() => buildInitialProfile(fields));
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [paying, setPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const profileVersion = useRef(0);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('canceled') === '1') {
      setCanceled(true);
    }
  }, []);

  const errors = useMemo(() => ({ ...validate(profile, fields, t), ...serverErrors }), [profile, fields, t, serverErrors]);
  const hasErrors = Object.keys(errors).length > 0;

  const invalidatePreview = () => { profileVersion.current += 1; setPreview(null); setServerErrors({}); setErrorMsg(''); };

  const setValue = (key, value) => {
    invalidatePreview();
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const setGroupValue = (groupKey, subKey, value) => {
    invalidatePreview();
    setProfile((p) => ({
      ...p,
      [groupKey]: { ...(p[groupKey] || {}), [subKey]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || paying) return;
    setTouched(true);
    setErrorMsg('');
    if (hasErrors) {
      setPreview(null);
      const firstKey = Object.keys(errors)[0];
      // Error keys are either "fieldKey" or "groupKey.subKey"; field ids use dashes.
      const fieldId = `f-${firstKey.replace('.', '-')}`;
      const el = document.getElementById(fieldId);
      if (el) el.focus({ preventScroll: false });
      return;
    }
    const version = profileVersion.current;
    setSubmitting(true);
    setPreview(null);
    try {
      const res = await fetch(POSITIONING_API_BASE + '/api/positioning/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positioningPayload(profile, fields, locale)),
      });
      const result = await readPositioningResponse(res, locale);
      if (version !== profileVersion.current) return;
      setServerErrors(localizedFieldErrors(result.fieldErrors || result.errors, locale));
      setPreview(result);
      trackSeoEvent('positioning_start', {
        locale,
        page_type: 'positioning',
        method: 'profile_preview',
      });
      setTimeout(() => {
        const el = document.getElementById('positioning-preview');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (err) {
      if (version !== profileVersion.current) return;
      setServerErrors(localizedFieldErrors(err.fieldErrors, locale));
      setErrorMsg(err && err.message ? err.message : t.requestFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async () => {
    if (paying || submitting || !canCheckout(preview, hasErrors)) { setErrorMsg(t.stalePreview); return; }
    const version = profileVersion.current;
    setErrorMsg('');
    setPaying(true);
    try {
      const res = await fetch(POSITIONING_API_BASE + '/api/positioning/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positioningPayload(profile, fields, locale)),
      });
      const data = await readPositioningResponse(res, locale);
      if (version !== profileVersion.current) { setPaying(false); return; }
      if (data.needsReview || data.deliverySummary?.ready === false || Object.keys(data.fieldErrors || {}).length || data.errors?.length) {
        setServerErrors(localizedFieldErrors(data.fieldErrors || data.errors, locale));
        setPreview(null);
        throw new Error(t.needsReview);
      }
      if (!data?.checkoutUrl) throw new Error(t.requestFailed);
      trackSeoEvent('begin_checkout', {
        locale,
        page_type: 'positioning',
        method: 'stripe_checkout',
      });
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setPaying(false);
      setServerErrors(localizedFieldErrors(err.fieldErrors, locale));
      setPreview(null);
      setErrorMsg(err && err.message ? err.message : t.requestFailed);
    }
  };

  const renderNumberInput = (f, value, onChange, hasErr) => {
    const b = getEffectiveBounds(f, profile);
    const min = typeof b.min === 'number' ? b.min : undefined;
    const max = typeof b.max === 'number' ? b.max : undefined;
    let step;
    if (f.key === 'gpa' || f.key === 'jointForeignGpa') {
      step = 0.01;
    } else {
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
    const label = getLabel(resolveLabel(f, profile), locale);
    const required = isRequired(f, profile);
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
            {required && <span className={styles.required}>*</span>}
          </label>
          {help && <div className={styles.help} style={{ marginTop: 0, marginBottom: 8 }}>{help}</div>}
          <div className={styles.grid}>
            {(f.fields || []).map((sf) => {
              const subErr = touched ? errors[`${f.key}.${sf.key}`] : undefined;
              const subHasErr = Boolean(subErr);
              const subLabel = getLabel(sf.label, locale);
              const subRequired = isRequired(sf, profile);
              return (
                <div key={sf.key} className={styles.field}>
                  <label htmlFor={`f-${f.key}-${sf.key}`} className={styles.label}>
                    {subLabel}
                    {subRequired && <span className={styles.required}>*</span>}
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
              {required && <span className={styles.required}>*</span>}
            </label>
          </div>
          {help && <div className={styles.help}>{help}</div>}
        </div>
      );
    }

    if (f.type === 'select') {
      const opts = (f.options || []).filter(o => isVisible(o, profile));
      return (
        <div key={f.key} className={styles.field}>
          <label htmlFor={`f-${f.key}`} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
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
            {required && <span className={styles.required}>*</span>}
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
          {required && <span className={styles.required}>*</span>}
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
        <a href={localizedInternalPath('/', locale)} className={styles.backLink}>
          &larr; {t.backHome}
        </a>

        <div className={styles.hero}>
          <h1 className={styles.title}>{t.heroTitle}</h1>
          <p className={styles.lead}>{t.heroLead}</p>
        </div>

        {canceled && (
          <div className={`${styles.banner} ${styles.bannerCanceled}`}>{t.canceled}</div>
        )}
        {errorMsg && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            {t.errorPrefix}{errorMsg}
          </div>
        )}

        {Object.keys(serverErrors).length > 0 && <div className={`${styles.banner} ${styles.bannerError}`} role="alert">
          <ul>{Object.entries(serverErrors).map(([key, message]) => <li key={key}>
            {getLabel(fields.find(f => f.key === key)?.label, locale) || key}: {message}
          </li>)}</ul>
        </div>}

        <form className={styles.card} onSubmit={handleSubmit} noValidate>
          <h2 className={styles.sectionTitle}>{t.profileSection}</h2>
          <div className={styles.grid}>
            {fields.filter((f) => isVisible(f, profile)).map(renderField)}
          </div>
          <div className={styles.submitRow}>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={paying || submitting}
            >
              {preview ? t.recomputeBtn : t.submitBtn}
            </button>
          </div>
        </form>

        {preview && (
          <div id="positioning-preview" className={styles.previewCard}>
            <p className={styles.previewLabel}>{t.previewLabel}</p>
            {preview.needsReview && <p role="alert">{t.needsReview}</p>}
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
                    <li key={i}>{getLabel(r, locale)}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '6px 0 0' }}>
                  {getLabel(preview.rationale, locale)}
                </p>
              )}
            </div>

            <DeliverySummary summary={preview.deliverySummary} locale={locale} />
            {canCheckout(preview, hasErrors) && <div className={styles.paywall}>
              <p className={styles.paywallTitle}>{t.paywallTitle}</p>
              <p className={styles.paywallText}>{t.paywallText}</p>
              {Array.isArray(t.paywallBullets) && t.paywallBullets.length > 0 && (
                <ul className={styles.paywallBullets}>
                  {t.paywallBullets.map((b, i) => (
                    <li key={i} className={styles.paywallBullet}>
                      <strong>{b.lead}</strong>{b.body}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className={styles.payBtn}
                onClick={handlePay}
                disabled={paying || submitting}
              >
                {paying ? t.paying : t.payBtn}
              </button>
              <p className={styles.payNote}>{t.payNote}</p>
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SchoolPositioningPage() {
  const { i18n } = useDocusaurusContext();
  const locale = pickLocale(i18n.currentLocale);
  const t = getLocaleMessages(COPY, locale);
  const positioningAvailable = locale === 'en';
  const pageTitle = positioningAvailable ? t.pageTitle : t.offlineTitle;
  const pageDesc = positioningAvailable ? t.pageDesc : t.offlineLead;
  return (
    <Layout title={pageTitle} description={pageDesc}>
      <Head>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="website" />
        <meta name="robots" content="noindex" />
      </Head>
      {positioningAvailable ? (
        <BrowserOnly fallback={<div className={styles.pageWrapper}><h1 className={styles.title}>{t.heroTitle}</h1><p>{t.heroLead}</p></div>}>
          {() => <FormBody />}
        </BrowserOnly>
      ) : <OfflineNotice locale={locale} t={t} />}
    </Layout>
  );
}
