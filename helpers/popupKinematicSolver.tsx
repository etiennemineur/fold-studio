import { FoldData, buildFaceTree, computeFoldedVertices } from "./foldEngine";
import {
  PopupDocument,
  PopupFoldData,
  PopupMechanismFoldMeta,
  popupDocumentToFoldData,
} from "./popupDocument";

type Vec2 = [number, number];
type Vec3 = [number, number, number];

const EPSILON = 1e-7;

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(a: Vec3, scalar: number): Vec3 {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length3(a: Vec3): number {
  return Math.sqrt(dot3(a, a));
}

function normalize3(a: Vec3): Vec3 {
  const length = length3(a);
  return length > EPSILON ? scale3(a, 1 / length) : [0, 0, 0];
}

function distance2(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function smoothClosure(bookAngleDeg: number): number {
  const closure = Math.max(0, Math.min(1, 1 - bookAngleDeg / 180));
  return closure * closure * (3 - 2 * closure);
}

function transformRightCoverPoint(x: number, y: number, bookAngleDeg: number): Vec3 {
  const rotation = (180 - bookAngleDeg) * Math.PI / 180;
  return [x * Math.cos(rotation), y, x * Math.sin(rotation)];
}

/**
 * Three-sphere intersection used by V-folds. Every triangle edge keeps its
 * original paper length throughout the complete opening motion.
 */
function trilaterate(
  anchorA: Vec3,
  anchorB: Vec3,
  anchorC: Vec3,
  radiusA: number,
  radiusB: number,
  radiusC: number,
  direction: "up" | "down",
): Vec3 {
  const ab = sub3(anchorB, anchorA);
  const d = Math.max(length3(ab), EPSILON);
  const ex = normalize3(ab);
  const ac = sub3(anchorC, anchorA);
  const i = dot3(ex, ac);
  const acPerpendicular = sub3(ac, scale3(ex, i));
  const j = length3(acPerpendicular);

  if (j < EPSILON) {
    const x = (radiusA * radiusA - radiusB * radiusB + d * d) / (2 * d);
    const base = add3(anchorA, scale3(ex, x));
    const height = Math.sqrt(Math.max(0, radiusA * radiusA - x * x));
    let normal = normalize3(cross3(ex, [0, 1, 0]));
    if (length3(normal) < EPSILON) normal = [0, 0, 1];
    const candidateA = add3(base, scale3(normal, height));
    const candidateB = add3(base, scale3(normal, -height));
    return direction === "up"
      ? (candidateA[2] >= candidateB[2] ? candidateA : candidateB)
      : (candidateA[2] <= candidateB[2] ? candidateA : candidateB);
  }

  const ey = scale3(acPerpendicular, 1 / j);
  const ez = normalize3(cross3(ex, ey));
  const x = (radiusA * radiusA - radiusB * radiusB + d * d) / (2 * d);
  const y = (
    radiusA * radiusA - radiusC * radiusC + i * i + j * j - 2 * i * x
  ) / (2 * j);
  const z = Math.sqrt(Math.max(0, radiusA * radiusA - x * x - y * y));
  const base = add3(anchorA, add3(scale3(ex, x), scale3(ey, y)));
  const candidateA = add3(base, scale3(ez, z));
  const candidateB = add3(base, scale3(ez, -z));

  return direction === "up"
    ? (candidateA[2] >= candidateB[2] ? candidateA : candidateB)
    : (candidateA[2] <= candidateB[2] ? candidateA : candidateB);
}

/** FABRIK in the book cross-section, with both cover attachment points fixed. */
function solvePlanarChain(
  start: Vec2,
  end: Vec2,
  segmentLengths: number[],
  initial: Vec2[],
): Vec2[] {
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  const endpointDistance = distance2(start, end);

  if (endpointDistance >= totalLength - 1e-6) {
    const direction: Vec2 = endpointDistance > EPSILON
      ? [(end[0] - start[0]) / endpointDistance, (end[1] - start[1]) / endpointDistance]
      : [1, 0];
    const straight = [start] as Vec2[];
    let travelled = 0;
    segmentLengths.forEach((length) => {
      travelled += length;
      straight.push([
        start[0] + direction[0] * travelled,
        start[1] + direction[1] * travelled,
      ]);
    });
    straight[straight.length - 1] = end;
    return straight;
  }

  const points = initial.map((point) => [...point] as Vec2);
  points[0] = [...start];
  points[points.length - 1] = [...end];

  for (let iteration = 0; iteration < 48; iteration++) {
    points[points.length - 1] = [...end];
    for (let index = points.length - 2; index >= 0; index--) {
      const next = points[index + 1];
      const current = points[index];
      const distance = Math.max(distance2(current, next), EPSILON);
      const ratio = segmentLengths[index] / distance;
      points[index] = [
        next[0] + (current[0] - next[0]) * ratio,
        next[1] + (current[1] - next[1]) * ratio,
      ];
    }

    points[0] = [...start];
    for (let index = 0; index < points.length - 1; index++) {
      const current = points[index];
      const next = points[index + 1];
      const distance = Math.max(distance2(current, next), EPSILON);
      const ratio = segmentLengths[index] / distance;
      points[index + 1] = [
        current[0] + (next[0] - current[0]) * ratio,
        current[1] + (next[1] - current[1]) * ratio,
      ];
    }

    if (distance2(points[points.length - 1], end) < 1e-5) break;
  }

  points[points.length - 1] = [...end];
  return points;
}

function chainPairsForMechanism(mechanism: PopupMechanismFoldMeta): Array<[number, number]> | null {
  if (mechanism.type === "parallel-fold") {
    return [[1, 2], [6, 7], [4, 5]];
  }
  if (mechanism.type === "platform") {
    return [[1, 2], [8, 9], [6, 7], [10, 11], [4, 5]];
  }
  if (mechanism.type === "box") {
    return [[1, 2], [8, 9], [10, 11], [6, 7], [12, 13], [14, 15], [4, 5]];
  }
  return null;
}

function profileForMechanism(mechanism: PopupMechanismFoldMeta, pointCount: number): number[] {
  if (mechanism.type === "parallel-fold") return [0, 1, 0];
  if (mechanism.type === "platform") return [0, 1, 1, 1, 0];
  if (mechanism.type === "box") return [0, 0.62, 1, 1, 1, 0.62, 0];
  return Array.from({ length: pointCount }, (_, index) => Math.sin(Math.PI * index / (pointCount - 1)));
}

function solveExtrudedMechanism(
  mechanism: PopupMechanismFoldMeta,
  vertexMap: Map<number, Vec3>,
  bookAngleDeg: number,
): void {
  const pairs = chainPairsForMechanism(mechanism);
  if (!pairs) return;

  const flatPoints = pairs.map(([topIndex]) => mechanism.localVertices[topIndex]);
  const segmentLengths = flatPoints.slice(0, -1).map((point, index) => (
    Math.abs(flatPoints[index + 1][0] - point[0])
  ));
  const firstGlobal = mechanism.localToGlobal[pairs[0][0]];
  const lastGlobal = mechanism.localToGlobal[pairs[pairs.length - 1][0]];
  const start3 = vertexMap.get(firstGlobal)!;
  const end3 = vertexMap.get(lastGlobal)!;
  const start: Vec2 = [start3[0], start3[2]];
  const end: Vec2 = [end3[0], end3[2]];
  const profile = profileForMechanism(mechanism, pairs.length);
  const closure = smoothClosure(bookAngleDeg);
  const directionSign = mechanism.params.foldDirection === "down" ? -1 : 1;
  const endpointVector: Vec2 = [end[0] - start[0], end[1] - start[1]];
  const endpointLength = Math.max(Math.hypot(endpointVector[0], endpointVector[1]), EPSILON);
  const perpendicular: Vec2 = [
    -endpointVector[1] / endpointLength,
    endpointVector[0] / endpointLength,
  ];
  const desiredLift = mechanism.type === "parallel-fold"
    ? mechanism.params.height
    : mechanism.type === "platform"
      ? mechanism.params.height
      : mechanism.params.height + mechanism.params.depth / 2;
  const amplitude = desiredLift * closure * directionSign;

  const initial = pairs.map((_, index) => {
    const t = index / (pairs.length - 1);
    const base = lerp2(start, end, t);
    return [
      base[0] + perpendicular[0] * amplitude * profile[index],
      base[1] + perpendicular[1] * amplitude * profile[index],
    ] as Vec2;
  });

  const solved = solvePlanarChain(start, end, segmentLengths, initial);
  pairs.forEach(([topLocalIndex, bottomLocalIndex], index) => {
    const [x, z] = solved[index];
    const topGlobal = mechanism.localToGlobal[topLocalIndex];
    const bottomGlobal = mechanism.localToGlobal[bottomLocalIndex];
    vertexMap.set(topGlobal, [x, mechanism.localVertices[topLocalIndex][1], z]);
    vertexMap.set(bottomGlobal, [x, mechanism.localVertices[bottomLocalIndex][1], z]);
  });
}

function solveVFoldMechanism(
  mechanism: PopupMechanismFoldMeta,
  vertexMap: Map<number, Vec3>,
  bookAngleDeg: number,
): void {
  const apexGlobal = mechanism.localToGlobal[0];
  const leftGlobal = mechanism.localToGlobal[1];
  const spineBottomGlobal = mechanism.localToGlobal[2];
  const rightGlobal = mechanism.localToGlobal[3];
  const centerGlobal = mechanism.localToGlobal[4];
  const apex: Vec3 = [0, mechanism.yStart, 0];
  const leftX = mechanism.localVertices[1][0];
  const rightX = mechanism.localVertices[3][0];
  const left: Vec3 = [leftX, mechanism.yEnd, 0];
  const right = transformRightCoverPoint(rightX, mechanism.yEnd, bookAngleDeg);
  const center = trilaterate(
    apex,
    left,
    right,
    mechanism.params.height,
    Math.abs(leftX),
    Math.abs(rightX),
    mechanism.params.foldDirection,
  );

  vertexMap.set(apexGlobal, apex);
  vertexMap.set(leftGlobal, left);
  vertexMap.set(spineBottomGlobal, [0, mechanism.yEnd, 0]);
  vertexMap.set(rightGlobal, right);
  vertexMap.set(centerGlobal, center);
}

function solveAnalyticalPopup(foldData: PopupFoldData, bookAngleDeg: number): Map<number, Vec3> {
  const vertexMap = new Map<number, Vec3>();
  foldData.verticesCoords.forEach((vertex, index) => {
    vertexMap.set(index, [vertex[0], vertex[1], vertex[2] ?? 0]);
  });

  const rightCover = foldData.facesVertices[foldData.popupMeta.rightCoverFaceIndex] || [];
  rightCover.forEach((vertexIndex) => {
    const flat = foldData.verticesCoords[vertexIndex];
    vertexMap.set(vertexIndex, transformRightCoverPoint(flat[0], flat[1], bookAngleDeg));
  });

  foldData.popupMeta.mechanisms.forEach((mechanism) => {
    if (mechanism.type === "v-fold" || mechanism.type === "v-fold-asymmetric") {
      solveVFoldMechanism(mechanism, vertexMap, bookAngleDeg);
    } else {
      solveExtrudedMechanism(mechanism, vertexMap, bookAngleDeg);
    }
  });

  return vertexMap;
}

/**
 * End-to-end kinematic pipeline for pop-up paper mechanics.
 * V-folds use exact trilateration. Extruded steps/platforms/boxes use a
 * length-preserving planar linkage solver with both cover attachments fixed.
 */
export function solvePopupKinematics(
  doc: PopupDocument,
  bookAngleDeg: number,
): { foldData: PopupFoldData; vertexMap: Map<number, Vec3> } {
  const clearanceDeg = Math.min(
    8,
    Math.atan2(Math.max(0, doc.paperThickness) * 2, Math.max(20, doc.bookWidth)) * 180 / Math.PI,
  );
  const effectiveBookAngle = Math.max(clearanceDeg, Math.min(180, bookAngleDeg));
  const foldData = popupDocumentToFoldData(doc, effectiveBookAngle);

  if (foldData.popupMeta) {
    return {
      foldData,
      vertexMap: solveAnalyticalPopup(foldData, effectiveBookAngle),
    };
  }

  const leftCoverFaceIndex = foldData.facesVertices.length - 2;
  const tree = buildFaceTree(foldData as FoldData, leftCoverFaceIndex);
  return {
    foldData,
    vertexMap: computeFoldedVertices(foldData as FoldData, tree, 1, false),
  };
}

/** Root-fixed cover coordinates used by auxiliary renderers. */
export function computeBookCoverPositions(
  bookWidth: number,
  bookHeight: number,
  bookAngleDeg: number,
): { leftCover: Vec3[]; rightCover: Vec3[] } {
  const leftCover: Vec3[] = [
    [0, 0, 0],
    [-bookWidth, 0, 0],
    [-bookWidth, bookHeight, 0],
    [0, bookHeight, 0],
  ];
  const rightCover: Vec3[] = [
    [0, 0, 0],
    transformRightCoverPoint(bookWidth, 0, bookAngleDeg),
    transformRightCoverPoint(bookWidth, bookHeight, bookAngleDeg),
    [0, bookHeight, 0],
  ];
  return { leftCover, rightCover };
}

/** Cubic ease-in-out for natural manual and automatic opening. */
export function interpolateBookAngle(startAngle: number, endAngle: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const eased = clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  return startAngle + (endAngle - startAngle) * eased;
}
