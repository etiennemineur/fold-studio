import { applyDoubleScoring } from "./doubleScoring";
import { generateOctagonalFoldData, generatePentagonalFoldData, generateMailerFoldData, generateTuckEndFoldData, generateDisplayFoldData } from "./shapeGenerators";
import { generateFlipTopFoldData, generateGableFoldData, generateSealEndFoldData, generateSnapLockFoldData, generateConcentricRingsFoldData, generateSineWavesFoldData } from "./additionalShapeGenerators";
import { normalizeFoldAssignments } from "./normalizeFoldAssignments";
import { generateOrigamiPaper } from "./origamiShapeGenerators";

export type ShapeType = 'box' | 'pyramid' | 'tray' | 'sleeve' | 'hexagonal' | 'triangular' | 'octagonal' | 'pentagonal' | 'mailer' | 'tuckEnd' | 'display' | 'flipTop' | 'gable' | 'sealEnd' | 'snapLock' | 'origamiSquare' | 'origamiRectangle' | 'origamiA4' | 'concentricRings' | 'sineWaves';

export interface BoxParams {
  width: number;
  height: number;
  depth: number;
  glueTabSize: number;
  materialThickness: number;
  bleedSize: number;
  tabFilletRadius?: number;
  tabTaperRatio?: number;
}

export interface FoldData {
  verticesCoords: [number, number, number?][];
  edgesVertices: [number, number][];
  edgesAssignment: ('M' | 'V' | 'B' | 'F' | 'P')[];
  edgesFoldAngle: number[];
  facesVertices: number[][];
}

export interface FaceTreeNode {
  faceIndex: number;
  vertices2D: [number, number][];
  foldAngle: number;
  hingeEdge: [number, number] | null;
  children: FaceTreeNode[];
}

export const DEFAULT_BOX_PARAMS: BoxParams = { 
  width: 100, 
  height: 60, 
  depth: 40, 
  glueTabSize: 15,
  materialThickness: 0.5,
  bleedSize: 3,
  tabFilletRadius: 0,
  tabTaperRatio: 0.3
};

/**
 * Computes outer vertices for a glue tab on a given edge.
 */
export function computeTabOuterVertices(
  v1: [number, number],
  v2: [number, number],
  opposite: [number, number],
  tabSize: number,
  taperRatio: number = 0.3
): [[number, number], [number, number]] {
  const dx = v2[0] - v1[0];
  const dy = v2[1] - v1[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  
  const edx = dx / len;
  const edy = dy / len;
  
  const p1x = edy;
  const p1y = -edx;
  const p2x = -edy;
  const p2y = edx;
  
  const midX = (v1[0] + v2[0]) / 2;
  const midY = (v1[1] + v2[1]) / 2;
  
  const opDx = opposite[0] - midX;
  const opDy = opposite[1] - midY;
  
  const dot1 = p1x * opDx + p1y * opDy;
  
  let outX = p1x;
  let outY = p1y;
  if (dot1 > 0) {
    outX = p2x;
    outY = p2y;
  }
  
  const taper = tabSize * taperRatio;
  
  const outerV1: [number, number] = [
    v1[0] + outX * tabSize + edx * taper,
    v1[1] + outY * tabSize + edy * taper
  ];
  
  const outerV2: [number, number] = [
    v2[0] + outX * tabSize - edx * taper,
    v2[1] + outY * tabSize - edy * taper
  ];
  
  return [outerV1, outerV2];
}

/**
 * Generates the FOLD data for a rectangular pyramid.
 */
export function generatePyramidFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;

  const slantFB = Math.sqrt(Math.pow(D / 2, 2) + Math.pow(H, 2));
  const slantLR = Math.sqrt(Math.pow(W / 2, 2) + Math.pow(H, 2));

  const verticesCoords: [number, number, number?][] = [
    [-W / 2, -D / 2],       // 0: base front-left
    [W / 2, -D / 2],        // 1: base front-right
    [W / 2, D / 2],         // 2: base back-right
    [-W / 2, D / 2],        // 3: base back-left
    [0, -D / 2 - slantFB],  // 4: front apex
    [0, D / 2 + slantFB],   // 5: back apex
    [W / 2 + slantLR, 0],   // 6: right apex
    [-W / 2 - slantLR, 0]   // 7: left apex
  ];

  const facesVertices: number[][] = [
    [0, 1, 2, 3], // 0: base
    [0, 4, 1],    // 1: front triangle
    [2, 5, 3],    // 2: back triangle
    [1, 6, 2],    // 3: right triangle
    [3, 7, 0]     // 4: left triangle
  ];

  const T = params.glueTabSize;
  if (T > 0) {
    // 1. Tab on edge 4->1 (front triangle right side)
    let [o1, o2] = computeTabOuterVertices(
      verticesCoords[4] as [number, number],
      verticesCoords[1] as [number, number],
      verticesCoords[0] as [number, number],
      T,
      params.tabTaperRatio ?? 0.3
    );
    verticesCoords.push(o1, o2); // 8, 9
    facesVertices.push([4, 8, 9, 1]); // 5

    // 2. Tab on edge 6->2 (right triangle back side)
    [o1, o2] = computeTabOuterVertices(
      verticesCoords[6] as [number, number],
      verticesCoords[2] as [number, number],
      verticesCoords[1] as [number, number],
      T,
      params.tabTaperRatio ?? 0.3
    );
    verticesCoords.push(o1, o2); // 10, 11
    facesVertices.push([6, 10, 11, 2]); // 6

    // 3. Tab on edge 5->3 (back triangle left side)
    [o1, o2] = computeTabOuterVertices(
      verticesCoords[5] as [number, number],
      verticesCoords[3] as [number, number],
      verticesCoords[2] as [number, number],
      T,
      params.tabTaperRatio ?? 0.3
    );
    verticesCoords.push(o1, o2); // 12, 13
    facesVertices.push([5, 12, 13, 3]); // 7

    // 4. Tab on edge 7->0 (left triangle front side)
    [o1, o2] = computeTabOuterVertices(
      verticesCoords[7] as [number, number],
      verticesCoords[0] as [number, number],
      verticesCoords[3] as [number, number],
      T,
      params.tabTaperRatio ?? 0.3
    );
    verticesCoords.push(o1, o2); // 14, 15
    facesVertices.push([7, 14, 15, 0]); // 8
  }

  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];

  const edgeMap = new Map<string, { count: number, vertices: [number, number], faces: number[] }>();

  facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 1, vertices: [v1, v2], faces: [faceIndex] });
      } else {
        const edge = edgeMap.get(key)!;
        edge.count++;
        edge.faces.push(faceIndex);
      }
    }
  });

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push('B');
      edgesFoldAngle.push(0);
    } else {
      const [v1, v2] = edge.vertices;
      const isBaseHinge = v1 <= 3 && v2 <= 3;

      if (isBaseHinge) {
        edgesAssignment.push('M');
        const isFB = (v1 === 0 && v2 === 1) || (v1 === 2 && v2 === 3);
        
        let foldAngle = 0;
        if (isFB) {
          foldAngle = (Math.atan2(-H, -D / 2) * 180) / Math.PI;
        } else {
          foldAngle = (Math.atan2(-H, -W / 2) * 180) / Math.PI;
        }
        edgesFoldAngle.push(foldAngle);
      } else {
                                // Tab hinge — folds slightly inside volume (Mountain)
        edgesAssignment.push('M');
        edgesFoldAngle.push(-91);
      }
    }
  }

  return {
    verticesCoords,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    facesVertices
  };
}

