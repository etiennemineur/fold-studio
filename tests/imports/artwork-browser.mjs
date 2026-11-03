import assert from 'node:assert/strict';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
const bundle=await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {useArtworkLayers} from './helpers/useArtworkLayers';function Harness(){window.artwork=useArtworkLayers();return null;}window.root=createRoot(document.getElementById('root'));window.root.render(React.createElement(Harness));`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const browser=await puppeteer.launch({headless:true});
try {
const page=await browser.newPage();await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});await page.waitForFunction(()=>window.artwork);
await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=8;const blob=await new Promise(r=>c.toBlob(r));window.file=new File([blob],'art.png',{type:'image/png'});window.artwork.addLayer(window.file,{x:0,y:0,width:100,height:100});});
await page.waitForFunction(()=>window.artwork.layers.length===1);
await page.evaluate(()=>{window.original=window.artwork.layers[0].id;window.artwork.duplicateLayer(window.original);});await page.waitForFunction(()=>window.artwork.layers.length===2);
await page.evaluate(()=>window.artwork.removeLayer(window.original));await page.waitForFunction(()=>window.artwork.layers.length===1);
assert.ok(await page.evaluate(async()=>{try{return (await fetch(window.artwork.layers[0].url)).ok}catch{return false}}),'Removing original must not revoke duplicate image');
await page.evaluate(()=>{window.artwork.clearLayers();window.artwork.addLayer(window.file,{x:0,y:0,width:100,height:100});window.artwork.clearLayers();});
await new Promise(r=>setTimeout(r,300));
assert.equal(await page.evaluate(()=>window.artwork.layers.length),0,'Pending image must not return after reset');
console.log('PASS real React artwork duplication lifetime and pending-reset cancellation');
}finally{await browser.close();}
