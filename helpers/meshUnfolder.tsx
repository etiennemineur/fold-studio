import { FoldData, buildFaceTree, computeFoldedVertices, FaceTreeNode } from "./foldEngine";
import { ParsedMesh } from "./objParser";
import {
  Vec3,
  Vec2,
  sub3,
  add2,
  sub2,
  dot3,
  cross3,
  len2,
  normalize3,
  distance3,
  getAABB,
  polygonsOverlapSAT
} from "./unfoldMathHelpers";
import { tryPlaceTab } from "./unfoldGlueTabs";

import { HalfEdge, DualEdge, Face2D, buildHalfEdges, buildDualGraph, computeFaceNormal } from "./meshUnfolderCore";

export interface UnfoldOptions {
  glueTabSize: number;
  glueTabAngle: number;
  rootFaceIndex?: number;
  forcedCuts?: string[];
}

export interface UnfoldResult {
  foldData: FoldData;
  hasOverlaps: boolean;
  overlappingFacePairs: [number, number][];
  edgeClassification: Record<string, 'cut' | 'fold' | 'boundary'>;
  internalEdgeKeys: string[];
  stats: {
    originalFaces: number;
    originalEdges: number;
    cutEdges: number;
    foldEdges: number;
    glueTabs: number;
  };
  foldVToMeshV?: Map<number, number>;
  newFToOrigF?: Map<number, number>;
}

function validateFoldAngleSigns(
  foldData: FoldData,
  mesh: ParsedMesh,
  newFToOrigF: Map<number, number>,
  foldVToMeshV: Map<number, number>
) {
  const trees = buildFaceTree(foldData);
  if (trees.length === 0) return;

  const parentMap = new Map<number, FaceTreeNode>();
  const nodes = [...trees];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    for (const child of n.children) {
      parentMap.set(child.faceIndex, n);
      nodes.push(child);
    }
  }

  const edgeLookup = new Map<string, number>();
  for (let i = 0; i < foldData.edgesVertices.length; i++) {
    const [ev1, ev2] = foldData.edgesVertices[i];
    edgeLookup.set(`${Math.min(ev1, ev2)}-${Math.max(ev1, ev2)}`, i);
  }

  for (const node of nodes) {
    if (!node.hingeEdge) continue;
    const parentNode = parentMap.get(node.faceIndex);
    if (!parentNode) continue;

    const childFaceIdx = node.faceIndex;
    if (newFToOrigF.get(childFaceIdx) === undefined) continue;

    const h1 = node.hingeEdge[0];
    const h2 = node.hingeEdge[1];

    const minH = Math.min(h1, h2);
    const maxH = Math.max(h1, h2);
    const edgeIdx = edgeLookup.get(`${minH}-${maxH}`);
    if (edgeIdx === undefined) continue;

    const mh1 = foldVToMeshV.get(h1);
    const mh2 = foldVToMeshV.get(h2);
    if (mh1 === undefined || mh2 === undefined) continue;

    const H1 = mesh.vertices[mh1];
    const H2 = mesh.vertices[mh2];

    const axisVec = sub3(H2, H1);
    const axisLen = Math.sqrt(axisVec[0] * axisVec[0] + axisVec[1] * axisVec[1] + axisVec[2] * axisVec[2]);
    if (axisLen < 1e-10) continue;
    const axis = [axisVec[0] / axisLen, axisVec[1] / axisLen, axisVec[2] / axisLen] as Vec3;

    const parentFace = foldData.facesVertices[parentNode.faceIndex];
    let adjParentFoldV = -1;
let mAdj: number | undefined;
for (const pv of parentFace) {
if (pv !== h1 && pv !== h2) {
const m = foldVToMeshV.get(pv);
if (m !== undefined) {
adjParentFoldV = pv;
mAdj = m;
break;
}
}
}
if (adjParentFoldV === -1 || mAdj === undefined) continue;
const adjParentMeshPos = mesh.vertices[mAdj] as Vec3;

    const toParent = sub3(adjParentMeshPos, H1);
    const toParentDotAxis = dot3(toParent, axis);
    const toParentPerp = sub3(toParent, [toParentDotAxis * axis[0], toParentDotAxis * axis[1], toParentDotAxis * axis[2]]);
    const toParentPerpLen = Math.sqrt(toParentPerp[0] * toParentPerp[0] + toParentPerp[1] * toParentPerp[1] + toParentPerp[2] * toParentPerp[2]);
    if (toParentPerpLen < 1e-10) continue;
    const d_parent = [toParentPerp[0] / toParentPerpLen, toParentPerp[1] / toParentPerpLen, toParentPerp[2] / toParentPerpLen] as Vec3;

    const d_flat = [-d_parent[0], -d_parent[1], -d_parent[2]] as Vec3;

    const childFace = foldData.facesVertices[childFaceIdx];
    let testFoldV = -1;
    for (const v of childFace) {
      if (v !== h1 && v !== h2) {
        testFoldV = v;
        break;
      }
    }
    if (testFoldV === -1) continue;

    const mTestV = foldVToMeshV.get(testFoldV);
    if (mTestV === undefined) continue;

    const C = mesh.vertices[mTestV];
    const toChild = sub3(C, H1);
    const toChildDotAxis = dot3(toChild, axis);
    const toChildPerp = sub3(toChild, [toChildDotAxis * axis[0], toChildDotAxis * axis[1], toChildDotAxis * axis[2]]);
    const toChildPerpLen = Math.sqrt(toChildPerp[0] * toChildPerp[0] + toChildPerp[1] * toChildPerp[1] + toChildPerp[2] * toChildPerp[2]);
    if (toChildPerpLen < 1e-10) continue;
    const d_child = [toChildPerp[0] / toChildPerpLen, toChildPerp[1] / toChildPerpLen, toChildPerp[2] / toChildPerpLen] as Vec3;

    const cross_prod = cross3(d_flat, d_child);
    const sin_theta = dot3(cross_prod, axis);
    const cos_theta = dot3(d_flat, d_child);

    const angleRad = Math.atan2(sin_theta, cos_theta);
    const computedAngleDeg = (angleRad * 180) / Math.PI;

    if (Math.abs(computedAngleDeg) >= 0.5) {
      const [ev0, ev1] = foldData.edgesVertices[edgeIdx];
      const finalEdgeAngle = ev0 === h1 && ev1 === h2 ? computedAngleDeg : -computedAngleDeg;
      foldData.edgesFoldAngle[edgeIdx] = finalEdgeAngle;
      if (finalEdgeAngle > 0) {
        foldData.edgesAssignment[edgeIdx] = 'V';
      } else {
        foldData.edgesAssignment[edgeIdx] = 'M';
      }
    }
  }
}

