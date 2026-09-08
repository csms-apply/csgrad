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
  let appended,removed=false,options,usedSource,fontReady=false,saveCalls=0;
  const classes=[];const clone={classList:{add:value=>classes.push(value)}};
  const report={cloneNode:deep=>{assert.equal(deep,true);return clone;}};
  const host={style:{},setAttribute(name,value){assert.equal(name,'aria-hidden');assert.equal(value,'true');},appendChild(node){assert.equal(node,clone);},remove(){removed=true;}};
  const doc={createElement:tag=>{assert.equal(tag,'div');return host;},body:{appendChild:node=>{appended=node;}},fonts:{ready:Promise.resolve().then(()=>{fontReady=true;})}};
  const html2pdf=()=>({set(value){options=value;return this;},from(node){usedSource=node;return this;},async save(){saveCalls++;assert.equal(fontReady,true);if(fail)throw Error('simulated save failure');}});
  const result=api.exportReportPdf(report,html2pdf,'report.pdf',doc);
  if(fail)await assert.rejects(result,/simulated save failure/);else await result;
  assert.equal(appended,host);assert.equal(removed,true);assert.equal(usedSource,clone);assert.notEqual(usedSource,report);
  assert.deepEqual(classes,['pdfReport']);assert.equal(options.jsPDF.format,'a4');assert.equal(options.html2canvas.windowWidth,794);assert.equal(saveCalls,1);
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
