import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const scriptPath = fileURLToPath(new URL('./seo-audit.mjs', import.meta.url));

async function withSite(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'csgrad-seo-audit-'));
  try {
    await run({
      root,
      page: (route, options) => writePage(root, route, options),
      sitemap: (routes) => writeSitemap(root, routes),
      audit: (...args) => spawnSync(process.execPath, [scriptPath, root, ...args], {encoding: 'utf8'}),
    });
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

async function writePage(root, route, {
  title,
  description,
  canonical,
  h1,
  hreflangs = [],
  noindex = false,
}) {
  const relativePath = route === '/'
    ? 'index.html'
    : path.join(decodeURIComponent(route.replace(/^\//, '').replace(/\/$/, '')), 'index.html');
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), {recursive: true});
  const alternates = hreflangs
    .map(({lang, href}) => `<link href="${href}" hreflang="${lang}" rel="alternate">`)
    .join('');
  const headings = Array.isArray(h1) ? h1 : (h1 === undefined ? [] : [h1]);
  await writeFile(filePath, `<!doctype html><html><head>
    <title>${title ?? ''}</title>
    ${description === undefined ? '' : `<meta content="${description}" name="description">`}
    ${canonical === undefined ? '' : `<link href="${canonical}" rel="canonical">`}
    ${noindex ? '<meta content="noindex,follow" name="robots">' : ''}
    ${alternates}
  </head><body>${headings.map((heading) => `<h1>${heading}</h1>`).join('')}</body></html>`);
}

async function writeSitemap(root, routes) {
  const urls = routes.map((route) => `<url><loc>${route}</loc></url>`).join('');
  await writeFile(path.join(root, 'sitemap.xml'), `<urlset>${urls}</urlset>`);
}

test('accepts a valid Docusaurus bilingual build', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/', {
      title: 'CS Grad 中文首页',
      description: '北美计算机硕士申请与选校数据。',
      canonical: 'https://csgrad.com/',
      h1: '北美计算机硕士申请指南',
      hreflangs: [
        {lang: 'zh-Hans', href: 'https://csgrad.com/'},
        {lang: 'en-US', href: 'https://csgrad.com/en/'},
        {lang: 'x-default', href: 'https://csgrad.com/'},
      ],
    });
    await page('/en/', {
      title: 'CS Grad Program Guide',
      description: 'Graduate computer science program data and admissions guidance.',
      canonical: 'https://csgrad.com/en/',
      h1: 'Computer Science Graduate Program Guide',
      hreflangs: [
        {lang: 'zh-Hans', href: 'https://csgrad.com/'},
        {lang: 'en-US', href: 'https://csgrad.com/en/'},
        {lang: 'x-default', href: 'https://csgrad.com/'},
      ],
    });
    await sitemap(['https://csgrad.com/', 'https://csgrad.com/en/']);

    const result = audit();
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /SEO audit passed: 2 indexable pages, 2 sitemap URLs/);
  });
});

test('allows localized alternates to use the same visible metadata', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    const hreflangs = [
      {lang: 'zh-Hans', href: 'https://csgrad.com/program'},
      {lang: 'en-US', href: 'https://csgrad.com/en/program'},
    ];
    await page('/program', {
      title: 'CMU MSCS | CS Grad',
      description: 'CMU MSCS program guide.',
      canonical: 'https://csgrad.com/program',
      h1: 'CMU MSCS',
      hreflangs,
    });
    await page('/en/program', {
      title: 'CMU MSCS | CS Grad',
      description: 'CMU MSCS program guide.',
      canonical: 'https://csgrad.com/en/program',
      h1: 'CMU MSCS',
      hreflangs,
    });
    await sitemap(['https://csgrad.com/program', 'https://csgrad.com/en/program']);

    const result = audit();
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});

test('rejects an indexable page with a missing title', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/missing-title', {
      description: 'A useful description.',
      canonical: 'https://csgrad.com/missing-title',
      h1: 'Useful heading',
    });
    await sitemap(['https://csgrad.com/missing-title']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[title-missing\].*missing-title/);
  });
});

test('allows known legacy issues from a baseline but still reports their count', async () => {
  await withSite(async ({root, page, sitemap, audit}) => {
    await page('/missing-title', {
      description: 'A useful description.',
      canonical: 'https://csgrad.com/missing-title',
      h1: 'Useful heading',
    });
    await sitemap(['https://csgrad.com/missing-title']);
    const baselinePath = path.join(root, 'seo-baseline.txt');
    await writeFile(
      baselinePath,
      '[title-missing] /missing-title must have one non-empty <title>\n',
    );

    const result = audit('--baseline', baselinePath);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /1 known legacy issue/);
  });
});