/**
 * Builds a directed tree of faces connected by hinges.
 * If rootFaceIndex is provided and is a valid index, it uses it as the root face.
 * Otherwise, it uses the auto-detected face with the most neighbors.
 */
export function buildFaceTree(foldData: FoldData, rootFaceIndex?: number): FaceTreeNode[] {
  const visited = new Set<number>();
  const nodes = new Map<number, FaceTreeNode>();

  const adjacency = new Map<number, { neighbor: number, edge: [number, number], angle: number }[]>();

  for (let i = 0; i < foldData.facesVertices.length; i++) {
    adjacency.set(i, []);
  }

  const edgeToFaces = new Map<string, { face: number, v1: number, v2: number }[]>();

  foldData.facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
      edgeToFaces.get(key)!.push({ face: faceIndex, v1, v2 });
    }
  });

  let totalAdjacencyEdges = 0;

  edgeToFaces.forEach((facesOnEdge, key) => {
    // Deduplicate by face index — faces with repeated vertices (from dead-end bounces)
    // can register the same edge multiple times for the same face
    const seenFaces = new Set<number>();
    const uniqueFacesOnEdge = facesOnEdge.filter(f => {
      if (seenFaces.has(f.face)) return false;
      seenFaces.add(f.face);
      return true;
    });

    if (uniqueFacesOnEdge.length === 2) {
      totalAdjacencyEdges++;
      const [fA, fB] = uniqueFacesOnEdge;
      
      const [minV, maxV] = key.split('-').map(Number);
      let angle = 0;
      let refDir: [number, number] | null = null;
      for (let i = 0; i < foldData.edgesVertices.length; i++) {
        const ev = foldData.edgesVertices[i];
        if ((ev[0] === minV && ev[1] === maxV) || (ev[0] === maxV && ev[1] === minV)) {
          angle = foldData.edgesFoldAngle[i];
          refDir = [ev[0], ev[1]];
          break;
        }
      }

      const fAMatchesRef = refDir !== null && fA.v1 === refDir[0] && fA.v2 === refDir[1];
      const fBMatchesRef = refDir !== null && fB.v1 === refDir[0] && fB.v2 === refDir[1];

      const fAAngle = fAMatchesRef ? angle : -angle;
      const fBAngle = fBMatchesRef ? angle : -angle;

      // fA.v1 -> fA.v2 is the directed edge in CCW order inside face fA
      adjacency.get(fA.face)!.push({ neighbor: fB.face, edge: [fA.v1, fA.v2], angle: fAAngle });
      adjacency.get(fB.face)!.push({ neighbor: fA.face, edge: [fB.v1, fB.v2], angle: fBAngle });
    }
  });

  const bestRoot = 0;

  const rootFace = (rootFaceIndex !== undefined && rootFaceIndex !== null && rootFaceIndex >= 0 && rootFaceIndex < foldData.facesVertices.length)
    ? rootFaceIndex 
    : bestRoot;
    
  console.log(`[FaceTree] Root face: ${rootFace}, total adjacency edges: ${totalAdjacencyEdges}`);
  
  function getVertices2D(faceIdx: number): [number, number][] {
    return foldData.facesVertices[faceIdx].map(vIdx => {
      const coords = foldData.verticesCoords[vIdx];
      return [coords[0], coords[1]];
    });
  }

  const roots: FaceTreeNode[] = [];

  function exploreComponent(startFace: number) {
    const rootNode: FaceTreeNode = {
      faceIndex: startFace,
      vertices2D: getVertices2D(startFace),
      foldAngle: 0,
      hingeEdge: null,
      children: []
    };

    visited.add(startFace);
    nodes.set(startFace, rootNode);
    roots.push(rootNode);

    const queue = [startFace];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentNode = nodes.get(current)!;

      const neighbors = adjacency.get(current) || [];
      for (const { neighbor, edge, angle } of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const childNode: FaceTreeNode = {
            faceIndex: neighbor,
            vertices2D: getVertices2D(neighbor),
            foldAngle: angle,
            hingeEdge: edge, // edge is directed (v1 -> v2) CCW in the parent face
            children: []
          };
          currentNode.children.push(childNode);
          nodes.set(neighbor, childNode);
          queue.push(neighbor);
        }
      }
    }
  }

  exploreComponent(rootFace);

  for (let i = 0; i < foldData.facesVertices.length; i++) {
    if (!visited.has(i)) {
      exploreComponent(i);
    }
  }

  return roots;
}

