import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import {transformSync} from '@babel/core';
import {localizedInternalPath} from '../src/lib/seo/localizedAlternates.mjs';

const require = createRequire(import.meta.url);
const filename = new URL('../src/pages/B+/UCLA MENG.jsx', import.meta.url);
const {code} = transformSync(readFileSync(filename, 'utf8'), {
  filename: filename.pathname,
  configFile: false,
  babelrc: false,
  presets: [[require.resolve('@babel/preset-react'), {runtime: 'classic'}]],
  plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
});

test('legacy UCLA page redirects in every locale and preserves URL state', () => {
  for (const [locale, prefix] of [['zh-Hans', ''], ['en', '/en'], ['zh-Hant', '/zh-Hant']]) {
    const module = {exports: {}};
    const mocks = {
      react: {Fragment: 'fragment', createElement: (type, props, ...children) => ({type, props, children})},
      '@docusaurus/Head': 'head',
      '@docusaurus/router': {Redirect: 'redirect', useLocation: () => ({search: '?from=tracker', hash: '#courses'})},
      '@docusaurus/useDocusaurusContext': () => ({i18n: {currentLocale: locale}, siteConfig: {url: 'https://csgrad.com'}}),
      '../../lib/seo/localizedAlternates.mjs': {localizedInternalPath},
    };
    new Function('require', 'module', 'exports', code)(id => mocks[id], module, module.exports);
    const tree = module.exports.default();
    assert.equal(tree.children.find(child => child.type === 'redirect').props.to, `${prefix}/A+/UCLA MENG?from=tracker#courses`);
    assert.equal(tree.children.find(child => child.type === 'a').props.href, `${prefix}/A+/UCLA MENG`);
    const head = tree.children.find(child => child.type === 'head');
    assert.equal(head.children.find(child => child.type === 'meta').props.content, 'noindex, follow');
    assert.equal(head.children.find(child => child.type === 'link').props.href, `https://csgrad.com${prefix}/A+/UCLA MENG`);
  }
});
