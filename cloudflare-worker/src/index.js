/**
 * Cloudflare Worker — csgrad report API
 *
 * Routes:
 *   POST /api/validate-code  — Validate redemption code, return JWT session
 *   POST /api/generate-report — Generate school positioning report
 *
 * Environment bindings:
 *   - SEATABLE_API_TOKEN (secret)
 *   - SEATABLE_BASE_UUID (secret)
 *   - HMAC_SECRET (secret)
 *   - REDEMPTION_CODES (KV namespace)
 */

import { querySimilarProfiles } from './seatable.js';
import { classifyPrograms } from './classifier.js';

// ---- CORS ----
const ALLOWED_ORIGINS = [
  'https://csms-apply.github.io',
  'https://csgrad.com',
  'http://localhost:3000',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status = 200, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
    },
  });
}

// ---- JWT helpers (HMAC-SHA256) ----
async function createJwt(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const data = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return `${data}.${signature}`;
}

async function verifyJwt(token, secret) {
  try {
    const [header, body, signature] = token.split('.');
    const data = `${header}.${body}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));

    if (!valid) return null;

    const payload = JSON.parse(atob(body));
    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// ---- Route: Validate Redemption Code ----
async function handleValidateCode(request, env) {
  const { code } = await request.json();

  if (!code || typeof code !== 'string') {
    return jsonResponse({ error: '请输入兑换码' }, 400, request);
  }

  const trimmed = code.trim().toUpperCase();

  // Check KV for the code
  const stored = await env.REDEMPTION_CODES.get(trimmed);
  if (!stored) {
    return jsonResponse({ error: '兑换码无效' }, 403, request);
  }

  const meta = JSON.parse(stored);

  // Check if code has remaining uses
  if (meta.usesLeft !== undefined && meta.usesLeft <= 0) {
    return jsonResponse({ error: '兑换码已用完' }, 403, request);
  }

  // Decrement uses
  if (meta.usesLeft !== undefined) {
    meta.usesLeft--;
    await env.REDEMPTION_CODES.put(trimmed, JSON.stringify(meta));
  }

  // Issue JWT (24h validity)
  const token = await createJwt(
    {
      code: trimmed,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000,
    },
    env.HMAC_SECRET
  );

  return jsonResponse({ token, expiresIn: 86400 }, 200, request);
}

// ---- Route: Generate Report ----
async function handleGenerateReport(request, env) {
  // Verify JWT
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  const payload = await verifyJwt(token, env.HMAC_SECRET);

  if (!payload) {
    return jsonResponse({ error: '请先验证兑换码' }, 401, request);
  }

  const userProfile = await request.json();

  // Validate required fields
  if (!userProfile.gpa || !userProfile.gpaScale) {
    return jsonResponse({ error: '请填写 GPA 和 GPA 制' }, 400, request);
  }

  try {
    // Query SeaTable for similar profiles
    const { applicants, datapoints, gpaRange } = await querySimilarProfiles(env, userProfile);

    if (applicants.length === 0) {
      return jsonResponse(
        {
          report: {
            safety: [],
            target: [],
            reach: [],
            stats: { totalPrograms: 0, totalDatapoints: 0, totalApplicants: 0 },
            gpaRange,
            disclaimer: '本报告数据来源于互联网公开信息，仅供参考。',
          },
        },
        200,
        request
      );
    }

    // Classify programs
    const report = classifyPrograms(datapoints, applicants);
    report.gpaRange = gpaRange;
    report.disclaimer = '本报告数据来源于互联网公开信息，仅供参考。';

    return jsonResponse({ report }, 200, request);
  } catch (err) {
    console.error('Report generation error:', err);
    return jsonResponse({ error: '生成报告时出错，请稍后再试' }, 500, request);
  }
}

// ---- Main handler ----
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    // Route
    if (request.method === 'POST' && url.pathname === '/api/validate-code') {
      return handleValidateCode(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/generate-report') {
      return handleGenerateReport(request, env);
    }

    return jsonResponse({ error: 'Not found' }, 404, request);
  },
};
