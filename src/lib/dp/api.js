// Client for the DataPoints API.
//
// Tries the live worker first; falls back to the static snapshot if the worker
// is unreachable or returns a non-2xx. This lets the page work both before
// the backend is deployed (snapshot only) and after (live API, fresh data).

import { WORKER_BASE_URL } from '../positioning/api';
import {
  PAGE_SIZE,
  LIST_LIMIT_API,
  LIST_LIMIT_SNAPSHOT_FALLBACK,
} from './config';

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
  try {
    const url = buildUrl('/api/dp', opts);
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    return { ...json, source: 'api' };
  } catch (err) {
    // Fallback: filter the local snapshot. Tag the original error so the page
    // can decide whether to surface it (current callers look at `source`).
    const errMsg = err && err.message ? err.message : String(err);
    warnDev('listDp falling back to snapshot:', errMsg);
    const snap = await loadSnapshot();
    const out = filterSnapshot(snap, opts);
    return { ...out, _fallbackError: errMsg };
  }
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
  try {
    const url = buildUrl('/api/programs', { q, status, limit });
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (err) {
    warnDev('listPrograms falling back to snapshot:', err && err.message ? err.message : err);
    const snap = await loadSnapshot();
    let rows = Object.values(snap.programs);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.school?.toLowerCase().includes(needle) ||
          p.program?.toLowerCase().includes(needle),
      );
    }
    return { rows: rows.slice(0, limit) };
  }
}

// ---------- snapshot fallback ----------

let _snapshotPromise = null;
function loadSnapshot() {
  if (!_snapshotPromise) {
    _snapshotPromise = fetch('/data/dp-snapshot.json').then((r) => {
      if (!r.ok) throw new Error('snapshot unavailable');
      return r.json();
    }).catch((err) => {
      // Reset on failure so a later call can retry (transient network blip).
      _snapshotPromise = null;
      throw err;
    });
  }
  return _snapshotPromise;
}

let _filterOptionsPromise = null;

const TIER_ORDER = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D'];

/**
 * Returns the filter-option lists used by the DataPoints page filters.
 * Lazily loads the snapshot the first time it's called and caches the result.
 * @returns {Promise<{schools: string[], tiers: string[], years: number[], ugCats: string[], majors: string[]}>}
 */
export function getFilterOptions() {
  if (!_filterOptionsPromise) {
    _filterOptionsPromise = loadSnapshot().then((snap) => {
      const schools = new Set();
      const tiers = new Set();
      const years = new Set();
      const ugCats = new Set();
      const majors = new Set();
      for (const p of Object.values(snap.programs || {})) {
        if (p.school) schools.add(p.school);
        if (p.tier) tiers.add(p.tier);
      }
      for (const a of Object.values(snap.applicants || {})) {
        if (a.ug_school_category) ugCats.add(a.ug_school_category);
        if (a.ug_major) majors.add(a.ug_major);
      }
      for (const d of snap.datapoints || []) {
        if (d.academic_year) years.add(d.academic_year);
      }
      const tierList = TIER_ORDER.filter((t) => tiers.has(t));
      // Append non-canonical tiers so we never silently drop new data.
      for (const t of tiers) if (!TIER_ORDER.includes(t)) tierList.push(t);
      return {
        schools: [...schools].sort(),
        tiers: tierList,
        years: [...years].sort((a, b) => b - a),
        ugCats: [...ugCats].sort(),
        majors: [...majors].sort(),
      };
    }).catch((err) => {
      _filterOptionsPromise = null;
      throw err;
    });
  }
  return _filterOptionsPromise;
}

function filterSnapshot(snap, opts) {
  const { applicants, programs, datapoints } = snap;
  const requested = Number(opts.limit) || PAGE_SIZE;
  const limit = Math.min(Math.max(requested, 1), LIST_LIMIT_SNAPSHOT_FALLBACK);
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const gMin = opts.gpaMin == null || opts.gpaMin === '' ? null : Number(opts.gpaMin);
  const gMax = opts.gpaMax == null || opts.gpaMax === '' ? null : Number(opts.gpaMax);
  const q = opts.q ? String(opts.q).toLowerCase() : null;

  const filtered = [];
  for (const d of datapoints) {
    const p = programs[d.program_id];
    const a = applicants[d.applicant_id];
    if (!p || !a) continue;
    if (opts.school && p.school !== opts.school) continue;
    if (opts.tier && p.tier !== opts.tier) continue;
    if (opts.year && d.academic_year !== Number(opts.year)) continue;
    if (opts.result && d.result !== opts.result) continue;
    if (opts.ugCategory && a.ug_school_category !== opts.ugCategory) continue;
    if (opts.major && a.ug_major !== opts.major) continue;
    if (gMin !== null && (a.gpa == null || a.gpa < gMin)) continue;
    if (gMax !== null && (a.gpa == null || a.gpa > gMax)) continue;
    if (q) {
      const hay = `${p.school} ${p.program} ${a.ug_school_name || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    filtered.push({ d, p, a });
  }
  filtered.sort((x, y) => {
    const xd = x.d.notified_at || x.d.submitted_at || '';
    const yd = y.d.notified_at || y.d.submitted_at || '';
    return yd.localeCompare(xd);
  });
  return {
    rows: filtered.slice(offset, offset + limit),
    total: filtered.length,
    offset,
    limit,
    source: 'snapshot',
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

// List the current user's own DPs. Backend's GET /api/dp doesn't filter by
// user, so we hit it with no filters and post-filter by applicant_id == me.
export async function listMyDp(applicantId) {
  if (!applicantId) return { rows: [], total: 0 };
  // Use the configured API list limit; per-user DP count is typically < 30.
  const url = buildUrl('/api/dp', { limit: LIST_LIMIT_API });
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const json = await r.json();
  const mine = json.rows.filter((row) => row.a?.id === applicantId);
  return { rows: mine, total: mine.length };
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