/**
 * Computes 3D positions for all vertices using forward kinematics.
 */
export function computeFoldedVertices(
  foldData: FoldData,
  tree: FaceTreeNode[],
  progress: number,
  sequential?: boolean
): Map<number, [number, number, number]> {
  const vertexMap = new Map<number, [number, number, number]>();

  // Rodrigues' rotation formula
  function rotatePoint(
    point: [number, number, number],
    axisPoint: [number, number, number],
    axisDir: [number, number, number],
    angleRad: number
  ): [number, number, number] {
    const pX = point[0] - axisPoint[0];
    const pY = point[1] - axisPoint[1];
    const pZ = point[2] - axisPoint[2];

    const len = Math.sqrt(axisDir[0] * axisDir[0] + axisDir[1] * axisDir[1] + axisDir[2] * axisDir[2]);
    const uX = axisDir[0] / len;
    const uY = axisDir[1] / len;
    const uZ = axisDir[2] / len;

    const cosTheta = Math.cos(angleRad);
    const sinTheta = Math.sin(angleRad);
    const dot = pX * uX + pY * uY + pZ * uZ;

    const crossX = uY * pZ - uZ * pY;
    const crossY = uZ * pX - uX * pZ;
    const crossZ = uX * pY - uY * pX;

    const rotX = pX * cosTheta + crossX * sinTheta + uX * dot * (1 - cosTheta);
    const rotY = pY * cosTheta + crossY * sinTheta + uY * dot * (1 - cosTheta);
    const rotZ = pZ * cosTheta + crossZ * sinTheta + uZ * dot * (1 - cosTheta);

    return [
      rotX + axisPoint[0],
      rotY + axisPoint[1],
      rotZ + axisPoint[2]
    ];
  }

  const parentMap = new Map<number, FaceTreeNode>();
  
  function buildParents(node: FaceTreeNode) {
    for (const child of node.children) {
      parentMap.set(child.faceIndex, node);
      buildParents(child);
    }
  }

  for (const root of tree) {
    buildParents(root);
  }

  // Compute depth of each node for sequential mode
  const depthMap = new Map<number, number>();
  let maxDepth = 1;
  if (sequential && tree.length > 0) {
    // Pass 1: Basic depth assignment
    function computeBasicDepths(node: FaceTreeNode, depth: number) {
      depthMap.set(node.faceIndex, depth);
      for (const child of node.children) {
        computeBasicDepths(child, depth + 1);
      }
    }
    for (const root of tree) {
      computeBasicDepths(root, 0);
    }

    // Pass 2: Global per-depth-level tab separation
    const allNodes: FaceTreeNode[] = [];
    function flattenNodes(node: FaceTreeNode) {
      allNodes.push(node);
      for (const child of node.children) {
        flattenNodes(child);
      }
    }
    for (const root of tree) {
      flattenNodes(root);
    }

    function shiftDepthAndSubtree(node: FaceTreeNode, shift: number) {
      const current = depthMap.get(node.faceIndex) ?? 0;
      depthMap.set(node.faceIndex, current + shift);
      for (const child of node.children) {
        shiftDepthAndSubtree(child, shift);
      }
    }

    let currentDepthToProcess = 1;
    let currentMaxDepth = Math.max(...depthMap.values(), 1);

    while (currentDepthToProcess <= currentMaxDepth) {
      const nodesAtDepth = allNodes.filter(n => depthMap.get(n.faceIndex) === currentDepthToProcess && n.foldAngle !== 0);
      
      const angleKeys = nodesAtDepth.map(n => Math.round(Math.abs(n.foldAngle) * 100));
      const uniqueAngles = new Set(angleKeys);

      if (uniqueAngles.size > 1) {
        // Find tab group
        let maxDeviation = -1;
        let tabKey = -1;
        for (const key of uniqueAngles) {
          const angleMag = key / 100;
          const deviation = Math.abs(angleMag - 90);
          if (deviation > maxDeviation) {
            maxDeviation = deviation;
            tabKey = key;
          }
        }

        // Shift non-tabs and their subtrees down by 1
        for (const node of nodesAtDepth) {
          const key = Math.round(Math.abs(node.foldAngle) * 100);
          if (key !== tabKey) {
            shiftDepthAndSubtree(node, 1);
          }
        }
        
        // Recompute max depth since subtrees were shifted
        currentMaxDepth = Math.max(...depthMap.values(), 1);
      }
      
      currentDepthToProcess++;
    }

    // Pass 3: Promote glue tabs to fold BEFORE parent panels.
    // Tabs are identified as leaf nodes (no children) whose fold angle
    // deviates from 90° — e.g. -91° (box), -61° (hex), -121° (tri).
    const tabFaceSet = new Set<number>();
    for (const nd of allNodes) {
      if (nd.foldAngle !== 0 && nd.children.length === 0) {
        const dev = Math.abs(Math.abs(nd.foldAngle) - 90);
        if (dev > 0.5) {
          tabFaceSet.add(nd.faceIndex);
        }
      }
    }

    if (tabFaceSet.size > 0) {
      let minTabDepth = Infinity;
      for (const fIdx of tabFaceSet) {
        const d = depthMap.get(fIdx) ?? 0;
        if (d < minTabDepth) minTabDepth = d;
      }

      let minPanelDepth = Infinity;
      for (const nd of allNodes) {
        if (tabFaceSet.has(nd.faceIndex)) continue;
        const d = depthMap.get(nd.faceIndex) ?? 0;
        if (d >= 1 && d < minPanelDepth) minPanelDepth = d;
      }

      if (minTabDepth > minPanelDepth) {
        // Shift all non-tab nodes at or after the first panel depth down by 1
        for (const nd of allNodes) {
          if (tabFaceSet.has(nd.faceIndex)) continue;
          const d = depthMap.get(nd.faceIndex) ?? 0;
          if (d >= minPanelDepth) {
            depthMap.set(nd.faceIndex, d + 1);
          }
        }
        // Place all tab nodes at the first fold slot
        for (const fIdx of tabFaceSet) {
          depthMap.set(fIdx, minPanelDepth);
        }
        currentMaxDepth = Math.max(...depthMap.values(), 1);
      }
    }

    // Compact depths to remove gaps
    const usedDepthSet = new Set<number>();
    for (const nd of allNodes) {
      usedDepthSet.add(depthMap.get(nd.faceIndex) ?? 0);
    }
    const sortedUsedDepths = [...usedDepthSet].sort((a, b) => a - b);
    const depthRemap = new Map<number, number>();
    sortedUsedDepths.forEach((d, i) => depthRemap.set(d, i));
    for (const nd of allNodes) {
      const d = depthMap.get(nd.faceIndex) ?? 0;
      depthMap.set(nd.faceIndex, depthRemap.get(d) ?? d);
    }

    maxDepth = Math.max(...depthMap.values(), 1);
  }

  function processNode(node: FaceTreeNode) {
    const faceIdx = node.faceIndex;
    const vertexIndices = foldData.facesVertices[faceIdx];

    for (let i = 0; i < vertexIndices.length; i++) {
      const vIdx = vertexIndices[i];
      if (vertexMap.has(vIdx)) continue;

      const initialCoords = foldData.verticesCoords[vIdx];
      let currentPos: [number, number, number] = [
        initialCoords[0],
        initialCoords[1],
        initialCoords[2] ?? 0
      ];

      // Traverse up the tree to accumulate structural rigid rotations
      let curr = node;
      while (true) {
        const parent = parentMap.get(curr.faceIndex);
        if (!parent || !curr.hingeEdge) break;

        const h1Idx = curr.hingeEdge[0];
        const h2Idx = curr.hingeEdge[1];
        
        const h1Coords = foldData.verticesCoords[h1Idx];
        const h2Coords = foldData.verticesCoords[h2Idx];

        const axisPoint: [number, number, number] = [
          h1Coords[0], 
          h1Coords[1], 
          h1Coords[2] ?? 0
        ];
        
        const axisDir: [number, number, number] = [
          h2Coords[0] - h1Coords[0],
          h2Coords[1] - h1Coords[1],
          (h2Coords[2] ?? 0) - (h1Coords[2] ?? 0)
        ];

        let effectiveProgress = progress;
        if (sequential && maxDepth > 0) {
          const nodeDepth = depthMap.get(curr.faceIndex) ?? 1;
          // Each depth level gets an equal slice of the total 0→1 progress range.
          // Depth 1 folds during [0, 1/maxDepth], depth 2 during [1/maxDepth, 2/maxDepth], etc.
          effectiveProgress = Math.max(0, Math.min(1, progress * maxDepth - (nodeDepth - 1)));
        }
        const angleDeg = curr.foldAngle * effectiveProgress;
        const angleRad = (angleDeg * Math.PI) / 180;

        currentPos = rotatePoint(currentPos, axisPoint, axisDir, angleRad);

        curr = parent;
      }

      vertexMap.set(vIdx, currentPos);
    }

    for (const child of node.children) {
      processNode(child);
    }
  }

  for (const root of tree) {
    processNode(root);
  }

  return vertexMap;
}

