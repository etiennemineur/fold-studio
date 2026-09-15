import { ParsedMesh } from "./objParser";
import {
  Vec3,
  Vec2,
  sub3,
  dot3,
  cross3,
  normalize3,
  distance3
} from "./unfoldMathHelpers";

export interface HalfEdge {
  id: number;
  origin: number;
  target: number;
  face: number;
  next: number;
  prev: number;
  twin: number;
}

export interface DualEdge {
  heId: number;
  f1: number;
  f2: number;
  weight: number;
  theta: number;
}

export interface Face2D {
  faceIdx: number;
  vertices2D: Map<number, Vec2>;
}

export function computeFaceCentroid(
  mesh: ParsedMesh,
  hes: HalfEdge[],
  faceToHe: Map<number, number>,
  faceIdx: number
): Vec3 {
  let cx = 0, cy = 0, cz = 0, count = 0;
  const startHe = faceToHe.get(faceIdx)!;
  let curr = startHe;
  do {
    const v = mesh.vertices[hes[curr].origin];
    cx += v[0]; cy += v[1]; cz += v[2];
    count++;
    curr = hes[curr].next;
  } while (curr !== startHe);
  return [cx/count, cy/count, cz/count];
}

export function computeFaceNormal(
  mesh: ParsedMesh,
  hes: HalfEdge[],
  faceToHe: Map<number, number>,
  f: number
): Vec3 {
  const startHe = faceToHe.get(f)!;
  let curr = startHe;
  let nx = 0, ny = 0, nz = 0;
  do {
    const v1 = mesh.vertices[hes[curr].origin];
    const v2 = mesh.vertices[hes[curr].target];
    nx += (v1[1] - v2[1]) * (v1[2] + v2[2]);
    ny += (v1[2] - v2[2]) * (v1[0] + v2[0]);
    nz += (v1[0] - v2[0]) * (v1[1] + v2[1]);
    curr = hes[curr].next;
  } while (curr !== startHe);
  return normalize3([nx, ny, nz]);
}

export function buildHalfEdges(mesh: ParsedMesh): { hes: HalfEdge[], faceToHe: Map<number, number> } {
  const hes: HalfEdge[] = [];
  const faceToHe = new Map<number, number>();
  
  let heCounter = 0;
  for (let f = 0; f < mesh.faces.length; f++) {
    const face = mesh.faces[f];
    const firstHeId = heCounter;
    faceToHe.set(f, firstHeId);
    
    for (let i = 0; i < face.length; i++) {
      hes.push({
        id: heCounter,
        origin: face[i],
        target: face[(i + 1) % face.length],
        face: f,
        next: -1,
        prev: -1,
        twin: -1
      });
      heCounter++;
    }
    
    for (let i = 0; i < face.length; i++) {
      hes[firstHeId + i].next = firstHeId + ((i + 1) % face.length);
      hes[firstHeId + i].prev = firstHeId + ((i - 1 + face.length) % face.length);
    }
  }

  const edgeLookup = new Map<string, number>();
  for (const he of hes) {
    edgeLookup.set(`${he.origin}-${he.target}`, he.id);
  }
  for (const he of hes) {
    const twinId = edgeLookup.get(`${he.target}-${he.origin}`);
    if (twinId !== undefined) {
      he.twin = twinId;
    }
  }

  return { hes, faceToHe };
}

export function buildDualGraph(
  mesh: ParsedMesh,
  hes: HalfEdge[],
  faceToHe: Map<number, number>
): DualEdge[] {
  const dualEdges: DualEdge[] = [];
  for (const he of hes) {
    if (he.twin !== -1 && he.face < hes[he.twin].face) {
      const f1 = he.face;
      const f2 = hes[he.twin].face;
      
      const vA = mesh.vertices[he.origin];
      const vB = mesh.vertices[he.target];
      const elen = distance3(vA, vB);
      
      const centroid1 = computeFaceCentroid(mesh, hes, faceToHe, f1);
      const centroid2 = computeFaceCentroid(mesh, hes, faceToHe, f2);
      
      const e = normalize3(sub3(vB, vA));
      const cVec = sub3(centroid1, vA);
      const dVec = sub3(centroid2, vA);
      
      const cDotE = dot3(cVec, e);
      const c_perp = sub3(cVec, [cDotE * e[0], cDotE * e[1], cDotE * e[2]]);
      
      const dDotE = dot3(dVec, e);
      const d_perp = sub3(dVec, [dDotE * e[0], dDotE * e[1], dDotE * e[2]]);
      
      const sinVal = dot3(cross3(c_perp, d_perp), e);
      const cosVal = dot3(c_perp, d_perp);
      const dihedral = Math.atan2(sinVal, cosVal);
      
      const theta = Math.atan2(Math.sin(dihedral - Math.PI), Math.cos(dihedral - Math.PI));
      
      const weight = (Math.PI - Math.abs(theta)) * elen;
      dualEdges.push({ heId: he.id, f1, f2, weight, theta });
    }
  }

  dualEdges.sort((a, b) => b.weight - a.weight);
  return dualEdges;
}