export function meshUnfolder(mesh: ParsedMesh, options?: Partial<UnfoldOptions>): UnfoldResult {
  const glueTabSize = options?.glueTabSize ?? 15;
  const glueTabAngle = options?.glueTabAngle ?? 45;
  const rootFaceIndex = options?.rootFaceIndex;

  const stats = {
    originalFaces: mesh.faces.length,
    originalEdges: 0,
    cutEdges: 0,
    foldEdges: 0,
    glueTabs: 0
  };

  if (mesh.faces.length === 0) {
    return {
      foldData: { verticesCoords: [], facesVertices: [], edgesVertices: [], edgesAssignment: [], edgesFoldAngle: [] },
      hasOverlaps: false,
      overlappingFacePairs: [],
      edgeClassification: {},
      internalEdgeKeys: [],
      stats
    };
  }

  // --- 1. Half-Edge Data Structure ---
  const { hes, faceToHe } = buildHalfEdges(mesh);
  stats.originalEdges = hes.filter(he => he.twin === -1 || he.id < he.twin).length;

  // --- 2. Dual Graph and Weighted MST ---
  const dualEdges = buildDualGraph(mesh, hes, faceToHe);

  const parent = new Int32Array(mesh.faces.length);
  for(let i=0; i < parent.length; i++) parent[i] = i;
  function find(i: number): number {
    if (parent[i] === i) return i;
    return parent[i] = find(parent[i]);
  }
  function union(i: number, j: number) {
    parent[find(i)] = find(j);
  }

  const forcedCutsSet = new Set(options?.forcedCuts ?? []);

  const mstEdges = new Set<number>(); 
  const cutEdges = new Set<number>();

  for (const edge of dualEdges) {
    const he = hes[edge.heId];
    const edgeKey = `${Math.min(he.origin, he.target)}-${Math.max(he.origin, he.target)}`;
    const isForcedCut = forcedCutsSet.has(edgeKey);

    if (isForcedCut) {
      cutEdges.add(edge.heId);
      stats.cutEdges++;
    } else if (find(edge.f1) !== find(edge.f2)) {
      union(edge.f1, edge.f2);
      mstEdges.add(edge.heId);
      stats.foldEdges++;
    } else {
      cutEdges.add(edge.heId);
      stats.cutEdges++;
    }
  }

  // --- 3. Planar Embedding (2D Unfolding) ---
  function getFaceLocal2D(faceIdx: number): Map<number, Vec2> {
    const startHe = faceToHe.get(faceIdx)!;
    const localCoords = new Map<number, Vec2>();
    
    const v0Idx = hes[startHe].origin;
    const v1Idx = hes[startHe].target;
    const v0 = mesh.vertices[v0Idx];
    const v1 = mesh.vertices[v1Idx];
    
    const U = normalize3(sub3(v1, v0));
    const normal = computeFaceNormal(mesh, hes, faceToHe, faceIdx);
    const V = cross3(normal, U); 
    
    let curr = startHe;
    do {
      const vIdx = hes[curr].origin;
      const v = mesh.vertices[vIdx];
      const diff = sub3(v, v0);
      localCoords.set(vIdx, [dot3(diff, U), dot3(diff, V)]);
      curr = hes[curr].next;
    } while(curr !== startHe);
    
    return localCoords;
  }

  function transformLocalToGlobal(localPt: Vec2, localA: Vec2, localB: Vec2, globalA: Vec2, globalB: Vec2): Vec2 {
    const pt = sub2(localPt, localA);
    const vL = sub2(localB, localA);
    const vG = sub2(globalB, globalA);
    
    const angleL = Math.atan2(vL[1], vL[0]);
    const angleG = Math.atan2(vG[1], vG[0]);
    const dTheta = angleG - angleL;
    
    const cosT = Math.cos(dTheta);
    const sinT = Math.sin(dTheta);
    
    const rx = pt[0]*cosT - pt[1]*sinT;
    const ry = pt[0]*sinT + pt[1]*cosT;
    
    return add2([rx, ry], globalA);
  }

  function computeFacePlacement(currFace2D: Face2D, nextFaceIdx: number, de: DualEdge, currFaceIdx: number): Map<number, Vec2> {
    let sharedHe = hes[de.heId];
    if (sharedHe.face !== currFaceIdx) {
      sharedHe = hes[sharedHe.twin];
    }
    const vA = sharedHe.origin;
    const vB = sharedHe.target;
    
    const globalA = currFace2D.vertices2D.get(vA)!;
    const globalB = currFace2D.vertices2D.get(vB)!;
    
    const nextLocal = getFaceLocal2D(nextFaceIdx);
    const localA = nextLocal.get(vA)!;
    const localB = nextLocal.get(vB)!;
    
    const nextGlobal = new Map<number, Vec2>();
    for (const [vIdx, lpt] of nextLocal.entries()) {
      nextGlobal.set(vIdx, transformLocalToGlobal(lpt, localA, localB, globalA, globalB));
    }
    return nextGlobal;
  }

  function face2DToPolygon(vertices2D: Map<number, Vec2>, faceVertices: number[]): Vec2[] {
    return faceVertices.map(vIdx => vertices2D.get(vIdx)!);
  }

  const faces2D = new Map<number, Face2D>();
  
  let actualRoot: number;
  if (rootFaceIndex !== undefined) {
    actualRoot = Math.min(Math.max(rootFaceIndex, 0), mesh.faces.length - 1);
  } else {
    // Auto-select: find the face with the largest surface area
    actualRoot = 0;
    let maxArea = -1;
    for (let f = 0; f < mesh.faces.length; f++) {
      const face = mesh.faces[f];
      if (face.length < 3) continue;
      // Compute area using cross product fan triangulation
      let area = 0;
      const v0 = mesh.vertices[face[0]];
      for (let i = 1; i < face.length - 1; i++) {
        const v1 = mesh.vertices[face[i]];
        const v2 = mesh.vertices[face[i + 1]];
        const e1 = sub3(v1, v0);
        const e2 = sub3(v2, v0);
        const cr = cross3(e1, e2);
        area += Math.sqrt(cr[0]*cr[0] + cr[1]*cr[1] + cr[2]*cr[2]) / 2;
      }
      if (area > maxArea) {
        maxArea = area;
        actualRoot = f;
      }
    }
  }

  const mstAdj = new Map<number, DualEdge[]>();
  for (const de of dualEdges) {
    if (mstEdges.has(de.heId)) {
      if(!mstAdj.has(de.f1)) mstAdj.set(de.f1, []);
      if(!mstAdj.has(de.f2)) mstAdj.set(de.f2, []);
      mstAdj.get(de.f1)!.push(de);
      mstAdj.get(de.f2)!.push(de);
    }
  }

  // Track all placed face polygons for overlap checking
  const placedPolygons: Vec2[][] = [];

  // Place root face
  const rootFace2D = getFaceLocal2D(actualRoot);
  faces2D.set(actualRoot, { faceIdx: actualRoot, vertices2D: rootFace2D });
  placedPolygons.push(face2DToPolygon(rootFace2D, mesh.faces[actualRoot]));

  const visited = new Set<number>([actualRoot]);
  const queue = [actualRoot];

  while (queue.length > 0) {
    const currF = queue.shift()!;
    const curr2D = faces2D.get(currF)!;
    
    const neighbors = mstAdj.get(currF) || [];
    for (const de of neighbors) {
      const nextF = de.f1 === currF ? de.f2 : de.f1;
      if (visited.has(nextF)) continue;
      
      // Compute WHERE the face would be placed
      const tentative2D = computeFacePlacement(curr2D, nextF, de, currF);
      const tentativePoly = face2DToPolygon(tentative2D, mesh.faces[nextF]);
      
      // Check overlap against ALL previously placed faces
      let hasOverlap = false;
      for (const existingPoly of placedPolygons) {
        if (polygonsOverlapSAT(tentativePoly, existingPoly, 0.5)) {
          hasOverlap = true;
          break;
        }
      }
      
      if (!hasOverlap) {
        // Safe to place
        visited.add(nextF);
        faces2D.set(nextF, { faceIdx: nextF, vertices2D: tentative2D });
        placedPolygons.push(tentativePoly);
        queue.push(nextF);
      } else {
        // OVERLAP detected — cut this edge instead of folding
        mstEdges.delete(de.heId);
        cutEdges.add(de.heId);
        stats.foldEdges--;
        stats.cutEdges++;
        // Do NOT add nextF to visited — it might be reachable from another edge later
      }
    }
  }

  // --- 3.1 Rescue Phase ---
  // Build full adjacency map from ALL dual edges
  const fullAdj = new Map<number, DualEdge[]>();
  for (const de of dualEdges) {
    if (!fullAdj.has(de.f1)) fullAdj.set(de.f1, []);
    if (!fullAdj.has(de.f2)) fullAdj.set(de.f2, []);
    fullAdj.get(de.f1)!.push(de);
    fullAdj.get(de.f2)!.push(de);
  }

  // Try to place unplaced faces via any available edge to a placed face
  let rescueChanged = true;
  while (rescueChanged) {
    rescueChanged = false;
    for (let f = 0; f < mesh.faces.length; f++) {
      if (visited.has(f)) continue;
      
      const adjacentEdges = fullAdj.get(f) || [];
      for (const de of adjacentEdges) {
        const neighbor = de.f1 === f ? de.f2 : de.f1;
        if (!visited.has(neighbor)) continue; // neighbor must be placed
        
        const neighborFace2D = faces2D.get(neighbor)!;
        const tentative2D = computeFacePlacement(neighborFace2D, f, de, neighbor);
        const tentativePoly = face2DToPolygon(tentative2D, mesh.faces[f]);
        
        let hasOverlap = false;
        for (const existingPoly of placedPolygons) {
          if (polygonsOverlapSAT(tentativePoly, existingPoly, 0.5)) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) {
          visited.add(f);
          faces2D.set(f, { faceIdx: f, vertices2D: tentative2D });
          placedPolygons.push(tentativePoly);
          
          // Update edge classification: this edge becomes a fold edge
          if (cutEdges.has(de.heId)) {
            cutEdges.delete(de.heId);
            mstEdges.add(de.heId);
            stats.cutEdges--;
            stats.foldEdges++;
          }
          // Also update mstAdj so BFS can continue from this face
          rescueChanged = true;
          break;
        }
      }
    }
  }

  // --- 3.2 Island Packing ---
  // Find remaining unplaced faces
  const unplacedFaces: number[] = [];
  for (let f = 0; f < mesh.faces.length; f++) {
    if (!visited.has(f)) unplacedFaces.push(f);
  }

  if (unplacedFaces.length > 0) {
    const islandParent = new Int32Array(mesh.faces.length);
    for (let i = 0; i < islandParent.length; i++) islandParent[i] = i;
    function islandFind(i: number): number {
      if (islandParent[i] === i) return i;
      return islandParent[i] = islandFind(islandParent[i]);
    }
    function islandUnion(i: number, j: number) {
      islandParent[islandFind(i)] = islandFind(j);
    }

    for (const de of dualEdges) {
      if (!visited.has(de.f1) && !visited.has(de.f2)) {
        islandUnion(de.f1, de.f2);
      }
    }

    const islands = new Map<number, number[]>();
    for (const f of unplacedFaces) {
      const root = islandFind(f);
      if (!islands.has(root)) islands.set(root, []);
      islands.get(root)!.push(f);
    }

    for (const islandFaces of islands.values()) {
      const islandVisited = new Set<number>();
      const islandQueue = [islandFaces[0]];
      const islandPlacedPolygons: Vec2[][] = [];
      const islandFaces2D = new Map<number, Face2D>();
      
      const islandRoot = islandFaces[0];
      const rootLocal2D = getFaceLocal2D(islandRoot);
      islandFaces2D.set(islandRoot, { faceIdx: islandRoot, vertices2D: rootLocal2D });
      islandPlacedPolygons.push(face2DToPolygon(rootLocal2D, mesh.faces[islandRoot]));
      islandVisited.add(islandRoot);
      
      const islandEdges = dualEdges.filter(de => !visited.has(de.f1) && !visited.has(de.f2));
      const islandAdj = new Map<number, DualEdge[]>();
      for (const de of islandEdges) {
        if (!islandAdj.has(de.f1)) islandAdj.set(de.f1, []);
        if (!islandAdj.has(de.f2)) islandAdj.set(de.f2, []);
        islandAdj.get(de.f1)!.push(de);
        islandAdj.get(de.f2)!.push(de);
      }

      while(islandQueue.length > 0) {
        const currF = islandQueue.shift()!;
        const curr2D = islandFaces2D.get(currF)!;
        
        const neighbors = islandAdj.get(currF) || [];
        for (const de of neighbors) {
          const nextF = de.f1 === currF ? de.f2 : de.f1;
          if (islandVisited.has(nextF)) continue;
          
          const tentative2D = computeFacePlacement(curr2D, nextF, de, currF);
          const tentativePoly = face2DToPolygon(tentative2D, mesh.faces[nextF]);
          
          let hasOverlap = false;
          for (const existingPoly of islandPlacedPolygons) {
            if (polygonsOverlapSAT(tentativePoly, existingPoly, 0.5)) {
              hasOverlap = true;
              break;
            }
          }
          
          if (!hasOverlap) {
            islandVisited.add(nextF);
            islandFaces2D.set(nextF, { faceIdx: nextF, vertices2D: tentative2D });
            islandPlacedPolygons.push(tentativePoly);
            islandQueue.push(nextF);
            
            // Mark as mst edge for this island
            if (cutEdges.has(de.heId)) {
              cutEdges.delete(de.heId);
              mstEdges.add(de.heId);
              stats.cutEdges--;
              stats.foldEdges++;
            }
          } else {
            if (mstEdges.has(de.heId)) {
              mstEdges.delete(de.heId);
              cutEdges.add(de.heId);
              stats.foldEdges--;
              stats.cutEdges++;
            }
          }
        }
      }
      
      // Calculate offset
      let mainMinX = Infinity, mainMaxX = -Infinity, mainMinY = Infinity, mainMaxY = -Infinity;
      for (const poly of placedPolygons) {
        const aabb = getAABB(poly);
        mainMinX = Math.min(mainMinX, aabb.minX);
        mainMaxX = Math.max(mainMaxX, aabb.maxX);
        mainMinY = Math.min(mainMinY, aabb.minY);
        mainMaxY = Math.max(mainMaxY, aabb.maxY);
      }
      if (mainMinX === Infinity) { mainMinX = 0; mainMaxX = 0; mainMinY = 0; mainMaxY = 0; }
      
      let islandMinX = Infinity, islandMinY = Infinity;
      for (const poly of islandPlacedPolygons) {
        const aabb = getAABB(poly);
        islandMinX = Math.min(islandMinX, aabb.minX);
        islandMinY = Math.min(islandMinY, aabb.minY);
      }
      if (islandMinX === Infinity) { islandMinX = 0; islandMinY = 0; }
      
      const offsetX = mainMaxX - islandMinX + 20;
      const offsetY = mainMinY - islandMinY;
      
      for (const [fIdx, f2D] of islandFaces2D.entries()) {
        const offsetVertices = new Map<number, Vec2>();
        for (const [vIdx, pt] of f2D.vertices2D.entries()) {
          offsetVertices.set(vIdx, [pt[0] + offsetX, pt[1] + offsetY]);
        }
        faces2D.set(fIdx, { faceIdx: fIdx, vertices2D: offsetVertices });
        visited.add(fIdx);
        placedPolygons.push(face2DToPolygon(offsetVertices, mesh.faces[fIdx]));
      }
    }
  }

  // Update mstAdj after all changes
  mstAdj.clear();
  for (const de of dualEdges) {
    if (mstEdges.has(de.heId)) {
      if(!mstAdj.has(de.f1)) mstAdj.set(de.f1, []);
      if(!mstAdj.has(de.f2)) mstAdj.set(de.f2, []);
      mstAdj.get(de.f1)!.push(de);
      mstAdj.get(de.f2)!.push(de);
    }
  }

  // --- Edge Promotion ---
  const foldConnectedPairs = new Set<string>();
  for (const de of dualEdges) {
    if (mstEdges.has(de.heId)) {
      const pairKey = `${Math.min(de.f1, de.f2)}-${Math.max(de.f1, de.f2)}`;
      foldConnectedPairs.add(pairKey);
    }
  }

  let promotedCount = 0;
  for (const de of dualEdges) {
    if (cutEdges.has(de.heId)) {
      const pairKey = `${Math.min(de.f1, de.f2)}-${Math.max(de.f1, de.f2)}`;
      if (foldConnectedPairs.has(pairKey)) {
        cutEdges.delete(de.heId);
        mstEdges.add(de.heId);
        stats.cutEdges--;
        stats.foldEdges++;
        promotedCount++;
      }
    }
  }
  console.log(`[Unfolder] Edge promotion: promoted ${promotedCount} cut edges to fold edges`);

  // --- Topological Vertex Construction ---
  const faceVertToUniqueId = new Map<number, Map<number, number>>();
  let uniqueIdCounter = 0;
  
  for (const [f, face2D] of faces2D.entries()) {
    const vMap = new Map<number, number>();
    for (const vIdx of face2D.vertices2D.keys()) {
      vMap.set(vIdx, uniqueIdCounter++);
    }
    faceVertToUniqueId.set(f, vMap);
  }
  
  const vParent = new Int32Array(uniqueIdCounter);
  for (let i = 0; i < uniqueIdCounter; i++) vParent[i] = i;
  function vFind(i: number): number {
    if (vParent[i] === i) return i;
    return vParent[i] = vFind(vParent[i]);
  }
  function vUnion(i: number, j: number) {
    vParent[vFind(i)] = vFind(j);
  }
  
  for (const de of dualEdges) {
    if (mstEdges.has(de.heId)) {
      const he = hes[de.heId];
      const vA = he.origin;
      const vB = he.target;
      
      const idA1 = faceVertToUniqueId.get(de.f1)?.get(vA);
      const idA2 = faceVertToUniqueId.get(de.f2)?.get(vA);
      if (idA1 !== undefined && idA2 !== undefined) vUnion(idA1, idA2);
      
      const idB1 = faceVertToUniqueId.get(de.f1)?.get(vB);
      const idB2 = faceVertToUniqueId.get(de.f2)?.get(vB);
      if (idB1 !== undefined && idB2 !== undefined) vUnion(idB1, idB2);
    }
  }
  
  const finalVIdToFoldVId = new Map<number, number>();
  const foldVertices: Vec2[] = [];
  
  function getFinalVId(uniqueId: number, pt2D: Vec2): number {
    const root = vFind(uniqueId);
    if (!finalVIdToFoldVId.has(root)) {
      finalVIdToFoldVId.set(root, foldVertices.length);
      foldVertices.push(pt2D);
    }
    return finalVIdToFoldVId.get(root)!;
  }
  
  const foldFaces: number[][] = [];
  const faceIdxToFoldFaceIdx = new Map<number, number>();
  const newFToOrigF = new Map<number, number>();
  
  for (const [f, face2D] of faces2D.entries()) {
    const newFace: number[] = [];
    const faceVertices = mesh.faces[f];
    for (const vIdx of faceVertices) {
      const pt = face2D.vertices2D.get(vIdx)!;
      const uid = faceVertToUniqueId.get(f)!.get(vIdx)!;
      newFace.push(getFinalVId(uid, pt));
    }
    
    faceIdxToFoldFaceIdx.set(f, foldFaces.length);
    newFToOrigF.set(foldFaces.length, f);
    foldFaces.push(newFace);
  }

  // --- 4. Glue Tab Generation ---
  // Build a lookup: cut edge heId → dihedral angle (radians)
  const cutEdgeThetaMap = new Map<number, number>();
  for (const de of dualEdges) {
    if (cutEdges.has(de.heId)) {
      cutEdgeThetaMap.set(de.heId, de.theta);
    }
  }

  const tabFaceDihedralAngle = new Map<number, number>();

  const allFacePolygons = foldFaces.slice(0, faces2D.size).map(face => ({
    poly: face.map(vIdx => foldVertices[vIdx]),
    vIndices: new Set(face)
  }));
  const placedTabPolygons: { poly: Vec2[]; vIndices: Set<number> }[] = [];

  const cutEdgesByPair = new Map<string, number[]>();
  for (const heId of cutEdges) {
    const he = hes[heId];
    if (he.twin === -1) continue;
    const f1 = he.face;
    const f2 = hes[he.twin].face;
    const pairKey = `${Math.min(f1, f2)}-${Math.max(f1, f2)}`;
    if (!cutEdgesByPair.has(pairKey)) cutEdgesByPair.set(pairKey, []);
    cutEdgesByPair.get(pairKey)!.push(heId);
  }

  for (const [pairKey, heIds] of cutEdgesByPair) {
    let bestHeId = heIds[0];
    let bestLen = 0;
    for (const heId of heIds) {
      const he = hes[heId];
      const edgeLen = distance3(mesh.vertices[he.origin], mesh.vertices[he.target]);
      if (edgeLen > bestLen) {
        bestLen = edgeLen;
        bestHeId = heId;
      }
    }

    const candidates = [hes[bestHeId].face];
    if (hes[bestHeId].twin !== -1) {
      candidates.push(hes[hes[bestHeId].twin].face);
    }

    for (const origF of candidates) {
      const f2D = faces2D.get(origF);
      if (!f2D) continue;

      let sharedHe = hes[bestHeId];
      if (sharedHe.face !== origF) {
        sharedHe = hes[sharedHe.twin];
      }

      const vA = sharedHe.origin;
      const vB = sharedHe.target;

      const ptA = f2D.vertices2D.get(vA)!;
      const ptB = f2D.vertices2D.get(vB)!;

      const uidA = faceVertToUniqueId.get(origF)!.get(vA)!;
      const uidB = faceVertToUniqueId.get(origF)!.get(vB)!;
      const vA_idx = getFinalVId(uidA, ptA);
      const vB_idx = getFinalVId(uidB, ptB);

      const tabResult = tryPlaceTab(
        origF,
        vA,
        vB,
        ptA,
        ptB,
        faces2D,
        mesh.faces,
        glueTabSize,
        glueTabAngle,
        vA_idx,
        vB_idx,
        allFacePolygons,
        placedTabPolygons
      );

      if (tabResult) {
        const { ot1, ot2 } = tabResult;

        const ot1_idx = foldVertices.length;
        foldVertices.push(ot1);
        const ot2_idx = foldVertices.length;
        foldVertices.push(ot2);

        // Tab attached CCW: vB -> vA -> ot2 -> ot1
        foldFaces.push([vB_idx, vA_idx, ot2_idx, ot1_idx]);

        const thetaRad = cutEdgeThetaMap.get(bestHeId) ?? 0;
        const thetaDeg = (thetaRad * 180) / Math.PI;
        tabFaceDihedralAngle.set(foldFaces.length - 1, thetaDeg);

        placedTabPolygons.push({
          poly: [ptB, ptA, ot2, ot1],
          vIndices: new Set([vB_idx, vA_idx, ot2_idx, ot1_idx])
        });

        stats.glueTabs++;
        break;
      }
    }
  }

  // --- 5. Edges and Assignments Extraction ---
  const foldEdgesVertices: [number, number][] = [];
  const foldEdgesAssignment: ('M'|'V'|'B'|'F')[] = [];
  const foldEdgesAngle: number[] = [];
  
  const foldEdgeMap = new Map<string, { count: number, fv1: number, fv2: number, f1: number, f2: number }>();
  
  for (let i = 0; i < foldFaces.length; i++) {
    const face = foldFaces[i];
    for (let j = 0; j < face.length; j++) {
      const v1 = face[j];
      const v2 = face[(j + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      
      if (!foldEdgeMap.has(key)) {
        foldEdgeMap.set(key, { count: 1, fv1: v1, fv2: v2, f1: i, f2: -1 });
      } else {
        const entry = foldEdgeMap.get(key)!;
        entry.count++;
        entry.f2 = i;
      }
    }
  }
  
  for (const entry of foldEdgeMap.values()) {
    foldEdgesVertices.push([entry.fv1, entry.fv2]);
    
    if (entry.count === 1) {
      foldEdgesAssignment.push('B');
      foldEdgesAngle.push(0);
    } else {
      const origF1 = newFToOrigF.get(entry.f1);
      const origF2 = newFToOrigF.get(entry.f2);
      
      if (origF1 !== undefined && origF2 !== undefined) {
        let theta = 0;
        let matchedDe: DualEdge | undefined;
        for (const de of dualEdges) {
          if ((de.f1 === origF1 && de.f2 === origF2) || (de.f1 === origF2 && de.f2 === origF1)) {
            theta = de.theta;
            matchedDe = de;
            break;
          }
        }
        let angleDeg = (theta * 180) / Math.PI;
        
        if (matchedDe) {
          const he = hes[matchedDe.heId];
          const uid1 = faceVertToUniqueId.get(matchedDe.f1)?.get(he.origin);
          const uid2 = faceVertToUniqueId.get(matchedDe.f1)?.get(he.target);
          const refFoldV1 = uid1 !== undefined ? finalVIdToFoldVId.get(vFind(uid1)) : undefined;
          const refFoldV2 = uid2 !== undefined ? finalVIdToFoldVId.get(vFind(uid2)) : undefined;

          if (entry.fv1 === refFoldV2 && entry.fv2 === refFoldV1) {
            angleDeg = -angleDeg;
          }
        }
        
        if (Math.abs(angleDeg) < 1) {
          foldEdgesAssignment.push('F');
          foldEdgesAngle.push(0);
        } else if (angleDeg > 0) {
          foldEdgesAssignment.push('V');
          foldEdgesAngle.push(angleDeg);
        } else {
          foldEdgesAssignment.push('M');
          foldEdgesAngle.push(angleDeg);
        }
            } else {
        // Tab hinge — use actual dihedral angle from the original cut edge
        // Add small inward offset so tabs fold slightly inside the volume
        const tabInwardOffset = 1; // degrees
        const tabFaceIdx = origF1 === undefined ? entry.f1 : entry.f2;
        const storedAngleDeg = tabFaceDihedralAngle.get(tabFaceIdx);
        if (storedAngleDeg !== undefined && Math.abs(storedAngleDeg) >= 1) {
          if (storedAngleDeg > 0) {
            foldEdgesAssignment.push('V');
            foldEdgesAngle.push(storedAngleDeg + tabInwardOffset);
          } else {
            foldEdgesAssignment.push('M');
            foldEdgesAngle.push(storedAngleDeg - tabInwardOffset);
          }
        } else {
          // Fallback: flat or unknown angle
          foldEdgesAssignment.push('M');
          foldEdgesAngle.push(-90 - tabInwardOffset);
        }
      }
    }
  }

  // --- 6. Overlap Detection (SAT) ---
  const overlappingFacePairs: [number, number][] = [];
  const polys = foldFaces.map(face => face.map(vIdx => foldVertices[vIdx]));
  
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      const set1 = new Set(foldFaces[i]);
      let sharedCount = 0;
      for (const v of foldFaces[j]) {
        if (set1.has(v)) sharedCount++;
      }
      if (sharedCount >= 2) continue; // Faces share an edge, skip overlap check
      
      if (polygonsOverlapSAT(polys[i], polys[j], 0.5)) {
        overlappingFacePairs.push([i, j]);
      }
    }
  }

  const edgeClassification: Record<string, 'cut' | 'fold' | 'boundary'> = {};
  const internalEdgeKeys: string[] = [];

  for (const he of hes) {
    if (he.twin === -1 || he.id < he.twin) {
      const edgeKey = `${Math.min(he.origin, he.target)}-${Math.max(he.origin, he.target)}`;
      if (he.twin === -1) {
        edgeClassification[edgeKey] = 'boundary';
      } else {
        internalEdgeKeys.push(edgeKey);
        if (mstEdges.has(he.id) || mstEdges.has(he.twin)) {
          edgeClassification[edgeKey] = 'fold';
        } else {
          edgeClassification[edgeKey] = 'cut';
        }
      }
    }
  }

  const foldVToMeshV = new Map<number, number>();
  for (const [origF, face2D] of faces2D.entries()) {
    const meshFace = mesh.faces[origF];
    for (const meshVIdx of meshFace) {
      const uid = faceVertToUniqueId.get(origF)?.get(meshVIdx);
      if (uid === undefined) continue;
      const root = vFind(uid);
      const foldVId = finalVIdToFoldVId.get(root);
      if (foldVId !== undefined && !foldVToMeshV.has(foldVId)) {
        foldVToMeshV.set(foldVId, meshVIdx);
      }
    }
  }

  const foldDataObj: FoldData = {
    verticesCoords: foldVertices,
    facesVertices: foldFaces,
    edgesVertices: foldEdgesVertices,
    edgesAssignment: foldEdgesAssignment,
    edgesFoldAngle: foldEdgesAngle
  };

  validateFoldAngleSigns(foldDataObj, mesh, newFToOrigF, foldVToMeshV);

  return {
    foldData: foldDataObj,
    hasOverlaps: overlappingFacePairs.length > 0,
    overlappingFacePairs,
    edgeClassification,
    internalEdgeKeys,
    stats,
    foldVToMeshV,
    newFToOrigF
  };
}