/**
 * Generates the FOLD data for a tray (box without top flaps).
 */
export function generateTrayFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [
    // Bottom
    [-W/2, -D/2], [W/2, -D/2], [W/2, D/2], [-W/2, D/2], // 0,1,2,3
    // Front side
    [-W/2, -D/2 - H], [W/2, -D/2 - H], // 4,5
    // Back side
    [W/2, D/2 + H], [-W/2, D/2 + H], // 6,7
    // Left side
    [-W/2 - H, D/2], [-W/2 - H, -D/2], // 8,9
    // Right side
    [W/2 + H, -D/2], [W/2 + H, D/2], // 10,11
  ];

  const facesVertices: number[][] = [
    [0, 1, 2, 3],       // 0: Bottom
    [0, 4, 5, 1],       // 1: Front
    [2, 6, 7, 3],       // 2: Back
    [3, 8, 9, 0],       // 3: Left
    [1, 10, 11, 2],     // 4: Right
  ];

  if (T > 0) {
    // Left side bottom: 9->0
    let [o1, o2] = computeTabOuterVertices(verticesCoords[9] as [number, number], verticesCoords[0] as [number, number], verticesCoords[3] as [number, number], T, params.tabTaperRatio ?? 0.3);
    verticesCoords.push(o1, o2); // 12, 13
    facesVertices.push([9, 12, 13, 0]);

    // Left side top: 3->8
    [o1, o2] = computeTabOuterVertices(verticesCoords[3] as [number, number], verticesCoords[8] as [number, number], verticesCoords[9] as [number, number], T, params.tabTaperRatio ?? 0.3);
    verticesCoords.push(o1, o2); // 14, 15
    facesVertices.push([3, 14, 15, 8]);

    // Right side bottom: 1->10
    [o1, o2] = computeTabOuterVertices(verticesCoords[1] as [number, number], verticesCoords[10] as [number, number], verticesCoords[11] as [number, number], T, params.tabTaperRatio ?? 0.3);
    verticesCoords.push(o1, o2); // 16, 17
    facesVertices.push([1, 16, 17, 10]);

    // Right side top: 11->2
    [o1, o2] = computeTabOuterVertices(verticesCoords[11] as [number, number], verticesCoords[2] as [number, number], verticesCoords[1] as [number, number], T, params.tabTaperRatio ?? 0.3);
    verticesCoords.push(o1, o2); // 18, 19
    facesVertices.push([11, 18, 19, 2]);
  }

  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];
  const edgeMap = new Map<string, { count: number, vertices: [number, number], faces: number[] }>();

  facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 1, vertices: [v1, v2], faces: [faceIndex] });
      } else {
        const edge = edgeMap.get(key)!;
        edge.count++;
        edge.faces.push(faceIndex);
      }
    }
  });

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push('B');
      edgesFoldAngle.push(0);
    } else {
      const [v1, v2] = edge.vertices;
      if (v1 <= 3 && v2 <= 3) {
        // Base-to-side hinge
        edgesAssignment.push('M');
        edgesFoldAngle.push(-90);
      } else {
                                // Tab hinge — folds slightly inside volume (Mountain)
        edgesAssignment.push('M');
        edgesFoldAngle.push(-91);
      }
    }
  }

  return { verticesCoords, edgesVertices, edgesAssignment, edgesFoldAngle, facesVertices };
}

