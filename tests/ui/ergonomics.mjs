import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
const base=process.env.UI_URL || 'http://127.0.0.1:5187';
const audit=process.argv.includes('--audit');
const results=[];
await mkdir('verification/ui',{recursive:true});
try {
for(const width of [1440,390]) {
 await page.setViewport({width,height:900});
 for(const mode of ['packaging','origami','popup','spirogami','unfolder']) {
  await page.goto(base+(mode==='unfolder'?'/unfolder':`/studio?mode=${mode}`),{waitUntil:'networkidle0'});
  await page.waitForSelector('main');
  const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,panels:[...document.querySelectorAll('[data-panel]')].map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})),nav:[...document.querySelectorAll('header a')].map(el=>({text:el.textContent,x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right}))}));
  results.push({width,mode,...metrics});
  if(audit) { if(mode==='packaging')await page.screenshot({path:`verification/ui/before-${width}.png`}); continue; }
  assert.equal(metrics.width,width);
  assert.ok(metrics.scroll<=width,`page overflow ${mode} ${width}`);
  assert.ok(metrics.panels.every(p=>p.width>= (width===390?380:200)),`usable panels ${mode} ${width}: ${JSON.stringify(metrics.panels)}`);
  assert.ok(metrics.nav.every(n=>n.x>=0 && n.right<=width),'all navigation links fit');
  if(mode==='unfolder') {
    const input=await page.$('input[type="file"]');
    await input.uploadFile('tests/ui/tetrahedron.obj');
  }
  await page.waitForSelector('[aria-label="Folding playback"]');
  const val=()=>page.$eval('[aria-label="Fold progress"]',el=>Number(el.value));
  await page.click('[data-action="fold"]'); assert.equal(await val(),100);
  await page.click('[data-action="play"]');
  await new Promise(r=>setTimeout(r,250));
  await page.click('[data-action="play"]'); const reversed=await val();
  await page.click('[data-action="play"]');
  await new Promise(r=>setTimeout(r,250));
  await page.click('[data-action="play"]'); assert.ok(await val()<reversed,'resume preserves reverse direction');
  await page.click('[data-action="unfold"]'); assert.equal(await val(),0);
  await page.select('[aria-label="Playback speed"]','2');
  await page.click('[data-action="play"]');
  await new Promise(r=>setTimeout(r,500)); assert.ok(await val()>0,`play advances applied progress ${mode} ${width}`);
  await page.click('[data-action="play"]'); const paused=await val();
  await new Promise(r=>setTimeout(r,200)); assert.equal(await val(),paused,'pause freezes progress');
  await page.click('[data-action="reset"]');assert.equal(await val(),0);
  if(width===1440) {
    const durations=[];
    for(const speed of ['0.5','2']) {
      await page.click('[data-action="reset"]');
      await page.select('[aria-label="Playback speed"]',speed);
      await page.click('[data-action="play"]');
      await new Promise(r=>setTimeout(r,600));
      await page.click('[data-action="play"]');durations.push(await val());
    }
    assert.ok(durations[1]>durations[0]*2,`speed changes actual progress ${mode}: ${durations}`);
    await page.click('[data-action="play"]');
    await page.focus('[aria-label="Fold progress"]');await page.keyboard.press('Home');
    await new Promise(r=>setTimeout(r,150));assert.equal(await val(),0,'scrub stops clock');
    if(mode!=='origami') {
      const canvas=await page.$('canvas');
      const flat=await canvas.screenshot();
      await page.click('[data-action="fold"]');
      await new Promise(r=>setTimeout(r,200));
      const folded=await canvas.screenshot();
      assert.notEqual(Buffer.compare(flat,folded),0,`rendered geometry changes ${mode}`);
    }
  }
  await page.click('[data-action="reset"]');
  await page.focus('[aria-label="Fold progress"]');await page.keyboard.press('ArrowRight');assert.ok(await val()>0,'keyboard scrub');
  if(mode==='packaging')await page.screenshot({path:`verification/ui/after-${width}.png`});
 }
}
console.log(JSON.stringify(results,null,2));
await writeFile(`verification/ui/${audit?'before':'after'}-metrics.json`,JSON.stringify(results,null,2));
console.log(audit?'AUDIT COMPLETE':'PASS: playback and layout across all five workshops at 1440 and 390; speed/scrub/render checks on desktop');
} finally {await browser.close();}
