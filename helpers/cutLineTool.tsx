import { FoldData } from "./foldEngine";

export type FaceCrossing = {
  faceIndex: number;
  entryPoint: [number, number];
  exitPoint: [number, number];
  entryEdgeLocalIdx: number | null;
  exitEdgeLocalIdx: number | null;
  entrySnappedVertexIdx: number | null;
  exitSnappedVertexIdx: number | null;
};

/**
 * Computes the 2D Euclidean distance between two points.
 */
function dist2D(a: [number, number], b: [number, number]): number {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}

/**
 * Returns the intersection point of two line segments, or null if they don't intersect.
 * Uses parametric equations and a small epsilon (1e-9) for numerical stability.
 */
export function segmentIntersection(
  a1: [number, number],
  a2: [number, number],
  b1: [number, number],
  b2: [number, number]
): [number, number] | null {
  const denom = (b2[1] - b1[1]) * (a2[0] - a1[0]) - (b2[0] - b1[0]) * (a2[1] - a1[1]);
  
  if (Math.abs(denom) < 1e-9) {
    return null; // Lines are parallel or collinear
  }
  
  const ua = ((b2[0] - b1[0]) * (a1[1] - b1[1]) - (b2[1] - b1[1]) * (a1[0] - b1[0])) / denom;
  const ub = ((a2[0] - a1[0]) * (a1[1] - b1[1]) - (a2[1] - a1[1]) * (a1[0] - b1[0])) / denom;
  
  // Allow a tiny tolerance for intersections exactly at segment endpoints
  if (ua >= -1e-9 && ua <= 1 + 1e-9 && ub >= -1e-9 && ub <= 1 + 1e-9) {
    return [
      a1[0] + ua * (a2[0] - a1[0]),
      a1[1] + ua * (a2[1] - a1[1])
    ];
  }
  
  return null;
}

/**
 * Finds all faces that a single line segment crosses.
 * A face is considered crossed if the segment intersects its boundaries at exactly 2 points.
 * Handles snapping to vertices if the cut is within 1mm.
 */
export function findFaceCrossings(
  foldData: FoldData,
  p1: [number, number],
  p2: [number, number]
): FaceCrossing[] {
  const crossings: FaceCrossing[] = [];
  
  for (let i = 0; i < foldData.facesVertices.length; i++) {
    const face = foldData.facesVertices[i];
    if (!face || face.length < 3) continue;
    
    // 1. Gather all raw intersections with the polygon edges
    const rawIntersections: { pt: [number, number]; edgeIdx: number }[] = [];
    for (let j = 0; j < face.length; j++) {
      const v1Idx = face[j];
      const v2Idx = face[(j + 1) % face.length];
      const v1 = foldData.verticesCoords[v1Idx];
      const v2 = foldData.verticesCoords[v2Idx];
      
      const ix = segmentIntersection(p1, p2, [v1[0], v1[1]], [v2[0], v2[1]]);
      if (ix) {
        rawIntersections.push({ pt: ix, edgeIdx: j });
      }
    }
    
    // 2. Deduplicate intersections and snap them to existing vertices (1mm tolerance)
    const uniqueIntersections: { pt: [number, number]; snappedIdx: number | null; edgeIdx: number | null }[] = [];
    
    for (const ix of rawIntersections) {
      // Deduplicate numerically identical points (e.g. exactly at a shared vertex)
      let isDuplicate = false;
      for (const unique of uniqueIntersections) {
        if (dist2D(ix.pt, unique.pt) < 1e-5) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) continue;
      
      // Snap to face vertices
      let snappedVertexIdx: number | null = null;
      for (let j = 0; j < face.length; j++) {
        const vj = foldData.verticesCoords[face[j]];
        if (dist2D(ix.pt, [vj[0], vj[1]]) <= 1.0) { // 1mm snap tolerance
          snappedVertexIdx = j;
          ix.pt = [vj[0], vj[1]]; // Perfect snap
          break;
        }
      }
      
      if (snappedVertexIdx !== null) {
        uniqueIntersections.push({ pt: ix.pt, snappedIdx: snappedVertexIdx, edgeIdx: null });
      } else {
        uniqueIntersections.push({ pt: ix.pt, snappedIdx: null, edgeIdx: ix.edgeIdx });
      }
    }
    
    // 3. A valid cut must enter and exit the polygon (exactly 2 unique intersection points)
    if (uniqueIntersections.length === 2) {
      // Sort by distance to p1 to determine entry [0] and exit [1]
      uniqueIntersections.sort((a, b) => dist2D(p1, a.pt) - dist2D(p1, b.pt));
      
      const entry = uniqueIntersections[0];
      const exit = uniqueIntersections[1];
      
      // Degeneracy check: skip if the cut runs exactly along an existing face edge
      let isDegenerate = false;
      if (entry.snappedIdx !== null && exit.snappedIdx !== null) {
        if ((entry.snappedIdx + 1) % face.length === exit.snappedIdx) isDegenerate = true;
        if ((exit.snappedIdx + 1) % face.length === entry.snappedIdx) isDegenerate = true;
      }
      
      if (!isDegenerate) {
        crossings.push({
          faceIndex: i,
          entryPoint: entry.pt,
          exitPoint: exit.pt,
          entryEdgeLocalIdx: entry.edgeIdx,
          exitEdgeLocalIdx: exit.edgeIdx,
          entrySnappedVertexIdx: entry.snappedIdx,
          exitSnappedVertexIdx: exit.snappedIdx
        });
      }
    }
  }
  
  // Sort overall face crossings by distance from p1 to ensure topological operations happen sequentially
  crossings.sort((a, b) => dist2D(p1, a.entryPoint) - dist2D(p1, b.entryPoint));
  
  return crossings;
}

