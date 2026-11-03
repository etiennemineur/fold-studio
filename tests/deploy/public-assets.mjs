import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd(), base=process.env.PAGE_URL || 'https://etienne.design/tools/FoldStudio/';
const out=path.join(root,'verification/public-assets');await mkdir(out,{recursive:true});
const files=await readdir(path.join(root,'dist/_assets'));
const expected=Object.fromEntries(await Promise.all(files.map(async name=>[name,createHash('sha256').update(await readFile(path.join(root,'dist/_assets',name))).digest('hex')])));
const browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();await page.setCacheEnabled(false);await page.setViewport({width:1440,height:1000});
 const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'studio',{waitUntil:'networkidle0'});await page.waitForSelector('#save-project');
 assert.equal(requests.some(u=>/\/(pdfmake|vfs_fonts)-/.test(u)),false,'PDF must not load before export');
 await page.screenshot({path:path.join(out,'desktop.png')});
 const checks=await page.evaluate(async ({base,expected})=>{
  const rows=[];
  for(const [name,digest] of Object.entries(expected)) {
   const r=await fetch(base+'_assets/'+name,{cache:'no-store'});
   if(!r.ok)throw Error(name+' HTTP '+r.status);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
   if(hash!==digest)throw Error(name+' checksum differs');
   rows.push({name,sha256:hash,status:r.status});
  }return rows;
 },{base,expected});
 const localHTML=await readFile(path.join(root,'dist/index.html'),'utf8');
 const refs=[...localHTML.matchAll(/(?:src|href)="(\/tools\/FoldStudio\/_assets\/[^"]+)"/g)].map(m=>m[1]).sort();
 const served=await page.evaluate(()=>[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(e=>e.getAttribute('src')||e.getAttribute('href')).filter(x=>x?.startsWith('/tools/FoldStudio/_assets/')));
 for(const ref of refs)assert.ok(served.includes(ref),'missing entry reference '+ref);
 await page.setViewport({width:390,height:844});await new Promise(r=>setTimeout(r,400));
 await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const neighbors=[];
 for(const route of ['/','/tools/','/foldstudio']) {
  const response=await page.goto(new URL(route,base).href,{waitUntil:'networkidle0'});
  assert.equal(response.status(),200);neighbors.push({route,status:response.status(),finalURL:page.url()});
 }
 assert.deepEqual(errors,[]);
 const result={assetCount:checks.length,checks,entryRefsMatch:true,pdfDeferred:true,neighbors,errors};
 await writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,checks:undefined},null,2));
} finally {await browser.close();}
