import {pathToFileURL} from 'node:url';
import {buildFaceTree, computeFoldedVertices, generateShapeFoldData, DEFAULT_BOX_PARAMS, type ShapeType, type FoldData} from '../../helpers/foldEngine';
export const families: ShapeType[] = ['box','pyramid','tray','sleeve','hexagonal','triangular','octagonal','pentagonal','mailer','tuckEnd','display','flipTop','gable','sealEnd','snapLock','origamiSquare','origamiRectangle','origamiA4','concentricRings','sineWaves'];
export function area(data: FoldData, face: number[]) {
  return Math.abs(face.reduce((sum,a,i)=>{const b=face[(i+1)%face.length],p=data.verticesCoords[a],q=data.verticesCoords[b];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
}
export function rigidity(data: FoldData, progress:number, sequential:boolean) {
  const folded=computeFoldedVertices(data,buildFaceTree(data),progress,sequential);
  let maxError=0, finite=true;
  for(const face of data.facesVertices) for(const a of face) for(const b of face) {
    const p=data.verticesCoords[a],q=data.verticesCoords[b],x=folded.get(a)!,y=folded.get(b)!;
    finite &&= x.every(Number.isFinite)&&y.every(Number.isFinite);
    maxError=Math.max(maxError,Math.abs(Math.hypot(p[0]-q[0],p[1]-q[1],(p[2]??0)-(q[2]??0))-Math.hypot(...x.map((v,i)=>v-y[i]))));
  }
  return {maxError,finite};
}
export function runAudit() {
const originalLog=console.log;console.log=()=>{};
try {
const results=[];
for(const family of families) for(const thickness of [0,0.5,1.5,3]) for(const glueTabSize of [0,15]) {
  const data=generateShapeFoldData(family,{...DEFAULT_BOX_PARAMS,materialThickness:thickness,glueTabSize});
  const badFaces=data.facesVertices.flatMap((f,i)=>area(data,f)<1e-8?[i]:[]);
  const incidence=new Map<string,number>();
  for(const face of data.facesVertices) for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],key=[a,b].sort((a,b)=>a-b).join('-');incidence.set(key,(incidence.get(key)??0)+1);}
  const badEdges=data.edgesVertices.flatMap(([a,b],i)=>!data.verticesCoords[a]||!data.verticesCoords[b]||a===b||!Number.isFinite(data.edgesFoldAngle[i])?[i]:[]);
  let maxError=0,finite=data.verticesCoords.every(p=>p.slice(0,2).every(Number.isFinite));
  for(const sequential of [false,true]) for(const progress of [0,0.125,0.25,0.5,0.75,1]) {const result=rigidity(data,progress,sequential);maxError=Math.max(maxError,result.maxError);finite&&=result.finite;}
  results.push({family,thickness,glueTabSize,vertices:data.verticesCoords.length,faces:data.facesVertices.length,badFaces,badEdges,nonmanifold:[...incidence.values()].filter(n=>n>2).length,maxError,finite});
}
return results;
} finally {console.log=originalLog;}
}
// This audit reports known mathematical limits; strict regressions live beside it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(runAudit(),null,2));