/**
 * Utility to split an existing edge by introducing a new vertex.
 * Returns the global vertex index of the newly inserted vertex.
 */
function splitEdge(foldData: FoldData, vA_idx: number, vB_idx: number, pt2D: [number, number]): number {
  const vA = foldData.verticesCoords[vA_idx];
  const vB = foldData.verticesCoords[vB_idx];
  
  // Interpolate Z-coordinate based on 2D position ratio
  const distAB = dist2D(vA as [number, number], vB as [number, number]);
  const distAP = dist2D(vA as [number, number], pt2D);
  const t = distAB > 1e-9 ? distAP / distAB : 0;
  
  const zA = vA[2] ?? 0;
  const zB = vB[2] ?? 0;
  const ptZ = zA + t * (zB - zA);
  
  // Push new vertex
  foldData.verticesCoords.push([pt2D[0], pt2D[1], ptZ]);
  const vNew_idx = foldData.verticesCoords.length - 1;
  
  // 1. Update the edges definition list
  const edgeIndex = foldData.edgesVertices.findIndex(e => 
    (e[0] === vA_idx && e[1] === vB_idx) || 
    (e[0] === vB_idx && e[1] === vA_idx)
  );
  
  if (edgeIndex !== -1) {
    const assignment = foldData.edgesAssignment[edgeIndex];
    const angle = foldData.edgesFoldAngle[edgeIndex];
    
    // Remove the original edge
    foldData.edgesVertices.splice(edgeIndex, 1);
    foldData.edgesAssignment.splice(edgeIndex, 1);
    foldData.edgesFoldAngle.splice(edgeIndex, 1);
    
    // Insert the two split halves
    foldData.edgesVertices.push([vA_idx, vNew_idx]);
    foldData.edgesAssignment.push(assignment);
    foldData.edgesFoldAngle.push(angle);
    
    foldData.edgesVertices.push([vNew_idx, vB_idx]);
    foldData.edgesAssignment.push(assignment);
    foldData.edgesFoldAngle.push(angle);
  }
  
  // 2. Update all faces that include this edge sequentially
  for (let i = 0; i < foldData.facesVertices.length; i++) {
    const face = foldData.facesVertices[i];
    if (!face) continue;
    
    const idxA = face.indexOf(vA_idx);
    const idxB = face.indexOf(vB_idx);
    
    if (idxA !== -1 && idxB !== -1) {
      const len = face.length;
      if ((idxA + 1) % len === idxB) {
        // vB comes directly after vA
        face.splice(idxA + 1, 0, vNew_idx);
      } else if ((idxB + 1) % len === idxA) {
        // vA comes directly after vB
        face.splice(idxB + 1, 0, vNew_idx);
      }
    }
  }
  
  return vNew_idx;
}

