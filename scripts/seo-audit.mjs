#!/usr/bin/env node

import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const cliArgs = process.argv.slice(2);
let buildArgument = 'build';
let baselineArgument = null;
for (let index = 0; index < cliArgs.length; index += 1) {
  if (cliArgs[index] === '--baseline') {
    baselineArgument = cliArgs[index + 1];
    index += 1;
  } else if (!cliArgs[index].startsWith('--')) {
    buildArgument = cliArgs[index];
  }
}

const buildDir = path.resolve(buildArgument);
const baselineFile = baselineArgument ? path.resolve(baselineArgument) : null;
function stableCompare(left, right) {
  const leftSegments = left.split(/[\\/]/);
  const rightSegments = right.split(/[\\/]/);
  for (let index = 0; index < Math.max(leftSegments.length, rightSegments.length); index += 1) {
    const leftSegment = leftSegments[index];
    const rightSegment = rightSegments[index];
    if (leftSegment === rightSegment) continue;
    if (leftSegment === undefined) return -1;
    if (rightSegment === undefined) return 1;
    if (leftSegment.startsWith(rightSegment)) return 1;
    if (rightSegment.startsWith(leftSegment)) return -1;
    return leftSegment < rightSegment ? -1 : 1;
  }
  return 0;
}

async function findFiles(directory, predicate) {
  const entries = (await readdir(directory, {withFileTypes: true}))
    .sort((left, right) => stableCompare(left.name, right.name));
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findFiles(entryPath, predicate));
    } else if (predicate(entryPath)) {
      files.push(entryPath);
    }
  }
  return files.sort(stableCompare);
}

