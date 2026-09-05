import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

function normalizeRoute(route) {
  if (typeof route !== 'string' || !route.startsWith('/')) {
    throw new TypeError(`Localized alternate routes must start with "/": ${route}`);
  }
  const normalized = route === '/' ? route : route.replace(/\/+$/, '');
  const segments = normalized.split('/').slice(1).map((segment) => decodeURIComponent(segment));
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new TypeError(`Localized alternate route cannot traverse directories: ${route}`);
  }
  return normalized;
}

function routeFile(outDir, route, baseUrl = '/') {
  const normalized = normalizeRoute(route);
  const normalizedBase = normalizeRoute(baseUrl);
  const relativeRoute = normalizedBase === '/'
    ? normalized
    : normalized === normalizedBase
      ? '/'
      : normalized.startsWith(`${normalizedBase}/`)
        ? normalized.slice(normalizedBase.length)
        : null;
  if (!relativeRoute) {
    throw new Error(`Route ${route} is outside the locale base URL ${baseUrl}`);
  }
  if (relativeRoute === '/') return path.join(outDir, 'index.html');
  return path.join(outDir, ...relativeRoute.slice(1).split('/').map(decodeURIComponent), 'index.html');
}

function attributes(tag) {
  const result = {};
  const body = tag.replace(/^<[^\s>]+\s*/i, '').replace(/\/?\s*>$/, '');
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(pattern)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function replaceAlternates(html, alternates) {
  const languages = new Set(alternates.map(({lang}) => lang.toLowerCase()));
  const withoutGeneratedAlternates = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const attrs = attributes(tag);
    const relationships = attrs.rel?.toLowerCase().split(/\s+/) ?? [];
    return relationships.includes('alternate') && languages.has(attrs.hreflang?.toLowerCase())
      ? ''
      : tag;
  });

  if (!/<\/head>/i.test(withoutGeneratedAlternates)) {
    throw new Error('Cannot add localized alternates because the built page has no </head>');
  }

  const tags = alternates.map(({lang, href}) => (
    `<link data-rh="true" rel="alternate" href="${escapeAttribute(href)}" hreflang="${escapeAttribute(lang)}">`
  ));
  return withoutGeneratedAlternates.replace(/<\/head>/i, `${tags.join('')}</head>`);
}

/**
 * Corrects localized pages whose translated route differs from the source route.
 * Docusaurus otherwise assumes both locales share the same pathname.
 */
export default function localizedAlternatesPlugin(context, options = {}) {
  const siteUrl = context.siteConfig.url.replace(/\/+$/, '');
  const pairs = options.pairs ?? [];
  const currentLocale = context.i18n?.currentLocale;
  const currentHtmlLang = currentLocale
    ? context.i18n?.localeConfigs?.[currentLocale]?.htmlLang
    : null;

  return {
    name: 'csgrad-localized-alternates',
    async postBuild({outDir, baseUrl = '/'}) {
      const pages = pairs.flatMap((pair) => {
        const defaultRoute = normalizeRoute(pair.defaultRoute);
        const localizedRoute = normalizeRoute(pair.localizedRoute);
        const alternates = [
          {lang: pair.defaultLocale, href: `${siteUrl}${defaultRoute}`},
          {lang: pair.localizedLocale, href: `${siteUrl}${localizedRoute}`},
          {lang: 'x-default', href: `${siteUrl}${defaultRoute}`},
        ];
        const routes = !currentHtmlLang
          ? [defaultRoute, localizedRoute]
          : [
            ...(currentHtmlLang.toLowerCase() === pair.defaultLocale.toLowerCase() ? [defaultRoute] : []),
            ...(currentHtmlLang.toLowerCase() === pair.localizedLocale.toLowerCase() ? [localizedRoute] : []),
          ];
        return routes.map((route) => ({route, alternates}));
      }).sort((left, right) => left.route < right.route ? -1 : left.route > right.route ? 1 : 0);

      for (const page of pages) {
        const file = routeFile(outDir, page.route, baseUrl);
        const html = await readFile(file, 'utf8');
        await writeFile(file, replaceAlternates(html, page.alternates));
      }
    },
  };
}
