import assert from 'node:assert/strict';
import test from 'node:test';
import {families, runAudit} from './audit';
import {buildFaceTree,computeFoldedVertices,generateShapeFoldData,DEFAULT_BOX_PARAMS} from '../../helpers/foldEngine';

const experimental = new Set(['concentricRings','sineWaves']);
const quiet = <T>(fn:()=>T):T => {const log=console.log;console.log=()=>{};try{return fn();}finally{console.log=log;}};

test('all 20 families: finite geometry, valid face/edge topology, rigid packaging at six animation samples', () => {
  const results=runAudit();
  assert.equal(results.length,160);
  assert.equal(new Set(results.map(r=>r.family)).size,20);
  for(const result of results) {
    const label=JSON.stringify(result);
    assert.ok(result.finite,label);
    assert.deepEqual(result.badFaces,[],label);
    assert.deepEqual(result.badEdges,[],label);
    assert.equal(result.nonmanifold,0,label);
    if(!experimental.has(result.family)) assert.ok(result.maxError<1e-7,label);
  }
});

test('known limitation: cyclic curved-crease meshes are NOT rigid-folding solutions', () => {
  for(const result of runAudit().filter(r=>experimental.has(r.family))) {
    // Explicit characterization, not a false claim that these shapes are rigid.
    assert.ok(result.maxError>1,`Re-evaluate documented limitation: ${JSON.stringify(result)}`);
  }
});

test('every packaging resting face preserves assembly distances, including thickness channels', () => quiet(() => {
  for(const family of families.filter(f=>!experimental.has(f))) for(const thickness of [0,0.5]) {
    const data=generateShapeFoldData(family,{...DEFAULT_BOX_PARAMS,materialThickness:thickness});
    const baseline=computeFoldedVertices(data,buildFaceTree(data),1);
    for(let root=0;root<data.facesVertices.length;root++) {
      const folded=computeFoldedVertices(data,buildFaceTree(data,root),1);
      for(const [a,p] of baseline) for(const [b,q] of baseline) {
        const x=folded.get(a)!,y=folded.get(b)!;
        const before=Math.hypot(...p.map((v,i)=>v-q[i]));
        const after=Math.hypot(...x.map((v,i)=>v-y[i]));
        assert.ok(Math.abs(before-after)<1e-7,`${family}, thickness ${thickness}, root ${root}, vertices ${a}/${b}`);
      }
    }
  }
}));

test('each tree hinge is a nonzero shared boundary; every face is visited once', () => quiet(() => {
  const key=(a:number,b:number)=>[a,b].sort((x,y)=>x-y).join('-');
  for(const family of families) for(const thickness of [0,0.5,1.5,3]) {
    const data=generateShapeFoldData(family,{...DEFAULT_BOX_PARAMS,materialThickness:thickness});
    assert.equal(data.edgesVertices.length,data.edgesAssignment.length);
    assert.equal(data.edgesVertices.length,data.edgesFoldAngle.length);
    const edgeKeys=new Set(data.edgesVertices.map(([a,b])=>key(a,b)));
    const boundaries=data.facesVertices.map(face=>new Set(face.map((a,i)=>key(a,face[(i+1)%face.length]))));
    for(const face of data.facesVertices) {
      assert.equal(new Set(face).size,face.length);
      for(const index of face) assert.ok(Number.isInteger(index)&&index>=0&&index<data.verticesCoords.length);
    }
    for(const boundary of boundaries) for(const edge of boundary) assert.ok(edgeKeys.has(edge));
    const seen=new Set<number>();
    const visit=(node:ReturnType<typeof buildFaceTree>[number])=>{
      assert.ok(!seen.has(node.faceIndex));seen.add(node.faceIndex);
      for(const child of node.children) {
        const [a,b]=child.hingeEdge!;
        assert.ok(boundaries[node.faceIndex].has(key(a,b))&&boundaries[child.faceIndex].has(key(a,b)));
        const p=data.verticesCoords[a],q=data.verticesCoords[b];
        assert.ok(Math.hypot(p[0]-q[0],p[1]-q[1])>1e-8);
        assert.ok(Number.isFinite(child.foldAngle));visit(child);
      }
    };
    buildFaceTree(data).forEach(visit);
    assert.equal(seen.size,data.facesVertices.length);
  }
}));

test('sequential endpoints equal synchronous endpoints and leave source data unchanged', () => quiet(() => {
  for(const family of families) for(const thickness of [0,0.5,1.5,3]) {
    const data=generateShapeFoldData(family,{...DEFAULT_BOX_PARAMS,materialThickness:thickness});
    const snapshot=JSON.stringify(data),tree=buildFaceTree(data);
    for(const progress of [0,1]) {
      const sync=computeFoldedVertices(data,tree,progress,false),seq=computeFoldedVertices(data,tree,progress,true);
      assert.deepEqual(seq,sync,`${family}, thickness ${thickness}, endpoint ${progress}`);
    }
    assert.equal(JSON.stringify(data),snapshot);
  }
}));
