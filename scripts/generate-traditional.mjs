// Regenerate Traditional Chinese content without translating machine identifiers.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import GithubSlugger from 'github-slugger';
import {parse} from '@babel/parser';
import {Converter} from 'opencc-js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const convert=Converter({from:'cn',to:'tw'});
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const write=(p,text)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);};
const prose=s=>s.replace(/https?:\/\/[^\s<>]+|\{#[^}]+\}|[^]+?(?=https?:\/\/|\{#|$)/g,x=>/^(https?:\/\/|\{#)/.test(x)?x:convert(x));
const parser=unified().use(remarkParse).use(remarkMdx).use(remarkFrontmatter,['yaml']);
function markdown(source, preserveAnchors = true, sourceFile = null){
 const relocate = value => {
  if (!sourceFile || !/^\.\.?\//.test(value)) return value;
  const [, pathname, suffix] = value.match(/^([^?#]*)(.*)$/s);
  const resolved = path.resolve(path.dirname(sourceFile), decodeURIComponent(pathname));
  const relative = path.relative(path.join(root, 'docs'), resolved);
  // Relative document links retain their translated sibling destination.
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return value;
  const sitePath = path.relative(root, resolved);
  if (sitePath.startsWith('..') || path.isAbsolute(sitePath)) throw new Error(`Reference outside site: ${value}`);
  return '@site/' + sitePath.split(path.sep).join('/') + suffix;
 };
 const tree=parser.parse(source),edits=[],slugger=new GithubSlugger();
 let seenH1=false;
 const visible=n=>n.type==='text'||n.type==='inlineCode'?n.value:(n.children||[]).map(visible).join('');
 function walk(n){
  if(n.url && relocate(n.url)!==n.url){
   const raw=source.slice(n.position.start.offset,n.position.end.offset);
   const offset=raw.indexOf(n.url);
   if(offset<0)throw new Error(`Cannot locate URL: ${n.url}`);
   edits.push([n.position.start.offset+offset,n.position.start.offset+offset+n.url.length,relocate(n.url)]);
  }
  if(n.type==='mdxjsEsm'){
   const ast=parse(n.value,{sourceType:'module',plugins:['jsx','typescript']});
   for(const statement of ast.program.body){
    if(statement.source?.type==='StringLiteral'){
     const value=statement.source.value, replacement=relocate(value);
     if(value!==replacement)edits.push([n.position.start.offset+statement.source.start+1,n.position.start.offset+statement.source.end-1,replacement]);
    }
   }
  }
  for(const attr of n.attributes||[]){
   if(['src','href'].includes(attr.name)&&typeof attr.value==='string'&&relocate(attr.value)!==attr.value){
    const start=attr.position.start.offset,raw=source.slice(start,attr.position.end.offset),offset=raw.indexOf(attr.value);
    edits.push([start+offset,start+offset+attr.value.length,relocate(attr.value)]);
   }
  }
  if(n.type==='text')edits.push([n.position.start.offset,n.position.end.offset,prose(source.slice(n.position.start.offset,n.position.end.offset))]);
  if(n.type==='yaml'){
   const original=source.slice(n.position.start.offset,n.position.end.offset);
   edits.push([n.position.start.offset,n.position.end.offset,original.replace(/^(title|description|sidebar_label):(.+)$/gm,(_,key,value)=>`${key}:${convert(value)}`)]);
  }
  if(n.type==='heading'){
   if(sourceFile&&n.depth===1){if(seenH1)edits.push([n.position.start.offset,n.position.start.offset+1,'##']);seenH1=true;}
   const title=visible(n),explicit=title.match(/\{#([^}]+)\}\s*$/);
   const id=explicit?explicit[1]:slugger.slug(title);
   if(preserveAnchors&&!explicit&&convert(title)!==title)edits.push([n.position.end.offset,n.position.end.offset,` {#${id}}`]);
  }
  for(const child of n.children||[])walk(child);
 }
 walk(tree);
 if(sourceFile){
  const yaml=tree.children.find(n=>n.type==='yaml');
  const titleNode=tree.children.find(n=>n.type==='heading'&&n.depth===1);
  const titleLine=yaml?.value.match(/^title:\s*(.+)$/m)?.[1];
  const title=convert((titleLine|| (titleNode?visible(titleNode):path.basename(sourceFile).replace(/\.mdx?$/,''))).replace(/^['"]|['"]$/g,''));
  const isSupplement=path.relative(path.join(root,'docs'),sourceFile)==='tutorial-basics/yale mscs 1 year.md';
  const pageTitle=isSupplement?'Yale MSCS 一年制：補充介紹與申請、就業案例':title;
  const additions=[];
  if(isSupplement&&!titleLine)additions.push('title: '+JSON.stringify(pageTitle));
  if(!yaml?.value.match(/^description:/m)){
   const paragraphs=[];
   const collect=n=>{if(n.type==='paragraph'){const text=visible(n).replace(/\s+/g,' ').trim();if(text)paragraphs.push(text);}else for(const c of n.children||[])collect(c);};
   collect(tree);
   const summary=convert(paragraphs.join(' ')).slice(0,180);
   additions.push('description: '+JSON.stringify(pageTitle+'：'+summary));
  }
  if(additions.length){
   if(yaml){const edit=edits.find(e=>e[0]===yaml.position.start.offset&&e[1]===yaml.position.end.offset);edit[2]=edit[2].replace(/---\s*$/,additions.join('\n')+'\n---');}
   else edits.push([0,0,'---\n'+additions.join('\n')+'\n---\n\n']);
  }
 }
 return edits.sort((a,b)=>b[0]-a[0]||b[1]-a[1]).reduce((s,[a,b,v])=>s.slice(0,a)+v+s.slice(b),source);
}
const dest=path.join(root,'i18n/zh-Hant');let docs=0;
for(const file of files(path.join(root,'docs'))){
 const rel=path.relative(path.join(root,'docs'),file),out=path.join(dest,'docusaurus-plugin-content-docs/current',rel);
 if(/\.mdx?$/.test(file)){write(out,markdown(fs.readFileSync(file,'utf8'), true, file));docs++;}
 else if(file.endsWith('.json')){const data=JSON.parse(fs.readFileSync(file));if(data.label)data.label=convert(data.label);if(data.link?.description)data.link.description=convert(data.link.description);write(out,JSON.stringify(data,null,2)+'\n');}
 else {fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(file,out);}
}
const messages={};
for(const file of files(path.join(root,'src')).filter(p=>/\.[jt]sx?$/.test(p))){
 let ast;try{ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'unambiguous',plugins:['jsx','typescript']});}catch{continue;}
 const visit=n=>{
  if(!n||typeof n!=='object')return;
  if(n.type==='ObjectExpression'){
   const vals=Object.fromEntries(n.properties.filter(p=>p.type==='ObjectProperty').map(p=>[p.key.name||p.key.value,p.value]));
   if(vals.id?.type==='StringLiteral'&&vals.message?.type==='StringLiteral')messages[vals.id.value]={message:convert(vals.message.value)};
  }
  if(n.type==='JSXElement'&&n.openingElement.name.name==='Translate'){
   const id=n.openingElement.attributes.find(a=>a.name?.name==='id')?.value?.value;
   if(id){const parts=n.children.map(c=>c.type==='JSXText'?c.value:c.type==='JSXExpressionContainer'&&c.expression.type==='StringLiteral'?c.expression.value:null);if(parts.every(x=>x!==null))messages[id]={message:convert(parts.join('').replace(/\s+/g,' ').trim())};}
  }
  for(const [key,value] of Object.entries(n))if(key!=='loc'&&key!=='tokens')Array.isArray(value)?value.forEach(visit):visit(value);
 };visit(ast);
}
const framework=JSON.parse(fs.readFileSync(path.join(root,'node_modules/@docusaurus/theme-translations/locales/zh-Hant/theme-common.json')));
const english=JSON.parse(fs.readFileSync(path.join(root,'i18n/en/code.json')));
const code={};for(const [id,item] of Object.entries(english)){code[id]=messages[id]|| (framework[id]?{message:typeof framework[id]==='string'?framework[id]:framework[id].message}:item);}
for(const [id,item] of Object.entries(messages))code[id]=item;
for(const [id,value] of Object.entries(framework))if(id in code)code[id]={message:typeof value==='string'?value:value.message};
for(const item of Object.values(code))item.message=convert(item.message);
code['tracker.alert.importFailed']={message:'匯入失敗：JSON 格式無效'};
write(path.join(dest,'code.json'),JSON.stringify(code,null,2)+'\n');
for(const file of files(path.join(root,'i18n/en')).filter(p=>p.endsWith('.json')&&!p.includes('/current/'))){
 const rel=path.relative(path.join(root,'i18n/en'),file);if(rel==='code.json')continue;
 const data=JSON.parse(fs.readFileSync(file));
 for(const [id,item] of Object.entries(data)){
  const label=id.match(/(?:label|title|category|doc)\.(.+)$/)?.[1];
  if(label)item.message=convert(label);
  else if(id==='version.label')item.message='目前版本';
  else if(rel.includes('content-blog'))item.message=id==='sidebar.title'?'近期文章':'部落格';
 }
 write(path.join(dest,rel),JSON.stringify(data,null,2)+'\n');
}
const badge=(active)=>fs.readFileSync(path.join(root,`static/img/readme/language-zh-${active?'active':'inactive'}.svg`),'utf8').replaceAll('简体中文','繁體中文');
for(const active of [true,false])write(path.join(root,`static/img/readme/language-hant-${active?'active':'inactive'}.svg`),badge(active));
for(const name of ['README.md','README.en.md']){
 const p=path.join(root,name);let text=fs.readFileSync(p,'utf8');
 if(!text.includes('href="README.zh-Hant.md"'))text=text.replace(/(  <a href="README.en.md"[^\n]+\n)/,'$1  <a href="README.zh-Hant.md"><img src="static/img/readme/language-hant-inactive.svg" alt="繁體中文" width="144" height="44" /></a>\n');
 write(p,text);
}
// README has HTML display text; preserve all tag attributes and destinations.
let readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
readme=readme.replace(/^.*<a href="https:\/\/discord\.gg\/[^\n]+\n/gm, '')
 .replace(/^## 加入 Discord\n[\s\S]*?(?=^<a id="qq-group")/m, '');
readme=markdown(readme, false).replace(/>([^<>]+)</g,(_,text)=>'>'+prose(text)+'<');
readme=readme.replaceAll('language-zh-active.svg','language-zh-inactive.svg').replaceAll('language-hant-inactive.svg','language-hant-active.svg');
readme=readme.replace('[CS Grad 中文首頁](https://csgrad.com/)', '[CS Grad 繁體中文首頁](https://csgrad.com/zh-Hant/)');
write(path.join(root,'README.zh-Hant.md'),readme);
console.log(`Generated ${docs} Traditional Chinese Markdown/MDX documents and ${Object.keys(code).length} UI messages.`);