/**
 * Generates the FOLD data for a rectangular sleeve.
 */
export function generateSleeveFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [
    [0, 0], [W, 0], [W + D, 0], [2 * W + D, 0], [2 * W + 2 * D, 0], // 0, 1, 2, 3, 4
    [0, H], [W, H], [W + D, H], [2 * W + D, H], [2 * W + 2 * D, H], // 5, 6, 7, 8, 9
  ];

  const facesVertices: number[][] = [
    [0, 1, 6, 5],
    [1, 2, 7, 6],
    [2, 3, 8, 7],
    [3, 4, 9, 8]
  ];

  if (T > 0) {
    // Tab on right edge of last panel: 4->9
    const [o1, o2] = computeTabOuterVertices(verticesCoords[4] as [number, number], verticesCoords[9] as [number, number], verticesCoords[8] as [number, number], T, params.tabTaperRatio ?? 0.3);
    verticesCoords.push(o1, o2); // 10, 11
    facesVertices.push([4, 10, 11, 9]);
  }

  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];
  const edgeMap = new Map<string, { count: number, vertices: [number, number], faces: number[] }>();

  facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 1, vertices: [v1, v2], faces: [faceIndex] });
      } else {
        const edge = edgeMap.get(key)!;
        edge.count++;
        edge.faces.push(faceIndex);
      }
    }
  });

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push('B');
      edgesFoldAngle.push(0);
    } else {
      const [v1, v2] = edge.vertices;
      if ((v1 === 4 && v2 === 9) || (v1 === 9 && v2 === 4)) {
                                // Tab hinge — folds slightly inside volume (Mountain)
        edgesAssignment.push('M');
        edgesFoldAngle.push(-91);
      } else {
        // Internal panel hinge (forming the tube)
        edgesAssignment.push('M');
        edgesFoldAngle.push(-90);
      }
    }
  }

  return { verticesCoords, edgesVertices, edgesAssignment, edgesFoldAngle, facesVertices };
}

