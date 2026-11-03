import assert from 'node:assert/strict';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bundle=await build({entryPoints:[root+'helpers/svgDielineImporter.tsx'],bundle:true,write:false,format:'iife',globalName:'SVGImporter'});
const browser=await puppeteer.launch({headless:true});
const page=await browser.newPage();
try {
await page.addScriptTag({content:bundle.outputFiles[0].text});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 1000 500"><rect x="0" y="0" width="1000" height="500" fill="none" stroke="black"/></svg>';
const result=await page.evaluate(s=>SVGImporter.svgDielineImporter(s),svg);
const xs=result.foldData.verticesCoords.map(v=>v[0]);
assert.ok(Math.abs(Math.max(...xs)-Math.min(...xs)-100)<1e-8,'Physical SVG width must remain 100 mm, not 1000 viewBox units');
console.log('PASS SVG physical dimensions');
const splitSVG='<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50"><rect width="100" height="50" fill="none" stroke="black"/><line x1="50" y1="0" x2="50" y2="50" stroke="green"/></svg>';
const split=await page.evaluate(s=>SVGImporter.svgDielineImporter(s).foldData,splitSVG);
assert.equal(split.facesVertices.length,2,'A crease touching the middle of two contour edges must split the sheet into two faces');
console.log('PASS SVG T-junction subdivision');
const dashed=await page.evaluate(s=>SVGImporter.svgDielineImporter(s.replace('stroke="green"','stroke="black" stroke-dasharray="2 1"')).foldData,splitSVG);
assert.equal(dashed.edgesAssignment.filter(a=>a==='M'||a==='V').length,1,'Black dashed lines are creases, not cuts');
console.log('PASS SVG dashed crease');
const islands=splitSVG.replace('</svg>','<g transform="translate(150 0)"><rect width="100" height="50" fill="none" stroke="black"/><line x1="50" y1="0" x2="50" y2="50" stroke="green"/></g></svg>');
const islandsResult=await page.evaluate(s=>SVGImporter.svgDielineImporter(s).foldData,islands);
assert.equal(islandsResult.facesVertices.length,4,'Each disconnected sheet must discard its own unbounded face');
console.log('PASS SVG disconnected sheets');
const invalid=await page.evaluate(()=>{try{SVGImporter.svgDielineImporter('<svg><path></svg>');return false;}catch{return true;}});
assert.equal(invalid,true,'Malformed SVG must be rejected instead of replacing the current document');
console.log('PASS SVG malformed document rejection');
for(const d of ['M 0 0 L 10','M 0 0 L 1e999 0 L 0 10 Z']) {
 const rejected=await page.evaluate(d=>{try { SVGImporter.svgDielineImporter(`<svg xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="black" d="${d}"/></svg>`);return false;}catch{return true;}},d);
 assert.ok(rejected,'Invalid path coordinates must be rejected: '+d);
}
console.log('PASS SVG invalid path coordinates');
const empty=await page.evaluate(()=>{try{SVGImporter.svgDielineImporter('<svg xmlns="http://www.w3.org/2000/svg"><text>Not a cutting plan</text></svg>');return false;}catch{return true;}});
assert.ok(empty,'A document without closed panels must not replace the current model');
console.log('PASS SVG empty cutting plan rejection');
} finally {await browser.close();}
