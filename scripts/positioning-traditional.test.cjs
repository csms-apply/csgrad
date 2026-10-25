const test = require('node:test');
const assert = require('node:assert/strict');
const {getLocaleMessages, localizeMessages} = require('../src/lib/i18n/traditional.js');

test('Traditional presentation preserves API keys, route spelling and original messages', () => {
  const source = { '台本': '台湾本科', path: '/找我辅导', count: n => `共 ${n} 条`, amount: 3 };
  const translated = localizeMessages(source, 'zh-Hant');
  assert.equal(translated['台本'], '臺灣本科');
  assert.equal(translated.path, '/找我辅导');
  assert.equal(translated.count(4), '共 4 條');
  assert.equal(translated.amount, 3);
  assert.equal(source['台本'], '台湾本科');
  assert.equal(localizeMessages(source, 'en'), source);
  assert.equal(getLocaleMessages({'zh-Hans':source}, 'zh-Hant'), translated);
});

test('Traditional paid report renders translated text with locale-specific program links', async () => {
  const React = require('react');
  const {renderToStaticMarkup} = require('react-dom/server');
  const {pageHarness} = await import('../src/lib/dp/page-test-harness.mjs');
  const harness = pageHarness('school-positioning-result', [], {locale:'zh-Hant'});
  const html = renderToStaticMarkup(React.createElement(harness.exports.ReviewedAlternatives, {
    locale:'zh-Hant', items:[{bucket:'match',school:'Example MSCS',
      programOverview:{'zh-Hans':'课程包含计算机系统与软件工程。'},doc:'/A/Example MSCS'}],
  }));
  assert.match(html, /課程包含計算機系統與軟件工程/);
  assert.match(html, /href="\/zh-Hant\/A\/Example%20MSCS"/);
  assert.doesNotMatch(html, /课程|计算机/);
});
