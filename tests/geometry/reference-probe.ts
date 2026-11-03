// Executes only the user's MODEL/ENGINE blocks, never its UI, imports or network code.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
const source=process.argv[2];
if (!source) throw new Error('Pass the local Mailer reference HTML path as the first argument.');
const html=readFileSync(source,'utf8');
const block=(name:string)=>{const start=`/*${name}-START*/`,end=`/*${name}-END*/`;const a=html.indexOf(start),b=html.indexOf(end);if(a<0||b<a)throw new Error(`Missing ${name}`);return html.slice(a+start.length,b);};
const context=vm.createContext({THREE,setTimeout,console});
vm.runInContext(`${block('MODEL')}\n${block('ENGINE')}\nglobalThis.model={P,H:H.map(([name,par,ch,p,v,keys,piv])=>({name,par,ch,p,v,keys,piv})),T,EPS,ENG};`,context,{timeout:5000});
const {P,H,T,EPS,ENG}=(context as any).model;
const rig=ENG.rig(P,H,T,EPS),samples=ENG.samplesFor(P,4,1.5);
let maxRigidError=0,finite=true;
const frames=[];
for(let frame=0;frame<=240;frame+=20) {
  for(const h of H) rig.hinge[h.name].rotation.x=ENG.angleAt(h.keys,frame)*Math.PI/180;
  rig.root.updateMatrixWorld(true);
  for(const name of Object.keys(P)) {
    const pts=P[name].o.map(([x,y]:number[])=>new THREE.Vector3(x,y,0));
    const world=pts.map((p:any)=>p.clone().applyMatrix4(rig.objs[name].matrixWorld));
    for(let i=0;i<pts.length;i++) {
      finite&&=world[i].toArray().every(Number.isFinite);
      for(let j=0;j<i;j++) maxRigidError=Math.max(maxRigidError,Math.abs(pts[i].distanceTo(pts[j])-world[i].distanceTo(world[j])));
    }
  }
  const collision=ENG.collide(rig,samples,null);
  frames.push({frame,samplePenetrations:collision.count,maxPenetration:collision.max,pairs:[...collision.pairs]});
}
console.log(JSON.stringify({source,panels:Object.keys(P).length,hinges:H.length,thickness:T,grid:4,edgeSampleSpacing:1.5,finite,maxRigidError,frames,warning:'Sparse sampling, not continuous collision certification. Reference excludes contact near parent hinges and uses three thickness samples.'},null,2));
