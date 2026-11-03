import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
const out=new URL('./verification/interactions-'+Date.now()+'/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.evaluateOnNewDocument(()=>{window.violations=[];document.addEventListener('securitypolicyviolation',e=>window.violations.push(e.violatedDirective+':'+e.blockedURI));});
const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:decodeURIComponent(out.pathname)});
const base=process.env.PAGE_URL||'https://etienne.design/tools/FoldStudio/';
try{
await page.goto(base,{waitUntil:'networkidle0'});await page.waitForSelector('canvas');
const slider=await page.$('[role="slider"]');await slider.focus();await page.keyboard.press('End');
await page.click('button[title="Export Options"]');
for(const label of ['Export SVG Dieline','Export PDF Dieline','Export .fold format']){
if(label!=='Export SVG Dieline')await page.click('button[title="Export Options"]');
await page.evaluate(label=>{const e=[...document.querySelectorAll('[role="menuitem"],button')].find(e=>e.textContent.trim()===label);if(!e)throw Error(label);e.click()},label);
await new Promise(r=>setTimeout(r,1600));
}
const names=await fs.readdir(out);
for(const ext of ['.svg','.pdf','.fold']) {
 const name=names.find(n=>n.endsWith(ext));if(!name)throw Error('Missing export '+ext);
 const buffer=await fs.readFile(new URL(name,out));
 if(ext==='.pdf'&&!buffer.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Invalid PDF');
 if(ext==='.fold')JSON.parse(buffer.toString());
 if(ext==='.svg'&&!(await page.evaluate(s=>!new DOMParser().parseFromString(s,'image/svg+xml').querySelector('parsererror'),buffer.toString())))throw Error('Invalid SVG');
}
console.log('downloads',names,'directory',decodeURIComponent(out.pathname));
await page.screenshot({path:decodeURIComponent(out.pathname)+'studio.png'});
console.log('violations',await page.evaluate(()=>window.violations));
if(!process.env.PAGE_URL) {
await page.goto('https://etienne.design/tools/',{waitUntil:'networkidle0'});
const card=await page.$('a[href="/tools/FoldStudio/"]');if(!card)throw Error('Missing hub card');
console.log('hub',await card.evaluate(e=>({text:e.innerText,image:!!e.querySelector('img')})));
await card.click();await page.waitForSelector('canvas');console.log('hubDestination',page.url());
}
console.log('errors',errors);if(errors.length)process.exitCode=1;
}finally{await browser.close()}
