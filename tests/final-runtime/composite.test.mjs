import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../components/StudioFoldedGeometry.tsx', import.meta.url), 'utf8');
const section = source.slice(source.indexOf('  const compositeTexture ='), source.indexOf('  const glueTabs ='));
function render(width, height) {
  const cleanups = [];
  let disposed = 0;
  const canvas = {getContext: () => new Proxy({}, {get: () => () => {}})};
  const scope = {artworkLayers: [{visible:true,url:'test',x:0,y:0,width:1,height:1,rotation:0}], foldData:{verticesCoords:[[0,0],[width,height]]}, imageMapRef:{current:new Map([['test', {}]])}, exteriorColor:'#fff',textureVersion:1,document:{createElement:()=>canvas}, THREE:{CanvasTexture:class { constructor(c){this.image=c;} dispose(){disposed++;}}, SRGBColorSpace:'srgb'},useMemo:fn=>fn(),useEffect:fn=>{cleanups.push(fn());}};
  vm.runInNewContext(section, scope);
  return {canvas,cleanups,disposed:()=>disposed};
}
test('composite canvas is truly capped, including large and thin patterns', () => {
 for (const [w,h] of [[10000,10000],[10000,0.001],[20,10]]) {
  const {canvas}=render(w,h);
  assert.ok(canvas.width>=1 && canvas.width<=2048, `width ${canvas.width}`);
  assert.ok(canvas.height>=1 && canvas.height<=2048, `height ${canvas.height}`);
 }
});
test('composite lifetime registers disposal on replacement/unmount',()=>{
 const a=render(10,10);
 assert.equal(a.cleanups.length,1);
 assert.equal(a.disposed(),0);
 a.cleanups[0]();
 assert.equal(a.disposed(),1);
});
