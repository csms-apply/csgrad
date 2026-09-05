import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import {transformSync} from '@babel/core';
import * as paths from '../src/lib/seo/localizedAlternates.mjs';

const require = createRequire(import.meta.url);
const filename = new URL('../src/theme/NavbarItem/LocaleDropdownNavbarItem/index.js', import.meta.url);
const {code} = transformSync(readFileSync(filename, 'utf8'), {
  filename: filename.pathname,
  configFile: false,
  babelrc: false,
  presets: [[require.resolve('@babel/preset-react'), {runtime: 'classic'}]],
  plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
});

// Exercise the real navbar component's generated items, including the hydration
// boundary. Browser regression additionally verifies the final DOM and clicks.
function renderItems({pathname, search = '', hash = '', hydrated = true, queryString = ''}) {
  const module = {exports: {}};
  const mocks = {
    '@docusaurus/useDocusaurusContext': () => ({i18n: {
      currentLocale: pathname.startsWith('/en/') ? 'en' : 'zh-Hans',
      locales: ['zh-Hans', 'en'],
      localeConfigs: {'zh-Hans': {label: '中文', htmlLang: 'zh-Hans'}, en: {label: 'English', htmlLang: 'en-US'}},
    }}),
    '@docusaurus/theme-common/internal': {useAlternatePageUtils: () => ({
      createUrl: ({locale}) => paths.localizedInternalPath(pathname, locale),
    })},
    '@docusaurus/Translate': {translate: ({message}) => message},
    '@docusaurus/router': {useLocation: () => ({pathname, search, hash})},
    '@docusaurus/useIsBrowser': () => hydrated,
    '@theme/NavbarItem/DropdownNavbarItem': () => null,
    '@theme/Icon/Language': () => null,
    '../../../lib/seo/localizedAlternates.mjs': paths,
    './styles.module.css': {},
  };
  new Function('require', 'module', 'exports', code)(
    (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id), module, module.exports,
  );
  return module.exports.default({dropdownItemsBefore: [], dropdownItemsAfter: [], queryString}).props.items;
}

test('initial hydration matches static HTML before adding the live order query', () => {
  const state = {pathname: '/en/school-positioning-result', search: '?session_id=synthetic', hash: '#report'};
  const initial = renderItems({...state, hydrated: false});
  assert.equal(initial[0].to, 'pathname:///school-positioning-result');
  const hydrated = renderItems(state);
  assert.equal(hydrated[0].to, 'pathname:///school-positioning-result?session_id=synthetic#report');
});

test('navbar preserves filter queries after a router location update', () => {
  const base = {pathname: '/en/datapoints'};
  assert.equal(renderItems(base)[0].to, 'pathname:///datapoints');
  assert.equal(renderItems({...base, search: '?school=Harvard&year=2026&gpaMin=3.5', hash: '#results'})[0].to,
    'pathname:///datapoints?school=Harvard&year=2026&gpaMin=3.5#results');
});

test('navbar maps the career-change route in each direction', () => {
  assert.equal(renderItems({pathname: '/转码项目'})[1].to, 'pathname:///en/career-change-programs');
  assert.equal(renderItems({pathname: '/en/career-change-programs'})[0].to, 'pathname:///转码项目');
});

test('internal links retain locale and URL state without rewriting external URLs', () => {
  assert.equal(paths.localizedInternalPath('/', 'en'), '/en/');
  assert.equal(paths.localizedInternalPath('/en/', 'zh-Hans'), '/');
  assert.equal(paths.localizedInternalPath('/B/Emory MSCS', 'en'), '/en/B/Emory MSCS');
  assert.equal(paths.localizedInternalPath('/en/B/Emory MSCS', 'en'), '/en/B/Emory MSCS');
  assert.equal(paths.localizedInternalPath('/找我辅导?ref=dp#fees', 'en'), '/en/consulting?ref=dp#fees');
  assert.equal(paths.localizedInternalPath('https://example.com/en/path', 'zh-Hans'), 'https://example.com/en/path');
  assert.equal(paths.localizedInternalPath('//example.com/path', 'en'), '//example.com/path');
  assert.equal(paths.localizedInternalPath('#fees', 'en'), '#fees');
});
