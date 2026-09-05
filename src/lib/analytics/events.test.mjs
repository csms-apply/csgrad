import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import test from 'node:test';

import {trackSeoEvent} from './events.mjs';
import {
  CONTACT_CTA_EXPERIMENT,
  resolveExperimentAssignment,
} from './experiments.mjs';
import {copyTextWithFallback} from './clipboard.mjs';
import {buildPositioningPurchaseParameters} from './purchase.mjs';

test('assigns a visitor to the contact CTA experiment with a 50/50 split', () => {
  const assignment = resolveExperimentAssignment({
    experiment: CONTACT_CTA_EXPERIMENT,
    search: '',
    storage: null,
    random: () => 0.25,
  });

  assert.deepEqual(assignment, {
    experiment_id: 'consulting_contact_cta_v1',
    variant: 'variant',
  });
});

test('keeps the same anonymous experiment assignment for a returning visitor', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  const first = resolveExperimentAssignment({
    experiment: CONTACT_CTA_EXPERIMENT,
    search: '',
    storage,
    random: () => 0.75,
  });
  const returning = resolveExperimentAssignment({
    experiment: CONTACT_CTA_EXPERIMENT,
    search: '',
    storage,
    random: () => 0.1,
  });

  assert.equal(first.variant, 'control');
  assert.deepEqual(returning, first);
});

test('supports a non-persistent QA query override for either experiment variant', () => {
  const values = new Map([
    ['csgrad.experiment.consulting_contact_cta_v1', 'control'],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  const preview = resolveExperimentAssignment({
    experiment: CONTACT_CTA_EXPERIMENT,
    search: '?csgrad_experiment=consulting_contact_cta_v1%3Avariant',
    storage,
    random: () => 0.75,
  });

  assert.equal(preview.variant, 'variant');
  assert.equal(values.get('csgrad.experiment.consulting_contact_cta_v1'), 'control');
});

test('accepts a provider-supplied assignment without coupling to a provider SDK', () => {
  const assignment = resolveExperimentAssignment({
    experiment: CONTACT_CTA_EXPERIMENT,
    providedVariant: 'control',
    storage: null,
    random: () => 0.1,
  });

  assert.equal(assignment.variant, 'control');
});

test('can turn the experiment off with one config flag while preserving QA previews', () => {
  const disabledExperiment = {...CONTACT_CTA_EXPERIMENT, enabled: false};

  const ordinaryVisit = resolveExperimentAssignment({
    experiment: disabledExperiment,
    providedVariant: 'variant',
    storage: null,
    random: () => 0.1,
  });
  const qaPreview = resolveExperimentAssignment({
    experiment: disabledExperiment,
    search: '?csgrad_experiment=consulting_contact_cta_v1%3Avariant',
    storage: null,
  });

  assert.equal(ordinaryVisit.variant, 'control');
  assert.equal(qaPreview.variant, 'variant');
});

test('sends a PII-free experiment exposure that GA4 can segment', () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/find-consulting'},
  };

  const sent = trackSeoEvent('experiment_exposure', {
    experiment_id: 'consulting_contact_cta_v1',
    variant: 'variant',
    page_type: 'consulting',
    email: 'must-not-leak@example.com',
  }, browserWindow);

  assert.equal(sent, true);
  assert.deepEqual(calls[0], [
    'event',
    'experiment_exposure',
    {
      experiment_id: 'consulting_contact_cta_v1',
      variant: 'variant',
      page_type: 'consulting',
      page_path: '/find-consulting',
    },
  ]);
});

test('falls back to the legacy copy command when Clipboard API permission is denied', async () => {
  const actions = [];
  const textarea = {
    style: {},
    setAttribute: (name) => actions.push(`attribute:${name}`),
    focus: () => actions.push('focus'),
    select: () => actions.push('select'),
    setSelectionRange: () => actions.push('selection-range'),
    remove: () => actions.push('remove'),
  };
  const documentAdapter = {
    body: {appendChild: () => actions.push('append')},
    createElement: () => textarea,
    execCommand: (command) => {
      actions.push(command);
      return true;
    },
  };

  const copied = await copyTextWithFallback('capsfly', {
    clipboard: {writeText: async () => { throw new Error('denied'); }},
    documentAdapter,
  });

  assert.equal(copied, true);
  assert.equal(textarea.value, 'capsfly');
  assert.deepEqual(actions, [
    'attribute:readonly',
    'append',
    'focus',
    'select',
    'selection-range',
    'copy',
    'remove',
  ]);
});

