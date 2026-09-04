const ALLOWED_EVENTS = new Set([
  'consulting_intent',
  'wechat_copy',
  'wechat_qr_view',
  'positioning_start',
  'begin_checkout',
]);

const ALLOWED_PARAMETERS = new Set([
  'locale',
  'page_type',
  'method',
  'content_group',
  'tier',
  'status',
]);

const MAX_STRING_LENGTH = 100;

function safeValue(value) {
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return undefined;
}

/**
 * Send one of CS Grad's intentionally small, PII-free SEO funnel events.
 * Unknown event names, unknown parameters, and non-scalar values are dropped.
 * Returns whether an event was handed to gtag.
 */
export function trackSeoEvent(name, parameters = {}, browserWindow = undefined) {
  if (!ALLOWED_EVENTS.has(name)) return false;

  const target = browserWindow === undefined
    ? (typeof window === 'undefined' ? null : window)
    : browserWindow;
  if (!target || typeof target.gtag !== 'function') return false;

  const payload = {};
  for (const [key, value] of Object.entries(parameters || {})) {
    if (!ALLOWED_PARAMETERS.has(key)) continue;
    const normalized = safeValue(value);
    if (normalized !== undefined) payload[key] = normalized;
  }

  const pathname = safeValue(target.location && target.location.pathname);
  if (pathname) payload.page_path = pathname;

  target.gtag('event', name, payload);
  return true;
}
