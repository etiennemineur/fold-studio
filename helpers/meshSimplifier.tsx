import { ParsedMesh } from "./objParser";

export interface SimplifyOptions {
  maxFaces?: number;
  coplanarAngleThreshold?: number;
  curvatureAngleThreshold?: number;
  preserveBoundary?: boolean;
  weldVertices?: boolean;
}

export interface SimplifyResult {
  mesh: ParsedMesh;
  wasSimplified: boolean;
  originalFaceCount: number;
  simplifiedFaceCount: number;
  coplanarGroupsMerged: number;
  curvatureMergeCount: number;
  fanVertexMergeCount: number;
  verticesWelded: number;
}

// --- Math Utilities ---
type Vec3 = [number, number, number];

function normalize3(a: Vec3): Vec3 {
  const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  return l === 0 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function distance3(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function len3(a: Vec3): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

/**
 * Computes face normal using Newell's method (robust for arbitrary N-gons)
 */
function computeNormal(vertices: Vec3[], face: number[]): Vec3 {
  let nx = 0,
    ny = 0,
    nz = 0;
  for (let i = 0; i < face.length; i++) {
    const v1 = vertices[face[i]];
    const v2 = vertices[face[(i + 1) % face.length]];
    nx += (v1[1] - v2[1]) * (v1[2] + v2[2]);
    ny += (v1[2] - v2[2]) * (v1[0] + v2[0]);
    nz += (v1[0] - v2[0]) * (v1[1] + v2[1]);
  }
  return normalize3([nx, ny, nz]);
}

/**
 * Checks if a polygon is planar within a specified tolerance.
 */
function isPolygonPlanar(vertices: Vec3[], face: number[], tolerance = 1.0): boolean {
  if (face.length <= 3) return true;
  const normal = computeNormal(vertices, face);
  const p0 = vertices[face[0]];
  for (let i = 1; i < face.length; i++) {
    const p = vertices[face[i]];
    const vec = sub3(p, p0);
    const deviation = dot3(vec, normal);
    if (Math.abs(deviation) > tolerance) return false;
  }
  return true;
}

/**
 * Removes consecutive duplicate vertices from a face to prevent degeneracies
 */
function cleanFace(face: number[]): number[] {
  if (face.length === 0) return [];
  const res: number[] = [];
  for (let i = 0; i < face.length; i++) {
    const v = face[i];
    if (res.length === 0 || res[res.length - 1] !== v) {
      res.push(v);
    }
  }
  // If the face loops back and has identical start/end, remove the end
  while (res.length > 1 && res[0] === res[res.length - 1]) {
    res.pop();
  }
  return res;
}

class UnionFind {
  parent: Int32Array;
  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) this.parent[i] = i;
  }
  find(i: number): number {
    if (this.parent[i] === i) return i;
    return (this.parent[i] = this.find(this.parent[i]));
  }
  union(i: number, j: number) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
    }
  }
}

/**
 * Simplifies a 3D mesh for unfolding via coplanar merging and iterative edge collapse.
 */
