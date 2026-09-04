import assert from 'node:assert/strict';
import test from 'node:test';

import {trackSeoEvent} from './events.mjs';

test('sends an allow-listed event with only safe parameters', () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/school-positioning'},
  };

  const sent = trackSeoEvent(
    'positioning_start',
    {
      locale: 'zh-Hans',
      page_type: 'positioning',
      method: 'form',
      email: 'must-not-leak@example.com',
      applicant_profile: 'must-not-leak',
    },
    browserWindow,
  );

  assert.equal(sent, true);
  assert.deepEqual(calls, [[
    'event',
    'positioning_start',
    {
      locale: 'zh-Hans',
      page_type: 'positioning',
      method: 'form',
      page_path: '/school-positioning',
    },
  ]]);
});

test('does nothing when analytics is unavailable during SSR or local tests', () => {
  assert.equal(trackSeoEvent('consulting_intent', {}, null), false);
});

test('rejects unknown events instead of sending arbitrary analytics data', () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/'},
  };

  assert.equal(trackSeoEvent('send_everything', {locale: 'en'}, browserWindow), false);
  assert.deepEqual(calls, []);
});

test('drops unsupported values and trims oversized strings', () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/consulting'},
  };

  trackSeoEvent(
    'wechat_copy',
    {
      locale: 'en',
      page_type: 'consulting',
      method: 'copy_button'.repeat(20),
      content_group: {unsafe: true},
    },
    browserWindow,
  );

  const payload = calls[0][2];
  assert.equal(payload.method.length, 100);
  assert.equal('content_group' in payload, false);
});