/**
 * Splits a single face into two faces along the cut line (entry to exit).
 * Updates vertices, splits edges, adds a new internal boundary edge, and mutates FoldData in place.
 */
export function splitFaceAtCut(
  foldData: FoldData,
  faceIndex: number,
  entryPoint: [number, number],
  exitPoint: [number, number],
  entryEdgeLocalIdx: number | null,
  exitEdgeLocalIdx: number | null,
  entrySnappedVertexIdx: number | null = null,
  exitSnappedVertexIdx: number | null = null,
  assignment: 'M' | 'V' | 'B' | 'F' = 'V',
  foldAngle: number = 90
): FoldData {
  // Capture a snapshot of original face vertices because edge splitting mutates the array
  const originalFace = [...foldData.facesVertices[faceIndex]];
  
  // Resolve Entry Global Index
  let entryGlobalIdx = -1;
  if (entryEdgeLocalIdx !== null) {
    const vA = originalFace[entryEdgeLocalIdx];
    const vB = originalFace[(entryEdgeLocalIdx + 1) % originalFace.length];
    entryGlobalIdx = splitEdge(foldData, vA, vB, entryPoint);
  } else if (entrySnappedVertexIdx !== null) {
    entryGlobalIdx = originalFace[entrySnappedVertexIdx];
  }
  
  // Resolve Exit Global Index
  let exitGlobalIdx = -1;
  if (exitEdgeLocalIdx !== null) {
    const vA = originalFace[exitEdgeLocalIdx];
    const vB = originalFace[(exitEdgeLocalIdx + 1) % originalFace.length];
    exitGlobalIdx = splitEdge(foldData, vA, vB, exitPoint);
  } else if (exitSnappedVertexIdx !== null) {
    exitGlobalIdx = originalFace[exitSnappedVertexIdx];
  }
  
  // Retrieve the updated face (since splitEdge added vertices in-place)
  const updatedFace = foldData.facesVertices[faceIndex];
  const idxA = updatedFace.indexOf(entryGlobalIdx);
  const idxB = updatedFace.indexOf(exitGlobalIdx);
  
  if (idxA === -1 || idxB === -1 || idxA === idxB) {
    return foldData; // Fallback for invalid geometry combinations
  }
  
  // Traverse CCW for Face A (from entry to exit)
  const faceA: number[] = [];
  for (let i = idxA; i !== idxB; i = (i + 1) % updatedFace.length) {
    faceA.push(updatedFace[i]);
  }
  faceA.push(updatedFace[idxB]);
  
  // Traverse CCW for Face B (from exit to entry)
  const faceB: number[] = [];
  for (let i = idxB; i !== idxA; i = (i + 1) % updatedFace.length) {
    faceB.push(updatedFace[i]);
  }
  faceB.push(updatedFace[idxA]);
  
  // Modify topological list: replace original face with Face A, push Face B
  foldData.facesVertices[faceIndex] = faceA;
  foldData.facesVertices.push(faceB);
  
  // Register the new internal edge that cuts the surface
  foldData.edgesVertices.push([entryGlobalIdx, exitGlobalIdx]);
  foldData.edgesAssignment.push(assignment);
  foldData.edgesFoldAngle.push(foldAngle);
  
  return foldData;
}

/**
 * Iteratively applies a series of segment cuts to the foldData.
 * Returns a new structural copy with modified geometry.
 */
