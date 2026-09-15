import { FoldData } from "./foldEngine";

export function findFaceForBorderEdge(v1: number, v2: number, foldData: FoldData): number {
  for (let f = 0; f < foldData.facesVertices.length; f++) {
    const face = foldData.facesVertices[f];
    for (let i = 0; i < face.length; i++) {
      const fv1 = face[i];
      const fv2 = face[(i + 1) % face.length];
      if ((fv1 === v1 && fv2 === v2) || (fv1 === v2 && fv2 === v1)) {
        return f;
      }
    }
  }
  return -1;
}

export function getFaceCentroid(faceIndex: number, foldData: FoldData): [number, number] {
  const face = foldData.facesVertices[faceIndex];
  let cx = 0;
  let cy = 0;
  for (const v of face) {
    cx += foldData.verticesCoords[v][0];
    cy += foldData.verticesCoords[v][1];
  }
  return [cx / face.length, cy / face.length];
}

export function pointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function computeEdgeOutwardNormal(
  v1: [number, number],
  v2: [number, number],
  centroid: [number, number]
): [number, number] {
  const dx = v2[0] - v1[0];
  const dy = v2[1] - v1[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx1 = dy / len;
  const ny1 = -dx / len;
  
  const mx = (v1[0] + v2[0]) / 2;
  const my = (v1[1] + v2[1]) / 2;
  
  const vx = mx - centroid[0];
  const vy = my - centroid[1];
  
  const dot = nx1 * vx + ny1 * vy;
  return dot > 0 ? [nx1, ny1] : [-nx1, -ny1];
}