// Client for the DataPoints API.
//
// Row data always comes from the live worker via /api/dp. The static
// dp-snapshot.json is now slim — only filter-option lists + total counts —
// used to populate filter dropdowns and header counts before the API
// responds. There is no full-snapshot fallback for rows.

import { WORKER_BASE_URL } from '../positioning/api';
import { LIST_LIMIT_API } from './config';

export const DP_API_BASE = WORKER_BASE_URL; // same worker as positioning

// In production builds we want fallback errors to stay silent (resilience is a
// feature). In dev, surface them via console.warn so debugging is easier.
const IS_DEV =
  typeof process !== 'undefined' &&
  process.env &&
  process.env.NODE_ENV !== 'production';

function warnDev(...args) {
  if (IS_DEV && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('[dp/api]', ...args);
  }
}

// ---------- public API ----------

/**
 * Fetch a filtered, paginated list of DPs.
 * @param {object} opts
 * @param {string} [opts.school]
 * @param {string} [opts.tier]
 * @param {string|number} [opts.year]
 * @param {string} [opts.result]
 * @param {string} [opts.ugCategory]
 * @param {string} [opts.major]
 * @param {number} [opts.gpaMin]
 * @param {number} [opts.gpaMax]
 * @param {string} [opts.q]
 * @param {number} [opts.limit=50]
 * @param {number} [opts.offset=0]
 * @returns {Promise<{rows, total, source: 'api'|'snapshot', offset, limit, _fallbackError?: string}>}
 */
export async function listDp(opts = {}) {
  const url = buildUrl('/api/dp', opts);
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  return { ...json, source: 'api' };
}

export async function getMe() {
  try {
    const r = await fetch(`${DP_API_BASE}/api/me`, { credentials: 'include' });
    if (!r.ok) return { user: null };
    return await r.json();
  } catch (err) {
    warnDev('getMe failed:', err && err.message ? err.message : err);
    return { user: null };
  }
}

export async function listPrograms({ q, status = 'active', limit = 500 } = {}) {
  const url = buildUrl('/api/programs', { q, status, limit });
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

// ---------- slim snapshot (just filter options + counts) ----------
// The page hits /api/dp for the actual rows; snapshot is only used to populate
// filter dropdowns + the header counts before any API call.

let _snapshotPromise = null;
function loadSnapshot() {
  if (!_snapshotPromise) {
    _snapshotPromise = fetch('/data/dp-snapshot.json').then((r) => {
      if (!r.ok) throw new Error('snapshot unavailable');
      return r.json();
    }).catch((err) => {
      _snapshotPromise = null;
      throw err;
    });
  }
  return _snapshotPromise;
}

const TIER_ORDER = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];

/**
 * Returns the filter-option lists used by the DataPoints page filters.
 * Reads the slim snapshot (~2KB) and reorders tiers by the canonical order.
 * @returns {Promise<{schools: string[], tiers: string[], years: number[], ugCats: string[], majors: string[]}>}
 */
export async function getFilterOptions() {
  const snap = await loadSnapshot();
  const opts = snap.options || {};
  const tiers = opts.tiers || [];
  // Reorder by canonical tier rank, append non-canonical at the end.
  const tierList = TIER_ORDER.filter((t) => tiers.includes(t));
  for (const t of tiers) if (!TIER_ORDER.includes(t)) tierList.push(t);
  return {
    schools: opts.schools || [],
    tiers: tierList,
    years: opts.years || [],
    ugCats: opts.ugCats || [],
    majors: opts.majors || [],
  };
}

// ---------- helpers ----------

function buildUrl(path, params) {
  const url = new URL(path, DP_API_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

// Also expose snapshot counts for the header. Always reads from the local
// snapshot to avoid an extra round-trip (the API would need a /api/stats route).
export async function getCounts() {
  try {
    const snap = await loadSnapshot();
    return snap.counts;
  } catch (err) {
    warnDev('getCounts failed:', err && err.message ? err.message : err);
    return { applicants: 0, programs: 0, datapoints: 0 };
  }
}

// ---------- write APIs (require session) ----------

async function jsonRequest(method, path, body) {
  const r = await fetch(`${DP_API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

export const getMyApplicant = () => jsonRequest('GET', '/api/applicant/me');
export const createMyApplicant = (body) => jsonRequest('POST', '/api/applicant/me', body);
export const updateMyApplicant = (body) => jsonRequest('PATCH', '/api/applicant/me', body);

export const createDp = (body) => jsonRequest('POST', '/api/dp', body);
export const updateDp = (id, body) => jsonRequest('PATCH', `/api/dp/${id}`, body);
export const deleteDp = (id) => jsonRequest('DELETE', `/api/dp/${id}`);

// List one applicant's DPs via the server-side applicantId filter.
export async function listMyDp(applicantId) {
  if (!applicantId) return { rows: [], total: 0 };
  const url = buildUrl('/api/dp', { applicantId, limit: LIST_LIMIT_API });
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

export async function signOut() {
  try {
    await fetch(`${DP_API_BASE}/api/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (err) {
    warnDev('signOut failed:', err && err.message ? err.message : err);
  }
}
