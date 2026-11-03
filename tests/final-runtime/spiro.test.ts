import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSpirogamiMeshData, generateSpirogamiFlatFoldData, getDefaultSpirogamiParams} from '../../helpers/spirogamiEngine';
const defaults = getDefaultSpirogamiParams();
const bounds = {discRadius:[50,200],innerRadius:[5,50],turns:[1,10],stripHeight:[5,100],stripWidth:[2,20],gapWidth:[0.5,10],paperThickness:[0.1,5],segmentsPerTurn:[8,128]};
for (const generator of [generateSpirogamiFlatFoldData, (p:typeof defaults)=>generateSpirogamiMeshData(p,0.5)]) {
 test(`generator ${generator.name || 'mesh'} bounds every numeric parameter without mutating input`,()=>{
  for (const [key,[min,max]] of Object.entries(bounds)) {
   for (const [value,expected] of [[min-1,min],[max+1,max],[NaN,defaults[key]],[Infinity,defaults[key]],[-Infinity,defaults[key]]]) {
    const input = {...defaults,[key]:value};
    assert.deepEqual(generator(input),generator({...defaults,[key]:expected}),`${key}=${value}`);
    assert.ok(Object.is(input[key],value));
   }
  }
 });
}
test('mesh progress is finite and bounded',()=>{
 for (const [input,expected] of [[NaN,0],[Infinity,0],[-1,0],[2,1]]) assert.deepEqual(generateSpirogamiMeshData(defaults,input),generateSpirogamiMeshData(defaults,expected));
});
