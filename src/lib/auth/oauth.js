// Shared OAuth helper for the DataPoints pages.
//
// Wraps the `/api/auth/sign-in/social` call used by datapoints, submit-dp
// and my-dp. Previously each page inlined this logic with its own ad-hoc
// `alert()` error path; this module centralises the network call and the
// draft-save side effect, and *throws* instead of alerting so each caller
// can decide how to surface failures (inline error, modal, etc).

import { DP_API_BASE } from '../dp/api';

/**
 * Kick off the social sign-in flow.
 *
 * On success this navigates the window to the provider's OAuth URL and
 * never returns. On failure it throws so the caller can render an inline
 * error.
 *
 * @param {'google'|'github'} provider
 * @param {object} [opts]
 * @param {string} [opts.callbackURL]  defaults to current window URL
 * @param {string} [opts.draftKey]     localStorage key for surviving the OAuth redirect
 * @param {unknown} [opts.draftValue]  draft payload to JSON.stringify into localStorage
 */
export async function startOAuth(provider, opts = {}) {
  const {
    callbackURL = typeof window !== 'undefined' ? window.location.href : '',
    draftKey,
    draftValue,
  } = opts;

  if (draftKey && draftValue !== undefined) {
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftValue));
    } catch {
      // ignore storage errors (private mode, quota, etc) — sign-in should
      // still proceed; the user just loses the draft.
    }
  }

  const r = await fetch(`${DP_API_BASE}/api/auth/sign-in/social`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ provider, callbackURL }),
  });

  let data = null;
  try { data = await r.json(); } catch {}

  if (!r.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
    throw new Error(msg);
  }
  if (!data || !data.url) {
    throw new Error((data && data.message) || 'unknown error');
  }
  window.location.href = data.url;
}
