import assert from 'node:assert/strict';
import test from 'node:test';
import {buildFaceTree, computeFoldedVertices, generateShapeFoldData, DEFAULT_BOX_PARAMS} from '../../helpers/foldEngine';

test('a box without glue tabs has no zero-area ghost panels', () => {
  for (const thickness of [0,0.5,1.5,3]) {
    const data=generateShapeFoldData('box',{...DEFAULT_BOX_PARAMS, glueTabSize:0, materialThickness:thickness});
    for(const face of data.facesVertices) {
      const area=face.reduce((s,a,i)=>{const p=data.verticesCoords[a],q=data.verticesCoords[face[(i+1)%face.length]];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
      assert.ok(Math.abs(area)>1e-8, `zero-area face ${face}, thickness ${thickness}`);
    }
    assert.equal(data.facesVertices.length, thickness<0.5 ? 9 : 17);
  }
});

test('double-scored box walls still close at 90 degrees', () => {
  for(const thickness of [0.5,1.5,3]) {
    const data=generateShapeFoldData('box',{...DEFAULT_BOX_PARAMS,materialThickness:thickness});
    const folded=computeFoldedVertices(data,buildFaceTree(data),1);
    for(const face of data.facesVertices.slice(1,5)) {
      const points=face.map(i=>folded.get(i)!);
      assert.ok(Math.abs(Math.max(...points.map(p=>p[2]))-Math.min(...points.map(p=>p[2]))-DEFAULT_BOX_PARAMS.height)<1e-7, `wall height lost at thickness ${thickness}`);
    }
  }
});

test('flat connections do not consume sequential animation time', () => {
  const data = {
    verticesCoords: [[0,0],[1,0],[1,1],[0,1],[2,0],[2,1],[3,0],[3,1]] as [number,number][],
    facesVertices: [[0,1,2,3],[1,4,5,2],[4,6,7,5]],
    edgesVertices: [[1,2],[4,5]] as [number,number][],
    edgesAssignment: ['F','M'] as ('F'|'M')[], edgesFoldAngle:[0,-90]
  };
  const folded = computeFoldedVertices(data,buildFaceTree(data),0.5,true);
  assert.ok(Math.abs(folded.get(6)![2]-Math.SQRT1_2)<1e-8);
});

const distance = (a: number[], b: number[]) => Math.hypot(...a.map((x,i)=>x-b[i]));
test('changing the resting face preserves the folded assembly up to rigid motion', () => {
  const data = generateShapeFoldData('box', {...DEFAULT_BOX_PARAMS, materialThickness:0}, {skipDoubleScoring:true});
  const baseline = computeFoldedVertices(data, buildFaceTree(data, 0), 1);
  for (let root=1;root<data.facesVertices.length;root++) {
    const actual = computeFoldedVertices(data, buildFaceTree(data, root), 1);
    for (const [a,pa] of baseline) for (const [b,pb] of baseline) {
      assert.ok(Math.abs(distance(pa,pb)-distance(actual.get(a)!,actual.get(b)!))<1e-7, `root ${root}, pair ${a}/${b} changes assembly`);
    }
  }
});
