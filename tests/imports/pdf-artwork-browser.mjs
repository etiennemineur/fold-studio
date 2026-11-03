import assert from 'node:assert/strict';
import {build} from 'esbuild';
import puppeteer from 'puppeteer';
const browser=await puppeteer.launch({headless:true});
try{
const page=await browser.newPage();
for(const [file,name] of [['helpers/pdfArtwork.ts','Artwork'],['helpers/dielineExporter.tsx','Exporter'],['helpers/popupExporter.tsx','Popup'],['helpers/popupDocument.tsx','PopupDoc']]){
 const bundle=await build({entryPoints:[file],bundle:true,write:false,format:'iife',globalName:name,loader:{'.css':'empty'}});await page.addScriptTag({content:bundle.outputFiles[0].text});
}
const r=await page.evaluate(async()=>{
 const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;let g=canvas.getContext('2d');g.fillStyle='red';g.fillRect(0,0,100,100);g.fillStyle='blue';g.fillRect(100,0,100,100);
 const layer={url:canvas.toDataURL(),visible:true,x:20,y:30,width:20,height:10,rotation:90};
 const transformed=await Artwork.preparePdfArtwork(layer,layer.url);
 const image=await new Promise(res=>{const img=new Image();img.onload=()=>res(img);img.src=transformed.source;});
 canvas.width=image.width;canvas.height=image.height;g=canvas.getContext('2d');g.drawImage(image,0,0);
 const top=[...g.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/4),1,1).data];
 const bottom=[...g.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height*3/4),1,1).data];
 const data={verticesCoords:[[0,0,0],[100,0,0],[100,50,0],[0,50,0]],edgesVertices:[[0,1],[1,2],[2,3],[3,0]],edgesAssignment:['B','B','B','B'],edgesFoldAngle:[0,0,0,0],facesVertices:[[0,1,2,3]]};
 const pdf=await Exporter.dielineExporter.exportDielinePDF(data,{width:100,depth:50,height:30,bleedSize:0},'Rotation',[layer]);
 const popup=Popup.exportPopupSVG(PopupDoc.createDefaultPopupDocument(),'A&B <test>');
 return {width:transformed.width,height:transformed.height,x:transformed.x,y:transformed.y,top,bottom,pdf:await pdf.slice(0,5).text(),popupValid:!new DOMParser().parseFromString(popup,'image/svg+xml').querySelector('parsererror')};
});
assert.ok(Math.abs(r.width-10)<1e-8&&Math.abs(r.height-20)<1e-8);assert.equal(r.x,25);assert.equal(r.y,25);
assert.deepEqual(r.top,[255,0,0,255]);assert.deepEqual(r.bottom,[0,0,255,255]);assert.equal(r.pdf,'%PDF-');
assert.ok(r.popupValid,'Popup SVG title must escape XML');console.log('PASS PDF rotated artwork geometry, actual pixels, real PDF generation; popup SVG title');
}finally{await browser.close();}