export function meshSimplifier(
  mesh: ParsedMesh,
  options?: SimplifyOptions
): SimplifyResult {
  const maxFaces = Math.max(1, Math.floor(options?.maxFaces ?? 200));
  const coplanarAngleThreshold = options?.coplanarAngleThreshold ?? 5;
  const curvatureAngleThreshold = options?.curvatureAngleThreshold ?? 35;
  const preserveBoundary = options?.preserveBoundary ?? true;
  const weldVerticesOpt = options?.weldVertices ?? true;

  let vertices = mesh.vertices.map((v) => [...v] as Vec3);
  let faces = mesh.faces.map((f) => [...f]);
  const originalFaceCount = faces.length;

  if (faces.length === 0) {
    return {
      mesh,
      wasSimplified: false,
      originalFaceCount: 0,
      simplifiedFaceCount: 0,
      coplanarGroupsMerged: 0,
      curvatureMergeCount: 0,
      fanVertexMergeCount: 0,
      verticesWelded: 0,
    };
  }

  // --- Phase 0: Vertex Welding ---
  let verticesWelded = 0;

  if (weldVerticesOpt && vertices.length > 0) {
    const epsilon = 1e-5;
    const invEpsilon = 1 / epsilon;

    const getCellKey = (x: number, y: number, z: number) => {
      return `${Math.floor(x * invEpsilon)},${Math.floor(y * invEpsilon)},${Math.floor(z * invEpsilon)}`;
    };

    const spatialGrid = new Map<string, number[]>();
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const key = getCellKey(v[0], v[1], v[2]);
      let arr = spatialGrid.get(key);
      if (!arr) {
        arr = [];
        spatialGrid.set(key, arr);
      }
      arr.push(i);
    }

    const remap = new Int32Array(vertices.length);
    for (let i = 0; i < vertices.length; i++) remap[i] = i;

    const offsets = [-1, 0, 1];
    const isProcessed = new Uint8Array(vertices.length);

    let weldedCount = 0;

    for (let i = 0; i < vertices.length; i++) {
      if (isProcessed[i]) continue;
      const v = vertices[i];

      const cx = Math.floor(v[0] * invEpsilon);
      const cy = Math.floor(v[1] * invEpsilon);
      const cz = Math.floor(v[2] * invEpsilon);

      for (const ox of offsets) {
        for (const oy of offsets) {
          for (const oz of offsets) {
            const key = `${cx + ox},${cy + oy},${cz + oz}`;
            const neighbors = spatialGrid.get(key);
            if (neighbors) {
              for (const n of neighbors) {
                if (n > i && !isProcessed[n]) {
                  const vn = vertices[n];
                  if (distance3(v, vn) < epsilon) {
                    remap[n] = i;
                    isProcessed[n] = 1;
                    weldedCount++;
                  }
                }
              }
            }
          }
        }
      }
    }

    if (weldedCount > 0) {
      verticesWelded = weldedCount;
      const newFaces: number[][] = [];
      for (const face of faces) {
        const remappedFace = face.map(idx => remap[idx]);
        const cleaned = cleanFace(remappedFace);
        if (cleaned.length >= 3) {
          newFaces.push(cleaned);
        }
      }
      faces = newFaces;

      // Dense vertex array rebuild
      const usedVertices = new Map<number, number>();
      const finalWeldVertices: Vec3[] = [];
      const finalWeldFaces: number[][] = [];

      for (const face of faces) {
        const newFace: number[] = [];
        for (const idx of face) {
          if (!usedVertices.has(idx)) {
            usedVertices.set(idx, finalWeldVertices.length);
            finalWeldVertices.push(vertices[idx]);
          }
          newFace.push(usedVertices.get(idx)!);
        }
        finalWeldFaces.push(newFace);
      }
      vertices = finalWeldVertices;
      faces = finalWeldFaces;
    }
  }

  // --- Phase 1: Coplanar Face Merging ---
  const edgeFaces = new Map<string, number[]>();
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i];
    for (let j = 0; j < face.length; j++) {
      const u = face[j];
      const v = face[(j + 1) % face.length];
      const key = Math.min(u, v) + "-" + Math.max(u, v);
      let arr = edgeFaces.get(key);
      if (!arr) {
        arr = [];
        edgeFaces.set(key, arr);
      }
      if (!arr.includes(i)) arr.push(i);
    }
  }

  const uf = new UnionFind(faces.length);
  const thresholdRad = (coplanarAngleThreshold * Math.PI) / 180;
  const faceNormals = faces.map((f) => computeNormal(vertices, f));

  for (const [_, fIds] of edgeFaces.entries()) {
    if (fIds.length === 2) {
      const [f1, f2] = fIds;
      const n1 = faceNormals[f1];
      const n2 = faceNormals[f2];
      let d = dot3(n1, n2);
      if (d > 1) d = 1;
      if (d < -1) d = -1;
      const angle = Math.acos(d);
      if (angle <= thresholdRad) {
        uf.union(f1, f2);
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < faces.length; i++) {
    const root = uf.find(i);
    let arr = groups.get(root);
    if (!arr) {
      arr = [];
      groups.set(root, arr);
    }
    arr.push(i);
  }

  let mergedCount = 0;
  let currentFaces: number[][] = [];

  for (const [_, groupFIds] of groups.entries()) {
    if (groupFIds.length === 1) {
      currentFaces.push(faces[groupFIds[0]]);
      continue;
    }

    const dirEdges = new Map<string, number>();
    for (const fId of groupFIds) {
      const face = faces[fId];
      for (let i = 0; i < face.length; i++) {
        const u = face[i];
        const v = face[(i + 1) % face.length];
        const key = `${u}-${v}`;
        dirEdges.set(key, (dirEdges.get(key) || 0) + 1);
      }
    }

    const boundaryAdjacency = new Map<number, number>();
    let valid = true;
    for (const [key, count] of dirEdges.entries()) {
      const [uStr, vStr] = key.split("-");
      const revKey = `${vStr}-${uStr}`;

      if (!dirEdges.has(revKey)) {
        if (count > 1) {
          valid = false;
          break;
        }
        const u = parseInt(uStr, 10);
        const v = parseInt(vStr, 10);
        if (boundaryAdjacency.has(u)) {
          valid = false;
          break;
        }
        boundaryAdjacency.set(u, v);
      } else {
        if (count !== 1 || dirEdges.get(revKey) !== 1) {
          valid = false;
          break;
        }
      }
    }

    if (!valid || boundaryAdjacency.size === 0) {
      for (const fId of groupFIds) currentFaces.push(faces[fId]);
      continue;
    }

    const loops: number[][] = [];
    const visited = new Set<number>();

    for (const [startNode] of boundaryAdjacency.entries()) {
      if (visited.has(startNode)) continue;
      const loop: number[] = [];
      let curr = startNode;
      let loopValid = true;
      while (true) {
        loop.push(curr);
        visited.add(curr);
        const next = boundaryAdjacency.get(curr);
        if (next === undefined) {
          loopValid = false;
          break;
        }
        if (next === startNode) {
          break;
        }
        if (visited.has(next)) {
          loopValid = false;
          break;
        }
        curr = next;
      }

      if (loopValid && loop.length >= 3) {
        loops.push(loop);
      } else {
        valid = false;
        break;
      }
    }

    if (valid && loops.length > 0) {
      for (const loop of loops) {
        currentFaces.push(loop);
      }
      mergedCount++;
    } else {
      for (const fId of groupFIds) currentFaces.push(faces[fId]);
    }
  }

  // --- Phase 1.5: Curvature-Aware Triangle Pair Merging ---
  const curvatureThresholdRad = (curvatureAngleThreshold * Math.PI) / 180;
  let curvatureMergeCount = 0;
  let pass15 = 0;

  while (pass15 < 20) {
    pass15++;

    const edgeFacesMap15 = new Map<string, number[]>();
    for (let i = 0; i < currentFaces.length; i++) {
      const face = currentFaces[i];
      for (let j = 0; j < face.length; j++) {
        const u = face[j];
        const v = face[(j + 1) % face.length];
        const key = Math.min(u, v) + "-" + Math.max(u, v);
        let arr = edgeFacesMap15.get(key);
        if (!arr) {
          arr = [];
          edgeFacesMap15.set(key, arr);
        }
        if (!arr.includes(i)) arr.push(i);
      }
    }

    const currentFaceNormals15 = currentFaces.map((f) => computeNormal(vertices, f));

    interface MergeCandidate {
      f1: number;
      f2: number;
      angle: number;
    }
    const candidates: MergeCandidate[] = [];

    for (const [key, fIds] of edgeFacesMap15.entries()) {
      if (fIds.length === 2) {
        const f1 = fIds[0];
        const f2 = fIds[1];
        const n1 = currentFaceNormals15[f1];
        const n2 = currentFaceNormals15[f2];
        let d = dot3(n1, n2);
        if (d > 1) d = 1;
        if (d < -1) d = -1;
        const angle = Math.acos(d);
        if (angle <= curvatureThresholdRad) {
          candidates.push({
            f1,
            f2,
            angle,
          });
        }
      }
    }

    if (candidates.length === 0) break;

    candidates.sort((a, b) => a.angle - b.angle);

    const mergedFacesThisPass = new Set<number>();
    let mergedInPass = 0;
    const nextFaces: number[][] = [];

    for (const cand of candidates) {
      if (mergedFacesThisPass.has(cand.f1) || mergedFacesThisPass.has(cand.f2)) continue;

      const face1 = currentFaces[cand.f1];
      const face2 = currentFaces[cand.f2];

      const dirEdges = new Map<string, number>();
      for (const face of [face1, face2]) {
        for (let i = 0; i < face.length; i++) {
          const u = face[i];
          const v = face[(i + 1) % face.length];
          const key = `${u}-${v}`;
          dirEdges.set(key, (dirEdges.get(key) || 0) + 1);
        }
      }

      const boundaryAdjacency = new Map<number, number>();
      let valid = true;
      for (const [key, count] of dirEdges.entries()) {
        const [uStr, vStr] = key.split("-");
        const revKey = `${vStr}-${uStr}`;

        if (!dirEdges.has(revKey)) {
          if (count > 1) {
            valid = false;
            break;
          }
          const u = parseInt(uStr, 10);
          const v = parseInt(vStr, 10);
          if (boundaryAdjacency.has(u)) {
            valid = false;
            break;
          }
          boundaryAdjacency.set(u, v);
        } else {
          if (count !== 1 || dirEdges.get(revKey) !== 1) {
            valid = false;
            break;
          }
        }
      }

      if (!valid || boundaryAdjacency.size === 0) continue;

      const loop: number[] = [];
      const startNodeIter = boundaryAdjacency.keys().next();
      if (startNodeIter.done) continue;
      const startNode = startNodeIter.value;

      let curr = startNode;
      const visited = new Set<number>();
      let loopValid = true;

      while (true) {
        loop.push(curr);
        visited.add(curr);
        const next = boundaryAdjacency.get(curr);
        if (next === undefined) {
          loopValid = false;
          break;
        }
        if (next === startNode) {
          break;
        }
        if (visited.has(next)) {
          loopValid = false;
          break;
        }
        curr = next;
      }

      if (loopValid && loop.length >= 3 && loop.length === boundaryAdjacency.size) {
        if (!isPolygonPlanar(vertices, loop, 1.0)) continue;
        nextFaces.push(loop);
        mergedFacesThisPass.add(cand.f1);
        mergedFacesThisPass.add(cand.f2);
        mergedInPass++;
        curvatureMergeCount++;
      }
    }

    if (mergedInPass === 0) break;

    for (let i = 0; i < currentFaces.length; i++) {
      if (!mergedFacesThisPass.has(i)) {
        nextFaces.push(currentFaces[i]);
      }
    }

    currentFaces = nextFaces;
  }

  // --- Phase 1.75: Fan Vertex Merging ---
  let fanVertexMergeCount = 0;

  const vertexToFaces = new Map<number, number[]>();
  for (let i = 0; i < currentFaces.length; i++) {
    for (const v of currentFaces[i]) {
      let arr = vertexToFaces.get(v);
      if (!arr) {
        arr = [];
        vertexToFaces.set(v, arr);
      }
      arr.push(i);
    }
  }

    const fanVertices = [];
  for (const [v, fIds] of vertexToFaces.entries()) {
    if (fIds.length >= 4) {
      fanVertices.push({ v, fIds });
    }
  }
  fanVertices.sort((a, b) => b.fIds.length - a.fIds.length);

  const consumedFaces = new Set<number>();
  const newMergedPolygons: number[][] = [];

  for (const fan of fanVertices) {
    const V = fan.v;
    const unconsumedFIds = fan.fIds.filter((fId) => !consumedFaces.has(fId));
    if (unconsumedFIds.length < 4) continue;

    // Build circular order
    const faceInfo = new Map<number, { prevV: number; nextV: number }>();
    for (const fId of unconsumedFIds) {
      const face = currentFaces[fId];
      const idx = face.indexOf(V);
      const prevV = face[(idx - 1 + face.length) % face.length];
      const nextV = face[(idx + 1) % face.length];
      faceInfo.set(fId, { prevV, nextV });
    }

    const chain: number[] = [];
    const currFId = unconsumedFIds[0];
    const startPrevV = faceInfo.get(currFId)!.prevV;
    let currNextV = faceInfo.get(currFId)!.nextV;
    chain.push(currFId);

    let validChain = true;
    while (chain.length < unconsumedFIds.length) {
      let foundNext = -1;
      for (const [fId, info] of faceInfo.entries()) {
        if (!chain.includes(fId) && info.prevV === currNextV) {
          foundNext = fId;
          break;
        }
      }
      if (foundNext === -1) {
        validChain = false;
        break;
      }
      chain.push(foundNext);
      currNextV = faceInfo.get(foundNext)!.nextV;
    }

    if (!validChain || currNextV !== startPrevV) {
      continue;
    }

    const chainLength = chain.length;
    const numGroups = Math.min(6, chainLength);
    const groupSize = Math.ceil(chainLength / numGroups);

    for (let i = 0; i < chainLength; i += groupSize) {
      const groupFIds = chain.slice(i, i + groupSize);
      if (groupFIds.length > 1) {
        const dirEdges = new Map<string, number>();
        for (const fId of groupFIds) {
          const face = currentFaces[fId];
          for (let j = 0; j < face.length; j++) {
            const u = face[j];
            const v = face[(j + 1) % face.length];
            const key = `${u}-${v}`;
            dirEdges.set(key, (dirEdges.get(key) || 0) + 1);
          }
        }

        const boundaryAdjacency = new Map<number, number>();
        let valid = true;
        for (const [key, count] of dirEdges.entries()) {
          const [uStr, vStr] = key.split("-");
          const revKey = `${vStr}-${uStr}`;
          if (!dirEdges.has(revKey)) {
            if (count > 1) {
              valid = false;
              break;
            }
            const u = parseInt(uStr, 10);
            const v = parseInt(vStr, 10);
            if (boundaryAdjacency.has(u)) {
              valid = false;
              break;
            }
            boundaryAdjacency.set(u, v);
          } else {
            if (count !== 1 || dirEdges.get(revKey) !== 1) {
              valid = false;
              break;
            }
          }
        }

        if (!valid || boundaryAdjacency.size === 0) continue;

        const loop: number[] = [];
        const startNodeIter = boundaryAdjacency.keys().next();
        if (startNodeIter.done) continue;
        const startNode = startNodeIter.value;

        let curr = startNode;
        const visited = new Set<number>();
        let loopValid = true;

        while (true) {
          loop.push(curr);
          visited.add(curr);
          const next = boundaryAdjacency.get(curr);
          if (next === undefined) {
            loopValid = false;
            break;
          }
          if (next === startNode) break;
          if (visited.has(next)) {
            loopValid = false;
            break;
          }
          curr = next;
        }

        if (loopValid && loop.length >= 3 && loop.length === boundaryAdjacency.size) {
          if (!isPolygonPlanar(vertices, loop, 1.0)) continue;
          newMergedPolygons.push(loop);
          for (const fId of groupFIds) {
            consumedFaces.add(fId);
          }
          fanVertexMergeCount++;
        }
      }
    }
  }

  if (consumedFaces.size > 0) {
    const nextFaces: number[][] = [];
    for (let i = 0; i < currentFaces.length; i++) {
      if (!consumedFaces.has(i)) {
        nextFaces.push(currentFaces[i]);
      }
    }
    for (const poly of newMergedPolygons) {
      nextFaces.push(poly);
    }
    currentFaces = nextFaces;
  }

  // --- Phase 2: Edge Collapse Decimation ---
  const activeFaces = new Array(currentFaces.length).fill(true);
  let activeFaceCount = currentFaces.length;

  if (activeFaceCount > maxFaces) {
    let pass = 0;
    while (activeFaceCount > maxFaces && pass < 10) {
      pass++;

      const vertexFaces = new Map<number, Set<number>>();
      for (let i = 0; i < currentFaces.length; i++) {
        if (!activeFaces[i]) continue;
        for (const v of currentFaces[i]) {
          if (!vertexFaces.has(v)) vertexFaces.set(v, new Set());
          vertexFaces.get(v)!.add(i);
        }
      }

      const edgeFacesMap = new Map<string, number[]>();
      for (let i = 0; i < currentFaces.length; i++) {
        if (!activeFaces[i]) continue;
        const face = currentFaces[i];
        for (let j = 0; j < face.length; j++) {
          const u = face[j];
          const v = face[(j + 1) % face.length];
          const key = Math.min(u, v) + "-" + Math.max(u, v);
          if (!edgeFacesMap.has(key)) edgeFacesMap.set(key, []);
          const arr = edgeFacesMap.get(key)!;
          if (!arr.includes(i)) arr.push(i);
        }
      }

      const currentFaceNormals = new Map<number, Vec3>();
      for (let i = 0; i < currentFaces.length; i++) {
        if (activeFaces[i]) {
          currentFaceNormals.set(i, computeNormal(vertices, currentFaces[i]));
        }
      }

      interface EdgeData {
        u: number;
        v: number;
        cost: number;
      }
      const edgesList: EdgeData[] = [];

      for (const [key, fIds] of edgeFacesMap.entries()) {
        const [uStr, vStr] = key.split("-");
        const u = parseInt(uStr, 10);
        const v = parseInt(vStr, 10);
        const len = distance3(vertices[u], vertices[v]);

        let cost = Infinity;
        if (fIds.length === 1) {
          if (!preserveBoundary) {
            cost = len * 10;
          }
        } else if (fIds.length === 2) {
          const n1 = currentFaceNormals.get(fIds[0])!;
          const n2 = currentFaceNormals.get(fIds[1])!;
          let d = dot3(n1, n2);
          if (d > 1) d = 1;
          if (d < -1) d = -1;
          const angle = Math.acos(d);
          cost = len * (angle + 0.1);
        }

        if (cost < Infinity) {
          edgesList.push({ u, v, cost });
        }
      }

      edgesList.sort((a, b) => a.cost - b.cost);

      const modifiedVertices = new Set<number>();
      let collapsedInPass = 0;

      for (const edge of edgesList) {
        if (activeFaceCount <= maxFaces) break;
        if (modifiedVertices.has(edge.u) || modifiedVertices.has(edge.v)) continue;

        const u = edge.u;
        const v = edge.v;

        const pU = vertices[u];
        const pV = vertices[v];
        vertices[u] = [
          (pU[0] + pV[0]) / 2,
          (pU[1] + pV[1]) / 2,
          (pU[2] + pV[2]) / 2,
        ];

        modifiedVertices.add(u);
        modifiedVertices.add(v);
        collapsedInPass++;

        const vFaces = vertexFaces.get(v) || new Set();
        for (const fId of vFaces) {
          if (!activeFaces[fId]) continue;
          const face = currentFaces[fId];
          const newFace = [];
          for (let j = 0; j < face.length; j++) {
            newFace.push(face[j] === v ? u : face[j]);
          }

          const cleaned = cleanFace(newFace);
          if (cleaned.length < 3) {
            activeFaces[fId] = false;
            activeFaceCount--;
          } else {
            currentFaces[fId] = cleaned;
            vertexFaces.get(u)?.add(fId);
          }
        }
        vertexFaces.set(v, new Set());
      }

      const seenHashes = new Set<string>();
      for (let i = 0; i < currentFaces.length; i++) {
        if (!activeFaces[i]) continue;
        const hash = [...currentFaces[i]].sort((a, b) => a - b).join("-");
        if (seenHashes.has(hash)) {
          activeFaces[i] = false;
          activeFaceCount--;
        } else {
          seenHashes.add(hash);
        }
      }

      if (collapsedInPass === 0) break;
    }
  }

  // --- Final Cleanup ---
  const finalFaces: number[][] = [];
  for (let i = 0; i < currentFaces.length; i++) {
    if (activeFaces[i]) finalFaces.push(currentFaces[i]);
  }

  const usedVertices = new Map<number, number>();
  const finalVertices: Vec3[] = [];
  const mappedFaces: number[][] = [];

  for (const face of finalFaces) {
    const newFace: number[] = [];
    for (const v of face) {
      if (!usedVertices.has(v)) {
        usedVertices.set(v, finalVertices.length);
        finalVertices.push(vertices[v]);
      }
      newFace.push(usedVertices.get(v)!);
    }
    mappedFaces.push(newFace);
  }

  const simplifiedFaceCount = mappedFaces.length;
  const wasSimplified = simplifiedFaceCount < originalFaceCount || mergedCount > 0 || verticesWelded > 0 || curvatureMergeCount > 0 || fanVertexMergeCount > 0;

  return {
    mesh: {
      vertices: finalVertices,
      faces: mappedFaces,
    },
    wasSimplified,
    originalFaceCount,
    simplifiedFaceCount,
    coplanarGroupsMerged: mergedCount,
    curvatureMergeCount,
    fanVertexMergeCount,
    verticesWelded,
  };
}