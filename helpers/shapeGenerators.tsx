import { BoxParams, FoldData, computeTabOuterVertices } from "./foldEngine";

/**
 * Helper to compute edges, assignments, and fold angles from faces.
 * Boundary edges get 'B' / 0°, internal hinges get 'M' / -90°.
 * Tab hinges (connected to tabFaceIndices) get 'V' / 90°.
 */
function buildEdgesFromFaces(
  facesVertices: number[][],
  tabFaceIndices?: Set<number>,
  tabFoldAngle?: number
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

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push("B");
      edgesFoldAngle.push(0);
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

  return { edgesVertices, edgesAssignment, edgesFoldAngle };
}

/**
 * Generates the FOLD data for an octagonal prism box.
 */
export function generateOctagonalFoldData(params: BoxParams): FoldData {
  const S = params.width / 2;
  const H = params.height;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];

  const edgeLen = 2 * S * Math.sin(Math.PI / 8);
  const flapH = Math.min(edgeLen * 0.4, S * 0.5);
  const effectiveT = Math.min(T, H * 0.4);
  const tabFaceIndices = new Set<number>();

  // Base Octagon
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    verticesCoords.push([S * Math.cos(angle), S * Math.sin(angle)]);
  }
  facesVertices.push([0, 1, 2, 3, 4, 5, 6, 7]);

  // Side panels, Flaps, and Tabs
  for (let i = 0; i < 8; i++) {
    const A = i;
    const B = (i + 1) % 8;
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

    // Flaps on alternate side panels (0, 2, 4, 6)
    if (i % 2 === 0) {
      const E_idx = verticesCoords.length;
      const E: [number, number] = [
        mx + ux * (H + flapH),
        my + uy * (H + flapH),
      ];
      verticesCoords.push(E);
      facesVertices.push([D_idx, E_idx, C_idx]);
    }

    // Tabs on alternate side panels (1, 3, 5, 7)
    if (effectiveT > 0 && i % 2 === 1) {
      const [o1, o2] = computeTabOuterVertices(vB, C, D, effectiveT, params.tabTaperRatio ?? 0.3);
      const o1_idx = verticesCoords.length;
      const o2_idx = verticesCoords.length + 1;
      verticesCoords.push(o1, o2);
      tabFaceIndices.add(facesVertices.length);
      facesVertices.push([C_idx, o2_idx, o1_idx, B]);
    }
  }

  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices,
    tabFaceIndices,
    -(360 / 8)
  );

  return {
    verticesCoords,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    facesVertices,
  };
}

/**
 * Generates the FOLD data for a pentagonal prism box.
 */
export function generatePentagonalFoldData(params: BoxParams): FoldData {
  const S = params.width / 2;
  const H = params.height;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];

  const edgeLen = 2 * S * Math.sin(Math.PI / 5);
  const flapH = Math.min(edgeLen * 0.4, S * 0.5);
  const effectiveT = Math.min(T, H * 0.4);
  const tabFaceIndices = new Set<number>();

  // Base Pentagon
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5;
    verticesCoords.push([S * Math.cos(angle), S * Math.sin(angle)]);
  }
  facesVertices.push([0, 1, 2, 3, 4]);

  // Side panels, Flaps, and Tabs
  for (let i = 0; i < 5; i++) {
    const A = i;
    const B = (i + 1) % 5;
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

    // Flaps on every panel
    const E_idx = verticesCoords.length;
    const E: [number, number] = [mx + ux * (H + flapH), my + uy * (H + flapH)];
    verticesCoords.push(E);
    facesVertices.push([D_idx, E_idx, C_idx]);

    // Tabs on 2 alternating side panels
    if (effectiveT > 0 && (i === 1 || i === 3)) {
      const [o1, o2] = computeTabOuterVertices(vB, C, D, effectiveT, params.tabTaperRatio ?? 0.3);
      const o1_idx = verticesCoords.length;
      const o2_idx = verticesCoords.length + 1;
      verticesCoords.push(o1, o2);
      tabFaceIndices.add(facesVertices.length);
      facesVertices.push([C_idx, o2_idx, o1_idx, B]);
    }
  }

  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices,
    tabFaceIndices,
    -(360 / 5)
  );

  return {
    verticesCoords,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    facesVertices,
  };
}

/**
 * Generates the FOLD data for a hinged-lid mailer box.
 */