/**
 * Generates the FOLD data for a hexagonal prism box.
 */
export function generateHexagonalFoldData(params: BoxParams): FoldData {
  const S = params.width / 2; // Approximate width = 2S
  const H = params.height;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];
  const tabFaceIndices = new Set<number>();

  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    verticesCoords.push([S * Math.cos(angle), S * Math.sin(angle)]);
  }
  facesVertices.push([0, 1, 2, 3, 4, 5]);

  for (let i = 0; i < 6; i++) {
    const A = i;
    const B = (i + 1) % 6;
    const vA = verticesCoords[A] as [number, number];
    const vB = verticesCoords[B] as [number, number];

    const mx = (vA[0] + vB[0]) / 2;
    const my = (vA[1] + vB[1]) / 2;
    const mlen = Math.sqrt(mx * mx + my * my) || 1;
    const ux = mx / mlen;
    const uy = my / mlen;

    const C_idx = verticesCoords.length;
    const C: [number, number] = [vB[0] + ux * H, vB[1] + uy * H];
    verticesCoords.push(C);

    const D_idx = verticesCoords.length;
    const D: [number, number] = [vA[0] + ux * H, vA[1] + uy * H];
    verticesCoords.push(D);

    facesVertices.push([A, D_idx, C_idx, B]);

    // Flap
    const flapH = S * 0.8;
    const E_idx = verticesCoords.length;
    const E: [number, number] = [mx + ux * (H + flapH), my + uy * (H + flapH)];
    verticesCoords.push(E);
    facesVertices.push([D_idx, E_idx, C_idx]);

    // Tab on alternate side panels
    if (T > 0 && i % 2 === 1) {
      // The side panel is [A, D_idx, C_idx, B]
      // The left edge looking outward is B -> C
      const [o1, o2] = computeTabOuterVertices(vB, C, D, T, params.tabTaperRatio ?? 0.3);
      const o1_idx = verticesCoords.length;
      const o2_idx = verticesCoords.length + 1;
      verticesCoords.push(o1, o2);
      tabFaceIndices.add(facesVertices.length);
      facesVertices.push([C_idx, o2_idx, o1_idx, B]);
    }
  }

  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];
  const edgeMap = new Map<string, { count: number, vertices: [number, number], faces: number[] }>();

  facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 1, vertices: [v1, v2], faces: [faceIndex] });
      } else {
        const edge = edgeMap.get(key)!;
        edge.count++;
        edge.faces.push(faceIndex);
      }
    }
  });

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push('B');
      edgesFoldAngle.push(0);
    } else {
      const [v1, v2] = edge.vertices;
      if (v1 <= 5 && v2 <= 5) {
        // Base hinge
        edgesAssignment.push('M');
        edgesFoldAngle.push(-90);
      } else {
        const isTabHinge = tabFaceIndices.has(edge.faces[0]) || (edge.faces.length > 1 && tabFaceIndices.has(edge.faces[1]));
                if (isTabHinge) {
          edgesAssignment.push('M');
          edgesFoldAngle.push(-61);
        } else {
          // Flap hinge — folds inward (Mountain)
          edgesAssignment.push('M');
          edgesFoldAngle.push(-90);
        }
      }
    }
  }

  return { verticesCoords, edgesVertices, edgesAssignment, edgesFoldAngle, facesVertices };
}

