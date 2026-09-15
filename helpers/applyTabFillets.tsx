import { FoldData, buildFaceTree, FaceTreeNode } from "./foldEngine";

type Vec3 = [number, number, number?];

/**
 * Computes a rounded fillet arc at a given corner.
 * Geometrically bounds the fillet size so it doesn't cross the midpoint of adjacent edges.
 */
function computeFillet(
  vPrev: Vec3,
  vC: Vec3,
  vNext: Vec3,
  radius: number,
  segments: number
): Vec3[] {
  const dir1 = [vPrev[0] - vC[0], vPrev[1] - vC[1]];
  const dir2 = [vNext[0] - vC[0], vNext[1] - vC[1]];
  
  const len1 = Math.sqrt(dir1[0] ** 2 + dir1[1] ** 2);
  const len2 = Math.sqrt(dir2[0] ** 2 + dir2[1] ** 2);
  
  // If adjacent edges are effectively zero length, skip filleting
  if (len1 < 1e-6 || len2 < 1e-6) return [vC]; 
  
  dir1[0] /= len1; 
  dir1[1] /= len1;
  dir2[0] /= len2; 
  dir2[1] /= len2;
  
  const dot = dir1[0] * dir2[0] + dir1[1] * dir2[1];
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  
  // If collinear or straight line, skip filleting
  if (theta < 1e-4 || Math.abs(theta - Math.PI) < 1e-4) return [vC]; 
  
  const alpha = theta / 2;
  const tanAlpha = Math.tan(alpha);
  
  if (tanAlpha < 1e-6) return [vC];

  // d is the distance from corner to tangent point
  let d = radius / tanAlpha;
  
  // Clamp d so fillets don't overlap on short edges
  const dMax = Math.min(len1 / 2, len2 / 2);
  
  let r = radius;
  if (d > dMax) {
    d = dMax;
    r = d * tanAlpha;
  }
  
  const getVec3 = (x: number, y: number): Vec3 => vC[2] !== undefined ? [x, y, vC[2]] : [x, y];

  // Tangent points on the adjacent edges
  const t1 = getVec3(vC[0] + dir1[0] * d, vC[1] + dir1[1] * d);
  const t2 = getVec3(vC[0] + dir2[0] * d, vC[1] + dir2[1] * d);
  
  // Angle bisector towards the interior of the corner
  const bisector = [dir1[0] + dir2[0], dir1[1] + dir2[1]];
  const bLen = Math.sqrt(bisector[0] ** 2 + bisector[1] ** 2);
  if (bLen < 1e-6) return [vC];

  bisector[0] /= bLen; 
  bisector[1] /= bLen;
  
  // Distance from corner to the center of the arc
  const distToCenter = r / Math.sin(alpha);
  const center = [vC[0] + bisector[0] * distToCenter, vC[1] + bisector[1] * distToCenter];
  
  const vt1 = [t1[0] - center[0], t1[1] - center[1]];
  const vt2 = [t2[0] - center[0], t2[1] - center[1]];
  
  const a1 = Math.atan2(vt1[1], vt1[0]);
  const a2 = Math.atan2(vt2[1], vt2[0]);
  
  // Calculate shortest sweeping angle path between t1 and t2
  let diff = a2 - a1;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = a1 + t * diff;
    points.push(getVec3(center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r));
  }
  
  return points;
}

/**
 * Post-processes a FoldData object to dynamically apply smooth fillets 
 * (rounded corners) exclusively to the outer structural glue tabs.
 */
