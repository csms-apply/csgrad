const ALLOWED_EVENTS = new Set([
  'consulting_intent',
  'wechat_copy',
  'wechat_qr_view',
  'positioning_start',
  'begin_checkout',
  'experiment_exposure',
  'purchase',
]);

const ALLOWED_PARAMETERS = new Set([
  'locale',
  'page_type',
  'method',
  'content_group',
  'tier',
  'status',
  'experiment_id',
  'variant',
  'currency',
  'value',
  'transaction_id',
]);

const MAX_STRING_LENGTH = 100;

function safeValue(value) {
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return undefined;
}

function safeParameter(key, value) {
  if (key === 'currency') {
    if (typeof value !== 'string') return undefined;
    const currency = value.toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : undefined;
  }
  if (key === 'value') {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? value
      : undefined;
  }
  if (key === 'transaction_id') {
    return typeof value === 'string' && /^positioning_[a-f0-9]{32}$/.test(value)
      ? value
      : undefined;
  }
  if (key === 'variant') {
    return value === 'control' || value === 'variant' ? value : undefined;
  }
  if (key === 'experiment_id') {
    return typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value)
      ? value
      : undefined;
  }
  return safeValue(value);
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
    const normalized = safeParameter(key, value);
    if (normalized !== undefined) payload[key] = normalized;
  }

  if (
    name === 'purchase'
    && (!payload.transaction_id || !payload.currency || typeof payload.value !== 'number')
  ) {
    return false;
  }
  if (name === 'experiment_exposure' && (!payload.experiment_id || !payload.variant)) {
    return false;
  }

  const pathname = safeValue(target.location && target.location.pathname);
  if (pathname) payload.page_path = pathname;

  target.gtag('event', name, payload);
  return true;
}
