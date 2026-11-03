import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('About describes the static edition, without dormant service claims',()=>{
 const text=read('components/AppLayout.tsx');
 for(const misleading of ['PostgreSQL','AI Photo Rendering','Hosting & Infrastructure']) assert.ok(!text.includes(misleading),misleading);
 assert.match(text,/browser/i);
 assert.match(text,/no accounts or AI/i);
});
test('Rings and Waves are labelled experimental non-rigid with an explicit warning',()=>{
 const text=read('components/StudioPackagingSidebar.tsx');
 for(const name of ['Concentric Rings','Sine Waves']) assert.ok(text.includes(name+' — experimental, non-rigid'));
 assert.match(text,/shapeType === 'concentricRings' \|\| shapeType === 'sineWaves'/);
 assert.match(text,/faces deform during folding/i);
 assert.match(text,/not validated for fabrication/i);
});