export function removeFoldEdge(
  foldData: FoldData,
  edgeIndex: number
): { foldData: FoldData; success: boolean } {
  const fd = JSON.parse(JSON.stringify(foldData)) as FoldData;

  if (edgeIndex < 0 || edgeIndex >= fd.edgesVertices.length) {
    return { foldData: fd, success: false };
  }

  const assignment = fd.edgesAssignment[edgeIndex];
  if (assignment !== "M" && assignment !== "V") {
    return { foldData: fd, success: false };
  }

  const [vA, vB] = fd.edgesVertices[edgeIndex];

  // Find exactly 2 faces that share this edge
  const adjacentFaces: { faceIndex: number; u: number; v: number; uIdx: number; vIdx: number }[] = [];

  for (let i = 0; i < fd.facesVertices.length; i++) {
    const face = fd.facesVertices[i];
    if (!face) continue;
    const len = face.length;
    for (let j = 0; j < len; j++) {
      const u = face[j];
      const v = face[(j + 1) % len];
      if ((u === vA && v === vB) || (u === vB && v === vA)) {
        adjacentFaces.push({ faceIndex: i, u, v, uIdx: j, vIdx: (j + 1) % len });
        break;
      }
    }
  }

  if (adjacentFaces.length !== 2) {
    return { foldData: fd, success: false };
  }

  const faceAInfo = adjacentFaces[0];
  const faceBInfo = adjacentFaces[1];

  const faceA = fd.facesVertices[faceAInfo.faceIndex];
  const faceB = fd.facesVertices[faceBInfo.faceIndex];

  const sharedFrom = faceAInfo.u;
  const sharedTo = faceAInfo.v;
  const posFirst = faceAInfo.uIdx;
  const posSecond = faceAInfo.vIdx;

  const mergedFace: number[] = [];

  let currA = (posSecond + 1) % faceA.length;
  while (currA !== posFirst) {
    mergedFace.push(faceA[currA]);
    currA = (currA + 1) % faceA.length;
  }

  mergedFace.push(sharedFrom);

  const posFromInB = faceB.indexOf(sharedFrom);
  const posToInB = faceB.indexOf(sharedTo);

  if (posFromInB === -1 || posToInB === -1) {
    return { foldData: fd, success: false };
  }

  let currB = (posFromInB + 1) % faceB.length;
  while (currB !== posToInB) {
    mergedFace.push(faceB[currB]);
    currB = (currB + 1) % faceB.length;
  }

  mergedFace.push(sharedTo);

  const lowerIdx = Math.min(faceAInfo.faceIndex, faceBInfo.faceIndex);
  const higherIdx = Math.max(faceAInfo.faceIndex, faceBInfo.faceIndex);

  fd.facesVertices[lowerIdx] = mergedFace;
  fd.facesVertices.splice(higherIdx, 1);

  fd.edgesVertices.splice(edgeIndex, 1);
  fd.edgesAssignment.splice(edgeIndex, 1);
  fd.edgesFoldAngle.splice(edgeIndex, 1);

  return { foldData: fd, success: true };
}

export function applyCutLine(
  foldData: FoldData,
  linePoints: [number, number][],
  options?: { assignment?: 'M' | 'V' | 'B' | 'F'; foldAngle?: number }
): { foldData: FoldData; cutCount: number } {
  // Deep clone to prevent unintended side-effects on original geometry data
  const fd = JSON.parse(JSON.stringify(foldData)) as FoldData;
  let cutCount = 0;
  
  for (let i = 0; i < linePoints.length - 1; i++) {
    const p1 = linePoints[i];
    const p2 = linePoints[i + 1];
    
    let segmentDidCut = true;
    
    // Since cutting mutates the topological structure, iteratively find new crossings
    // on the continuously updated foldData until no valid crossings remain for this segment
    while (segmentDidCut) {
      segmentDidCut = false;
      const crossings = findFaceCrossings(fd, p1, p2);
      
      if (crossings.length > 0) {
        // Take the closest crossing and cut it immediately.
        // It's vital to do this one at a time because the crossing invalidates subsequent face topologies.
        const first = crossings[0];
        
        splitFaceAtCut(
          fd,
          first.faceIndex,
          first.entryPoint,
          first.exitPoint,
          first.entryEdgeLocalIdx,
          first.exitEdgeLocalIdx,
          first.entrySnappedVertexIdx,
          first.exitSnappedVertexIdx,
          options?.assignment,
          options?.foldAngle
        );
        
        cutCount++;
        segmentDidCut = true;
      }
    }
  }
  
  return { foldData: fd, cutCount };
}