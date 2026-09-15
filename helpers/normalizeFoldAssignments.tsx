import { type FoldData, type FaceTreeNode, buildFaceTree } from "./foldEngine";

/**
 * Corrects Mountain/Valley (M/V) edge assignments in a FOLD document based on
 * the rigid kinematics of how each hinge rotates its child face in 3D.
 */
export function normalizeFoldAssignments(foldData: FoldData): FoldData {
  const tree = buildFaceTree(foldData);
  if (tree.length === 0) return foldData;
  
  const edgeIndexMap = new Map<string, number>();
  for (let i = 0; i < foldData.edgesVertices.length; i++) {
    const [v1, v2] = foldData.edgesVertices[i];
    edgeIndexMap.set(`${Math.min(v1, v2)}-${Math.max(v1, v2)}`, i);
  }
  
  const newAssignments = [...foldData.edgesAssignment];
  
  function processNode(node: FaceTreeNode) {
    for (const child of node.children) {
      if (child.hingeEdge) {
        const [h1, h2] = child.hingeEdge;
        const key = `${Math.min(h1, h2)}-${Math.max(h1, h2)}`;
        const edgeIdx = edgeIndexMap.get(key);
        
        if (edgeIdx !== undefined) {
          const assign = newAssignments[edgeIdx];
          const angle = foldData.edgesFoldAngle[edgeIdx];
          
          if (assign !== 'B' && assign !== 'F' && angle !== 0) {
            const h1c = foldData.verticesCoords[h1];
            const h2c = foldData.verticesCoords[h2];
            
            if (h1c && h2c) {
              const hx = h2c[0] - h1c[0];
              const hy = h2c[1] - h1c[1];
              
              const childFace = foldData.facesVertices[child.faceIndex];
              let cx = 0, cy = 0;
              for (const v of childFace) {
                const vc = foldData.verticesCoords[v];
                if (vc) {
                  cx += vc[0];
                  cy += vc[1];
                }
              }
              cx /= childFace.length;
              cy /= childFace.length;
              
              const hingeMidX = (h1c[0] + h2c[0]) / 2;
              const hingeMidY = (h1c[1] + h2c[1]) / 2;
              const hz = hx * (cy - hingeMidY) - hy * (cx - hingeMidX);
              
              newAssignments[edgeIdx] = (hz * angle > 0) ? 'M' : 'V';
            }
          }
        }
      }
      processNode(child);
    }
  }
  
  processNode(tree[0]);
  
  return {
    ...foldData,
    edgesAssignment: newAssignments as FoldData['edgesAssignment']
  };
}