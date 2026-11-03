// Optional comparison against the user's local reference, never required by CI.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
const reference=process.argv[2];
if(!reference) throw new Error('Pass the path to Simulateur Mailer.html');
const source=await readFile(reference,'utf8');
const section=name=>source.split(`/*${name}-START*/`)[1].split(`/*${name}-END*/`)[0];
const browser=await puppeteer.launch({headless:true});
try {
 const page=await browser.newPage();
 const bundle=await build({entryPoints:['helpers/svgDielineImporter.tsx'],bundle:true,write:false,format:'iife',globalName:'SVGImporter'});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const result=await page.evaluate(({sample,engine})=>{
  const ref=new Function(sample+engine+';return {sample:SAMPLE(),ENG};')();
  const reference=ref.ENG.buildFaces(ref.sample.cuts,ref.sample.folds);
  const actual=SVGImporter.svgDielineImporter(ref.sample.svg());
  return {reference:{faces:reference.faces.length,hinges:reference.foldLines.length},foldStudio:{faces:actual.foldData.facesVertices.length,hinges:actual.foldData.edgesAssignment.filter(a=>a==='M'||a==='V').length},warnings:actual.warnings,finite:actual.foldData.verticesCoords.flat().every(Number.isFinite)};
 },{sample:section('SAMPLE'),engine:section('ENGINE')});
 await mkdir('verification',{recursive:true});await writeFile('verification/reference-mailer.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
