import assert from 'node:assert/strict';
import {build} from 'esbuild';
import puppeteer from 'puppeteer';
const bundle=await build({stdin:{contents:`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{StudioSpiroSidebar}from'./components/StudioSpiroSidebar';import{getDefaultSpirogamiParams}from'./helpers/spirogamiEngine';function App(){const[p,set]=useState(getDefaultSpirogamiParams());return <StudioSpiroSidebar params={p} onParamsChange={set} studioMode="spirogami" name="Test"/>;}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',loader:{'.css':'empty','.module.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
const browser=await puppeteer.launch({headless:true});
try {
 const page=await browser.newPage(); await page.setContent('<div id="root"></div>'); await page.addScriptTag({content:bundle.outputFiles[0].text}); await page.waitForSelector('input[type=number]');
 const bounds=[[50,200],[5,50],[1,10],[5,100],[2,20],[0.5,10],[0.1,5]];
 for(let i=0;i<bounds.length;i++) {
  const [min,max]=bounds[i];
  const attrs=await page.$$eval('input[type=number]',(els,i)=>({min:els[i].min,max:els[i].max}),i);
  assert.deepEqual(attrs,{min:String(min),max:String(max)});
  for(const [value,expected] of [[1000000,max],[-100,min]]) {
   await page.$$eval('input[type=number]',(els,{i,value})=>{const el=els[i];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));},{i,value});
   await page.waitForFunction(({i,expected})=>Number(document.querySelectorAll('input[type=number]')[i].value)===expected,{}, {i,expected});
  }
 }
 console.log('PASS seven Spirogami numeric controls: HTML bounds and real input clamp');
} finally {await browser.close();}
