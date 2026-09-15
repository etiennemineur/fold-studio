import { FoldData } from "./foldEngine";

export interface CollisionResult {
  collidingFaces: Set<number>;
  collisionPairs: [number, number][];
  hasCollisions: boolean;
}

type Vec3 = [number, number, number];

// Internal vector math utilities to avoid heavy external dependencies
function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0]
  ];
}

/**
 * Möller–Trumbore inspired edge-piercing test to check if the segment pq intersects the triangle v0,v1,v2.
 */
function segmentTriangleIntersect(p: Vec3, q: Vec3, v0: Vec3, v1: Vec3, v2: Vec3): boolean {
  const dir = sub(q, p);
  const edge1 = sub(v1, v0);
  const edge2 = sub(v2, v0);
  const pvec = cross(dir, edge2);
  const det = dot(edge1, pvec);
  
  // Back-face culling is disabled (double sided paper)
  const EPSILON = 1e-6;
  if (Math.abs(det) < EPSILON) return false;
  
  const invDet = 1.0 / det;
  const tvec = sub(p, v0);
  const u = dot(tvec, pvec) * invDet;
  
  if (u < -EPSILON || u > 1.0 + EPSILON) return false;

  const qvec = cross(tvec, edge1);
  const v = dot(dir, qvec) * invDet;
  
  if (v < -EPSILON || u + v > 1.0 + EPSILON) return false;

  const t = dot(edge2, qvec) * invDet;
  
  // Ensure the segment actively pierces the face within its finite bounds, skipping strictly grazing borders.
  if (t > EPSILON && t < 1.0 - EPSILON) return true;

  return false;
}

/**
 * Validates intersection between two triangulated sub-meshes by evaluating mutual piercing of edges.
 */
function trianglesIntersect(t1: [Vec3, Vec3, Vec3], t2: [Vec3, Vec3, Vec3]): boolean {
  return segmentTriangleIntersect(t1[0], t1[1], t2[0], t2[1], t2[2]) ||
         segmentTriangleIntersect(t1[1], t1[2], t2[0], t2[1], t2[2]) ||
         segmentTriangleIntersect(t1[2], t1[0], t2[0], t2[1], t2[2]) ||
         segmentTriangleIntersect(t2[0], t2[1], t1[0], t1[1], t1[2]) ||
         segmentTriangleIntersect(t2[1], t2[2], t1[0], t1[1], t1[2]) ||
         segmentTriangleIntersect(t2[2], t2[0], t1[0], t1[1], t1[2]);
}

/**
 * Cheap initial volume overlap test.
 */
function aabbOverlap(b1: {min: number[], max: number[]}, b2: {min: number[], max: number[]}) {
  const eps = 1e-5;
  if (b1.max[0] < b2.min[0] - eps || b1.min[0] > b2.max[0] + eps) return false;
  if (b1.max[1] < b2.min[1] - eps || b1.min[1] > b2.max[1] + eps) return false;
  if (b1.max[2] < b2.min[2] - eps || b1.min[2] > b2.max[2] + eps) return false;
  return true;
}

export function collisionDetection(
  foldData: FoldData, 
  vertexMap: Map<number, [number, number, number]>
): CollisionResult {
  const collidingFaces = new Set<number>();
  const collisionPairs: [number, number][] = [];

  const faceVerticesSet = foldData.facesVertices.map(face => new Set(face));

  // Determine contiguous topology to skip structural neighbors (hinged faces never 'collide' physically at their hinge line).
  function areAdjacent(f1: number, f2: number) {
    for (const v of foldData.facesVertices[f1]) {
      if (faceVerticesSet[f2].has(v)) return true;
    }
    return false;
  }

  // Pre-triangulate arbitrary N-gons into planar triangulated subsets using a basic Fan implementation.
  const faceTriangles: [Vec3, Vec3, Vec3][][] = [];
  foldData.facesVertices.forEach(face => {
    const tris: [Vec3, Vec3, Vec3][] = [];
    if (face.length < 3) {
      faceTriangles.push(tris);
      return;
    }
    const rawV0 = vertexMap.get(face[0]) || foldData.verticesCoords[face[0]];
    const v0: Vec3 = [rawV0[0], rawV0[1], rawV0[2] ?? 0];

    for (let i = 1; i < face.length - 1; i++) {
      const rawV1 = vertexMap.get(face[i]) || foldData.verticesCoords[face[i]];
      const v1: Vec3 = [rawV1[0], rawV1[1], rawV1[2] ?? 0];
      
      const rawV2 = vertexMap.get(face[i + 1]) || foldData.verticesCoords[face[i + 1]];
      const v2: Vec3 = [rawV2[0], rawV2[1], rawV2[2] ?? 0];

      tris.push([v0, v1, v2]);
    }
    faceTriangles.push(tris);
  });

  const faceBBoxes = faceTriangles.map(tris => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    tris.forEach(tri => {
      tri.forEach(v => {
        min[0] = Math.min(min[0], v[0]);
        min[1] = Math.min(min[1], v[1]);
        min[2] = Math.min(min[2], v[2]);
        max[0] = Math.max(max[0], v[0]);
        max[1] = Math.max(max[1], v[1]);
        max[2] = Math.max(max[2], v[2]);
      });
    });
    return { min, max };
  });

  // Evaluate topological bounds scaling O(N^2) over non-adjacent isolated groupings.
  for (let i = 0; i < faceTriangles.length; i++) {
    for (let j = i + 1; j < faceTriangles.length; j++) {
      if (areAdjacent(i, j)) continue;
      if (!aabbOverlap(faceBBoxes[i], faceBBoxes[j])) continue;

      const trisA = faceTriangles[i];
      const trisB = faceTriangles[j];
      let intersected = false;

      for (const tA of trisA) {
        for (const tB of trisB) {
          if (trianglesIntersect(tA, tB)) {
            intersected = true;
            break;
          }
        }
        if (intersected) break;
      }

      if (intersected) {
        collidingFaces.add(i);
        collidingFaces.add(j);
        collisionPairs.push([i, j]);
      }
    }
  }

  return {
    collidingFaces,
    collisionPairs,
    hasCollisions: collisionPairs.length > 0
  };
}