/**
 * Generates the FOLD data for an equilateral triangular prism box.
 */
export function generateTriangularFoldData(params: BoxParams): FoldData {
  const S = params.width;
  const H = params.height;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];
  const tabFaceIndices = new Set<number>();

  verticesCoords.push(
    [-S / 2, -S * Math.sqrt(3) / 6],
    [S / 2, -S * Math.sqrt(3) / 6],
    [0, S * Math.sqrt(3) / 3]
  );
  facesVertices.push([0, 1, 2]);

  for (let i = 0; i < 3; i++) {
    const A = i;
    const B = (i + 1) % 3;
    const vA = verticesCoords[A] as [number, number];
    const vB = verticesCoords[B] as [number, number];

    const mx = (vA[0] + vB[0]) / 2;
    const my = (vA[1] + vB[1]) / 2;
    const mlen = Math.sqrt(mx * mx + my * my) || 1;
    const ux = mx / mlen;
    const uy = my / mlen;

    const C_idx = verticesCoords.length;
    const C: [number, number] = [vB[0] + ux * H, vB[1] + uy * H];
    verticesCoords.push(C);

    const D_idx = verticesCoords.length;
    const D: [number, number] = [vA[0] + ux * H, vA[1] + uy * H];
    verticesCoords.push(D);

    facesVertices.push([A, D_idx, C_idx, B]);

    // Flap
    const flapH = S * Math.sqrt(3) / 6;
    const E_idx = verticesCoords.length;
    const E: [number, number] = [mx + ux * (H + flapH), my + uy * (H + flapH)];
    verticesCoords.push(E);
    facesVertices.push([D_idx, E_idx, C_idx]);

    // Tabs on panels 0 and 1
    if (T > 0 && i < 2) {
      const [o1, o2] = computeTabOuterVertices(vB, C, D, T, params.tabTaperRatio ?? 0.3);
      const o1_idx = verticesCoords.length;
      const o2_idx = verticesCoords.length + 1;
      verticesCoords.push(o1, o2);
      tabFaceIndices.add(facesVertices.length);
      facesVertices.push([C_idx, o2_idx, o1_idx, B]);
    }
  }

  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];
  const edgeMap = new Map<string, { count: number, vertices: [number, number], faces: number[] }>();

  facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 1, vertices: [v1, v2], faces: [faceIndex] });
      } else {
        const edge = edgeMap.get(key)!;
        edge.count++;
        edge.faces.push(faceIndex);
      }
    }
  });

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push('B');
      edgesFoldAngle.push(0);
    } else {
      const [v1, v2] = edge.vertices;
      if (v1 <= 2 && v2 <= 2) {
        // Base hinge
        edgesAssignment.push('M');
        edgesFoldAngle.push(-90);
      } else {
        const isTabHinge = tabFaceIndices.has(edge.faces[0]) || (edge.faces.length > 1 && tabFaceIndices.has(edge.faces[1]));
                if (isTabHinge) {
          edgesAssignment.push('M');
          edgesFoldAngle.push(-121);
        } else {
          // Flap hinge — folds inward (Mountain)
          edgesAssignment.push('M');
          edgesFoldAngle.push(-90);
        }
      }
    }
  }

  return { verticesCoords, edgesVertices, edgesAssignment, edgesFoldAngle, facesVertices };
}

/**
 * Dispatcher to generate FOLD data for the specified shape.
 */
