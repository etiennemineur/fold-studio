import { BoxParams, FoldData, computeTabOuterVertices } from "./foldEngine";

/**
 * Utility to safely compile FoldData from manual faces and known internal fold assignments.
 */
function buildCustomFoldData(
  verticesCoords: [number, number, number?][],
  facesVertices: number[][],
  internalFolds: Record<string, { assignment: 'M' | 'V' | 'F'; foldAngle: number }>
): FoldData {
  const edgeMap = new Map<string, { count: number; vertices: [number, number]; faces: number[] }>();

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

  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push('B');
      edgesFoldAngle.push(0);
    } else {
      const key1 = `${edge.vertices[0]}-${edge.vertices[1]}`;
      const key2 = `${edge.vertices[1]}-${edge.vertices[0]}`;
      const fold = internalFolds[key1] || internalFolds[key2];
      if (fold) {
        edgesAssignment.push(fold.assignment);
        edgesFoldAngle.push(fold.foldAngle);
      } else {
        edgesAssignment.push('F');
        edgesFoldAngle.push(0);
      }
    }
  }

  return {
    verticesCoords,
    facesVertices,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
  };
}

/**
 * Enhanced internal helper to compute edges, assignments, and fold angles from faces.
 * Boundary edges get 'B' / 0°, internal hinges get 'M' / -90° (unless specified in customAngles).
 * Tab hinges (connected to tabFaceIndices) get 'V' / 90°.
 */
function buildEdgesFromFaces(
  facesVertices: number[][],
  tabFaceIndices?: Set<number>,
  tabFoldAngle?: number,
  customAngles?: Map<string, number>
) {
  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ("M" | "V" | "B" | "F")[] = [];
  const edgesFoldAngle: number[] = [];

  const edgeMap = new Map<
    string,
    { count: number; vertices: [number, number]; faces: number[] }
  >();

  facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, {
          count: 1,
          vertices: [v1, v2],
          faces: [faceIndex],
        });
      } else {
        const edge = edgeMap.get(key)!;
        edge.count++;
        edge.faces.push(faceIndex);
      }
    }
  });

  for (const [key, edge] of edgeMap.entries()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push("B");
      edgesFoldAngle.push(0);
    } else {
      if (customAngles && customAngles.has(key)) {
        const angle = customAngles.get(key)!;
        edgesAssignment.push(angle > 0 ? "V" : "M");
        edgesFoldAngle.push(angle);
      } else {
                const isTabHinge = tabFaceIndices && edge.faces.some((f) => tabFaceIndices.has(f));
        if (isTabHinge) {
          const angle = tabFoldAngle !== undefined ? tabFoldAngle : -90;
          edgesAssignment.push(angle > 0 ? "V" : "M");
          edgesFoldAngle.push(angle > 0 ? angle + 1 : angle - 1);
        } else {
          edgesAssignment.push("M");
          edgesFoldAngle.push(-90);
        }
      }
    }
  }

  return { edgesVertices, edgesAssignment, edgesFoldAngle };
}

/**
 * Generates the FOLD data for a cigarette-style flip-top box.
 */
