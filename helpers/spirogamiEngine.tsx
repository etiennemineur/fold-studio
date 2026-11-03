import { FoldData } from "./foldEngine";
import { getFoldEdgeSignature } from "./foldEdgeInteraction";

export interface SpirogamiParams {
  discRadius: number;
  innerRadius: number;
  turns: number;
  stripHeight: number;
  stripWidth: number;
  gapWidth: number;
  paperThickness: number;
  paperColor: string;
  segmentsPerTurn: number;
  foldOverrides?: Record<string, 'M' | 'V'>;
}

export function getDefaultSpirogamiParams(): SpirogamiParams {
  return {
    discRadius: 100,
    innerRadius: 15,
    turns: 4,
    stripHeight: 40,
    stripWidth: 8,
    gapWidth: 2,
    paperThickness: 0.5,
    paperColor: '#F3EFE6',
    segmentsPerTurn: 64,
    foldOverrides: {}
  };
}

// Shared by numeric controls and both public generators (including restored projects).
export const SPIROGAMI_BOUNDS = {
  discRadius: [50, 200], innerRadius: [5, 50], turns: [1, 10],
  stripHeight: [5, 100], stripWidth: [2, 20], gapWidth: [0.5, 10],
  paperThickness: [0.1, 5], segmentsPerTurn: [8, 128],
} as const;

export function normalizeSpirogamiParams(params: SpirogamiParams): SpirogamiParams {
  const result = { ...params };
  const defaults = getDefaultSpirogamiParams();
  for (const key of Object.keys(SPIROGAMI_BOUNDS) as (keyof typeof SPIROGAMI_BOUNDS)[]) {
    const [min, max] = SPIROGAMI_BOUNDS[key];
    const value = Number.isFinite(params[key]) ? params[key] : defaults[key];
    result[key] = Math.max(min, Math.min(max, value));
  }
  result.segmentsPerTurn = Math.round(result.segmentsPerTurn);
  return result;
}

