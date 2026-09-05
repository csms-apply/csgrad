const localizedRouteGroups = Object.freeze([
  Object.freeze({
    'zh-Hans': '/找我辅导',
    en: '/en/consulting',
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