export function generateFlipTopFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];
  const tabFaceIndices = new Set<number>();
  const customAngles = new Map<string, number>();

  const x0 = 0;
  const x1 = D;
  const x2 = D + W;
  const x3 = 2 * D + W;
  const x4 = 2 * D + 2 * W;

  // 0-4: Bottom row (y=0)
  verticesCoords.push([x0, 0], [x1, 0], [x2, 0], [x3, 0], [x4, 0]);
  // 5-9: Top row (y=H)
  verticesCoords.push([x0, H], [x1, H], [x2, H], [x3, H], [x4, H]);

  facesVertices.push(
    [0, 1, 6, 5], // 0: Side1
    [1, 2, 7, 6], // 1: Front
    [2, 3, 8, 7], // 2: Side2
    [3, 4, 9, 8]  // 3: Back
  );

  // Lid extending from Back panel
  const v10_idx = verticesCoords.length;
  const v11_idx = verticesCoords.length + 1;
  verticesCoords.push([x3, H + D], [x4, H + D]);
  facesVertices.push([8, 9, v11_idx, v10_idx]); // 4: Lid

  // Tuck tab extending from Lid
  const v12_idx = verticesCoords.length;
  const v13_idx = verticesCoords.length + 1;
  verticesCoords.push([x3 + 3, H + D + 15], [x4 - 3, H + D + 15]);
  facesVertices.push([v10_idx, v11_idx, v13_idx, v12_idx]); // 5: Tuck tab

  // Set tuck tab custom fold angle (+90° Valley fold)
  customAngles.set(`${Math.min(v10_idx, v11_idx)}-${Math.max(v10_idx, v11_idx)}`, 90);

  // Lid Dust Flaps
  const dustW = D * 0.7;
  const v14_idx = verticesCoords.length;
  const v15_idx = verticesCoords.length + 1;
  verticesCoords.push([x3 - dustW, H + 3], [x3 - dustW, H + D - 3]);
  facesVertices.push([8, v10_idx, v15_idx, v14_idx]); // 6: Lid left dust

  const v16_idx = verticesCoords.length;
  const v17_idx = verticesCoords.length + 1;
  verticesCoords.push([x4 + dustW, H + 3], [x4 + dustW, H + D - 3]);
  facesVertices.push([9, v16_idx, v17_idx, v11_idx]); // 7: Lid right dust

  // Bottom flaps
  const flapH = Math.min(D * 0.4, D / 2);
  const mainFlapH = D / 2;

  const v18_idx = verticesCoords.length;
  const v19_idx = verticesCoords.length + 1;
  verticesCoords.push([x0 + 3, -flapH], [x1 - 3, -flapH]);
  facesVertices.push([0, v18_idx, v19_idx, 1]); // 8: Bottom side1 dust

  const v20_idx = verticesCoords.length;
  const v21_idx = verticesCoords.length + 1;
  verticesCoords.push([x1, -mainFlapH], [x2, -mainFlapH]);
  facesVertices.push([1, v20_idx, v21_idx, 2]); // 9: Bottom front main

  const v22_idx = verticesCoords.length;
  const v23_idx = verticesCoords.length + 1;
  verticesCoords.push([x2 + 3, -flapH], [x3 - 3, -flapH]);
  facesVertices.push([2, v22_idx, v23_idx, 3]); // 10: Bottom side2 dust

  const v24_idx = verticesCoords.length;
  const v25_idx = verticesCoords.length + 1;
  verticesCoords.push([x3, -mainFlapH], [x4, -mainFlapH]);
  facesVertices.push([3, v24_idx, v25_idx, 4]); // 11: Bottom back main

  // Glue Tab
  if (T > 0) {
    const [o1, o2] = computeTabOuterVertices(
      verticesCoords[5] as [number, number],
      verticesCoords[0] as [number, number],
      verticesCoords[1] as [number, number],
      T,
      params.tabTaperRatio ?? 0.3
    );
    const o1_idx = verticesCoords.length;
    const o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([5, o1_idx, o2_idx, 0]); // 12: Glue tab
  }

  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices,
    tabFaceIndices,
    90, // tabs valley fold
    customAngles
  );

  return { verticesCoords, edgesVertices, edgesAssignment, edgesFoldAngle, facesVertices };
}

/**
 * Generates the FOLD data for Concentric Rings.
 */
export function generateConcentricRingsFoldData(params: BoxParams): FoldData {
  const verticesCoords: [number, number][] = [];
  verticesCoords.push([0, 0]); // 0: center

  const numSpokes = 20;
  const numRings = 4;
  const R = params.width / 2;
  const radii = [R * 0.187, R * 0.373, R * 0.587, R * 0.8];
  const boundaryR = R;

  for (let r = 0; r <= numRings; r++) {
    const radius = r < numRings ? radii[r] : boundaryR;
    for (let s = 0; s < numSpokes; s++) {
      const angle = (s / numSpokes) * 2 * Math.PI - Math.PI / 2;
      verticesCoords.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
    }
  }

  const facesVertices: number[][] = [];
  for (let s = 0; s < numSpokes; s++) {
    const nextS = (s + 1) % numSpokes;
    facesVertices.push([0, 1 + s, 1 + nextS]);
  }

  for (let r = 0; r < numRings; r++) {
    for (let s = 0; s < numSpokes; s++) {
      const nextS = (s + 1) % numSpokes;
      const currRingStart = 1 + r * numSpokes;
      const nextRingStart = 1 + (r + 1) * numSpokes;
      facesVertices.push([
        currRingStart + s,
        nextRingStart + s,
        nextRingStart + nextS,
        currRingStart + nextS
      ]);
    }
  }

  const internalFolds: Record<string, { assignment: 'M' | 'V' | 'F'; foldAngle: number }> = {};
  for (let r = 0; r < numRings; r++) {
    const assignment = r % 2 === 0 ? "M" : "V";
    const foldAngle = r % 2 === 0 ? -70 : 70;
    const ringStart = 1 + r * numSpokes;
    for (let s = 0; s < numSpokes; s++) {
      const nextS = (s + 1) % numSpokes;
      const v1 = ringStart + s;
      const v2 = ringStart + nextS;
      internalFolds[`${v1}-${v2}`] = { assignment, foldAngle };
    }
  }

  return buildCustomFoldData(verticesCoords, facesVertices, internalFolds);
}

