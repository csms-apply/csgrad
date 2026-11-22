// Every locale serves a page at the same path, so internal links only swap the locale prefix.
// Internal page links retain their query/hash.
export function localizedInternalPath(href, locale) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
  const [, pathname, suffix] = href.match(/^([^?#]*)(.*)$/);
  const unlocalized = pathname.replace(/^\/(?:en|zh-Hant|ko|vi|ja)(?=\/|$)/, '').replace(/^\/+/, '/') || '/';
  const prefix = ['en', 'zh-Hant', 'ko', 'vi', 'ja'].includes(locale) ? `/${locale}` : '';
  return `${prefix}${unlocalized}${suffix}`;
}
