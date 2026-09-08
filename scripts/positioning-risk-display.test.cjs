const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('@babel/core');
const filename = path.join(__dirname, '../src/pages/school-positioning-result.jsx');
const source = fs.readFileSync(filename, 'utf8');
const { code } = transformSync(source, {
  filename, babelrc: false, configFile: false,
  presets: [require.resolve('@babel/preset-react')],
  plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
});
const exportsForTest = {};
vm.runInNewContext(code, {
  exports: exportsForTest,
  require(name) {
    if (name === 'react') return React;
    if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (name.startsWith('@')) return {};
    throw new Error(`Unexpected import: ${name}`);
  },
});
const { RiskNotice, ReviewedAlternatives } = exportsForTest;
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('uncalibrated policy text is visible and escaped', () => {
  const html = render(RiskNotice, { locale: 'zh-Hans', policy: { calibrated: false, caveat: '风险未校准 <script>unsafe</script>' } });
  assert.match(html, /风险未校准/);
  assert.ok(!html.includes('<script>'));
});
test('legacy responses retain a meaningful localized risk explanation', () => {
  assert.match(render(RiskNotice, { locale: 'zh-Hans' }), /不保证录取/);
  assert.match(render(RiskNotice, { locale: 'en' }), /not personal admission probabilities/);
  assert.equal(render(ReviewedAlternatives, { locale: 'en' }), '');
});
test('additional match candidates display reason and link, excluding other buckets', () => {
  const html = render(ReviewedAlternatives, { locale: 'zh-Hans', items: [
    { bucket: 'match', school: 'Example MCS', reason: '需要进一步审核方向', doc: '/A/Example MCS' },
    { bucket: 'safety', school: 'Wrong bucket' }, null,
  ] });
  assert.match(html, /补充主申候选/); assert.match(html, /Example MCS/);
  assert.match(html, /需要进一步审核方向/); assert.match(html, /href="\/A\/Example%20MCS"/);
  assert.ok(!html.includes('Wrong bucket'));
});
test('risk and alternatives are part of the same DOM subtree exported to PDF', () => {
  const start = source.indexOf('<div ref={reportRef}');
  const footer = source.indexOf('<div className={styles.reportFooter}', start);
  const report = source.slice(start, footer);
  assert.match(report, /<RiskNotice policy={data.riskPolicy}/);
  assert.match(report, /<ReviewedAlternatives items={data.reviewedAlternatives}/);
  assert.match(source, /\.from\(reportRef.current\)/);
});
