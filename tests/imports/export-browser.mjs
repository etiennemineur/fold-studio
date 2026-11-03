import assert from 'node:assert/strict';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bundle=await build({entryPoints:[root+'helpers/dielineExporter.tsx'],bundle:true,write:false,format:'iife',globalName:'Exporter',loader:{'.css':'empty'}});
const browser=await puppeteer.launch({headless:true});
const page=await browser.newPage();
try {
await page.addScriptTag({content:bundle.outputFiles[0].text});
const importer=await build({entryPoints:[root+'helpers/svgDielineImporter.tsx'],bundle:true,write:false,format:'iife',globalName:'SVGImporter'});
await page.addScriptTag({content:importer.outputFiles[0].text});
const result=await page.evaluate(async()=>{
 const data={verticesCoords:[[0,0,0],[100,0,0],[100,50,0],[0,50,0]],edgesVertices:[[0,1],[1,2],[2,3],[3,0]],edgesAssignment:['B','B','B','B'],edgesFoldAngle:[0,0,0,0],facesVertices:[[0,1,2,3]]};
 const params={width:100,depth:50,height:30,materialThickness:0.5,bleedSize:0};
 const name='A & B </title><script>window.injected=true</script><title>';
 const s=await Exporter.dielineExporter.exportDielineSVG(data,params,name);
 const doc=new DOMParser().parseFromString(s,'image/svg+xml');
 const roundtrip=SVGImporter.svgDielineImporter(s).foldData;
 const xs=roundtrip.verticesCoords.map(v=>v[0]);
 return {extent:Math.max(...xs)-Math.min(...xs),roundtrip:roundtrip.facesVertices.length,valid:!doc.querySelector('parsererror'),scripts:doc.querySelectorAll('script').length,title:doc.querySelector('title')?.textContent,name};
});
assert.ok(result.valid,'SVG names containing ampersands must remain valid XML');
assert.equal(result.scripts,0,'Project names must not inject SVG markup');
assert.equal(result.title,result.name+' - Dieline');
assert.equal(result.extent,100,'Printer registration marks must not enlarge the re-imported sheet');
assert.equal(result.roundtrip,1,'Printer registration marks must not become extra panels on re-import');
console.log('PASS SVG export name escaping and roundtrip');
const failure=await page.evaluate(async()=>{
 const data={verticesCoords:[[0,0,0],[100,0,0],[100,50,0],[0,50,0]],edgesVertices:[[0,1],[1,2],[2,3],[3,0]],edgesAssignment:['B','B','B','B'],edgesFoldAngle:[0,0,0,0],facesVertices:[[0,1,2,3]]};
 return Promise.race([Exporter.dielineExporter.exportDielinePDF(data,{bleedSize:0},'Test',[{visible:true,url:'blob:missing-artwork',width:10,height:10,x:0,y:0,rotation:0}]).then(()=> 'resolved',()=> 'rejected'),new Promise(r=>setTimeout(()=>r('hung'),2000))]);
});
assert.equal(failure,'rejected','PDF export must reject missing artwork instead of hanging forever');
console.log('PASS PDF artwork failure propagation');
} finally {await browser.close();}