test('rejects duplicate titles across indexable pages', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/first', {
      title: 'Same Program | CS Grad',
      description: 'First page description.',
      canonical: 'https://csgrad.com/first',
      h1: 'First program',
    });
    await page('/second', {
      title: '  same program | cs grad  ',
      description: 'Second page description.',
      canonical: 'https://csgrad.com/second',
      h1: 'Second program',
    });
    await sitemap(['https://csgrad.com/first', 'https://csgrad.com/second']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[title-duplicate\].*\/first.*\/second/);
  });
});

test('rejects an indexable page with a missing description', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/missing-description', {
      title: 'Useful title',
      canonical: 'https://csgrad.com/missing-description',
      h1: 'Useful heading',
    });
    await sitemap(['https://csgrad.com/missing-description']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[description-missing\].*missing-description/);
  });
});

test('rejects duplicate descriptions across indexable pages', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/first', {
      title: 'First title',
      description: 'Shared program description.',
      canonical: 'https://csgrad.com/first',
      h1: 'First heading',
    });
    await page('/second', {
      title: 'Second title',
      description: ' shared PROGRAM description. ',
      canonical: 'https://csgrad.com/second',
      h1: 'Second heading',
    });
    await sitemap(['https://csgrad.com/first', 'https://csgrad.com/second']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[description-duplicate\].*\/first.*\/second/);
  });
});

test('rejects an indexable page with a missing canonical URL', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/missing-canonical', {
      title: 'Canonical test',
      description: 'Tests that canonical metadata is required.',
      h1: 'Canonical URL test',
    });
    await sitemap([]);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[canonical-missing\].*missing-canonical/);
  });
});

test('rejects duplicate canonical URLs across indexable pages', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/first', {
      title: 'First canonical title',
      description: 'First canonical page description.',
      canonical: 'https://csgrad.com/first',
      h1: 'First canonical heading',
    });
    await page('/second', {
      title: 'Second canonical title',
      description: 'Second canonical page description.',
      canonical: 'https://csgrad.com/first',
      h1: 'Second canonical heading',
    });
    await sitemap(['https://csgrad.com/first']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[canonical-duplicate\].*\/first.*\/second/);
  });
});

test('rejects an indexable page without exactly one H1', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/missing-h1', {
      title: 'Missing H1 test',
      description: 'Tests that an indexable page needs a primary heading.',
      canonical: 'https://csgrad.com/missing-h1',
    });
    await sitemap(['https://csgrad.com/missing-h1']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[h1-count\].*missing-h1.*found 0/);
  });
});

test('rejects multiple H1 elements on one indexable page', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/multiple-headings', {
      title: 'Multiple heading title',
      description: 'A page must expose one primary heading.',
      canonical: 'https://csgrad.com/multiple-headings',
      h1: ['First primary heading', 'Second primary heading'],
    });
    await sitemap(['https://csgrad.com/multiple-headings']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[h1-count\].*multiple-headings.*found 2/);
  });
});

test('rejects an hreflang link whose target is absent from the bilingual build', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/', {
      title: 'Hreflang target test',
      description: 'Tests that language alternatives resolve to built pages.',
      canonical: 'https://csgrad.com/',
      h1: 'Hreflang target validation',
      hreflangs: [
        {lang: 'zh-Hans', href: 'https://csgrad.com/'},
        {lang: 'en-US', href: 'https://csgrad.com/en/missing'},
      ],
    });
    await sitemap(['https://csgrad.com/']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[hreflang-target-missing\].*en\/missing/);
  });
});

test('rejects a noindex page included in a sitemap', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/public', {
      title: 'Public page',
      description: 'A public page that belongs in the sitemap.',
      canonical: 'https://csgrad.com/public',
      h1: 'Public content',
    });
    await page('/private', {
      title: 'Private result',
      description: 'A personalized result that must stay out of search.',
      canonical: 'https://csgrad.com/private',
      h1: 'Private result',
      noindex: true,
    });
    await sitemap(['https://csgrad.com/public', 'https://csgrad.com/private']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[sitemap-noindex\].*\/private/);
  });
});

test('rejects a sitemap URL that is not the page canonical', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/alias', {
      title: 'Canonical alias',
      description: 'An alias must not be submitted as a canonical search URL.',
      canonical: 'https://csgrad.com/preferred',
      h1: 'Canonical alias test',
    });
    await sitemap(['https://csgrad.com/alias']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[sitemap-noncanonical\].*\/alias.*\/preferred/);
  });
});

test('rejects a sitemap URL whose built page does not exist', async () => {
  await withSite(async ({page, sitemap, audit}) => {
    await page('/', {
      title: 'Existing page',
      description: 'An existing page used to test a stale sitemap entry.',
      canonical: 'https://csgrad.com/',
      h1: 'Existing page heading',
    });
    await sitemap(['https://csgrad.com/', 'https://csgrad.com/removed-page']);

    const result = audit();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[sitemap-target-missing\].*removed-page/);
  });
});