export function generateSpirogamiMeshData(params: SpirogamiParams, progress: number) {
  params = normalizeSpirogamiParams(params);
  progress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const numSegments = Math.floor(params.turns * params.segmentsPerTurn);
  const dTheta = (Math.PI * 2) / params.segmentsPerTurn;
  const rStep = (params.stripWidth + params.gapWidth) / (Math.PI * 2);

  const stripPos: number[] = [];
  const stripEdge: number[] = [];
  const spiralLine: number[] = [];

  for (let i = 0; i < numSegments; i++) {
    const theta1 = i * dTheta;
    const theta2 = (i + 1) * dTheta;

    const r1 = params.innerRadius + rStep * theta1;
    const r2 = params.innerRadius + rStep * theta2;

    const P1 = [r1 * Math.cos(theta1), r1 * Math.sin(theta1), 0];
    const P2 = [r2 * Math.cos(theta2), r2 * Math.sin(theta2), 0];

    // Tangent derivatives
    const dr1 = rStep;
    const dr2 = rStep;

    const T1 = [
      dr1 * Math.cos(theta1) - r1 * Math.sin(theta1),
      dr1 * Math.sin(theta1) + r1 * Math.cos(theta1),
      0
    ];
    const lenT1 = Math.hypot(T1[0], T1[1]);
    T1[0] /= lenT1; T1[1] /= lenT1;

    const T2 = [
      dr2 * Math.cos(theta2) - r2 * Math.sin(theta2),
      dr2 * Math.sin(theta2) + r2 * Math.cos(theta2),
      0
    ];
    const lenT2 = Math.hypot(T2[0], T2[1]);
    T2[0] /= lenT2; T2[1] /= lenT2;

    // Outward Normal
    const N1 = [T1[1], -T1[0], 0];
    const N2 = [T2[1], -T2[0], 0];

    const alpha = progress * (Math.PI / 2);
    const cosA = Math.cos(alpha);
    const sinA = Math.sin(alpha);

    const Top1 = [
      P1[0] + params.stripHeight * (cosA * N1[0]),
      P1[1] + params.stripHeight * (cosA * N1[1]),
      params.stripHeight * sinA
    ];

    const Top2 = [
      P2[0] + params.stripHeight * (cosA * N2[0]),
      P2[1] + params.stripHeight * (cosA * N2[1]),
      params.stripHeight * sinA
    ];

    // Strip quads -> triangles (P1, Top1, P2) & (P2, Top1, Top2)
    stripPos.push(
      P1[0], P1[1], P1[2],
      Top1[0], Top1[1], Top1[2],
      P2[0], P2[1], P2[2],

      P2[0], P2[1], P2[2],
      Top1[0], Top1[1], Top1[2],
      Top2[0], Top2[1], Top2[2]
    );

    // Strip Edge Lines
    stripEdge.push(P1[0], P1[1], P1[2], P2[0], P2[1], P2[2]);
    stripEdge.push(Top1[0], Top1[1], Top1[2], Top2[0], Top2[1], Top2[2]);
    stripEdge.push(P1[0], P1[1], P1[2], Top1[0], Top1[1], Top1[2]);
    if (i === numSegments - 1) {
      stripEdge.push(P2[0], P2[1], P2[2], Top2[0], Top2[1], Top2[2]);
    }

    // Spiral path line on the base
    spiralLine.push(P1[0], P1[1], P1[2], P2[0], P2[1], P2[2]);
  }

  // Base Disc
  const basePos: number[] = [];
  const numBaseSegments = 128;
  const dThetaBase = (Math.PI * 2) / numBaseSegments;
  const halfStrip = params.stripWidth / 2;
  const maxR = params.discRadius;

  function getDiscBandsAtAngle(angle: number) {
    const bands: [number, number][] = [];
    const crossings: number[] = [];
    
    const maxTheta = params.turns * Math.PI * 2;
    let k = 0;
    while (true) {
      const t = angle + Math.PI * 2 * k;
      if (t > maxTheta) break;
      const r = params.innerRadius + rStep * t;
      if (r <= maxR) {
        crossings.push(r);
      }
      k++;
    }

    let currentR = 0;
    for (let i = 0; i < crossings.length; i++) {
      const crossR = crossings[i];
      const innerEdge = crossR - halfStrip;
      const outerEdge = crossR + halfStrip;
      
      if (innerEdge > currentR) {
        bands.push([currentR, Math.min(innerEdge, maxR)]);
      }
      currentR = outerEdge;
    }
    if (currentR < maxR) {
      bands.push([currentR, maxR]);
    }
    
    return { bands, crossings };
  }

  for (let i = 0; i < numBaseSegments; i++) {
    const theta1 = i * dThetaBase;
    const theta2 = (i + 1) * dThetaBase;
    
    const { bands: bands1, crossings: cross1 } = getDiscBandsAtAngle(theta1);
    const { bands: bands2, crossings: cross2 } = getDiscBandsAtAngle(theta2);
    
    const numBands = Math.min(bands1.length, bands2.length);
    for (let j = 0; j < numBands; j++) {
      const [in1, out1] = bands1[j];
      const [in2, out2] = bands2[j];
      
      const p1 = [in1 * Math.cos(theta1), in1 * Math.sin(theta1), -0.1];
      const p2 = [out1 * Math.cos(theta1), out1 * Math.sin(theta1), -0.1];
      const p3 = [in2 * Math.cos(theta2), in2 * Math.sin(theta2), -0.1];
      const p4 = [out2 * Math.cos(theta2), out2 * Math.sin(theta2), -0.1];
      
      if (in1 === 0 && in2 === 0) {
        basePos.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p4[0], p4[1], p4[2]);
      } else {
        basePos.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
        basePos.push(p2[0], p2[1], p2[2], p4[0], p4[1], p4[2], p3[0], p3[1], p3[2]);
      }
    }

    const numCross = Math.min(cross1.length, cross2.length);
    for (let j = 0; j < numCross; j++) {
      const c1 = cross1[j];
      const c2 = cross2[j];
      
      const in1 = c1 - halfStrip;
      const in2 = c2 - halfStrip;
      const out1 = c1 + halfStrip;
      const out2 = c2 + halfStrip;

      spiralLine.push(in1 * Math.cos(theta1), in1 * Math.sin(theta1), -0.1);
      spiralLine.push(in2 * Math.cos(theta2), in2 * Math.sin(theta2), -0.1);

      spiralLine.push(out1 * Math.cos(theta1), out1 * Math.sin(theta1), -0.1);
      spiralLine.push(out2 * Math.cos(theta2), out2 * Math.sin(theta2), -0.1);
    }
  }

  return {
    stripPositions: new Float32Array(stripPos),
    basePositions: new Float32Array(basePos),
    stripEdgePositions: new Float32Array(stripEdge),
    spiralLinePositions: new Float32Array(spiralLine)
  };
}