test('builds a stable, anonymous GA4 purchase from paid API totals', async () => {
  const sessionId = 'private-checkout-session-id';
  const body = {status: 'paid', amount_total: 2999, currency: 'usd'};

  const first = await buildPositioningPurchaseParameters(body, sessionId, webcrypto.subtle);
  const repeated = await buildPositioningPurchaseParameters(body, sessionId, webcrypto.subtle);

  assert.deepEqual(first, repeated);
  assert.equal(first.currency, 'USD');
  assert.equal(first.value, 29.99);
  assert.match(first.transaction_id, /^positioning_[a-f0-9]{32}$/);
  assert.equal(first.transaction_id.includes(sessionId), false);
  assert.deepEqual(first.items, [{
    item_id: 'school_positioning_report',
    item_name: 'MSCS School Positioning Report',
    price: 29.99,
    quantity: 1,
  }]);
});

test('does not infer revenue when a paid result omits an authoritative total', async () => {
  const parameters = await buildPositioningPurchaseParameters(
    {status: 'paid'},
    'legacy-paid-session',
    webcrypto.subtle,
  );

  assert.equal(parameters, null);
});

test('does not infer currency when a paid result only provides an amount', async () => {
  const parameters = await buildPositioningPurchaseParameters(
    {status: 'paid', amount_total: 2999},
    'paid-session-without-currency',
    webcrypto.subtle,
  );

  assert.equal(parameters, null);
});

test('sends the GA4 purchase fields without leaking checkout or customer identifiers', async () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/school-positioning-result'},
  };
  const purchase = await buildPositioningPurchaseParameters(
    {status: 'paid', value: 29.99, currency: 'usd'},
    'private-checkout-session-id',
    webcrypto.subtle,
  );

  const sent = trackSeoEvent('purchase', {
    ...purchase,
    session_id: 'must-not-leak',
    email: 'must-not-leak@example.com',
  }, browserWindow);

  assert.equal(sent, true);
  assert.deepEqual(calls[0], [
    'event',
    'purchase',
    {
      currency: 'USD',
      value: 29.99,
      transaction_id: purchase.transaction_id,
      items: [{
        item_id: 'school_positioning_report',
        item_name: 'MSCS School Positioning Report',
        price: 29.99,
        quantity: 1,
      }],
      page_path: '/school-positioning-result',
    },
  ]);
});

test('rejects a purchase event that tries to use the raw checkout session as transaction id', () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/school-positioning-result'},
  };

  const sent = trackSeoEvent('purchase', {
    currency: 'USD',
    value: 29.99,
    transaction_id: 'private-checkout-session-id',
  }, browserWindow);

  assert.equal(sent, false);
  assert.deepEqual(calls, []);
});

test('requires the fixed GA4 item payload on every purchase event', () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/school-positioning-result'},
  };

  const sent = trackSeoEvent('purchase', {
    currency: 'USD',
    value: 29.99,
    transaction_id: 'positioning_0123456789abcdef0123456789abcdef',
  }, browserWindow);

  assert.equal(sent, false);
  assert.deepEqual(calls, []);
});

test('rejects a purchase whose item price disagrees with the authoritative total', () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/school-positioning-result'},
  };

  const sent = trackSeoEvent('purchase', {
    currency: 'USD',
    value: 29.99,
    transaction_id: 'positioning_0123456789abcdef0123456789abcdef',
    items: [{
      item_id: 'school_positioning_report',
      item_name: 'MSCS School Positioning Report',
      price: 1,
      quantity: 1,
    }],
  }, browserWindow);

  assert.equal(sent, false);
  assert.deepEqual(calls, []);
});

test('rejects purchase items containing arbitrary nested or PII fields', () => {
  const calls = [];
  const browserWindow = {
    gtag: (...args) => calls.push(args),
    location: {pathname: '/school-positioning-result'},
  };

  const sent = trackSeoEvent('purchase', {
    currency: 'USD',
    value: 29.99,
    transaction_id: 'positioning_0123456789abcdef0123456789abcdef',
    items: [{
      item_id: 'school_positioning_report',
      item_name: 'MSCS School Positioning Report',
      price: 29.99,
      quantity: 1,
      customer: {email: 'must-not-leak@example.com'},
    }],
  }, browserWindow);

  assert.equal(sent, false);
  assert.deepEqual(calls, []);
});

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
