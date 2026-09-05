#!/usr/bin/env node

import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const buildDir = path.resolve(process.argv[2] ?? 'build');

async function findFiles(directory, predicate) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findFiles(entryPath, predicate));
    } else if (predicate(entryPath)) {
      files.push(entryPath);
    }
  }
  return files;
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

async function main() {
  const htmlFiles = (await findFiles(buildDir, (file) => file.endsWith('.html')))
    .filter((file) => path.basename(file) !== '404.html');
  const pages = await Promise.all(htmlFiles.map(async (file) => ({
    file,
    html: await readFile(file, 'utf8'),
  })));
  const indexablePages = pages.filter(({html}) => !isNoindex(html));
  const indexableCount = indexablePages.length;
  const issues = [];
  const titleOwners = new Map();
  const descriptionOwners = new Map();
  const canonicalOwners = new Map();

  for (const page of indexablePages) {
    const titles = elementTexts(page.html, 'title');
    if (titles.length !== 1 || !titles[0]) {
      issues.push(`[title-missing] ${pageRoute(page.file)} must have one non-empty <title>`);
    } else {
      const titleKey = comparisonKey(titles[0]);
      const firstOwner = titleOwners.get(titleKey);
      if (firstOwner) {
        issues.push(`[title-duplicate] ${firstOwner} and ${pageRoute(page.file)} share the title "${titles[0]}"`);
      } else {
        titleOwners.set(titleKey, pageRoute(page.file));
      }
    }

    const pageDescriptions = descriptions(page.html);
    if (pageDescriptions.length !== 1 || !pageDescriptions[0]) {
      issues.push(`[description-missing] ${pageRoute(page.file)} must have one non-empty meta description`);
    } else {
      const descriptionKey = comparisonKey(pageDescriptions[0]);
      const firstOwner = descriptionOwners.get(descriptionKey);
      if (firstOwner) {
        issues.push(`[description-duplicate] ${firstOwner} and ${pageRoute(page.file)} share the same meta description`);
      } else {
        descriptionOwners.set(descriptionKey, pageRoute(page.file));
      }
    }

    const canonicals = linksWithRel(page.html, 'canonical');
    if (canonicals.length !== 1 || !canonicals[0]) {
      issues.push(`[canonical-missing] ${pageRoute(page.file)} must have one canonical URL`);
    } else {
      const canonicalKey = urlKey(canonicals[0]);
      const firstOwner = canonicalOwners.get(canonicalKey);
      if (firstOwner) {
        issues.push(`[canonical-duplicate] ${firstOwner} and ${pageRoute(page.file)} share canonical ${canonicals[0]}`);
      } else {
        canonicalOwners.set(canonicalKey, pageRoute(page.file));
      }
    }

    const headings = elementTexts(page.html, 'h1');
    if (headings.length !== 1 || !headings[0]) {
      issues.push(`[h1-count] ${pageRoute(page.file)} must have exactly one non-empty <h1>; found ${headings.length}`);
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

  const sitemapFiles = await findFiles(buildDir, (file) => /(?:^|\/)sitemap[^/]*\.xml$/i.test(file));
  const sitemapUrls = [];
  for (const file of sitemapFiles) {
    const xml = await readFile(file, 'utf8');
    sitemapUrls.push(...[...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim()));
  }
  const sitemapUrlCount = sitemapUrls.length;

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

  if (issues.length > 0) {
    console.error(`SEO audit failed with ${issues.length} issue(s):`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }

  console.log(`SEO audit passed: ${indexableCount} indexable pages, ${sitemapUrlCount} sitemap URLs`);
}

main().catch((error) => {
  console.error(`SEO audit failed: ${error.message}`);
  process.exitCode = 1;
});
