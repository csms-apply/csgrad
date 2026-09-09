import OpenCC from 'opencc-js/cn2t';

const convert = OpenCC.Converter({from: 'cn', to: 'tw'});
const cache = new WeakMap();

// Convert presentation text only. Persisted values, object keys and routes
// retain their original spelling so language changes cannot alter API data.
export function toTraditional(value) {
  return typeof value === 'string' ? convert(value) : value;
}

export function localizeMessages(value, locale) {
  if (locale !== 'zh-Hant') return value;
  if (typeof value === 'string') {
    return /^(?:https?:\/\/|\/|#)/.test(value) ? value : toTraditional(value);
  }
  if (typeof value === 'function') return (...args) => localizeMessages(value(...args), locale);
  if (!value || typeof value !== 'object') return value;
  if (cache.has(value)) return cache.get(value);
  const result = Array.isArray(value)
    ? value.map(item => localizeMessages(item, locale))
    : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeMessages(item, locale)]));
  cache.set(value, result);
  return result;
}

export function getLocaleMessages(messages, locale) {
  return messages[locale] || localizeMessages(messages['zh-Hans'], locale);
}
