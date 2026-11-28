import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createRequire} from 'node:module';

const {legacyRedirects} = createRequire(import.meta.url)('../plugins/legacy-redirects.cjs');

const root = new URL('../', import.meta.url);
const catalogPath = new URL('static/data/programs.json', root);
const programs = JSON.parse(readFileSync(catalogPath, 'utf8'));

test('committed program catalog matches the docs generator', () => {
  const before = readFileSync(catalogPath, 'utf8');
  execFileSync(process.execPath, ['scripts/generate-programs.js'], {cwd: fileURLToPath(root)});
  assert.equal(readFileSync(catalogPath, 'utf8'), before);
});

test('every language serves each document at the same English slug', () => {
  assert.equal(new Set(programs.map(program => program.id)).size, programs.length);
  const slugs = directory => legacyRedirects(fileURLToPath(new URL(directory, root)));
  const expected = slugs('docs');
  for (const program of programs) {
    assert.equal(program.slug, `/${program.tier}/${program.slug.split('/').pop()}`);
    assert.match(program.slug.split('/').pop(), /^[a-z0-9-]+$/);
    assert.ok(Object.values(expected).includes(program.slug), program.slug);
  }
  for (const locale of ['en', 'zh-Hant', 'ko', 'vi', 'ja', 'es']) {
    assert.deepEqual(slugs(`i18n/${locale}/docusaurus-plugin-content-docs/current`), expected, locale);
  }
  // Tier folders keep their capitals (/A+/ucla-meng); everything else is lowercase.
  for (const slug of Object.values(expected)) assert.match(slug, /^(\/(SSS|SS|S|A\+|A|A-|B\+|B|B-|C\+))?\/[a-z0-9/-]+$/, slug);
});

test('UCLA follows the current tier while existing tracker IDs remain stable', () => {
  const ucla = programs.find(program => program.id === 'bplus-ucla-meng');
  assert.equal(ucla.tier, 'A+');
  assert.equal(ucla.slug, '/A+/ucla-meng');
  assert.equal(programs.filter(program => program.school === 'UCLA' && program.program === 'MEng').length, 1);
  const scu = programs.find(program => program.slug === '/B-/scu-mscse');
  assert.equal(scu.id, 'bminus-santa-clara-university-mscse');
  assert.equal(scu.school, 'Santa Clara University');
});
