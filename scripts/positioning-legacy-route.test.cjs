const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync,existsSync} = require('node:fs');
const {join} = require('node:path');
const root = join(__dirname,'..');
const destination = 'https://www.cs.washington.edu/academics/graduate/pmp/';
const route = 'A/uw pmp cse/index.html';
function verify(file) {
 const html = readFileSync(file,'utf8');
 assert.ok(html.includes(`content="0;url=${destination}"`));
 assert.ok(html.includes(`href="${destination}"`));
 assert.match(html,/<meta name="robots" content="noindex">/);
 assert.doesNotMatch(html,/uw ee pmp/);
}
test('frozen UW CSE PMP links lead to the correct official program without JavaScript',()=>{
 verify(join(root,'static',route));
});
// CI builds both locales before test:ux, verifying Docusaurus copied the static
// fallback to each locale output (the source is shared, not two diverging pages).
test('both deployed locale paths retain the legacy redirect', {skip:!existsSync(join(root,'build'))},()=>{
 verify(join(root,'build',route));
 verify(join(root,'build/en',route));
});
