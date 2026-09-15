import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const browser=await puppeteer.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
const errors=[],requests=[]; page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});page.on('request',r=>requests.push(r.url()));
const base=process.env.PAGE_URL||'http://127.0.0.1:4187/tools/FoldStudio/';
const results=[];
try{
for(const route of ['studio','studio?mode=origami','studio?mode=popup','studio?mode=spirogami','unfolder']){
await page.goto(base+route,{waitUntil:'networkidle0',timeout:60000});
if(route !== 'unfolder') await page.waitForSelector('canvas',{timeout:10000});
const state=await page.evaluate(()=>({title:document.title,text:document.body.innerText.slice(0,3500),canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height})),buttons:[...document.querySelectorAll('button')].map(b=>({text:b.innerText,title:b.title}))}));
results.push({route,...state});
}
console.log(JSON.stringify({results,errors,external:[...new Set(requests.filter(u=>!u.startsWith(base)&&!u.startsWith('blob:')&&!u.startsWith('data:')))]},null,2));
if(errors.length)process.exitCode=1;
}finally{await browser.close();}
