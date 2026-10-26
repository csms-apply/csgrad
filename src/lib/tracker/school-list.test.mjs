import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeShare, encodeShare, enCell, shortCell, searchIndex, matches, picksFromLegacyCards, UI} from './school-list.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./school-list.json', import.meta.url)));
const row = (name) => data.rows.find((r) => r.name === name);

test('share links round-trip ids and a Chinese title, and reject junk', () => {
  const ids = [row('mscs@cmu').id, row('mscs@columbia').id, row('eecs@mit').id];
  const hash = encodeShare(ids, '27 Fall 陆本 CS 选校', data.order);
  const back = decodeShare(`#${hash}`, data.order);
  assert.deepEqual([...back.ids].sort(), [...ids].sort());
  assert.equal(back.title, '27 Fall 陆本 CS 选校');
  assert.equal(decodeShare('#pick-AAAA', data.order), null);
  assert.equal(decodeShare('#courses', data.order), null);
  assert.equal(decodeShare('#pick-!!', data.order), null);
});

test('data is consistent: every row is in the append-only share order and has an English label', () => {
  assert.deepEqual([...data.order].sort(), data.rows.map((r) => r.id).sort());
  for (const r of data.rows) for (const x of r.rounds) assert.ok(!/\p{Script=Han}/u.test(x.label) || data.en[x.label], x.label);
});

test('language cells: English abbreviations and short table form', () => {
  assert.equal(enCell('96(阅读26 口语22 其余24)'), '96(R 26 S 22 others 24)');
  assert.equal(enCell('口语23 阅读/听力22 写作24'), 'S 23 R/L 22 W 24');
  assert.equal(enCell('无'), 'None');
  assert.equal(shortCell('96(阅读26 口语22 其余24)', 'zh'), '96*');
  assert.equal(shortCell('口语23 阅读/听力22 写作24', 'zh'), '口语23*');
  assert.equal(shortCell('S 23 R/L 22 W 24', 'en'), 'S 23*');
  assert.equal(shortCell('7(口语 6.5)', 'zh'), '7(口语 6.5)');
});

test('search matches Chinese aliases, prefixes and Latin substrings', () => {
  const cmu = searchIndex(row('mscs@cmu'));
  assert.ok(matches(cmu, '卡梅'));
  assert.ok(matches(cmu, 'cmu mscs'));
  assert.ok(matches(cmu, 'scs'));
  assert.ok(!matches(cmu, '斯坦福'));
});

test('old kanban cards from the program library become picks', () => {
  const cards = JSON.stringify([{slug: '/SS/cmu mscs'}, {slug: ''}, {school: 'Custom'}, {slug: '/SS/cmu mscs'}]);
  assert.deepEqual(picksFromLegacyCards(cards, data.rows), [row('mscs@cmu').id]);
  assert.deepEqual(picksFromLegacyCards('not json', data.rows), []);
});

test('Chinese and English copy have the same keys', () => {
  assert.deepEqual(Object.keys(UI.en).sort(), Object.keys(UI.zh).sort());
});
