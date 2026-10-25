import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const output = path.resolve(process.argv[2] || 'build');
const programs = JSON.parse(readFileSync(path.join(output, 'data/programs.json'), 'utf8'));
for (const locale of ['', 'en', 'zh-Hant']) {
  for (const program of programs) {
    // HTTP static servers decode the URL before looking up the output file.
    const html = readFileSync(path.join(output, locale, program.slug, 'index.html'), 'utf8');
    assert.match(html, /<html/);
  }
  const redirect = readFileSync(path.join(output, locale, 'B+/UCLA MENG/index.html'), 'utf8');
  assert.match(redirect, /name="robots" content="noindex, follow"/);
  const prefix = locale ? `/${locale}` : '';
  assert.ok(redirect.includes(`href="${prefix}/A+/UCLA MENG"`), `Missing legacy link for ${locale}`);
  const homepage = readFileSync(path.join(output, locale, 'index.html'), 'utf8');
  assert.ok(!homepage.includes('ubgp4doSw8gAh7dG9'), `Expired event remains in ${locale}`);
}
console.log(`Verified ${programs.length} program pages, legacy UCLA links and homepages in all 3 locales.`);
