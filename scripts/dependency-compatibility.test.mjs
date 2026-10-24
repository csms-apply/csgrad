import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const serialize = require('serialize-javascript');

// These values are serialized into executable worker code by the CSS minimizer.
test('worker serialization preserves ordinary options, functions, dates and regexes', () => {
  const options = {enabled: true, match: /\.css$/i, date: new Date('2026-01-01'), transform: function (x) { return x + 1; }};
  const restored = runInNewContext(`(${serialize(options)})`);
  assert.equal(restored.enabled, true);
  assert.equal(restored.match.test('main.CSS'), true);
  assert.equal(restored.date.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(restored.transform(2), 3);
});

test('spoofed RegExp flags and Date strings cannot inject worker code', () => {
  const regex = Object.create(RegExp.prototype);
  Object.defineProperties(regex, {
    source: {get: () => 'x'},
    flags: {get: () => '\"+(globalThis.injected=true)+\"'},
  });
  regex.toJSON = () => 'placeholder';
  const date = Object.create(Date.prototype);
  date.toISOString = () => '\"+(globalThis.injected=true)+\"';
  date.toJSON = () => '2026-01-01';
  for (const value of [regex, date]) {
    const context = {injected: false};
    try {
      runInNewContext(`(${serialize({value})})`, context, {timeout: 1000});
    } catch (error) {
      // Rejecting the forged object or invalid flags is safe; executing it is not.
      assert.ok(['TypeError', 'SyntaxError', 'RangeError'].includes(error.name));
    }
    assert.equal(context.injected, false);
  }
});
