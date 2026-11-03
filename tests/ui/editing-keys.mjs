import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({headless:true,args:['--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();await page.setViewport({width:1440,height:900});
 await page.goto(process.env.UI_URL || 'http://127.0.0.1:5187/studio',{waitUntil:'networkidle0'});
 const point=await page.$eval('line[stroke="#0055FF"]',el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 await page.mouse.click(point.x,point.y);
 await page.waitForSelector('line[stroke="#FF6600"]');
 const before=await page.$$eval('svg line',els=>els.length);
 for(const tag of ['input','textarea','div']) {
   await page.evaluate(tag=>{const el=document.createElement(tag);el.id='editing-probe';if(tag==='div')el.contentEditable='true';el.textContent='editable';document.body.append(el);el.focus();},tag);
   await page.keyboard.press('Backspace');
   assert.equal(await page.$$eval('svg line',els=>els.length),before,`${tag} editing must not delete geometry`);
   assert.ok(await page.$('line[stroke="#FF6600"]'),`${tag} keeps selected edge`);
   await page.$eval('#editing-probe',el=>el.remove());
 }
 console.log('PASS selected fold preserved during input, textarea and contenteditable Backspace');
} finally {await browser.close();}