function isNoindex(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some((match) => {
    const tag = match[0];
    return /\bname\s*=\s*["']robots["']/i.test(tag)
      && /\bcontent\s*=\s*["'][^"']*\bnoindex\b[^"']*["']/i.test(tag);
  });
}

function pageRoute(file) {
  const relative = path.relative(buildDir, file).split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'/index.html'.length)}`;
  return `/${relative}`;
}

function elementTexts(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  return [...html.matchAll(pattern)]
    .map((match) => match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function comparisonKey(value) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
}

function tags(html, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  return [...html.matchAll(pattern)].map((match) => match[0]);
}

function attributes(tag) {
  const result = {};
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const body = tag.replace(/^<[^\s>]+\s*/i, '').replace(/\/?\s*>$/, '');
  for (const match of body.matchAll(attributePattern)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function descriptions(html) {
  return tags(html, 'meta')
    .map(attributes)
    .filter((attrs) => attrs.name?.toLowerCase() === 'description')
    .map((attrs) => attrs.content?.replace(/\s+/g, ' ').trim() ?? '');
}

function linksWithRel(html, relationship) {
  return tags(html, 'link')
    .map(attributes)
    .filter((attrs) => attrs.rel?.toLowerCase().split(/\s+/).includes(relationship))
    .map((attrs) => attrs.href?.trim() ?? '');
}

function languageAlternates(html) {
  return tags(html, 'link')
    .map(attributes)
    .filter((attrs) => attrs.rel?.toLowerCase().split(/\s+/).includes('alternate') && attrs.hreflang)
    .map((attrs) => ({lang: attrs.hreflang, href: attrs.href?.trim() ?? ''}));
}

function urlKey(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    return comparisonKey(value);
  }
}

function routeKey(value) {
  let pathname = value;
  try {
    pathname = new URL(value).pathname;
  } catch {
    // A local route is also accepted here.
  }
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep malformed escapes unchanged so the audit can report the URL.
  }
  const normalized = `/${pathname}`.replace(/\/{2,}/g, '/').normalize('NFKC');
  return normalized === '/' ? normalized : normalized.replace(/\/+$/, '');
}

function localeKey(route) {
  return route === '/en' || route.startsWith('/en/') ? 'en' : 'zh-Hans';
}

async function main() {
  const htmlFiles = (await findFiles(buildDir, (file) => file.endsWith('.html')))
    .filter((file) => path.basename(file) !== '404.html');
  const pages = (await Promise.all(htmlFiles.map(async (file) => ({
    file,
    html: await readFile(file, 'utf8'),
  }))))
    .sort((left, right) => {
      const leftRoute = pageRoute(left.file);
      const rightRoute = pageRoute(right.file);
      return stableCompare(leftRoute, rightRoute);
    });
  const indexablePages = pages.filter(({html}) => !isNoindex(html));
  const indexableCount = indexablePages.length;
  const issues = [];
  const titleOwners = new Map();
  const descriptionOwners = new Map();
  const canonicalOwners = new Map();

  for (const page of indexablePages) {
    const route = pageRoute(page.file);
    const locale = localeKey(route);
    const titles = elementTexts(page.html, 'title');
    if (titles.length !== 1 || !titles[0]) {
      issues.push(`[title-missing] ${route} must have one non-empty <title>`);
    } else {
      const titleKey = `${locale}\0${comparisonKey(titles[0])}`;
      const firstOwner = titleOwners.get(titleKey);
      if (firstOwner) {
        issues.push(`[title-duplicate] ${firstOwner} and ${route} share the title "${titles[0]}"`);
      } else {
        titleOwners.set(titleKey, route);
      }
    }

    const pageDescriptions = descriptions(page.html);
    if (pageDescriptions.length !== 1 || !pageDescriptions[0]) {
      issues.push(`[description-missing] ${route} must have one non-empty meta description`);
    } else {
      const descriptionKey = `${locale}\0${comparisonKey(pageDescriptions[0])}`;
      const firstOwner = descriptionOwners.get(descriptionKey);
      if (firstOwner) {
        issues.push(`[description-duplicate] ${firstOwner} and ${route} share the same meta description`);
      } else {
        descriptionOwners.set(descriptionKey, route);
      }
    }

    const canonicals = linksWithRel(page.html, 'canonical');
    if (canonicals.length !== 1 || !canonicals[0]) {
      issues.push(`[canonical-missing] ${route} must have one canonical URL`);
    } else {
      const canonicalKey = urlKey(canonicals[0]);
      const firstOwner = canonicalOwners.get(canonicalKey);
      if (firstOwner) {
        issues.push(`[canonical-duplicate] ${firstOwner} and ${route} share canonical ${canonicals[0]}`);
      } else {
        canonicalOwners.set(canonicalKey, route);
      }
    }

    const headings = elementTexts(page.html, 'h1');
    if (headings.length !== 1 || !headings[0]) {
      issues.push(`[h1-count] ${route} must have exactly one non-empty <h1>; found ${headings.length}`);
    }
  }

  const knownCanonicalUrls = new Set(canonicalOwners.keys());
  for (const page of indexablePages) {
    for (const alternate of languageAlternates(page.html)) {
      if (!alternate.href || !knownCanonicalUrls.has(urlKey(alternate.href))) {
        issues.push(`[hreflang-target-missing] ${pageRoute(page.file)} hreflang ${alternate.lang} targets missing page ${alternate.href || '(empty href)'}`);
      }
    }
  }

  const pagesByCanonical = new Map();
  const pagesByRoute = new Map();
  for (const page of pages) {
    const [canonical] = linksWithRel(page.html, 'canonical');
    if (canonical) pagesByCanonical.set(urlKey(canonical), page);
    pagesByRoute.set(routeKey(pageRoute(page.file)), page);
  }

  // Navigation and SEO alternate tags can diverge. Validate the links that
  // visitors actually click, including pages intentionally excluded from SEO.
  for (const page of pages) {
    for (const attrs of tags(page.html, 'a').map(attributes)) {
      if (!attrs.lang || !attrs.href?.startsWith('/') || attrs.href.startsWith('//')) continue;
      const target = new URL(attrs.href.replace(/&amp;/g, '&'), 'https://csgrad.com');
      if (!pagesByRoute.has(routeKey(target.pathname))) {
        issues.push(`[locale-navigation-target-missing] ${pageRoute(page.file)} language ${attrs.lang} targets missing page ${attrs.href}`);
      }
    }
  }

  const sitemapFiles = await findFiles(buildDir, (file) => /(?:^|\/)sitemap[^/]*\.xml$/i.test(file));
  if (sitemapFiles.length === 0) {
    issues.push('[sitemap-missing] no sitemap XML files were found');
  }
  const sitemapUrls = [];
  for (const file of sitemapFiles) {
    const xml = await readFile(file, 'utf8');
    sitemapUrls.push(...[...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim()));
  }
  if (sitemapFiles.length > 0 && sitemapUrls.length === 0) {
    issues.push('[sitemap-empty] sitemap XML files contain no URLs');
  }
  const sitemapUrlCount = sitemapUrls.length;
  const sitemapUrlKeys = new Set(sitemapUrls.map(urlKey));

  for (const page of indexablePages) {
    const [canonical] = linksWithRel(page.html, 'canonical');
    if (canonical && !sitemapUrlKeys.has(urlKey(canonical))) {
      issues.push(`[sitemap-canonical-missing] ${pageRoute(page.file)} canonical ${canonical} is not listed in a sitemap`);
    }
  }

  for (const sitemapUrl of sitemapUrls) {
    const page = pagesByCanonical.get(urlKey(sitemapUrl)) ?? pagesByRoute.get(routeKey(sitemapUrl));
    if (!page) {
      issues.push(`[sitemap-target-missing] ${sitemapUrl} has no matching built HTML page`);
      continue;
    }
    if (page && isNoindex(page.html)) {
      issues.push(`[sitemap-noindex] ${sitemapUrl} points to noindex page ${pageRoute(page.file)}`);
      continue;
    }
    const [canonical] = linksWithRel(page.html, 'canonical');
    if (!canonical || urlKey(canonical) !== urlKey(sitemapUrl)) {
      issues.push(`[sitemap-noncanonical] ${sitemapUrl} is not canonical; ${pageRoute(page.file)} declares ${canonical || '(missing canonical)'}`);
    }
  }

  const currentIssues = [...new Set(issues)].sort();
  const knownIssues = baselineFile
    ? new Set((await readFile(baselineFile, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')))
    : new Set();
  const newIssues = currentIssues.filter((issue) => !knownIssues.has(issue));
  const resolvedIssues = [...knownIssues].filter((issue) => !currentIssues.includes(issue));

  let failed = false;
  if (newIssues.length > 0) {
    console.error(`SEO audit failed with ${newIssues.length} new issue(s):`);
    for (const issue of newIssues) console.error(`- ${issue}`);
    failed = true;
  }

  if (resolvedIssues.length > 0) {
    console.error(`SEO audit failed with ${resolvedIssues.length} stale baseline issue(s); delete these entries from ${baselineFile}:`);
    for (const issue of resolvedIssues) console.error(`- delete ${issue}`);
    failed = true;
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  const legacySummary = currentIssues.length > 0
    ? `, ${currentIssues.length} known legacy issue(s)`
    : '';
  console.log(`SEO audit passed: ${indexableCount} indexable pages, ${sitemapUrlCount} sitemap URLs${legacySummary}`);
}

main().catch((error) => {
  console.error(`SEO audit failed: ${error.message}`);
  process.exitCode = 1;
});
