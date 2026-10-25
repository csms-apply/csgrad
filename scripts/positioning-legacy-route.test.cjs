const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync,existsSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const root = join(__dirname,'..');
const destination = 'https://www.cs.washington.edu/academics/graduate/pmp/';
const route = 'A/uw pmp cse/index.html';
const missingProgramRedirects = [
 ['A-/nyu courant mscs/index.html','https://cs.nyu.edu/dynamic/masters/prospective-overview/'],
 ['B+/dartmouth mscs/index.html','https://web.cs.dartmouth.edu/graduate/graduate-admissions/masters-computer-science'],
 ['B+/purdue mscs/index.html','https://www.cs.purdue.edu/graduate/curriculum/masters.html'],
 ['B/bu mscs/index.html','https://www.bu.edu/cs/masters/program/cs/'],
 ['SS/CMU MLT/index.html','https://www.lti.cmu.edu/academics/masters-programs/mlt.html'],
];
function verify(file) {
 const html = readFileSync(file,'utf8');
 assert.ok(html.includes(`content="0;url=${destination}"`));
 assert.ok(html.includes(`href="${destination}"`));
 assert.match(html,/<meta name="robots" content="noindex">/);
 assert.doesNotMatch(html,/uw ee pmp/);
}
function verifyExternalRedirect(file, target) {
 const html = readFileSync(file,'utf8');
 assert.ok(html.includes(`content="0;url=${target}"`));
 assert.ok(html.includes(`href="${target}"`));
 assert.match(html,/<meta name="robots" content="noindex">/);
}
function verifyStanfordRedirect(file) {
 const html = readFileSync(file,'utf8');
 assert.match(html,/<meta name="robots" content="noindex">/);
 assert.match(html,/location\.pathname\.startsWith\('\/en\/'\)/);
 assert.match(html,/location\.pathname\.startsWith\('\/zh-Hant\/'\)/);
 assert.match(html,/location\.replace\(`\$\{locale\}\/SS\/stanford%20msee`\)/);
 assert.match(html,/href="\/SS\/stanford%20msee"/);
}
test('frozen UW CSE PMP links lead to the correct official program without JavaScript',()=>{
 verify(join(root,'static',route));
});
test('missing report program routes redirect to official program pages',()=>{
 for (const [path,target] of missingProgramRedirects) {
  verifyExternalRedirect(join(root,'static',path),target);
 }
 verifyStanfordRedirect(join(root,'static','SSS/stanford msee/index.html'));
});
test('Stanford MSEE legacy link keeps each locale with or without a trailing slash',()=>{
 const html = readFileSync(join(root,'static','SSS/stanford msee/index.html'),'utf8');
 const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 for (const [path,target] of [
  ['/SSS/stanford%20msee','/SS/stanford%20msee'],
  ['/en/SSS/stanford%20msee/','/en/SS/stanford%20msee'],
  ['/zh-Hant/SSS/stanford%20msee','/zh-Hant/SS/stanford%20msee'],
 ]) {
  let redirect;
  runInNewContext(script,{location:{pathname:path,replace:url=>{redirect=url;}}});
  assert.equal(redirect,target);
 }
});
// CI builds both locales before test:ux, verifying Docusaurus copied the static
// fallback to each locale output (the source is shared, not two diverging pages).
test('both deployed locale paths retain the legacy redirect', {skip:!existsSync(join(root,'build'))},()=>{
 verify(join(root,'build',route));
 verify(join(root,'build/en',route));
});
test('every deployed locale keeps all missing-report redirects', {skip:!existsSync(join(root,'build'))},()=>{
 for (const locale of ['', 'en', 'zh-Hant']) {
  for (const [path,target] of missingProgramRedirects) {
   verifyExternalRedirect(join(root,'build',locale,path),target);
  }
  verifyStanfordRedirect(join(root,'build',locale,'SSS/stanford msee/index.html'));
 }
});