export function generateSpirogamiFlatFoldData(params: SpirogamiParams): FoldData {
  params = normalizeSpirogamiParams(params);
  const verticesCoords: [number, number, number?][] = [];
  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];
  const facesVertices: number[][] = [];

  // 1. Base Disc
  const discStartIdx = verticesCoords.length;
  const numDiscSides = 64;
  const discFace: number[] = [];
  for (let i = 0; i < numDiscSides; i++) {
    const a = (i / numDiscSides) * Math.PI * 2;
    verticesCoords.push([params.discRadius * Math.cos(a), params.discRadius * Math.sin(a)]);
    discFace.push(discStartIdx + i);
  }
  facesVertices.push(discFace);

  for (let i = 0; i < numDiscSides; i++) {
    edgesVertices.push([discStartIdx + i, discStartIdx + ((i + 1) % numDiscSides)]);
    edgesAssignment.push('B');
    edgesFoldAngle.push(0);
  }

  // Spiral cut line on base disc
  const spiralStartIdx = verticesCoords.length;
  let totalArcLength = 0;
  const numSegments = Math.floor(params.turns * params.segmentsPerTurn);
  const dTheta = (Math.PI * 2) / params.segmentsPerTurn;
  const rStep = (params.stripWidth + params.gapWidth) / (Math.PI * 2);

  const spiralLengths: number[] = [0];

  for (let i = 0; i <= numSegments; i++) {
    const theta = i * dTheta;
    const r = params.innerRadius + rStep * theta;
    verticesCoords.push([r * Math.cos(theta), r * Math.sin(theta)]);
    
    if (i > 0) {
      const prev = verticesCoords[spiralStartIdx + i - 1];
      const curr = verticesCoords[spiralStartIdx + i];
      const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
      totalArcLength += dist;
      spiralLengths.push(totalArcLength);
      
      edgesVertices.push([spiralStartIdx + i - 1, spiralStartIdx + i]);
      edgesAssignment.push('V'); 
      edgesFoldAngle.push(90);
    }
  }

  // 2. Unwound strip
  const stripY = -params.discRadius - params.stripHeight - 20;
  const stripStartIdx = verticesCoords.length;

  for (let i = 0; i <= numSegments; i++) {
    const x = spiralLengths[i] - totalArcLength / 2;
    verticesCoords.push([x, stripY]);
    verticesCoords.push([x, stripY + params.stripHeight]);
  }

  for (let i = 0; i < numSegments; i++) {
    const bl = stripStartIdx + i * 2;
    const tl = stripStartIdx + i * 2 + 1;
    const br = stripStartIdx + (i + 1) * 2;
    const tr = stripStartIdx + (i + 1) * 2 + 1;
    
    facesVertices.push([bl, br, tr, tl]);
    
    edgesVertices.push([bl, br]);
    edgesAssignment.push('B');
    edgesFoldAngle.push(0);
    
    edgesVertices.push([tl, tr]);
    edgesAssignment.push('B');
    edgesFoldAngle.push(0);
    
    if (i > 0) {
      edgesVertices.push([bl, tl]);
      edgesAssignment.push('F');
      edgesFoldAngle.push(0);
    }
  }

  edgesVertices.push([stripStartIdx, stripStartIdx + 1]);
  edgesAssignment.push('B');
  edgesFoldAngle.push(0);

  const lastBl = stripStartIdx + numSegments * 2;
  const lastTl = stripStartIdx + numSegments * 2 + 1;
  edgesVertices.push([lastBl, lastTl]);
  edgesAssignment.push('B');
  edgesFoldAngle.push(0);

  const foldData: FoldData = {
    verticesCoords,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    facesVertices
  };

  if (params.foldOverrides) {
    edgesVertices.forEach((_, edgeIndex) => {
      const current = edgesAssignment[edgeIndex];
      if (current !== 'M' && current !== 'V') return;
      const override = params.foldOverrides?.[getFoldEdgeSignature(foldData, edgeIndex)];
      if (!override || override === current) return;
      edgesAssignment[edgeIndex] = override;
      const angle = edgesFoldAngle[edgeIndex] ?? 0;
      edgesFoldAngle[edgeIndex] = angle !== 0 ? -angle : override === 'M' ? -90 : 90;
    });
  }

  return foldData;
}