/**
 * Generates the FOLD data for Sine Waves.
 */
export function generateSineWavesFoldData(params: BoxParams): FoldData {
  const verticesCoords: [number, number][] = [];
  const N = 20;
  const numWaves = 4;
  const W = params.width;
  const amp = W * 0.053;
  const freq = 2;
  const numRows = numWaves + 2;
  const rowSpacing = W / (numWaves + 1);

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c <= N; c++) {
      const x = -W / 2 + (c / N) * W;
      const baseY = -W / 2 + r * rowSpacing;
      let y = baseY;
      if (r > 0 && r < numRows - 1) {
        const phase = r % 2 === 0 ? 0 : Math.PI;
        y += amp * Math.sin(freq * 2 * Math.PI * c / N + phase);
      }
      verticesCoords.push([x, y]);
    }
  }

  const facesVertices: number[][] = [];
  for (let r = 0; r < numRows - 1; r++) {
    for (let c = 0; c < N; c++) {
      const topLeft = r * (N + 1) + c;
      const topRight = topLeft + 1;
      const bottomLeft = (r + 1) * (N + 1) + c;
      const bottomRight = bottomLeft + 1;
      facesVertices.push([topLeft, topRight, bottomRight, bottomLeft]);
    }
  }

    const internalFolds: Record<string, { assignment: 'M' | 'V' | 'F'; foldAngle: number }> = {};
  for (let r = 1; r < numRows - 1; r++) {
    const assignment = r % 2 !== 0 ? "M" : "V";
    const foldAngle = r % 2 !== 0 ? -30 : 30;
    for (let c = 0; c < N; c++) {
      const v1 = r * (N + 1) + c;
      const v2 = v1 + 1;
      internalFolds[`${v1}-${v2}`] = { assignment, foldAngle };
    }
  }

  return buildCustomFoldData(verticesCoords, facesVertices, internalFolds);
}

/**
 * Generates the FOLD data for a gable-top box (milk carton style).
 */
export function generateGableFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];
  const tabFaceIndices = new Set<number>();
  const customAngles = new Map<string, number>();

  const x0 = 0, x1 = D, x2 = D + W, x3 = 2 * D + W, x4 = 2 * D + 2 * W;

  // 0-4: Bottom row (y=0)
  verticesCoords.push([x0, 0], [x1, 0], [x2, 0], [x3, 0], [x4, 0]);
  // 5-9: Top row (y=H)
  verticesCoords.push([x0, H], [x1, H], [x2, H], [x3, H], [x4, H]);

  facesVertices.push(
    [0, 1, 6, 5], // 0: Side1
    [1, 2, 7, 6], // 1: Front
    [2, 3, 8, 7], // 2: Side2
    [3, 4, 9, 8]  // 3: Back
  );

  const gableH = D * 0.6;
  const phi = (Math.atan2(gableH, D / 2) * 180) / Math.PI;
  const gableFoldAngle = -(90 - phi);

  // Front gable peak
  const v10_idx = verticesCoords.length;
  verticesCoords.push([x1 + W / 2, H + gableH]);
  facesVertices.push([6, 7, v10_idx]); // 4: Front gable
  customAngles.set(`${Math.min(6, 7)}-${Math.max(6, 7)}`, gableFoldAngle);

  // Back gable peak
  const v11_idx = verticesCoords.length;
  verticesCoords.push([x3 + W / 2, H + gableH]);
  facesVertices.push([8, 9, v11_idx]); // 5: Back gable
  customAngles.set(`${Math.min(8, 9)}-${Math.max(8, 9)}`, gableFoldAngle);

  // Side1 Support Flap
  const v12_idx = verticesCoords.length;
  const v13_idx = verticesCoords.length + 1;
  verticesCoords.push([x0, H + gableH], [x1, H + gableH]);
  facesVertices.push([5, 6, v13_idx, v12_idx]); // 6: Side1 support

  // Side2 Support Flap
  const v14_idx = verticesCoords.length;
  const v15_idx = verticesCoords.length + 1;
  verticesCoords.push([x2, H + gableH], [x3, H + gableH]);
  facesVertices.push([7, 8, v15_idx, v14_idx]); // 7: Side2 support

  // Bottom flaps
  const flapH = Math.min(D * 0.4, D / 2);
  const mainFlapH = D / 2;

  const v16_idx = verticesCoords.length;
  const v17_idx = verticesCoords.length + 1;
  verticesCoords.push([x0 + 3, -flapH], [x1 - 3, -flapH]);
  facesVertices.push([0, v16_idx, v17_idx, 1]); // 8: Bottom side1 dust

  const v18_idx = verticesCoords.length;
  const v19_idx = verticesCoords.length + 1;
  verticesCoords.push([x1, -mainFlapH], [x2, -mainFlapH]);
  facesVertices.push([1, v18_idx, v19_idx, 2]); // 9: Bottom front main

  const v20_idx = verticesCoords.length;
  const v21_idx = verticesCoords.length + 1;
  verticesCoords.push([x2 + 3, -flapH], [x3 - 3, -flapH]);
  facesVertices.push([2, v20_idx, v21_idx, 3]); // 10: Bottom side2 dust

  const v22_idx = verticesCoords.length;
  const v23_idx = verticesCoords.length + 1;
  verticesCoords.push([x3, -mainFlapH], [x4, -mainFlapH]);
  facesVertices.push([3, v22_idx, v23_idx, 4]); // 11: Bottom back main

  // Glue Tab
  if (T > 0) {
    const [o1, o2] = computeTabOuterVertices(
      verticesCoords[5] as [number, number],
      verticesCoords[0] as [number, number],
      verticesCoords[1] as [number, number],
      T,
      params.tabTaperRatio ?? 0.3
    );
    const o1_idx = verticesCoords.length;
    const o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([5, o1_idx, o2_idx, 0]); // 12: Glue tab
  }

  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices,
    tabFaceIndices,
    90, // tabs valley fold
    customAngles
  );

  return { verticesCoords, edgesVertices, edgesAssignment, edgesFoldAngle, facesVertices };
}