export function generateShapeFoldData(
  shapeType: ShapeType, 
  params: BoxParams,
  options?: { skipDoubleScoring?: boolean }
): FoldData {
  if (shapeType === 'origamiSquare') return generateOrigamiPaper('square', params.width, params.height);
  if (shapeType === 'origamiRectangle') return generateOrigamiPaper('rectangle', params.width, params.height);
  if (shapeType === 'origamiA4') return generateOrigamiPaper('a4', params.width, params.height);

  let foldData: FoldData;
  if (shapeType === 'pyramid') foldData = generatePyramidFoldData(params);
  else if (shapeType === 'tray') foldData = generateTrayFoldData(params);
  else if (shapeType === 'sleeve') foldData = generateSleeveFoldData(params);
  else if (shapeType === 'hexagonal') foldData = generateHexagonalFoldData(params);
  else if (shapeType === 'triangular') foldData = generateTriangularFoldData(params);
  else if (shapeType === 'octagonal') foldData = generateOctagonalFoldData(params);
  else if (shapeType === 'pentagonal') foldData = generatePentagonalFoldData(params);
  else if (shapeType === 'mailer') foldData = generateMailerFoldData(params);
  else if (shapeType === 'tuckEnd') foldData = generateTuckEndFoldData(params);
  else if (shapeType === 'display') foldData = generateDisplayFoldData(params);
  else if (shapeType === 'flipTop') foldData = generateFlipTopFoldData(params);
  else if (shapeType === 'gable') foldData = generateGableFoldData(params);
  else if (shapeType === 'sealEnd') foldData = generateSealEndFoldData(params);
  else if (shapeType === 'snapLock') foldData = generateSnapLockFoldData(params);
  else if (shapeType === 'concentricRings') foldData = generateConcentricRingsFoldData(params);
  else if (shapeType === 'sineWaves') foldData = generateSineWavesFoldData(params);
  else foldData = generateBoxFoldData(params);
  
  const normalizedData = normalizeFoldAssignments(foldData);

  if (options?.skipDoubleScoring) {
    return normalizedData;
  }

  // Apply double scoring post-processing when material thickness exceeds threshold
  return applyDoubleScoring(normalizedData, params.materialThickness).foldData;
}

/**
 * Generates the FOLD data for a standard box with alternating glue tabs.
 */
export function generateBoxFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;
  const F = Math.min(W, D) * 0.4; // Top flap size, avoiding overlaps
  const taper = T * (params.tabTaperRatio ?? 0.3);

  const verticesCoords: [number, number, number?][] = [
    // Bottom
    [-W/2, -D/2], [W/2, -D/2], [W/2, D/2], [-W/2, D/2], // 0,1,2,3
    // Front side
    [-W/2, -D/2 - H], [W/2, -D/2 - H], // 4,5
    // Back side
    [W/2, D/2 + H], [-W/2, D/2 + H], // 6,7
    // Left side
    [-W/2 - H, D/2], [-W/2 - H, -D/2], // 8,9
    // Right side
    [W/2 + H, -D/2], [W/2 + H, D/2], // 10,11
    // Front flap
    [-W/2, -D/2 - H - F], [W/2, -D/2 - H - F], // 12,13
    // Back flap
    [-W/2, D/2 + H + F], [W/2, D/2 + H + F], // 14,15
    // Left flap
    [-W/2 - H - F, -D/2], [-W/2 - H - F, D/2], // 16,17
    // Right flap
    [W/2 + H + F, -D/2], [W/2 + H + F, D/2], // 18,19
    // Tab bl (on Left side bottom)
    [-W/2 - taper, -D/2 - T], [-W/2 - H + taper, -D/2 - T], // 20,21
    // Tab tl (on Left side top)
    [-W/2 - H + taper, D/2 + T], [-W/2 - taper, D/2 + T], // 22,23
    // Tab br (on Right side bottom)
    [W/2 + H - taper, -D/2 - T], [W/2 + taper, -D/2 - T], // 24,25
    // Tab tr (on Right side top)
    [W/2 + taper, D/2 + T], [W/2 + H - taper, D/2 + T] // 26,27
  ];

  // Faces specified in counter-clockwise (CCW) order
  const facesVertices: number[][] = [
    [0, 1, 2, 3],       // 0: Bottom
    [0, 4, 5, 1],       // 1: Front
    [2, 6, 7, 3],       // 2: Back
    [3, 8, 9, 0],       // 3: Left
    [1, 10, 11, 2],     // 4: Right
    [4, 12, 13, 5],     // 5: Front flap
    [6, 15, 14, 7],     // 6: Back flap
    [8, 17, 16, 9],     // 7: Left flap
    [10, 18, 19, 11],   // 8: Right flap
    [9, 21, 20, 0],     // 9: Tab bl
    [3, 23, 22, 8],     // 10: Tab tl
    [1, 25, 24, 10],    // 11: Tab br
    [11, 27, 26, 2]     // 12: Tab tr
  ];

  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];

  const edgeMap = new Map<string, { count: number, vertices: [number, number], faces: number[] }>();

  facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 1, vertices: [v1, v2], faces: [faceIndex] });
      } else {
        const edge = edgeMap.get(key)!;
        edge.count++;
        edge.faces.push(faceIndex);
      }
    }
  });

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push('B');
      edgesFoldAngle.push(0);
    } else {
      const [f1, f2] = edge.faces;
      const hasBottom = f1 === 0 || f2 === 0;
      if (hasBottom) {
        // Hinge connected to the bottom face folds up -> Mountain (-90)
        edgesAssignment.push('M');
        edgesFoldAngle.push(-90);
            } else {
        // Tabs fold slightly inside volume (-91°), flaps fold to -90°
        const isTab = f1 >= 9 || f2 >= 9;
        edgesAssignment.push('M');
        edgesFoldAngle.push(isTab ? -91 : -90);
      }
    }
  }

  return {
    verticesCoords,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    facesVertices
  };
}

