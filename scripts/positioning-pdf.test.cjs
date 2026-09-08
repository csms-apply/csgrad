const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {transformSync} = require('@babel/core');
const source = fs.readFileSync(require('node:path').join(__dirname,'../src/pages/school-positioning-result.jsx'),'utf8');
const {code}=transformSync(source,{babelrc:false,configFile:false,presets:[require.resolve('@babel/preset-react')],plugins:[require.resolve('@babel/plugin-transform-modules-commonjs')]});
const api={};
vm.runInNewContext(code,{exports:api,require(name){if(name==='react')return React;if(name.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>k})};if(name.startsWith('@'))return {};throw Error(name);}});

test('program links localize internal routes and preserve external/already encoded links',()=>{
 for(const [input,en,zh] of [
  ['/A/uiuc mcs','/en/A/uiuc%20mcs','/A/uiuc%20mcs'],
  ['/A/uiuc%20mcs','/en/A/uiuc%20mcs','/A/uiuc%20mcs'],
  ['/en/A/uiuc%20mcs','/en/A/uiuc%20mcs','/en/A/uiuc%20mcs'],
  ['https://example.com/program?x=1&y=2','https://example.com/program?x=1&y=2','https://example.com/program?x=1&y=2'],
  ['//example.com/program','//example.com/program','//example.com/program'],
 ]){assert.equal(api.programDetailHref(input,'en'),en);assert.equal(api.programDetailHref(input,'zh-Hans'),zh);}
 const html=renderToStaticMarkup(React.createElement(api.ReviewedAlternatives,{locale:'en',items:[{bucket:'match',school:'Program',doc:'/A/uiuc%20mcs'}]}));
 assert.match(html,/href="\/en\/A\/uiuc%20mcs"/);
});

test('PDF uses an isolated A4 clone and removes it after success or save failure',async()=>{
 for(const fail of [false,true]) {
  let appended,removed=false,options,usedSource,fontReady=false,saveCalls=0,overlayRemoved=false;
  const classes=[];const clone={classList:{add:value=>classes.push(value)},querySelectorAll:()=>[]};
  const report={cloneNode:deep=>{assert.equal(deep,true);return clone;}};
  const host={style:{},setAttribute(name,value){assert.equal(name,'aria-hidden');assert.equal(value,'true');},appendChild(node){assert.equal(node,clone);},remove(){removed=true;}};
  const doc={createElement:tag=>{assert.equal(tag,'div');return host;},body:{appendChild:node=>{appended=node;}},fonts:{ready:Promise.resolve().then(()=>{fontReady=true;})}};
  const html2pdf=()=>({prop:{overlay:{remove(){overlayRemoved=true;}}},set(value){options=value;return this;},from(node){usedSource=node;return this;},async save(){saveCalls++;assert.equal(fontReady,true);if(fail)throw Error('simulated save failure');}});
  const result=api.exportReportPdf(report,html2pdf,'report.pdf',doc);
  if(fail)await assert.rejects(result,/simulated save failure/);else await result;
  assert.equal(appended,host);assert.equal(removed,true);assert.equal(overlayRemoved,true);assert.equal(usedSource,clone);assert.notEqual(usedSource,report);
  assert.deepEqual(classes,['pdfReport']);assert.equal(options.jsPDF.format,'a4');assert.equal(options.html2canvas.windowWidth,undefined);assert.equal(saveCalls,1);
 }
});

test('export failure is wired to a localized visible alert and PDF-only layout rules',()=>{
 assert.match(source,/catch\s*\{\s*setPdfError\(true\)/);
 assert.match(source,/pdfError && <p role="alert"/);
 assert.match(source,/PDF generation failed/);
 const css=fs.readFileSync(require('node:path').join(__dirname,'../src/pages/school-positioning-result.module.css'),'utf8');
 assert.match(css,/\.pdfReport \.bucketsGrid,[\s\S]*?display: block !important/);
 assert.match(css,/\.pdfReport \.schoolCard,[\s\S]*?break-inside: avoid/);
});

test('PDF heading groups retain the first card/list item and every remaining node in order',()=>{
 class Element {
  constructor(tag,name='',children=[]){this.tagName=tag.toUpperCase();this.className=name;this.children=[];this.parentNode=null;this.classList={contains:n=>this.className.split(' ').includes(n)};children.forEach(c=>this.appendChild(c));}
  get firstElementChild(){return this.children[0]||null;}
  get nextElementSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}
  matches(){return ['UL','OL'].includes(this.tagName);}
  appendChild(child){if(child.parentNode)child.parentNode.children.splice(child.parentNode.children.indexOf(child),1);this.children.push(child);child.parentNode=this;}
  insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);child.parentNode=this;}
 }
 const heading=new Element('div','bucketHeader'),card1=new Element('div','schoolCard'),card2=new Element('div','schoolCard');
 const list=new Element('div','schoolList',[card1,card2]),bucket=new Element('div','bucket',[heading,list]);
 const title=new Element('h2'),item1=new Element('li'),item2=new Element('li'),ul=new Element('ul','',[item1,item2]);
 const checklist=new Element('section','adviceCard',[title,ul]);
 api.preparePdfLayout({querySelectorAll:()=>[bucket,checklist]},{createElement:tag=>new Element(tag)});
 assert.equal(bucket.firstElementChild.className,'pdfKeepTogether');
 assert.deepEqual(bucket.firstElementChild.children,[heading,card1]);assert.deepEqual(list.children,[card2]);
 assert.equal(checklist.firstElementChild.className,'pdfKeepTogether');assert.equal(checklist.firstElementChild.children[0],title);
 assert.equal(checklist.firstElementChild.children[1].tagName,'UL');assert.deepEqual(checklist.firstElementChild.children[1].children,[item1]);assert.deepEqual(ul.children,[item2]);
});
