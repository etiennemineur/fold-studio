import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
import puppeteer from 'puppeteer';
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import Page from './pages/unfolder';createRoot(document.getElementById('root')).render(<MemoryRouter><Page/></MemoryRouter>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',loader:{'.css':'empty','.module.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'observe-real-unfolder',setup(b){b.onLoad({filter:/\/meshUnfolder\.tsx$/},args=>({contents:fs.readFileSync(args.path,'utf8').replace('export function meshUnfolder(mesh: ParsedMesh, options?: Partial<UnfoldOptions>): UnfoldResult {','export function meshUnfolder(mesh: ParsedMesh, options?: Partial<UnfoldOptions>): UnfoldResult { window.unfoldCalls = (window.unfoldCalls || 0) + 1;'),loader:'tsx'}));}}]});
const browser=await puppeteer.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
try {
 const page=await browser.newPage(); page.on('pageerror',error=>console.error(error.message)); await page.setRequestInterception(true); page.on('request',r=>r.respond({status:200,contentType:'text/html',body:'<div id="root"></div>'})); await page.goto('http://fold-runtime.test'); await page.addScriptTag({content:bundle.outputFiles[0].text}); await page.waitForSelector('input[type=file]');
 await page.$eval('input[type=file]',el=>{const dt=new DataTransfer();dt.items.add(new File(['v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 3 2\nf 1 2 4\nf 2 3 4\nf 3 1 4'],'tetra.obj',{type:'text/plain'}));el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.waitForFunction(()=>window.unfoldCalls===1);
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Force Re-unfold')&&!b.disabled));
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Force Re-unfold')).click());
 await new Promise(r=>setTimeout(r,400));
 assert.equal(await page.evaluate(()=>window.unfoldCalls),2,'Force Re-unfold must call the real solver again with unchanged parameters');
 console.log('PASS real Unfolder page: OBJ imported, Force Re-unfold executes solver twice');
} finally {await browser.close();}
