import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('verification/projects');
await mkdir(root,{recursive:true});
const output = await mkdtemp(path.join(root,'fold-project-test-'));
const url = process.env.UI_URL || 'http://127.0.0.1:4209/tools/FoldStudio/studio';
const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page = await browser.newPage(); await page.setViewport({width:1440,height:1000});
const errors=[]; const external=[];
page.on('request',r=>{if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(url).origin) external.push(r.url());});
page.on('pageerror',e=>errors.push(e.message));
const cdp=await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:output});
const wait = ms=>new Promise(r=>setTimeout(r,ms));
async function ready() {await page.waitForSelector('#save-project:not([disabled])'); await wait(250);}
async function save(tag) {
  const downloadDir=await mkdtemp(path.join(output,`${tag}-`));
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloadDir});
  const before=new Set(await readdir(downloadDir));
  await page.click('#save-project');
  let file;
  for(let i=0;i<150;i++) {
    file=(await readdir(downloadDir)).find(n=>n.endsWith('.foldstudio.json')&&!before.has(n));
    if(file) break;
    const error=await page.$eval('#project-status',e=>e.getAttribute('role')==='alert'?e.textContent:null);
    if(error) throw new Error(error);
    await wait(100);
  }
  assert.ok(file,`download missing ${tag}`); await ready();
  return JSON.parse(await readFile(path.join(downloadDir,file),'utf8'));
}
async function open(project,tag,success=true) {
  const filename=path.join(output,`${tag}.input.json`); await writeFile(filename,JSON.stringify(project));
  const chooserPromise=page.waitForFileChooser(); await page.click('#open-project');
  await (await chooserPromise).accept([filename]);
  await page.waitForFunction(ok=> {const e=document.querySelector('#project-status');return ok ? e?.textContent?.includes('Project opened locally') : e?.getAttribute('role')==='alert';},{timeout:20000},success);
  await ready();
}
try {
  await page.goto(url,{waitUntil:'networkidle0'}); await ready();
  // Real artwork upload creates the blob source that the save action must embed.
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=12;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,10,12);x.fillStyle='#0000ff';x.fillRect(10,0,10,12);return c.toDataURL();});
  const imagePath=path.join(output,'red-blue.png');await writeFile(imagePath,Buffer.from(png.split(',')[1],'base64'));
  const upload=await page.$('input[type=file][accept="image/*"]');assert.ok(upload);await upload.uploadFile(imagePath);
  await page.waitForFunction(()=>document.querySelector('svg image'));
  const initial=await save('initial');assert.equal(initial.state.artwork.layers.length,1);assert.match(initial.state.artwork.layers[0].url,/^data:image\/png;base64,/);
  for(const mode of ['packaging','origami','popup','spirogami']) {
    if(mode!=='packaging') {await page.goto(`${url}?mode=${mode}`,{waitUntil:'networkidle0'});await ready();}
    const source=mode==='packaging'?initial:await save(`${mode}-source`);
    source.state.name=`Saved ${mode}`;source.state.progress=37;source.state.sequential=true;source.state.showGrid=false;
    source.state.artwork=structuredClone(initial.state.artwork);
    source.state.artwork.exteriorColor='#aabbcc';source.state.artwork.interiorColor='#445566';source.state.artwork.materialType='custom';
    source.state.artwork.layers[0].rotation=27; source.state.artwork.layers[0].x+=7;
    source.state.popupDocument.paperColor='#aabbcc';source.state.spirogamiParams.paperColor='#aabbcc';
    if(mode==='packaging') {source.state.params.width=127;source.state.importedMode=true;source.state.baseFoldData.verticesCoords[0][0]+=2;source.state.displayFoldData.verticesCoords[0][0]+=2;}
    if(mode==='origami') {source.state.origamiFoldType='V';source.state.origamiFoldAngle=123;source.state.origamiPaperWidth=187;source.state.baseFoldData.verticesCoords[0][0]+=3;source.state.displayFoldData.verticesCoords[0][0]+=3;}
    if(mode==='popup') source.state.popupDocument.bookWidth=167;
    if(mode==='spirogami') source.state.spirogamiParams.stripHeight=53;
    await open(source,`${mode}-authored`);
    const authored=await save(`${mode}-authored`);
    assert.deepEqual(authored,source,`${mode}: opening applies all authored fields without regeneration`);
    // Reload destroys every old blob URL and all React state.
    await page.reload({waitUntil:'networkidle0'});await ready();
    if(mode!=='packaging') {await page.goto(`${url}?mode=packaging`,{waitUntil:'networkidle0'});await ready();}
    await page.evaluate(()=> {const e=[...document.querySelectorAll('input')].find(e=>e.value.startsWith('Untitled'));if(!e)throw Error('name input missing');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Changed before open');e.dispatchEvent(new Event('input',{bubbles:true}));});
    await open(authored,`${mode}-roundtrip`);
    const restored=await save(`${mode}-restored`);
    assert.deepEqual(restored,authored,`${mode}: complete settings, geometry and assets survived reload`);
    const pixels=await page.evaluate(async()=>{const el=document.querySelector('svg image');if(!el)throw Error('rendered artwork missing');const im=new Image();im.src=el.getAttribute('href')||el.getAttribute('xlink:href');await im.decode();const c=document.createElement('canvas');c.width=20;c.height=12;const x=c.getContext('2d');x.drawImage(im,0,0);return [Array.from(x.getImageData(2,2,1,1).data),Array.from(x.getImageData(17,2,1,1).data)];});
    assert.deepEqual(pixels,[[255,0,0,255],[0,0,255,255]]);
    const broken=structuredClone(restored);broken.state.baseFoldData.edgesVertices[0][0]=999999;
    await open(broken,`${mode}-malformed`,false);
    assert.deepEqual(await save(`${mode}-after-rejection`),restored,`${mode}: rejected file preserves current project`);
    if(mode==='packaging') {
      const corrupt=structuredClone(restored);
      corrupt.state.artwork.layers[0].url=corrupt.state.artwork.layers[0].url.slice(0,66);
      await open(corrupt,'corrupt-image',false);
      assert.deepEqual(await save('after-corrupt-image'),restored);
      await page.evaluate(() => {
        const input=document.querySelector('#project-file');const data=new DataTransfer();
        data.items.add(new File([' '.repeat(16*1024*1024+1)],'oversize.json',{type:'application/json'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));
      });
      await page.waitForFunction(()=>document.querySelector('#project-status')?.textContent?.includes('exceeds 16 MiB'));
      assert.deepEqual(await save('after-oversize'),restored);
      console.log('PASS corrupt embedded image and oversized file preserve the current model');
    }
    console.log(`PASS ${mode}: full reload roundtrip, artwork pixels, malformed rejection`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(`PASS no page errors or external requests; artifacts ${output}`);
} finally {await browser.close();}
