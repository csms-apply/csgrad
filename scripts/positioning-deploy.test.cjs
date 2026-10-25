const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const handler = require('serve-handler');

test('running static server follows activation and serves previous PDF chunk URL', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'csgrad-activation-'));
  const releases = path.join(root, '.site-releases');
  for (const version of ['old', 'new']) {
    for (const file of ['index.html', 'en/index.html', 'school-positioning-result/index.html', 'en/school-positioning-result/index.html', 'zh-Hant/index.html', 'zh-Hant/school-positioning-result/index.html', `assets/js/pdf-${version}.js`]) {
      const output = path.join(releases, version, file);
      fs.mkdirSync(path.dirname(output), {recursive:true});
      fs.writeFileSync(output, version);
    }
  }
  fs.symlinkSync(path.join(releases,'old'), path.join(root,'build'));
  const server = http.createServer((req,res) => handler(req,res,{public:path.join(root,'build')}));
  try {
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await (await fetch(origin)).text(), 'old');
    const oldChunk = `${origin}/assets/js/pdf-old.js`;
    assert.equal((await fetch(oldChunk)).status, 200);
    execFileSync('python3', [path.join(__dirname,'activate-build.py'),root,path.join(releases,'new')]);
    assert.equal(await (await fetch(origin)).text(), 'new');
    const oldResponse = await fetch(oldChunk);
    assert.equal(oldResponse.status,200);
    assert.equal(await oldResponse.text(),'old');
    assert.equal(await (await fetch(`${origin}/assets/js/pdf-new.js`)).text(),'new');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root,{recursive:true,force:true});
  }
});
