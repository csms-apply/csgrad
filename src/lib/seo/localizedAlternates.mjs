const localizedRouteGroups = Object.freeze([
  Object.freeze({
    'zh-Hans': '/找我辅导',
    en: '/en/consulting',
  }),
  Object.freeze({
    'zh-Hans': '/转码项目',
    en: '/en/career-change-programs',
  }),
]);

function normalizePathname(pathname) {
  if (typeof pathname !== 'string') return '';

  const pathOnly = pathname.split(/[?#]/, 1)[0] || '/';
  let decodedPath = pathOnly;
  try {
    decodedPath = decodeURI(pathOnly);
  } catch {
    // Keep malformed paths unchanged so they simply use Docusaurus' fallback.
  }

  const leadingSlashPath = decodedPath.startsWith('/')
    ? decodedPath
    : `/${decodedPath}`;
  return leadingSlashPath === '/'
    ? leadingSlashPath
    : leadingSlashPath.replace(/\/+$/, '');
}

export function localizedAlternatePath(pathname, locale) {
  const normalizedPathname = normalizePathname(pathname);
  const routeGroup = localizedRouteGroups.find((routes) => (
    Object.values(routes).some((route) => normalizePathname(route) === normalizedPathname)
  ));
  return routeGroup?.[locale] ?? null;
}

export function localizedAlternateUrl({pathname, locale, siteUrl, fallback}) {
  const alternatePath = localizedAlternatePath(pathname, locale);
  if (!alternatePath) return fallback(locale);
  return `${siteUrl.replace(/\/+$/, '')}${alternatePath}`;
}

// Internal page links retain their query/hash; SEO alternates above stay route-only.
export function localizedInternalPath(href, locale) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
  const [, pathname, suffix] = href.match(/^([^?#]*)(.*)$/);
  const mapped = localizedAlternatePath(pathname, locale);
  if (mapped) return `${mapped}${suffix}`;
  const unlocalized = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return `${locale === 'en' ? `/en${unlocalized}` : unlocalized}${suffix}`;
}
