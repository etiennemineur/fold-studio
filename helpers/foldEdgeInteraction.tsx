import { FoldData } from "./foldEngine";

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : "0.0000";
}

/**
 * Returns a stable-enough signature for a generated fold edge. The vertex
 * indices protect distinct coincident hinges, while coordinates prevent an
 * override from being silently applied after a structural regeneration.
 */
export function getFoldEdgeSignature(foldData: FoldData, edgeIndex: number): string {
  const edge = foldData.edgesVertices[edgeIndex];
  if (!edge) return `missing-${edgeIndex}`;

  const [rawA, rawB] = edge;
  const a = Math.min(rawA, rawB);
  const b = Math.max(rawA, rawB);
  const va = foldData.verticesCoords[a] ?? [0, 0];
  const vb = foldData.verticesCoords[b] ?? [0, 0];

  return [
    `${a}-${b}`,
    `${formatCoordinate(va[0])},${formatCoordinate(va[1])}`,
    `${formatCoordinate(vb[0])},${formatCoordinate(vb[1])}`,
  ].join("@");
}

/** Inverts one mountain/valley edge while preserving its target magnitude. */
export function toggleFoldEdgeAssignment(foldData: FoldData, edgeIndex: number): FoldData {
  const current = foldData.edgesAssignment[edgeIndex];
  if (current !== "M" && current !== "V") return foldData;

  const edgesAssignment = [...foldData.edgesAssignment] as FoldData["edgesAssignment"];
  const edgesFoldAngle = [...foldData.edgesFoldAngle];
  const currentAngle = edgesFoldAngle[edgeIndex] ?? 0;

  if (current === "M") {
    edgesAssignment[edgeIndex] = "V";
    edgesFoldAngle[edgeIndex] = currentAngle !== 0 ? -currentAngle : 90;
  } else {
    edgesAssignment[edgeIndex] = "M";
    edgesFoldAngle[edgeIndex] = currentAngle !== 0 ? -currentAngle : -90;
  }

  return { ...foldData, edgesAssignment, edgesFoldAngle };
}

/** Sets one fold edge explicitly to mountain or valley. */
export function setFoldEdgeAssignment(
  foldData: FoldData,
  edgeIndex: number,
  assignment: "M" | "V",
): FoldData {
  const current = foldData.edgesAssignment[edgeIndex];
  if ((current !== "M" && current !== "V") || current === assignment) return foldData;
  return toggleFoldEdgeAssignment(foldData, edgeIndex);
}
