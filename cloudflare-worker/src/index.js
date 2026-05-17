import { classify } from './classifier.js';
import schoolLists from '../../src/lib/positioning/school-lists.json';
import { createCheckoutSession, verifyStripeSignature } from './stripe.js';

const FRONTEND_RESULT_URL = 'https://csgrad.com/school-positioning-result';
const FRONTEND_CANCEL_URL = 'https://csgrad.com/school-positioning?canceled=1';
const KV_TTL_SECONDS = 60 * 60 * 24 * 30;

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

  let session;
  try {
    session = await createCheckoutSession(env.STRIPE_SECRET_KEY, {
      submissionId: sessionId,
      successUrl: `${FRONTEND_RESULT_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: FRONTEND_CANCEL_URL,
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
  if (record.status !== 'paid') {
    return jsonResponse({ status: 'pending' });
  }
  return jsonResponse({
    status: 'paid',
    tier: record.tier,
    schoolList: schoolLists[record.tier] || { summary: '', reach: [], match: [], safety: [] },
  });
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
