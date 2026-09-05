import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const pagePath = path.resolve('src/pages/tracker.jsx');

function fixture(overrides = {}) {
  return {id: 'existing', school: 'Test University', program: 'MSCS', column: 'target', deadline: '',
    lors: [{name: 'Reference', done: false}], toefl: '', gre: '', essayStatus: 'not_started', notes: '',
    fromLibrary: false, tier: '', slug: '', ...overrides};
}

// Exercise the real page and modal event handlers without a browser/backend.
// Hooks are scheduled explicitly; browser keyboard/focus behavior is covered separately.
function mountTracker(initialCards = [], locale = 'zh-Hans', priorStorage) {
  const frames = new Map();
  const effects = [];
  const writes = [];
  const storageValues = new Map(priorStorage || [['csgrad_tracker_data', typeof initialCards === 'string' ? initialCards : JSON.stringify(initialCards)]]);
  let failKey = null;
  let failWrite = () => false;
  let frame;
  let cursor;
  const slot = (create) => {
    const index = cursor++;
    if (!(index in frame)) frame[index] = create();
    return [frame, index];
  };
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    Fragment: 'fragment',
    useState(initial) {
      const [state, index] = slot(() => typeof initial === 'function' ? initial() : initial);
      return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useRef(initial) { const [state, index] = slot(() => ({current: initial})); return state[index]; },
    useMemo(fn) { return fn(); },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) {
      const [state, index] = slot(() => undefined);
      if (!state[index] || !deps || deps.some((value, i) => value !== state[index][i])) {
        state[index] = deps;
        effects.push(fn);
      }
    },
  };
  const translate = ({message}, values = {}) => message.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
  const passthrough = ({children}) => children;
  const mocks = {
    react,
    '@theme/Layout': passthrough,
    '@docusaurus/Head': passthrough,
    '@docusaurus/Translate': {__esModule: true, default: passthrough, translate},
    '@docusaurus/useDocusaurusContext': () => ({i18n: {currentLocale: locale}}),
    '@dnd-kit/core': {DndContext: passthrough, DragOverlay: passthrough, useSensor: () => null,
      useSensors: () => [], useDroppable: () => ({}), PointerSensor: {}, closestCorners: () => null},
    '@dnd-kit/sortable': {SortableContext: passthrough, useSortable: () => ({}), arrayMove: (items) => items},
    '@dnd-kit/utilities': {CSS: {Transform: {toString: () => ''}}},
  };
  const cache = new Map();
  const alerts = [];
  const storage = {
    getItem: (key) => storageValues.get(key) ?? null,
    setItem: (key, value) => {
      if (key === failKey || failWrite(key, value)) throw new Error('QuotaExceededError');
      storageValues.set(key, value); writes.push({key, value});
    },
    removeItem: (key) => storageValues.delete(key),
  };
  class FileReader {
    readAsText(file) { this.onload({target: {result: file.text}}); }
  }
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), {filename, babelrc: false, configFile: false,
      plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs']}).code;
    const module = {exports: {}};
    const localRequire = (specifier) => {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.endsWith('.css')) return new Proxy({}, {get: (_, name) => name});
      if (specifier.startsWith('.')) {
        let resolved = path.resolve(path.dirname(filename), specifier);
        if (!path.extname(resolved)) resolved += '.js';
        return load(resolved);
      }
      return require(specifier);
    };
    new Function('require', 'module', 'exports', 'localStorage', 'FileReader', 'alert', 'fetch', 'document', code)(
      localRequire, module, module.exports, storage, FileReader, (msg) => alerts.push(msg),
      () => Promise.resolve({json: () => Promise.resolve([])}), {activeElement: null});
    cache.set(filename, module.exports);
    return module.exports;
  }
  const Page = load(pagePath).default;
  function expand(node, key = 'root') {
    if (node == null || typeof node === 'boolean') return null;
    if (Array.isArray(node)) return node.flatMap((child, index) => expand(child, `${key}/${index}`));
    if (typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const id = `${key}:${node.type.name}`;
      if (!frames.has(id)) frames.set(id, []);
      frame = frames.get(id);
      cursor = 0;
      return expand(node.type(node.props), id);
    }
    return {...node, props: {...node.props, children: expand(node.props.children, key)}};
  }
  let tree;
  const render = () => { tree = expand(react.createElement(Page, {})); return tree; };
  const all = (predicate, node = tree) => {
    if (Array.isArray(node)) return node.flatMap((child) => all(predicate, child));
    if (!node || typeof node !== 'object') return [];
    return [...(predicate(node) ? [node] : []), ...all(predicate, node.props.children)];
  };
  const textOf = (node) => Array.isArray(node) ? node.map(textOf).join('')
    : node && typeof node === 'object' ? textOf(node.props.children) : node == null ? '' : String(node);
  const button = (label) => all((node) => node.type === 'button' && textOf(node).includes(label))[0];
  const flush = () => { effects.splice(0).forEach((fn) => fn()); render(); };
  const importFile = (data) => {
    all((node) => node.type === 'input' && node.props.type === 'file')[0].props.onChange({target: {
      files: [{text: typeof data === 'string' ? data : JSON.stringify(data)}], value: 'fixture.json'}});
    render();
  };
  render(); flush(); flush();
  return {render, flush, all, button, textOf, importFile, alerts, writes,
    storageSnapshot: () => new Map(storageValues),
    failWritesTo: (key) => { failKey = key; },
    failWritesWhen: (predicate) => { failWrite = predicate; },
    raw: () => storageValues.get('csgrad_tracker_data'),
    saved: () => JSON.parse(storageValues.get('csgrad_tracker_data'))};
}

