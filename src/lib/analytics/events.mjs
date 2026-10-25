const ALLOWED_EVENTS = new Set([
  'consulting_intent',
  'wechat_copy',
  'wechat_qr_view',
  'positioning_start',
  'begin_checkout',
  'experiment_exposure',
  'purchase',
  'language_preference_set',
  'language_preference_applied',
  'audience_visit',
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

// Language analytics accepts only bounded categories, never caller-supplied text.
const LANGUAGE_EVENTS = new Set([
  'language_preference_set', 'language_preference_applied', 'audience_visit',
]);
const SUPPORTED_LOCALES = new Set(['zh-Hans', 'zh-Hant', 'en']);
const LANGUAGE_PARAMETERS = {
  current_locale: SUPPORTED_LOCALES,
  selected_locale: SUPPORTED_LOCALES,
  preferred_locale: new Set([...SUPPORTED_LOCALES, 'none']),
  preference_source: new Set(['manual', 'saved', 'default']),
  storage_status: new Set(['persisted', 'unavailable', 'none']),
};

function languagePayload(name, parameters) {
  const payload = {};
  for (const [key, allowed] of Object.entries(LANGUAGE_PARAMETERS)) {
    if (allowed.has(parameters[key])) payload[key] = parameters[key];
  }
  if (!payload.current_locale || !payload.preferred_locale || !payload.preference_source) {
    return null;
  }
  if (name === 'language_preference_set' && !payload.selected_locale) return null;
  if (name !== 'language_preference_set') delete payload.selected_locale;
  return payload;
}

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

  if (LANGUAGE_EVENTS.has(name)) {
    const payload = languagePayload(name, parameters || {});
    if (!payload) return false;
    // Override GA's default full URL: checkout/query/hash can contain private data.
    // The locale-level page location is sufficient for this audience breakdown.
    const localePath = payload.current_locale === 'zh-Hans' ? '/' : `/${payload.current_locale}/`;
    payload.page_location = `https://csgrad.com${localePath}`;
    payload.page_path = localePath;
    payload.page_referrer = '';
    payload.transport_type = 'beacon';
    target.gtag('event', name, payload);
    return true;
  }

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
