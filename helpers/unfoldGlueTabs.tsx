import { Vec2, len2, polygonsOverlapSAT } from "./unfoldMathHelpers";

export function tryPlaceTab(
  origF: number,
  vA: number,
  vB: number,
  ptA: Vec2,
  ptB: Vec2,
  faces2D: Map<number, { faceIdx: number; vertices2D: Map<number, Vec2> }>,
  meshFaces: number[][],
  glueTabSize: number,
  glueTabAngle: number,
  vA_idx: number,
  vB_idx: number,
  allFacePolygons: { poly: Vec2[]; vIndices: Set<number> }[],
  placedTabPolygons: { poly: Vec2[]; vIndices: Set<number> }[]
): { ot1: Vec2; ot2: Vec2 } | null {
  const f2D = faces2D.get(origF);
  if (!f2D) return null;

  const dx = ptB[0] - ptA[0];
  const dy = ptB[1] - ptA[1];
  const len = len2([dx, dy]);
  const minEdgeForTab = Math.max(2, glueTabSize * 0.15);
  if (len < minEdgeForTab) return null;

  const ux = dx / len;
  const uy = dy / len;
  let nx = dy / len;
  let ny = -dx / len;

  const faceVerts = meshFaces[origF];
  let cx = 0, cy = 0;
  for (const vIdx of faceVerts) {
    const pt = f2D.vertices2D.get(vIdx)!;
    cx += pt[0];
    cy += pt[1];
  }
  cx /= faceVerts.length;
  cy /= faceVerts.length;

  const edgeMidX = (ptA[0] + ptB[0]) / 2;
  const edgeMidY = (ptA[1] + ptB[1]) / 2;
  const toCentroidX = edgeMidX - cx;
  const toCentroidY = edgeMidY - cy;
  if (nx * toCentroidX + ny * toCentroidY < 0) {
    nx = -nx;
    ny = -ny;
  }

  const effectiveTabSize = Math.min(glueTabSize, len * 0.8);
  const taper = effectiveTabSize * Math.tan((glueTabAngle * Math.PI) / 180);
  const actualTaper = Math.min(taper, len * 0.45);

  const ot1: Vec2 = [
    ptB[0] + nx * effectiveTabSize - ux * actualTaper,
    ptB[1] + ny * effectiveTabSize - uy * actualTaper,
  ];
  const ot2: Vec2 = [
    ptA[0] + nx * effectiveTabSize + ux * actualTaper,
    ptA[1] + ny * effectiveTabSize + uy * actualTaper,
  ];

  const tabPoly = [ptB, ptA, ot2, ot1];

  for (const existing of allFacePolygons) {
    let sharedCount = 0;
    if (existing.vIndices.has(vA_idx)) sharedCount++;
    if (existing.vIndices.has(vB_idx)) sharedCount++;
    if (sharedCount >= 2) continue;

    if (polygonsOverlapSAT(tabPoly, existing.poly, 0.5)) {
      return null;
    }
  }

  for (const existing of placedTabPolygons) {
    let sharedCount = 0;
    if (existing.vIndices.has(vA_idx)) sharedCount++;
    if (existing.vIndices.has(vB_idx)) sharedCount++;
    if (sharedCount >= 2) continue;

    if (polygonsOverlapSAT(tabPoly, existing.poly, 0.5)) {
      return null;
    }
  }

  return { ot1, ot2 };
}