test('custom add persists the category selected in the real modal callback', () => {
  for (const column of ['reach', 'match', 'target', 'safety']) {
    const page = mountTracker();
    page.button('添加自定义项目').props.onClick(); page.render();
    page.all((node) => node.type === 'input' && node.props.placeholder === '如: Stanford University')[0]
      .props.onChange({target: {value: 'E2E University'}}); page.render();
    page.all((node) => node.type === 'select' && node.props.value === 'reach')[0]
      .props.onChange({target: {value: column}}); page.render();
    page.all((node) => node.type === 'button' && page.textOf(node) === '添加项目')[0].props.onClick();
    page.render(); page.flush();
    assert.equal(page.saved()[0].column, column);
  }
});

test('invalid backup never replaces existing persisted cards', () => {
  const original = [fixture()];
  const page = mountTracker(original);
  page.importFile([fixture({column: 'invisible-column'})]);
  page.flush();
  assert.deepEqual(page.saved(), original);
  assert.match(page.textOf(page.all((node) => node.props.role === 'status')), /导入失败/);
});

test('valid backups require explicit replacement, cancel safely, and can be undone', () => {
  const original = [fixture()];
  const incoming = [fixture({id: 'new-card', school: 'Another University', column: 'safety'})];
  const page = mountTracker(original);
  page.importFile(incoming); page.flush();
  assert.deepEqual(page.saved(), original);
  assert.match(page.textOf(page.all((node) => node.props.role === 'alertdialog')), /替换.*不是合并/);
  page.button('取消').props.onClick(); page.render(); page.flush();
  assert.deepEqual(page.saved(), original);
  page.importFile(incoming);
  page.button('确认替换').props.onClick(); page.render(); page.flush();
  assert.deepEqual(page.saved(), incoming);
  page.button('撤销最近导入').props.onClick(); page.render();
  page.button('取消').props.onClick(); page.render(); page.flush();
  assert.deepEqual(page.saved(), incoming);
  page.button('撤销最近导入').props.onClick(); page.render();
  page.button('恢复旧清单').props.onClick(); page.render(); page.flush();
  assert.deepEqual(page.saved(), original);
});

test('invalid array entries, duplicate IDs, malformed nested fields and non-array JSON are rejected by import', () => {
  const invalid = [
    {}, [null], [fixture(), fixture()], [fixture({lors: undefined})],
    [fixture({id: ''})], [fixture({lors: [{name: 'Ref', done: 'yes'}]})],
    [fixture({essayStatus: 'unknown'})], [fixture({deadline: '2026-02-30'})],
    [fixture({slug: 'javascript:alert(1)'})], [fixture({slug: '//outside.example'})],
    [fixture({fromLibrary: true})], [fixture({school: '', program: ''})], 'not json',
  ];
  for (const data of invalid) {
    const original = [fixture()];
    const page = mountTracker(original);
    page.importFile(data); page.flush();
    assert.deepEqual(page.saved(), original);
    assert.equal(page.all((node) => node.props.role === 'alertdialog').length, 0);
    assert.match(page.textOf(page.all((node) => node.props.role === 'status')), /导入失败/);
  }
});

test('existing export format permits empty backups and school-only/program-only records', () => {
  for (const incoming of [[], [fixture({program: ''})], [fixture({school: ''})],
    [fixture({fromLibrary: true, libraryId: 'emory-mscs', slug: '/B/Emory MSCS', lors: []})]]) {
    const page = mountTracker([fixture()]);
    page.importFile(incoming);
    page.button('确认替换').props.onClick(); page.render(); page.flush();
    assert.deepEqual(page.saved(), incoming);
  }
});

test('initial hydration never writes an empty list over existing saved cards', () => {
  const original = [fixture()];
  const page = mountTracker(original);
  assert.ok(page.writes.length > 0);
  assert.ok(page.writes.every(({value}) => value === JSON.stringify(original)));
});

test('unreadable legacy saved data remains intact and blocks empty-state editing', () => {
  for (const raw of ['invalid json', JSON.stringify([fixture({column: 'legacy-invalid'})])]) {
    const page = mountTracker(raw);
    assert.equal(page.raw(), raw);
    assert.equal(page.writes.length, 0);
    assert.equal(page.button('添加自定义项目').props.disabled, true);
    assert.match(page.textOf(page.all((node) => node.props.role === 'alert')), /原始数据已保留/);
  }
});

