import test from 'node:test';
import React from 'react';
import assert from 'node:assert/strict';
import {pageHarness, elements, visibleText} from '../dp/page-test-harness.mjs';

const imports = {
  '@site/src/lib/auth/SignInButtons': () => null,
  '@site/src/lib/auth/oauth': {startOAuth() { throw new Error('Unexpected OAuth'); }},
};

for (const [page, component] of [['datapoints','DataPointsPage'],['submit-dp','SubmitDp'],['my-dp','MyDp']]) {
  test(`${page} uses Traditional Chinese messages and preserves actual locale`, () => {
    const harness = pageHarness(page, [component, 'pickLocale'], {locale:'zh-Hant', imports});
    assert.equal(harness.exports.pickLocale('zh-Hant'), 'zh-Hant');
    const tree = harness.render(component);
    assert.match(tree.props.title + tree.props.description, /[錄數據傳個學申請]/);
    assert.doesNotMatch(tree.props.title + tree.props.description, /[录数传个学]/);
  });
}

test('Traditional enum labels preserve original submitted values and unknown free text', () => {
  const harness = pageHarness('submit-dp', ['Select', 'dispEnum', 'COPY'], {locale:'zh-Hant', imports:{...imports,react:{...React,useId:()=> 'test-id'}}});
  const {getLocaleMessages} = harness.loadModule('src/lib/i18n/traditional.js');
  let submitted;
  const tree = harness.render('Select', {id:'major', options:['其他学科'], enumGroup:'UG_MAJORS', locale:'zh-Hant', value:'其他学科', onChange:value=>{submitted=value;}, t:getLocaleMessages(harness.exports.COPY,'zh-Hant')});
  const option = elements(tree, node=>node.type==='option' && node.props.value==='其他学科')[0];
  assert.equal(visibleText(option),'其他學科');
  elements(tree,node=>node.type==='select')[0].props.onChange({target:{value:'其他学科'}});
  assert.equal(submitted,'其他学科');
  assert.equal(harness.exports.dispEnum('UG_MAJORS','自由填写原文','zh-Hant'),'自由填写原文');
});

test('my DP browse, submit, and sign-out retain the Traditional Chinese locale', async () => {
  const window = {location:{href:''}};
  const harness = pageHarness('my-dp', ['Inner','COPY'], {locale:'zh-Hant', globals:{window}, imports:{...imports,
    '@site/src/lib/dp/api': {getMe:async()=>({user:{nickname:'Synthetic'}}),getMyApplicant:async()=>({applicant:null}),signOut:async()=>{}}
  }});
  const {getLocaleMessages} = harness.loadModule('src/lib/i18n/traditional.js');
  const props = {locale:'zh-Hant',t:getLocaleMessages(harness.exports.COPY,'zh-Hant')};
  harness.render('Inner',props);
  await harness.effects();
  const tree=harness.render('Inner',props);
  const links=elements(tree,node=>node.type==='a').map(node=>node.props.href);
  assert.ok(links.includes('/zh-Hant/datapoints'));
  assert.ok(links.includes('/zh-Hant/submit-dp'));
  const signOut=elements(tree,node=>node.type==='button' && visibleText(node)===props.t.signOut)[0];
  await signOut.props.onClick();
  assert.equal(window.location.href,'/zh-Hant/datapoints');
});
