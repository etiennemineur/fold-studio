import assert from 'node:assert/strict';
import { objParser } from '../../helpers/objParser';
const points='v 0 0 0\nv 1 0 0\nv 0 1 0\n';
assert.deepEqual(objParser(points+'f -3 -2 -1').faces,[[0,1,2]]);
assert.deepEqual(objParser(points+'f 1 2 3 # triangle').faces,[[0,1,2]],'Inline comments are not vertex references');
for(const source of [points+'f 0 2 3',points+'f 1 2 99',points+'f 1x 2 3',points+'f 1 1 2','v NaN 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3','v 1e999 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3','v 0 0 0\nf 1 2 3',points+'f 1 2']) assert.throws(()=>objParser(source),undefined,'Invalid OBJ must be rejected: '+source);
assert.ok(objParser(points+'f 1 2 3').vertices.flat().every(Number.isFinite));
console.log('PASS OBJ relative indices, inline comments, invalid coordinates and references');
