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
  'items',
]);

const MAX_STRING_LENGTH = 100;
const POSITIONING_ITEM_ID = 'school_positioning_report';
const POSITIONING_ITEM_NAME = 'MSCS School Positioning Report';
const POSITIONING_ITEM_KEYS = new Set(['item_id', 'item_name', 'price', 'quantity']);

function safeValue(value) {
  if (typeof value === 'string') return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  return undefined;
}

function safePurchaseItems(value) {
  if (!Array.isArray(value) || value.length !== 1) return undefined;
  const [item] = value;
  if (!item || typeof item !== 'object' || Array.isArray(item)) return undefined;
  const keys = Object.keys(item);
  if (keys.length !== POSITIONING_ITEM_KEYS.size) return undefined;
  if (keys.some((key) => !POSITIONING_ITEM_KEYS.has(key))) return undefined;
  if (item.item_id !== POSITIONING_ITEM_ID || item.item_name !== POSITIONING_ITEM_NAME) {
    return undefined;
  }
  if (typeof item.price !== 'number' || !Number.isFinite(item.price) || item.price < 0) {
    return undefined;
  }
  if (item.quantity !== 1) return undefined;

  return [{
    item_id: POSITIONING_ITEM_ID,
    item_name: POSITIONING_ITEM_NAME,
    price: item.price,
    quantity: 1,
  }];
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
  if (key === 'items') return safePurchaseItems(value);
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
 * Unknown event names and parameters are dropped. Values must be safe scalars,
 * except for the exact, PII-free GA4 purchase item schema validated above.
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
    && (
      !payload.transaction_id
      || !payload.currency
      || typeof payload.value !== 'number'
      || !payload.items
      || payload.items[0].price !== payload.value
    )
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
