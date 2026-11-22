import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const require = createRequire(import.meta.url);
const legacyRedirectsPlugin = require('../plugins/legacy-redirects.cjs');
const siteDir = path.resolve(import.meta.dirname, '..');

test('old file-path URLs redirect to English slugs in each locale and keep URL state', async () => {
  for (const baseUrl of ['/', '/en/', '/zh-Hant/', '/ja/']) {
    const outDir = mkdtempSync(path.join(tmpdir(), 'csgrad-redirects-'));
    try {
      await legacyRedirectsPlugin({baseUrl, siteDir, siteConfig: {url: 'https://csgrad.com'}}).postBuild({outDir});
      for (const [from, to] of [
        ['A+/UCLA MENG', 'A+/ucla-meng'],
        ['B+/UCLA MENG', 'A+/ucla-meng'],
        ['B+/ucla-meng', 'A+/ucla-meng'],
        ['programs/ucla-meng', 'A+/ucla-meng'],
        ['SSS/stanford msee', 'SS/stanford-msee'],
        ['B+/rics-mcs', 'B+/rice-mcs'],
        ['找我辅导', 'consulting'],
        ['useful_docs/FAANG过简历关', 'guides/faang-resume-screening'],
      ]) {
        const html = readFileSync(path.join(outDir, from, 'index.html'), 'utf8');
        const destination = `${baseUrl}${to}`;
        assert.match(html, /<meta name="robots" content="noindex, follow">/);
        assert.ok(html.includes(`<link rel="canonical" href="https://csgrad.com${destination}">`), from);
        assert.ok(html.includes(`content="0;url=${destination}"`), from);
        let redirect;
        runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
          location: {search: '?from=tracker', hash: '#courses', replace: url => { redirect = url; }},
        });
        assert.equal(redirect, `${destination}?from=tracker#courses`);
      }
    } finally {
      rmSync(outDir, {recursive: true, force: true});
    }
  }
});
