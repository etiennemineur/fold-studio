import { FoldData } from "./foldEngine";

export interface VertexValidation {
  vertexIndex: number;
  position: [number, number];
  isInterior: boolean;
  kawasakiValid: boolean;
  maekawValid: boolean;
  sectorAngles: number[];
  kawasakiDeviation: number;
  mountainCount: number;
  valleyCount: number;
}

export interface FoldValidationResult {
  vertices: VertexValidation[];
  isValid: boolean;
  kawasakiViolations: number[];
  maekawViolations: number[];
}

export function foldValidation(foldData: FoldData): FoldValidationResult {
  const boundaryVertices = new Set<number>();
  
  // 1. Find all boundary vertices
  foldData.edgesAssignment.forEach((assign, i) => {
    if (assign === 'B') {
      boundaryVertices.add(foldData.edgesVertices[i][0]);
      boundaryVertices.add(foldData.edgesVertices[i][1]);
    }
  });

  // 2. Pre-compute incident edges for fast lookup
  const vertexIncidentEdges = new Map<number, number[]>();
  for (let i = 0; i < foldData.verticesCoords.length; i++) {
    vertexIncidentEdges.set(i, []);
  }

  foldData.edgesVertices.forEach((edge, edgeIndex) => {
    vertexIncidentEdges.get(edge[0])!.push(edgeIndex);
    vertexIncidentEdges.get(edge[1])!.push(edgeIndex);
  });

  const vertices: VertexValidation[] = [];
  const kawasakiViolations: number[] = [];
  const maekawViolations: number[] = [];
  let allInteriorValid = true;

  // 3. Process each vertex
  for (let vIdx = 0; vIdx < foldData.verticesCoords.length; vIdx++) {
    const isInterior = !boundaryVertices.has(vIdx);
    const edges = vertexIncidentEdges.get(vIdx)!;
    
    let mCount = 0;
    let vCount = 0;
    edges.forEach(eIdx => {
      const assign = foldData.edgesAssignment[eIdx];
      if (assign === 'M') mCount++;
      if (assign === 'V') vCount++;
    });

    const position: [number, number] = [
      foldData.verticesCoords[vIdx][0],
      foldData.verticesCoords[vIdx][1]
    ];

    if (!isInterior) {
      vertices.push({
        vertexIndex: vIdx,
        position,
        isInterior,
        kawasakiValid: true,
        maekawValid: true,
        sectorAngles: [],
        kawasakiDeviation: 0,
        mountainCount: mCount,
        valleyCount: vCount
      });
      continue;
    }

    // Maekawa's Theorem check
    const maekawValid = Math.abs(mCount - vCount) === 2;
    if (!maekawValid) {
      maekawViolations.push(vIdx);
    }

    // Kawasaki's Theorem check
    const edgeAngles = edges.map(eIdx => {
      const edge = foldData.edgesVertices[eIdx];
      const otherVIdx = edge[0] === vIdx ? edge[1] : edge[0];
      const v = foldData.verticesCoords[vIdx];
      const otherV = foldData.verticesCoords[otherVIdx];
      const angle = Math.atan2(otherV[1] - v[1], otherV[0] - v[0]);
      return { eIdx, angle };
    });

    edgeAngles.sort((a, b) => a.angle - b.angle);

    const sectorAngles: number[] = [];
    let sumEven = 0;
    let sumOdd = 0;

    for (let i = 0; i < edgeAngles.length; i++) {
      const current = edgeAngles[i].angle;
      const next = edgeAngles[(i + 1) % edgeAngles.length].angle;
      let diff = next - current;
      // Handle wrap around the circle 
      if (diff < 0) {
        diff += 2 * Math.PI;
      }
      sectorAngles.push(diff);
      if (i % 2 === 0) {
        sumEven += diff;
      } else {
        sumOdd += diff;
      }
    }

    const kawasakiDeviation = Math.abs(sumEven - Math.PI);
    // Flat-foldable nodes strictly require an even degree to satisfy Kawasaki
    const kawasakiValid = edgeAngles.length % 2 === 0 && kawasakiDeviation < 0.05 && Math.abs(sumOdd - Math.PI) < 0.05;

    if (!kawasakiValid) {
      kawasakiViolations.push(vIdx);
    }

    if (!kawasakiValid || !maekawValid) {
      allInteriorValid = false;
    }

    vertices.push({
      vertexIndex: vIdx,
      position,
      isInterior,
      kawasakiValid,
      maekawValid,
      sectorAngles,
      kawasakiDeviation,
      mountainCount: mCount,
      valleyCount: vCount
    });
  }

  return {
    vertices,
    isValid: allInteriorValid,
    kawasakiViolations,
    maekawViolations
  };
}