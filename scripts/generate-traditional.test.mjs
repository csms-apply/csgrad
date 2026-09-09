import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
const parser=unified().use(remarkParse).use(remarkMdx).use(remarkFrontmatter,['yaml']);
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
function protectedValues(source, file){
 source=source.replace(/@site\/[^\s)'"<>]+/g, value=>{
  const target=path.resolve(value.slice(6));
  let relative=path.relative(path.dirname(path.resolve(file)),target).split(path.sep).join('/');
  if(!relative.startsWith('.'))relative='./'+relative;
  return relative;
 });source=source.replace(/ \{#[^}]+\}(?=\r?$)/gm,'');const out=[];function visit(n){
 if(['code','inlineCode','mdxjsEsm','mdxFlowExpression','mdxTextExpression'].includes(n.type))out.push([n.type,n.value]);
 if(n.url)out.push(['url',n.url]);
 if(n.type==='yaml'){const fields=n.value.split('\n').filter(l=>!/^(title|description|sidebar_label):/.test(l)).join('\n');if(fields.trim())out.push(['frontmatter-identifiers',fields]);}
 if(n.attributes)out.push(['jsx-attributes',n.attributes.map(a=>source.slice(a.position.start.offset,a.position.end.offset))]);
 for(const c of n.children||[])visit(c);
}visit(parser.parse(source));return out;}
test('all source documents have Traditional copies with equivalent resource targets and identical code, identifiers and JSX attributes',()=>{
 const docs=files('docs').filter(p=>/\.mdx?$/.test(p));assert.ok(docs.length>100);
 for(const file of docs){const target=path.join('i18n/zh-Hant/docusaurus-plugin-content-docs/current',path.relative('docs',file));assert.ok(fs.existsSync(target),file);assert.deepEqual(protectedValues(fs.readFileSync(target,'utf8'),file),protectedValues(fs.readFileSync(file,'utf8'),file),file);}
});
test('all READMEs link all three languages with their active badge',()=>{
 for(const [file,badge] of [['README.md','zh'],['README.en.md','en'],['README.zh-Hant.md','hant']]){
  const text=fs.readFileSync(file,'utf8');for(const href of ['README.md','README.en.md','README.zh-Hant.md'])assert.ok(text.includes(`href="${href}"`));assert.ok(text.includes(`language-${badge}-active.svg`));
 }
 assert.doesNotMatch(fs.readFileSync('README.zh-Hant.md','utf8'),/\{#[^}]+\}/);
});

test('moved intro resolves its original static image through the site alias',()=>{
 const text=fs.readFileSync('i18n/zh-Hant/docusaurus-plugin-content-docs/current/intro.mdx','utf8');
 assert.ok(text.includes('](@site/static/img/csgradqqchat.png)'));
 assert.ok(fs.existsSync('static/img/csgradqqchat.png'));
});

test('Traditional README links to its localized homepage',()=>{
 assert.ok(fs.readFileSync('README.zh-Hant.md','utf8').includes('[CS Grad 繁體中文首頁](https://csgrad.com/zh-Hant/)'));
});

test('Traditional documents have unique descriptions and at most one explicit H1',()=>{
 const descriptions=new Set();
 for(const file of files('i18n/zh-Hant/docusaurus-plugin-content-docs/current').filter(p=>/\.mdx?$/.test(p))){
  const source=fs.readFileSync(file,'utf8');
  assert.ok((source.match(/^# /gm)||[]).length<=1,file);
  const description=source.match(/^description: (.+)$/m)?.[1];
  assert.ok(description,file);assert.ok(!descriptions.has(description),file);descriptions.add(description);
 }
 const supplemental=fs.readFileSync('i18n/zh-Hant/docusaurus-plugin-content-docs/current/tutorial-basics/yale mscs 1 year.md','utf8');
 assert.match(supplemental,/^title: "Yale MSCS 一年制：補充介紹與申請、就業案例"/m);
 assert.ok(!fs.readFileSync('i18n/zh-Hant/code.json','utf8').includes('跳至主要内容'));
});
