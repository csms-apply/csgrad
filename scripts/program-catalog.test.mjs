import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const catalogPath = new URL('static/data/programs.json', root);
const programs = JSON.parse(readFileSync(catalogPath, 'utf8'));

test('committed program catalog matches the docs generator', () => {
  const before = readFileSync(catalogPath, 'utf8');
  execFileSync(process.execPath, ['scripts/generate-programs.js'], {cwd: fileURLToPath(root)});
  assert.equal(readFileSync(catalogPath, 'utf8'), before);
});

test('every catalog link has a document in each supported language', () => {
  assert.equal(new Set(programs.map(program => program.id)).size, programs.length);
  for (const directory of ['docs', 'i18n/en/docusaurus-plugin-content-docs/current', 'i18n/zh-Hant/docusaurus-plugin-content-docs/current']) {
    for (const program of programs) {
      assert.ok(existsSync(new URL(`${directory}${program.slug}.md`, root)), `${directory}${program.slug}`);
    }
  }
});

test('UCLA follows the current tier while existing tracker IDs remain stable', () => {
  const ucla = programs.find(program => program.id === 'bplus-ucla-meng');
  assert.equal(ucla.tier, 'A+');
  assert.equal(ucla.slug, '/A+/UCLA MENG');
  assert.equal(programs.filter(program => program.school === 'UCLA' && program.program === 'MEng').length, 1);
  const scu = programs.find(program => program.slug === '/B-/SCU MSCSE');
  assert.equal(scu.id, 'bminus-santa-clara-university-mscse');
  assert.equal(scu.school, 'Santa Clara University');
});