test('storage failure during backup or replacement keeps the current list unchanged', () => {
  for (const key of ['csgrad_tracker_before_import', 'csgrad_tracker_data']) {
    const original = [fixture()];
    const page = mountTracker(original);
    page.importFile([fixture({id: 'new'})]);
    page.failWritesTo(key);
    page.button('确认替换').props.onClick(); page.render(); page.flush();
    assert.deepEqual(page.saved(), original);
    assert.match(page.textOf(page.all((node) => node.props.role === 'status')), /导入未完成/);
  }
});

test('failed second import preserves the current list and the original undo backup', () => {
  const original = [fixture()];
  const firstImport = [fixture({id: 'first-import'})];
  const page = mountTracker(original);
  page.importFile(firstImport);
  page.button('确认替换').props.onClick(); page.render(); page.flush();
  page.importFile([fixture({id: 'second-import'})]);
  page.failWritesTo('csgrad_tracker_data');
  page.button('确认替换').props.onClick(); page.render(); page.flush();
  assert.deepEqual(page.saved(), firstImport);
  assert.equal(page.storageSnapshot().get('csgrad_tracker_before_import'), JSON.stringify(original));
});

test('failed first import removes its temporary undo backup', () => {
  const original = [fixture()];
  const page = mountTracker(original);
  page.importFile([fixture({id: 'new'})]);
  page.failWritesTo('csgrad_tracker_data');
  page.button('确认替换').props.onClick(); page.render(); page.flush();
  assert.deepEqual(page.saved(), original);
  assert.equal(page.storageSnapshot().has('csgrad_tracker_before_import'), false);
});

test('failed rollback clearly warns about undo history and disables the undo action', () => {
  const original = [fixture()];
  const firstImport = [fixture({id: 'first-import'})];
  const page = mountTracker(original);
  page.importFile(firstImport);
  page.button('确认替换').props.onClick(); page.render(); page.flush();
  page.importFile([fixture({id: 'second-import'})]);
  page.failWritesWhen((key, value) => key === 'csgrad_tracker_data'
    || (key === 'csgrad_tracker_before_import' && value === JSON.stringify(original)));
  page.button('确认替换').props.onClick(); page.render(); page.flush();
  assert.deepEqual(page.saved(), firstImport);
  assert.match(page.textOf(page.all((node) => node.props.role === 'status')), /无法恢复之前的撤销备份/);
  assert.equal(page.button('撤销最近导入'), undefined);
});

test('undo backup survives a page reload and restores the previous list', () => {
  const original = [fixture()];
  const page = mountTracker(original);
  page.importFile([fixture({id: 'new'})]);
  page.button('确认替换').props.onClick(); page.render(); page.flush();
  const reloaded = mountTracker([], 'zh-Hans', page.storageSnapshot());
  reloaded.button('撤销最近导入').props.onClick(); reloaded.render();
  reloaded.button('恢复旧清单').props.onClick(); reloaded.render(); reloaded.flush();
  assert.deepEqual(reloaded.saved(), original);
});

test('recovery import preserves unreadable old data and undo restores it without empty-state writes', () => {
  const original = JSON.stringify([fixture({column: 'unrecognized-legacy-column'})]);
  const page = mountTracker(original);
  page.importFile([fixture({id: 'valid-replacement'})]);
  page.button('确认替换').props.onClick(); page.render(); page.flush();
  page.button('撤销最近导入').props.onClick(); page.render();
  page.button('恢复旧清单').props.onClick(); page.render(); page.flush();
  assert.equal(page.raw(), original);
  assert.equal(page.button('添加自定义项目').props.disabled, true);
});

test('English tracker renders localized home and program detail links', () => {
  const page = mountTracker([fixture({slug: '/B/Emory MSCS'})], 'en');
  assert.ok(page.all((node) => node.type === 'a' && node.props.href === '/en/').length);
  assert.ok(page.all((node) => node.type === 'a' && node.props.href === '/en/B/Emory MSCS').length);
});

test('card and library modals expose accessible dialog semantics and close actions', () => {
  const page = mountTracker();
  page.button('添加自定义项目').props.onClick(); page.render();
  let modal = page.all((node) => node.props.role === 'dialog')[0];
  assert.equal(modal.props['aria-modal'], 'true');
  assert.ok(modal.props['aria-labelledby']);
  page.all((node) => node.type === 'button' && node.props['aria-label'] === '关闭')[0].props.onClick(); page.render();
  assert.equal(page.all((node) => node.props.role === 'dialog').length, 0);
  page.button('添加项目').props.onClick(); page.render();
  modal = page.all((node) => node.props.role === 'dialog')[0];
  assert.equal(modal.props['aria-modal'], 'true');
  assert.ok(modal.props['aria-labelledby']);
});
