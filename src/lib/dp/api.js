// Client for the DataPoints API.
//
// Tries the live worker first; falls back to the static snapshot if the worker
// is unreachable or returns a non-2xx. This lets the page work both before
// the backend is deployed (snapshot only) and after (live API, fresh data).

import { WORKER_BASE_URL } from '../positioning/api';

export const DP_API_BASE = WORKER_BASE_URL; // same worker as positioning

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
 * @returns {Promise<{rows, total, source: 'api'|'snapshot'}>}
 */
export async function listDp(opts = {}) {
  try {
    const url = buildUrl('/api/dp', opts);
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    return { ...json, source: 'api' };
  } catch (err) {
    // fallback: filter the local snapshot
    const snap = await loadSnapshot();
    return filterSnapshot(snap, opts);
  }
}

export async function getMe() {
  try {
    const r = await fetch(`${DP_API_BASE}/api/me`, { credentials: 'include' });
    if (!r.ok) return { user: null };
    return await r.json();
  } catch {
    return { user: null };
  }
}

export async function listPrograms({ q, status = 'active', limit = 500 } = {}) {
  try {
    const url = buildUrl('/api/programs', { q, status, limit });
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
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
    });
  }
  return _snapshotPromise;
}

function filterSnapshot(snap, opts) {
  const { applicants, programs, datapoints } = snap;
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
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
  } catch {
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
  // Use a high limit; per-user DP count is typically < 30.
  const url = buildUrl('/api/dp', { limit: 200 });
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
  } catch {}
}