/**
 * Generates the FOLD data for a seal end box (tube with chamfered top/bottom closures).
 */
export function generateSealEndFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];
  const tabFaceIndices = new Set<number>();

  const x0 = -D - W;
  const x1 = -W;
  const x2 = 0;
  const x3 = D;
  const x4 = D + W;
  const yB = -H / 2;
  const yT = H / 2;

  // 0-4: Bottom row
  verticesCoords.push([x0, yB], [x1, yB], [x2, yB], [x3, yB], [x4, yB]);
  // 5-9: Top row
  verticesCoords.push([x0, yT], [x1, yT], [x2, yT], [x3, yT], [x4, yT]);

  facesVertices.push(
    [0, 1, 6, 5], // 0: Side1
    [1, 2, 7, 6], // 1: Front
    [2, 3, 8, 7], // 2: Side2
    [3, 4, 9, 8]  // 3: Back
  );

  const flapH = D / 2;
  const dustH = Math.min(D / 2, W / 4);
  const chamfer = D * 0.15;

  // Top Flaps
  const v10_idx = verticesCoords.length;
  const v11_idx = verticesCoords.length + 1;
  verticesCoords.push([x0 + 3, yT + dustH], [x1 - 3, yT + dustH]);
  facesVertices.push([5, 6, v11_idx, v10_idx]); // 4: Side1 Top Dust

  const v12_idx = verticesCoords.length;
  const v13_idx = verticesCoords.length + 1;
  verticesCoords.push([x1 + chamfer, yT + flapH], [x2 - chamfer, yT + flapH]);
  facesVertices.push([6, 7, v13_idx, v12_idx]); // 5: Front Top Main

  const v14_idx = verticesCoords.length;
  const v15_idx = verticesCoords.length + 1;
  verticesCoords.push([x2 + 3, yT + dustH], [x3 - 3, yT + dustH]);
  facesVertices.push([7, 8, v15_idx, v14_idx]); // 6: Side2 Top Dust

  const v16_idx = verticesCoords.length;
  const v17_idx = verticesCoords.length + 1;
  verticesCoords.push([x3 + chamfer, yT + flapH], [x4 - chamfer, yT + flapH]);
  facesVertices.push([8, 9, v17_idx, v16_idx]); // 7: Back Top Main

  // Bottom Flaps
  const v18_idx = verticesCoords.length;
  const v19_idx = verticesCoords.length + 1;
  verticesCoords.push([x0 + 3, yB - dustH], [x1 - 3, yB - dustH]);
  facesVertices.push([0, v18_idx, v19_idx, 1]); // 8: Side1 Bottom Dust

  const v20_idx = verticesCoords.length;
  const v21_idx = verticesCoords.length + 1;
  verticesCoords.push([x1 + chamfer, yB - flapH], [x2 - chamfer, yB - flapH]);
  facesVertices.push([1, v20_idx, v21_idx, 2]); // 9: Front Bottom Main

  const v22_idx = verticesCoords.length;
  const v23_idx = verticesCoords.length + 1;
  verticesCoords.push([x2 + 3, yB - dustH], [x3 - 3, yB - dustH]);
  facesVertices.push([2, v22_idx, v23_idx, 3]); // 10: Side2 Bottom Dust

  const v24_idx = verticesCoords.length;
  const v25_idx = verticesCoords.length + 1;
  verticesCoords.push([x3 + chamfer, yB - flapH], [x4 - chamfer, yB - flapH]);
  facesVertices.push([3, v24_idx, v25_idx, 4]); // 11: Back Bottom Main

  // Glue Tab
  if (T > 0) {
    const [o1, o2] = computeTabOuterVertices(
      verticesCoords[5] as [number, number],
      verticesCoords[0] as [number, number],
      verticesCoords[6] as [number, number],
      T,
      params.tabTaperRatio ?? 0.3
    );
    const o1_idx = verticesCoords.length;
    const o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([5, o1_idx, o2_idx, 0]); // 12: Glue tab
  }

  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices,
    tabFaceIndices,
    90 // tabs valley fold
  );

  return { verticesCoords, edgesVertices, edgesAssignment, edgesFoldAngle, facesVertices };
}