export function generateMailerFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;

  const verticesCoords: [number, number, number?][] = [
    // Bottom Face (0-3)
    [-W / 2, -D / 2],
    [W / 2, -D / 2],
    [W / 2, D / 2],
    [-W / 2, D / 2],
    // Front side (4-5)
    [-W / 2, -D / 2 - H],
    [W / 2, -D / 2 - H],
    // Back side (6-7)
    [W / 2, D / 2 + H],
    [-W / 2, D / 2 + H],
    // Left side (8-9)
    [-W / 2 - H, D / 2],
    [-W / 2 - H, -D / 2],
    // Right side (10-11)
    [W / 2 + H, -D / 2],
    [W / 2 + H, D / 2],
    // Lid panel (12-13)
    [-W / 2, -D / 2 - H - D],
    [W / 2, -D / 2 - H - D],
    // Tuck flap (14-15) - tapered
    [-W / 2 + 3, -D / 2 - H - D - 15],
    [W / 2 - 3, -D / 2 - H - D - 15],
    // Left dust flap (16-17) - tapered
    [-W / 2 - H * 0.8, -D / 2 - H - 5],
    [-W / 2 - H * 0.8, -D / 2 - H - D + 5],
    // Right dust flap (18-19) - tapered
    [W / 2 + H * 0.8, -D / 2 - H - 5],
    [W / 2 + H * 0.8, -D / 2 - H - D + 5],
  ];

  const facesVertices: number[][] = [
    [0, 1, 2, 3], // 0: Bottom
    [0, 4, 5, 1], // 1: Front
    [2, 6, 7, 3], // 2: Back
    [3, 8, 9, 0], // 3: Left
    [1, 10, 11, 2], // 4: Right
    [5, 4, 12, 13], // 5: Lid
    [13, 12, 14, 15], // 6: Tuck flap
    [12, 4, 16, 17], // 7: Left dust flap
    [5, 13, 19, 18], // 8: Right dust flap
  ];

  const effectiveT = Math.min(T, H * 0.4);
  const tabFaceIndices = new Set<number>();

  if (effectiveT > 0) {
    // Tabs on left and right sides
    let [o1, o2] = computeTabOuterVertices(
      verticesCoords[9] as [number, number],
      verticesCoords[0] as [number, number],
      verticesCoords[3] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    let o1_idx = verticesCoords.length;
    let o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([9, o1_idx, o2_idx, 0]);

    [o1, o2] = computeTabOuterVertices(
      verticesCoords[3] as [number, number],
      verticesCoords[8] as [number, number],
      verticesCoords[9] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    o1_idx = verticesCoords.length;
    o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([3, o1_idx, o2_idx, 8]);

    [o1, o2] = computeTabOuterVertices(
      verticesCoords[1] as [number, number],
      verticesCoords[10] as [number, number],
      verticesCoords[11] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    o1_idx = verticesCoords.length;
    o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([1, o1_idx, o2_idx, 10]);

    [o1, o2] = computeTabOuterVertices(
      verticesCoords[11] as [number, number],
      verticesCoords[2] as [number, number],
      verticesCoords[1] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    o1_idx = verticesCoords.length;
    o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([11, o1_idx, o2_idx, 2]);
  }

  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices,
    tabFaceIndices
  );

  return {
    verticesCoords,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    facesVertices,
  };
}

/**
 * Generates the FOLD data for a reverse tuck-end box.
 */
export function generateTuckEndFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;
  const flapH = Math.min(W / 4, D / 2);

  const yB = -H / 2;
  const yT = H / 2;
  const x0 = -D - W;
  const x1 = -W;
  const x2 = 0;
  const x3 = D;
  const x4 = D + W;

  const verticesCoords: [number, number, number?][] = [
    // Bottom row (0-4)
    [x0, yB],
    [x1, yB],
    [x2, yB],
    [x3, yB],
    [x4, yB],
    // Top row (5-9)
    [x0, yT],
    [x1, yT],
    [x2, yT],
    [x3, yT],
    [x4, yT],
    // Top Side 1 flap (10-11)
    [x1 - 3, yT + flapH],
    [x0 + 3, yT + flapH],
    // Top Side 2 flap (12-13)
    [x3 - 3, yT + flapH],
    [x2 + 3, yT + flapH],
    // Top tuck main (14-15)
    [x2, yT + D],
    [x1, yT + D],
    // Top tuck tab (16-17)
    [x2 - 3, yT + D + 15],
    [x1 + 3, yT + D + 15],
    // Bottom Side 1 flap (18-19)
    [x0 + 3, yB - flapH],
    [x1 - 3, yB - flapH],
    // Bottom Side 2 flap (20-21)
    [x2 + 3, yB - flapH],
    [x3 - 3, yB - flapH],
    // Bottom tuck main (22-23)
    [x3, yB - D],
    [x4, yB - D],
    // Bottom tuck tab (24-25)
    [x3 + 3, yB - D - 15],
    [x4 - 3, yB - D - 15],
  ];

  const facesVertices: number[][] = [
    [1, 2, 7, 6], // 0: Front
    [0, 1, 6, 5], // 1: Side 1
    [2, 3, 8, 7], // 2: Side 2
    [3, 4, 9, 8], // 3: Back
    [6, 10, 11, 5], // 4: Top Side 1 flap
    [8, 12, 13, 7], // 5: Top Side 2 flap
    [7, 14, 15, 6], // 6: Top tuck main
    [14, 16, 17, 15], // 7: Top tuck tab
    [0, 18, 19, 1], // 8: Bottom Side 1 flap
    [2, 20, 21, 3], // 9: Bottom Side 2 flap
    [3, 22, 23, 4], // 10: Bottom tuck main
    [22, 24, 25, 23], // 11: Bottom tuck tab
  ];

  const effectiveT = Math.min(T, H * 0.4);
  const tabFaceIndices = new Set<number>();

  if (effectiveT > 0) {
    // Glue tab on the left edge of Side 1
    let [o1, o2] = computeTabOuterVertices(
      verticesCoords[5] as [number, number],
      verticesCoords[0] as [number, number],
      verticesCoords[1] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    let o1_idx = verticesCoords.length;
    let o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([5, o1_idx, o2_idx, 0]);
  }

  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices,
    tabFaceIndices
  );

  return {
    verticesCoords,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    facesVertices,
  };
}

/**
 * Generates the FOLD data for an open-front display box.
 */
export function generateDisplayFoldData(params: BoxParams): FoldData {
  const W = params.width;
  const H = params.height;
  const D = params.depth;
  const T = params.glueTabSize;
  const effectiveT = Math.min(T, H * 0.4);

  const verticesCoords: [number, number, number?][] = [
    // Bottom (0-3)
    [-W / 2, -D / 2],
    [W / 2, -D / 2],
    [W / 2, D / 2],
    [-W / 2, D / 2],
    // Front wall (shorter, 40% of H) (4-5)
    [-W / 2, -D / 2 - H * 0.4],
    [W / 2, -D / 2 - H * 0.4],
    // Back wall (full height) (6-7)
    [W / 2, D / 2 + H],
    [-W / 2, D / 2 + H],
    // Left wall (full height) (8-9)
    [-W / 2 - H, D / 2],
    [-W / 2 - H, -D / 2],
    // Right wall (full height) (10-11)
    [W / 2 + H, -D / 2],
    [W / 2 + H, D / 2],
  ];

  const facesVertices: number[][] = [
    [0, 1, 2, 3], // 0: Bottom
    [0, 4, 5, 1], // 1: Front
    [2, 6, 7, 3], // 2: Back
    [3, 8, 9, 0], // 3: Left
    [1, 10, 11, 2], // 4: Right
  ];

  const tabFaceIndices = new Set<number>();

  if (effectiveT > 0) {
    // Left side bottom: 9->0
    let [o1, o2] = computeTabOuterVertices(
      verticesCoords[9] as [number, number],
      verticesCoords[0] as [number, number],
      verticesCoords[3] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    let o1_idx = verticesCoords.length;
    let o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([9, o1_idx, o2_idx, 0]);

    // Left side top: 3->8
    [o1, o2] = computeTabOuterVertices(
      verticesCoords[3] as [number, number],
      verticesCoords[8] as [number, number],
      verticesCoords[9] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    o1_idx = verticesCoords.length;
    o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([3, o1_idx, o2_idx, 8]);

    // Right side bottom: 1->10
    [o1, o2] = computeTabOuterVertices(
      verticesCoords[1] as [number, number],
      verticesCoords[10] as [number, number],
      verticesCoords[11] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    o1_idx = verticesCoords.length;
    o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([1, o1_idx, o2_idx, 10]);

    // Right side top: 11->2
    [o1, o2] = computeTabOuterVertices(
      verticesCoords[11] as [number, number],
      verticesCoords[2] as [number, number],
      verticesCoords[1] as [number, number],
      effectiveT,
      params.tabTaperRatio ?? 0.3
    );
    o1_idx = verticesCoords.length;
    o2_idx = verticesCoords.length + 1;
    verticesCoords.push(o1, o2);
    tabFaceIndices.add(facesVertices.length);
    facesVertices.push([11, o1_idx, o2_idx, 2]);
  }

  const { edgesVertices, edgesAssignment, edgesFoldAngle } = buildEdgesFromFaces(
    facesVertices,
    tabFaceIndices
  );

  return {
    verticesCoords,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    facesVertices,
  };
}