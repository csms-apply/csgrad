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
    if (name === '@site/src/lib/i18n/traditional') return require('../src/lib/i18n/traditional.js'); if (name === '@site/src/lib/seo/localizedAlternates.mjs') return require('../src/lib/seo/localizedAlternates.mjs'); if (name.startsWith('@')) return {};
    throw new Error(`Unexpected import: ${name}`);
  },
});
const { RiskNotice, ReviewedAlternatives, Bucket } = exportsForTest;
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
  assert.match(source, /exportReportPdf\(reportRef.current/);
  assert.match(source, /\.from\(clone\)/);
});

test('program overview replaces generic fit details without changing links or old reports', () => {
  const item = {bucket:'match',school:'Example MCS',doc:'/A/Example MCS',reason:'Legacy reason',
    programOverview:{en:'A coursework program with a capstone <project>.','zh-Hans':'以课程和毕业项目为主。'},
    fit:{trackMatch:'aligned',reasons:[{en:'Generic fit reason','zh-Hans':'通用适配理由'}],checks:[{message:{en:'Generic verify task','zh-Hans':'通用核验任务'}}]}};
  for (const [locale,expected] of [['en','A coursework program with a capstone &lt;project&gt;.'],['zh-Hans','以课程和毕业项目为主。']]) {
    const html=render(ReviewedAlternatives,{locale,items:[item]});
    assert.ok(html.includes(expected));
    assert.ok(!html.includes('<project>'));
    assert.doesNotMatch(html,/Generic fit reason|Generic verify task|通用适配理由|通用核验任务|Legacy reason/);
    assert.ok(html.includes(locale==='en'?'/en/A/Example%20MCS':'/A/Example%20MCS'));
  }
  const old=render(ReviewedAlternatives,{locale:'en',items:[{...item,programOverview:undefined}]});
  assert.match(old,/Generic fit reason/);assert.match(old,/Generic verify task/);
  const empty=render(ReviewedAlternatives,{locale:'en',items:[{...item,programOverview:{en:'   ','zh-Hans':'仅中文'}}]});
  assert.match(empty,/Generic fit reason/);assert.doesNotMatch(empty,/仅中文/);
  const legacy=render(ReviewedAlternatives,{locale:'en',items:[{...item,programOverview:undefined,fit:undefined}]});
  assert.match(legacy,/Legacy reason/);
});

test('bucket headers do not repeat identical labels and retain distinct Chinese subtitles', () => {
  for (const title of ['Reach','Match','Alternatives']) {
    const html=render(Bucket,{items:[],title,subtitle:title,locale:'en',t:{emptyBucket:'No programs'}});
    const heading=html.match(/<h3[^>]*>(.*?)<\/h3>/)[1];
    assert.equal(heading,title);
  }
  for (const [title,subtitle] of [['冲刺','Reach'],['主申','Match'],['备选','Alternatives']]) {
    const html=render(Bucket,{items:[],title,subtitle,locale:'zh-Hans',t:{emptyBucket:'暂无项目'}});
    const heading=html.match(/<h3[^>]*>(.*?)<\/h3>/)[1];
    assert.ok(heading.startsWith(title));
    assert.equal(heading.split(title).length-1,1);
    assert.ok(heading.includes(subtitle));
  }
});