/**
 * Generates the FOLD data for a snap-lock / corner-locked tray.
 */
export function generateSnapLockFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;

  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];

  // Bottom Center (v0-v3)
  verticesCoords.push(
    [-W / 2, -D / 2], // 0
    [W / 2, -D / 2],  // 1
    [W / 2, D / 2],   // 2
    [-W / 2, D / 2]   // 3
  );
  facesVertices.push([0, 1, 2, 3]); // 0: Bottom

  // Front Wall (v4-v5)
  verticesCoords.push([-W / 2, -D / 2 - H], [W / 2, -D / 2 - H]); // 4, 5
  facesVertices.push([0, 4, 5, 1]); // 1: Front

  // Back Wall (v6-v7)
  verticesCoords.push([W / 2, D / 2 + H], [-W / 2, D / 2 + H]); // 6, 7
  facesVertices.push([2, 6, 7, 3]); // 2: Back

  // Left Wall (v8-v9)
  verticesCoords.push([-W / 2 - H, D / 2], [-W / 2 - H, -D / 2]); // 8, 9
  facesVertices.push([3, 8, 9, 0]); // 3: Left

  // Right Wall (v10-v11)
  verticesCoords.push([W / 2 + H, -D / 2], [W / 2 + H, D / 2]); // 10, 11
  facesVertices.push([1, 10, 11, 2]); // 4: Right

  // Corner Ears (Attached to Front and Back walls, fold inwards to lock Sides)
  const earW = Math.min(D * 0.8, H);

  // Front-Left Ear (Hinge: 4->0)
  const v12_idx = verticesCoords.length;
  const v13_idx = verticesCoords.length + 1;
  verticesCoords.push([-W / 2 - earW, -D / 2 - H], [-W / 2 - earW, -D / 2]);
  facesVertices.push([4, 0, v13_idx, v12_idx]); // 5: Front-Left Ear

  // Front-Right Ear (Hinge: 1->5)
  const v14_idx = verticesCoords.length;
  const v15_idx = verticesCoords.length + 1;
  verticesCoords.push([W / 2 + earW, -D / 2], [W / 2 + earW, -D / 2 - H]);
  facesVertices.push([1, 5, v15_idx, v14_idx]); // 6: Front-Right Ear

  // Back-Left Ear (Hinge: 3->7)
  const v16_idx = verticesCoords.length;
  const v17_idx = verticesCoords.length + 1;
  verticesCoords.push([-W / 2 - earW, D / 2], [-W / 2 - earW, D / 2 + H]);
  facesVertices.push([3, 7, v17_idx, v16_idx]); // 7: Back-Left Ear

  // Back-Right Ear (Hinge: 6->2)
  const v18_idx = verticesCoords.length;
  const v19_idx = verticesCoords.length + 1;
  verticesCoords.push([W / 2 + earW, D / 2 + H], [W / 2 + earW, D / 2]);
  facesVertices.push([6, 2, v19_idx, v18_idx]); // 8: Back-Right Ear

  // All folds default to -90° (mountain), which creates the lock correctly
  // as the ear will fold inward relative to the front/back panels.
  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices
  );

  return { verticesCoords, edgesVertices, edgesAssignment, edgesFoldAngle, facesVertices };
}