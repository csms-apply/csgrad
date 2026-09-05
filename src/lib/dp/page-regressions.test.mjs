import assert from 'node:assert/strict';
import test from 'node:test';
import {elements, pageHarness, visibleText} from './page-test-harness.mjs';

const authImports = {
  '@site/src/lib/auth/SignInButtons': () => null,
  '@site/src/lib/auth/oauth': {startOAuth() { throw new Error('OAuth must not run'); }},
};
const emptyOptions = {schools: [], tiers: [], years: [], ugCats: [], majors: []};

for (const locale of ['zh-Hans', 'en']) {
  test(`${locale}: failed DP load is distinct from empty results and can retry`, async () => {
    let attempts = 0;
    const harness = pageHarness('datapoints', ['Table', 'COPY'], {
      locale,
      imports: {
        ...authImports,
        '@site/src/lib/dp/api': {listDp: async () => {
          attempts += 1;
          if (attempts === 1) throw new TypeError('Failed to fetch');
          return {rows: [], total: 0};
        }},
      },
    });
    const props = {counts: {datapoints: 1908, applicants: 317, programs: 280, source: 'snapshot'}, filterOpts: emptyOptions, t: harness.exports.COPY[locale], locale};
    let tree = harness.render('Table', props);
    assert.doesNotMatch(visibleText(tree), /匹配0|Matched0/);
    await harness.effects();
    await harness.timers();
    tree = harness.render('Table', props);
    assert.equal(elements(tree, (el) => el.type?.name === 'EmptyState').length, 0, 'network failure must not render an empty-result component');
    assert.doesNotMatch(visibleText(tree), /匹配0|Matched0|Failed to fetch/);
    assert.match(visibleText(tree), locale === 'en' ? /snapshot/i : /快照/);
    const retry = elements(tree, (el) => el.type === 'button' && /重试|Retry/.test(visibleText(el)))[0];
    assert.ok(retry, 'a failed request offers retry');
    retry.props.onClick();
    harness.render('Table', props);
    await harness.effects();
    await harness.timers();
    tree = harness.render('Table', props);
    assert.equal(attempts, 2, 'retry performs a new list request');
    assert.equal(elements(tree, (el) => el.type?.name === 'EmptyState').length, 1, 'a successful empty response renders the real empty state');
    assert.match(visibleText(tree), locale === 'en' ? /Matched/ : /匹配/);
  });

  test(`${locale}: corrected applicant form clears old validation error before sign-in`, async () => {
    const harness = pageHarness('submit-dp', ['Inner'], {
      locale,
      imports: {...authImports, '@site/src/lib/dp/api': {getMe: async () => ({user: null})}},
    });
    harness.render('Inner');
    await harness.effects();
    let tree = harness.render('Inner');
    const getForm = () => elements(tree, (el) => el.type?.name === 'ApplicantForm')[0];
    await getForm().props.onSave();
    tree = harness.render('Inner');
    assert.match(visibleText(tree), locale === 'en' ? /required fields/i : /请填写必填字段/);
    for (const [key, value] of Object.entries({ug_school_category: '美本', ug_school_name: 'E2E synthetic', graduation_year: '2028', ug_major: 'CS'})) {
      getForm().props.setField(key, value);
      tree = harness.render('Inner');
    }
    await getForm().props.onSave();
    tree = harness.render('Inner');
    assert.equal(elements(tree, (el) => el.type?.name === 'SignInPromptModal').length, 1);
    assert.doesNotMatch(visibleText(tree), /required fields|请填写必填字段/i);
    const backLink = elements(tree, (el) => el.type === 'a' && /DataPoints/.test(visibleText(el)))[0];
    assert.equal(backLink.props.href, locale === 'en' ? '/en/datapoints' : '/datapoints');
  });

  test(`${locale}: changing DP filters updates the router while retaining other query parameters`, async () => {
    const pathname = locale === 'en' ? '/en/datapoints' : '/datapoints';
    const window = {
      location: {pathname, search: '?school=Harvard&utm_source=e2e', hash: '#filters'},
      innerWidth: 1200, addEventListener() {}, removeEventListener() {},
      history: {replaceState() { throw new Error('Native history does not notify the language menu'); }},
    };
    const destinations = [];
    const history = {replace(destination) { destinations.push(destination); }};
    const harness = pageHarness('datapoints', ['Table', 'COPY'], {
      locale,
      globals: {window},
      imports: {
        ...authImports,
        '@docusaurus/router': {useHistory: () => history},
        '@site/src/lib/dp/api': {listDp: async () => ({rows: [], total: 0})},
      },
    });
    const props = {counts: {source: 'unavailable'}, filterOpts: emptyOptions, t: harness.exports.COPY[locale], locale};
    let tree = harness.render('Table', props);
    const schoolSelect = () => elements(tree, (el) => el.type?.name === 'Select' && el.props.label === props.t.filterSchool)[0];
    assert.equal(schoolSelect().props.value, 'Harvard', 'initial query filters survive hydration');
    await harness.effects();
    assert.equal(destinations.length, 0, 'unchanged initial filters do not trigger navigation');
    schoolSelect().props.onChange('MIT');
    tree = harness.render('Table', props);
    await harness.effects();
    assert.deepEqual(destinations, [`${pathname}?school=MIT&utm_source=e2e#filters`]);
    assert.doesNotMatch(visibleText(tree), /1908|317|280/);
    assert.match(visibleText(tree), locale === 'en' ? /Database totals are temporarily unavailable/ : /暂时无法获取数据库总量/);
  });

  test(`${locale}: result polling does not claim payment confirmation and localizes connection failures`, async () => {
    const harness = pageHarness('school-positioning-result', ['ResultBody'], {
      locale,
      imports: {
        '@site/src/lib/positioning/api': {WORKER_BASE_URL: 'https://isolated.invalid'},
        '@site/src/lib/analytics/events.mjs': {trackSeoEvent() { throw new Error('No analytics expected'); }},
        '@site/src/lib/analytics/purchase.mjs': {},
      },
      globals: {
        window: {location: {search: '?session_id=e2e_synthetic'}},
        fetch: async () => { throw new TypeError('Failed to fetch'); },
      },
    });
    let tree = harness.render('ResultBody');
    assert.doesNotMatch(visibleText(tree), /Stripe/);
    await harness.effects();
    harness.render('ResultBody');
    await harness.effects();
    for (let count = 0; count < 4; count += 1) await harness.timers();
    tree = harness.render('ResultBody');
    assert.doesNotMatch(visibleText(tree), /Failed to fetch/);
    assert.match(visibleText(tree), locale === 'en' ? /connection/i : /网络/);
    assert.ok(elements(tree, (el) => el.type === 'button' && /重试|Retry/.test(visibleText(el))).length);
  });
}

for (const outcome of ['api', 'snapshot', 'unavailable']) {
  test(`DP totals identify ${outcome} provenance instead of inventing a live zero`, async () => {
    const harness = pageHarness('datapoints', ['COPY'], {
      imports: authImports,
      globals: {fetch: async (url) => {
        if (url.endsWith('/api/stats') && outcome === 'api') return {ok: true, json: async () => ({datapoints: 25, applicants: 10, programs: 8})};
        if (url === '/data/dp-snapshot.json' && outcome === 'snapshot') return {ok: true, json: async () => ({counts: {datapoints: 20, applicants: 9, programs: 7}})};
        return {ok: false, status: 503};
      }},
    });
    const {getCounts} = harness.loadModule('src/lib/dp/api.js');
    const counts = await getCounts();
    assert.equal(counts.source, outcome);
    assert.equal(counts.datapoints, outcome === 'api' ? 25 : outcome === 'snapshot' ? 20 : null);
  });
}
