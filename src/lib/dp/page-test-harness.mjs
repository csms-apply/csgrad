// Runs the actual JSX component and its event/effect callbacks without a browser,
// a Docusaurus build, or network access. Browser integration is verified separately.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import React from 'react';
import {transformSync} from '@babel/core';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const plugins = [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')];

export function pageHarness(page, names, {locale = 'zh-Hans', imports = {}, globals = {}} = {}) {
  let cursor = 0;
  const slots = [];
  const effects = [];
  const timers = new Map();
  let nextTimer = 0;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = {value: typeof initial === 'function' ? initial() : initial};
      return [slots[index].value, (next) => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      return (slots[index] ??= {current: initial});
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = {deps, value: factory()};
      return slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) {
        const previous = slots[index];
        slots[index] = {deps};
        effects.push(() => {
          previous?.cleanup?.();
          slots[index].cleanup = callback();
        });
      }
    },
  };
  const cache = new Map();
  const window = {
    location: {search: '', pathname: `/${page}`, hash: ''},
    history: {replaceState() {}}, innerWidth: 1200,
    addEventListener() {}, removeEventListener() {},
  };
  const context = vm.createContext({
    console, URL, URLSearchParams, window,
    document: {getElementById() { return {focus() {}}; }},
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch() { throw new Error('Unexpected network access in page regression test'); },
    ...globals,
  });
  const history = {replace() {}};
  function load(filename, expose = []) {
    if (cache.has(filename)) return cache.get(filename);
    const source = readFileSync(filename, 'utf8') + (expose.length ? `\nexport {${expose.join(',')}};` : '');
    const {code} = transformSync(source, {filename, configFile: false, babelrc: false, plugins});
    const module = {exports: {}};
    const localRequire = (specifier) => {
      if (specifier in imports) return imports[specifier];
      if (specifier === 'react') return hooks;
      if (specifier.endsWith('.css')) return new Proxy({}, {get: (_, key) => key});
      if (specifier === '@docusaurus/useDocusaurusContext') return () => ({i18n: {currentLocale: locale}});
      if (specifier === '@docusaurus/router') return {useHistory: () => history};
      if (specifier.startsWith('@theme/') || specifier.startsWith('@docusaurus/')) return ({children}) => children;
      if (specifier.startsWith('@site/') || specifier.startsWith('.')) {
        let target = specifier.startsWith('@site/') ? resolve(root, specifier.slice(6)) : resolve(dirname(filename), specifier);
        if (!/\.(?:mjs|jsx|js)$/.test(target)) target += '.js';
        return load(target);
      }
      return require(specifier);
    };
    const evaluate = vm.runInContext(`(function(require, module, exports) {${code}\n})`, context, {filename});
    evaluate(localRequire, module, module.exports);
    cache.set(filename, module.exports);
    return module.exports;
  }
  const exports = load(resolve(root, `src/pages/${page}.jsx`), names);
  return {
    exports,
    loadModule(relativePath) { return load(resolve(root, relativePath)); },
    render(name, props = {}) { cursor = 0; return exports[name](props); },
    async effects() {
      for (const effect of effects.splice(0)) effect();
      await Promise.resolve();
      await Promise.resolve();
    },
    async timers() {
      const pending = [...timers.values()];
      timers.clear();
      for (const callback of pending) await callback();
    },
  };
}

function sameDeps(previous, next) {
  return Boolean(previous && next && previous.length === next.length && next.every((value, index) => Object.is(value, previous[index])));
}

export function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => elements(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}

export function visibleText(tree) {
  if (Array.isArray(tree)) return tree.map(visibleText).join('');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree?.props ? visibleText(tree.props.children) : '';
}