export function applyTabFillets(foldData: FoldData, filletRadius: number): FoldData {
  if (filletRadius <= 0) return foldData;

  const newVerticesCoords: Vec3[] = foldData.verticesCoords.map(v => 
    v.length > 2 ? [v[0], v[1], v[2]] : [v[0], v[1]]
  );
  
  const newFacesVertices: number[][] = foldData.facesVertices.map(f => [...f]);
  
  const tree = buildFaceTree(foldData);
  const glueTabHinges = new Map<number, [number, number]>();

  // Topological discovery of valid glue tab faces
  function traverse(node: FaceTreeNode) {
    if (node.children.length === 0 && node.hingeEdge) {
      const faceVertices = foldData.facesVertices[node.faceIndex];
      if (faceVertices.length === 4) {
        const h1 = node.hingeEdge[0];
        const h2 = node.hingeEdge[1];
        
        let hingeIdx = -1;
        for (let i = 0; i < 4; i++) {
          const v1 = faceVertices[i];
          const v2 = faceVertices[(i + 1) % 4];
          if ((v1 === h1 && v2 === h2) || (v1 === h2 && v2 === h1)) {
            hingeIdx = i;
            break;
          }
        }
        
        if (hingeIdx !== -1) {
          const opIdx = (hingeIdx + 2) % 4;
          const ov1 = faceVertices[opIdx];
          const ov2 = faceVertices[(opIdx + 1) % 4];
          
          const getLen = (a: number, b: number) => {
            const p1 = foldData.verticesCoords[a];
            const p2 = foldData.verticesCoords[b];
            const dx = p1[0] - p2[0];
            const dy = p1[1] - p2[1];
            return Math.sqrt(dx * dx + dy * dy);
          };
          
          const hingeLen = getLen(h1, h2);
          const oppLen = getLen(ov1, ov2);
          
          if (hingeLen > 0 && oppLen / hingeLen < 0.95) {
            glueTabHinges.set(node.faceIndex, [h1, h2]);
          }
        }
      }
    }
    for (const child of node.children) {
      traverse(child);
    }
  }
  
  for (const root of tree) {
    traverse(root);
  }
  
  // Isolate out corner paths and inject segmented fillets dynamically
  for (const [faceIdx, hinge] of glueTabHinges.entries()) {
    const face = foldData.facesVertices[faceIdx];
    const [h1, h2] = hinge;
    
    let hingeI = -1;
    for (let i = 0; i < 4; i++) {
      if ((face[i] === h1 && face[(i + 1) % 4] === h2) || 
          (face[i] === h2 && face[(i + 1) % 4] === h1)) {
        hingeI = i;
        break;
      }
    }
    
    if (hingeI === -1) continue;
    
    const cornersToFillet = [(hingeI + 2) % 4, (hingeI + 3) % 4];
    const newFace: number[] = [];
    
    for (let i = 0; i < 4; i++) {
      if (cornersToFillet.includes(i)) {
        const vPrevIdx = face[(i + 3) % 4];
        const vCIdx = face[i];
        const vNextIdx = face[(i + 1) % 4];
        
        const pts = computeFillet(
          foldData.verticesCoords[vPrevIdx],
          foldData.verticesCoords[vCIdx],
          foldData.verticesCoords[vNextIdx],
          filletRadius,
          6 // Fixed curve segmentation count (produces 7 vertices)
        );
        
        if (pts.length === 1) {
          newFace.push(vCIdx); // Un-filletable math fallback
        } else {
          for (const pt of pts) {
            newVerticesCoords.push(pt);
            newFace.push(newVerticesCoords.length - 1);
          }
        }
      } else {
        newFace.push(face[i]);
      }
    }
    
    newFacesVertices[faceIdx] = newFace;
  }
  
  // Re-map unified edge pool to preserve core creases and emit custom boundaries
  const oldEdgeMap = new Map<string, { assign: 'M' | 'V' | 'B' | 'F' | 'P', angle: number }>();
  for (let i = 0; i < foldData.edgesVertices.length; i++) {
    const e = foldData.edgesVertices[i];
    const key = Math.min(e[0], e[1]) + '-' + Math.max(e[0], e[1]);
    oldEdgeMap.set(key, {
      assign: foldData.edgesAssignment[i],
      angle: foldData.edgesFoldAngle[i]
    });
  }
  
  const newEdgesVertices: [number, number][] = [];
  const newEdgesAssignment: ('M' | 'V' | 'B' | 'F' | 'P')[] = [];
  const newEdgesFoldAngle: number[] = [];
  const newEdgeMap = new Map<string, { count: number, vertices: [number, number] }>();
  
  for (let f = 0; f < newFacesVertices.length; f++) {
    const face = newFacesVertices[f];
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = minV + '-' + maxV;
      
      if (!newEdgeMap.has(key)) {
        newEdgeMap.set(key, { count: 1, vertices: [v1, v2] });
      } else {
        newEdgeMap.get(key)!.count++;
      }
    }
  }
  
  for (const [key, edgeInfo] of newEdgeMap.entries()) {
    newEdgesVertices.push(edgeInfo.vertices);
    
    if (oldEdgeMap.has(key)) {
      const oldInfo = oldEdgeMap.get(key)!;
      newEdgesAssignment.push(oldInfo.assign);
      newEdgesFoldAngle.push(oldInfo.angle);
    } else {
      // Newly created arc sequences and truncated boundaries are implicitly cuts
      newEdgesAssignment.push('B');
      newEdgesFoldAngle.push(0);
    }
  }
  
  return {
    verticesCoords: newVerticesCoords,
    edgesVertices: newEdgesVertices,
    edgesAssignment: newEdgesAssignment,
    edgesFoldAngle: newEdgesFoldAngle,
    facesVertices: newFacesVertices
  };
}