import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();
 await page.goto(process.env.UI_URL || 'http://127.0.0.1:5187/studio',{waitUntil:'networkidle0'});
 const before=await page.$eval('input',el=>el.value);
 const geometry=await page.$$eval('svg line',els=>els.map(el=>el.outerHTML));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.evaluate(()=>{
  const input=[...document.querySelectorAll('input[type=file]')].find(el=>el.accept.includes('svg'));
  const dt=new DataTransfer();dt.items.add(new File(['<svg><path d="broken"/></svg>'],'invalid.svg',{type:'image/svg+xml'}));
  input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.body.innerText.includes('Unable to import SVG'),{timeout:3000});
 assert.equal(await page.$eval('input',el=>el.value),before,'invalid import keeps existing design name');
 assert.ok(await page.$('[data-sonner-toast]'),'visible accessible toast');
 assert.deepEqual(await page.$$eval('svg line',els=>els.map(el=>el.outerHTML)),geometry,'pattern unchanged');
 await page.evaluate(()=>{
   const input=document.querySelector('input[accept=".svg"]');
   const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(10*1024*1024+1)],'large.svg'));
   input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.body.innerText.includes('maximum file size is 10 MB'));
 await page.evaluate(()=>{
   FileReader.prototype.readAsText=function(){this.dispatchEvent(new ProgressEvent('error'));};
   const input=document.querySelector('input[accept=".svg"]');
   const dt=new DataTransfer();dt.items.add(new File(['<svg/>'],'unreadable.svg'));
   input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.waitForFunction(()=>document.body.innerText.includes('file could not be read'));
 assert.deepEqual(await page.$$eval('svg line',els=>els.map(el=>el.outerHTML)),geometry,'all failures preserve pattern');
 assert.deepEqual(errors,[],'no uncaught application errors');
 console.log('PASS invalid SVG, size limit and simulated read failure: visible errors, original geometry intact');
} finally {await browser.close();}
