import test from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGE_PREFERENCE_KEY, selectLanguage, readLanguagePreference, preferredHomepage, initializeLanguagePreference} from './preference.mjs';

function storage() {
  const values = new Map();
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)};
}
function browser(pathname = '/') {
  const events = [], redirects = [], timers = [];
  return {localStorage: storage(), sessionStorage: storage(),
    location: {pathname, search: '?ref=example', hash: '#section', replace: url => redirects.push(url)},
    gtag: (...args) => events.push(args), setTimeout: callback => timers.push(callback), events, redirects, timers};
}

test('manual selections persist all three defaults and emit bounded analytics', () => {
  const b = browser();
  for (const locale of ['en', 'zh-Hant', 'zh-Hans']) {
    assert.equal(selectLanguage(locale, 'zh-Hans', b), true);
    assert.equal(readLanguagePreference(b).locale, locale);
    assert.equal(b.events.at(-1)[2].selected_locale, locale);
  }
  assert.equal(selectLanguage('https://evil.example', 'en', b), false);
  assert.equal(b.events.length, 3);
});

test('only neutral homepage restores default, preserving search and hash', () => {
  assert.equal(preferredHomepage(browser().location, 'en'), '/en/?ref=example#section');
  assert.equal(preferredHomepage(browser().location, 'zh-Hant'), '/zh-Hant/?ref=example#section');
  for (const path of ['/en/', '/zh-Hant/', '/datapoints', '/school-positioning-result', '/auth/callback']) {
    assert.equal(preferredHomepage(browser(path).location, 'en'), null);
  }
  assert.equal(preferredHomepage(browser().location, 'zh-Hans'), null);
  assert.equal(preferredHomepage(browser().location, 'bogus'), null);
});

test('revisit redirects once and records application only on destination', () => {
  const source = browser();
  selectLanguage('zh-Hant', 'zh-Hans', source);
  source.events.length = 0;
  initializeLanguagePreference(source, 'zh-Hans');
  initializeLanguagePreference(source, 'zh-Hans');
  assert.deepEqual(source.redirects, ['/zh-Hant/?ref=example#section']);
  assert.equal(source.events.length, 0);
  const destination = {...source, location: {...source.location, pathname: '/zh-Hant/'}};
  initializeLanguagePreference(destination, 'zh-Hant');
  initializeLanguagePreference(destination, 'zh-Hant');
  assert.deepEqual(source.events.map(e => e[1]), ['audience_visit', 'language_preference_applied']);
  assert.equal(source.events[0][2].current_locale, 'zh-Hant');
  const nextVisit = {...destination};
  initializeLanguagePreference(nextVisit, 'zh-Hant');
  assert.equal(source.events.filter(e => e[1] === 'language_preference_applied').length, 1);
});

test('explicit links do not rewrite preference or force the saved language', () => {
  const b = browser('/en/');
  b.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, 'zh-Hant');
  initializeLanguagePreference(b, 'en');
  assert.equal(b.redirects.length, 0);
  assert.equal(readLanguagePreference(b).locale, 'zh-Hant');
  assert.equal(b.events[0][2].current_locale, 'en');
});

test('blocked or corrupt storage never prevents use and never redirects externally', () => {
  const b = browser();
  Object.defineProperty(b, 'localStorage', {get() {throw new Error('denied');}});
  Object.defineProperty(b, 'sessionStorage', {get() {throw new Error('denied');}});
  assert.equal(selectLanguage('en', 'zh-Hans', b), false);
  initializeLanguagePreference(b, 'zh-Hans');
  assert.equal(b.redirects.length, 0);
  assert.equal(b.events.at(-1)[2].storage_status, 'unavailable');
  const invalid = browser();
  invalid.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, '//evil.example');
  initializeLanguagePreference(invalid, 'zh-Hans');
  assert.equal(invalid.redirects.length, 0);
  assert.equal(invalid.events[0][2].preferred_locale, 'none');
});

test('delayed analytics emits once; blocked analytics retries are bounded', () => {
  const b = browser();
  delete b.gtag;
  initializeLanguagePreference(b, 'zh-Hans');
  assert.equal(b.timers.length, 1);
  b.gtag = (...args) => b.events.push(args);
  b.timers.shift()();
  assert.equal(b.events.length, 1);
  const blocked = browser();
  delete blocked.gtag;
  initializeLanguagePreference(blocked, 'zh-Hans');
  let count = 0;
  while (blocked.timers.length) {blocked.timers.shift()(); assert.ok(++count < 20);}
  assert.equal(count, 19);
});
