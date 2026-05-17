import { classify } from './classifier.js';
import schoolLists from '../../src/lib/positioning/school-lists.json';
import { createCheckoutSession, fetchCheckoutSession, verifyStripeSignature } from './stripe.js';

const ALLOWED_FRONTEND_HOSTS = ['csgrad.com', 'www.csgrad.com', 'localhost', '127.0.0.1'];
const DEFAULT_FRONTEND_ORIGIN = 'https://csgrad.com';
const KV_TTL_SECONDS = 60 * 60 * 24 * 30;

function getFrontendOrigin(request) {
  const origin = request.headers.get('Origin') || request.headers.get('Referer');
  if (!origin) return DEFAULT_FRONTEND_ORIGIN;
  try {
    const url = new URL(origin);
    if (ALLOWED_FRONTEND_HOSTS.includes(url.hostname)) {
      return url.origin;
    }
  } catch (e) {}
  return DEFAULT_FRONTEND_ORIGIN;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function textResponse(text, status = 200, extraHeaders = {}) {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

async function handleCheckout(request, env) {
  let profile;
  try {
    profile = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const { tier } = classify(profile);
  const sessionId = crypto.randomUUID();
  const submissionKey = `submission:${sessionId}`;

  const record = {
    profile,
    tier,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await env.POSITIONING_KV.put(submissionKey, JSON.stringify(record), {
    expirationTtl: KV_TTL_SECONDS,
  });

  const frontendOrigin = getFrontendOrigin(request);
  let session;
  try {
    session = await createCheckoutSession(env.STRIPE_SECRET_KEY, {
      submissionId: sessionId,
      successUrl: `${frontendOrigin}/school-positioning-result?session_id=${sessionId}`,
      cancelUrl: `${frontendOrigin}/school-positioning?canceled=1`,
    });
  } catch (err) {
    return jsonResponse({ error: 'stripe_error', message: String(err && err.message || err) }, 502);
  }

  record.stripeSessionId = session.id;
  await env.POSITIONING_KV.put(submissionKey, JSON.stringify(record), {
    expirationTtl: KV_TTL_SECONDS,
  });

  return jsonResponse({ checkoutUrl: session.url, sessionId });
}

async function handleWebhook(request, env) {
  const sigHeader = request.headers.get('Stripe-Signature');
  const payload = await request.text();

  const ok = await verifyStripeSignature({
    payload,
    header: sigHeader,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });
  if (!ok) {
    return new Response('invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch (e) {
    return new Response('invalid json', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data && event.data.object;
    const submissionId = session && session.metadata && session.metadata.submissionId;
    if (submissionId) {
      const key = `submission:${submissionId}`;
      const existing = await env.POSITIONING_KV.get(key);
      if (existing) {
        const record = JSON.parse(existing);
        record.status = 'paid';
        record.paidAt = new Date().toISOString();
        await env.POSITIONING_KV.put(key, JSON.stringify(record), {
          expirationTtl: KV_TTL_SECONDS,
        });
      }
    }
  }

  return new Response('ok', { status: 200 });
}

async function handleResult(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) {
    return jsonResponse({ error: 'missing_sessionId' }, 400);
  }
  const raw = await env.POSITIONING_KV.get(`submission:${sessionId}`);
  if (!raw) {
    return jsonResponse({ error: 'not_found' }, 404);
  }
  const record = JSON.parse(raw);
  if (record.status !== 'paid' && record.stripeSessionId) {
    try {
      const session = await fetchCheckoutSession(env.STRIPE_SECRET_KEY, record.stripeSessionId);
      if (session && session.payment_status === 'paid') {
        record.status = 'paid';
        record.paidAt = new Date().toISOString();
        await env.POSITIONING_KV.put(`submission:${sessionId}`, JSON.stringify(record), {
          expirationTtl: KV_TTL_SECONDS,
        });
      }
    } catch (e) {}
  }
  if (record.status !== 'paid') {
    return jsonResponse({ status: 'pending' });
  }
  const profile = record.profile || {};
  const isCs = !!profile.isCsBackground;
  const careerGoal = profile.careerGoal;
  const hasTag = (s, tag) => Array.isArray(s.tags) && s.tags.includes(tag);
  const keep = (s) => {
    if (isCs && hasTag(s, 'non-cs-only')) return false;
    if (careerGoal !== 'us-phd' && hasTag(s, 'phd-only')) return false;
    return true;
  };
  const filterBucket = (arr) => Array.isArray(arr) ? arr.filter(keep) : [];
  const rawList = schoolLists[record.tier] || { summary: '', reach: [], match: [], safety: [] };
  const reach = filterBucket(rawList.reach);
  const matchBucket = filterBucket(rawList.match);
  const safetyAll = filterBucket(rawList.safety);
  const movedToMatch = safetyAll.filter((s) => hasTag(s, 'high-bar-no-safety'));
  const safety = safetyAll.filter((s) => !hasTag(s, 'high-bar-no-safety'));
  const match = matchBucket.concat(movedToMatch);
  const schoolList = {
    summary: rawList.summary || '',
    reach,
    match,
    safety,
  };
  const response = {
    status: 'paid',
    tier: record.tier,
    schoolList,
    careerGoal: careerGoal || null,
  };
  if (careerGoal === 'us-phd' && schoolLists.phdRecommended) {
    response.phdRecommended = {
      summary: schoolLists.phdRecommended.summary || '',
      schools: filterBucket(schoolLists.phdRecommended.schools),
    };
  }
  if (profile.isCsBackground === false && schoolLists.codingTransitionRecommended) {
    response.codingTransitionRecommended = {
      summary: schoolLists.codingTransitionRecommended.summary || '',
      schools: filterBucket(schoolLists.codingTransitionRecommended.schools),
    };
  }
  let warnings = [];
  try {
    const r = classify(profile);
    if (Array.isArray(r.warnings)) warnings = warnings.concat(r.warnings);
  } catch (e) {}
  const allRecommended = [
    ...schoolList.reach,
    ...schoolList.match,
    ...schoolList.safety,
    ...((response.phdRecommended && response.phdRecommended.schools) || []),
    ...((response.codingTransitionRecommended && response.codingTransitionRecommended.schools) || []),
  ];
  const hasCmu = allRecommended.some((s) => /cmu|carnegie\s*mellon/i.test(s.school || ''));
  const isUsResident = profile.ugType === 'us-top' || profile.ugType === 'us-mid';
  if (hasCmu && !isUsResident) {
    warnings.push({
      type: 'cmu-language',
      severity: 'info',
      message: '推荐列表里包含 CMU 项目：CMU 对非美国身份的申请者硬性要求语言成绩（托福 / 雅思 / 多邻国均可），过期的托福成绩也接受。建议尽早安排考试，不要拖到申请季前最后一刻。',
    });
  }
  const hasDomesticFeeder = allRecommended.some((s) => hasTag(s, 'domestic-feeder-only'));
  if (hasDomesticFeeder && !isUsResident) {
    warnings.push({
      type: 'domestic-feeder-only',
      severity: 'info',
      message: '推荐里包含 UMich MSCS 等以本校 SUGS / 直系本科为主的项目，外校录取 hc 极少。建议作为 reach 试，主力还是放更对外友好的项目。',
    });
  }
  const hasUpennCis = allRecommended.some((s) => /upenn\s*cis|upenn\s*mscis/i.test(s.school || ''));
  if (hasUpennCis) {
    const floor = isUsResident ? 3.85 : 3.9;
    let gpa4 = 0;
    try {
      const mod = await import('./classifier.js');
      if (typeof mod.normalizeGpa === 'function') {
        gpa4 = mod.normalizeGpa(profile.gpa, profile.gpaScale);
      }
    } catch (e) {}
    if (gpa4 <= 0) {
      const g = Number(profile.gpa);
      if (!isNaN(g) && g > 0) {
        gpa4 = g > 4 ? Math.min(4, (g / 100) * 4) : g;
      }
    }
    if (gpa4 > 0 && gpa4 < floor) {
      warnings.push({
        type: 'school-gpa-floor-upenn-cis',
        severity: 'info',
        message: `UPenn CIS 对 GPA 有隐性下线（${isUsResident ? '美本约 3.85+' : '陆本约 3.9+'}）。你目前 GPA 折算约 ${gpa4.toFixed(2)} 可能被刷，建议作为冲刺校而非主申。`,
      });
    }
  }
  if (warnings.length > 0) response.warnings = warnings;
  return jsonResponse(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      switch (pathname) {
        case '/api/positioning/checkout':
          if (method !== 'POST') return textResponse('method not allowed', 405);
          return await handleCheckout(request, env);
        case '/api/stripe/webhook':
          if (method !== 'POST') return textResponse('method not allowed', 405);
          return await handleWebhook(request, env);
        case '/api/positioning/result':
          if (method !== 'GET') return textResponse('method not allowed', 405);
          return await handleResult(request, env);
        default:
          return textResponse('not found', 404);
      }
    } catch (err) {
      return jsonResponse({ error: 'internal_error', message: String(err && err.message || err) }, 500);
    }
  },
};
