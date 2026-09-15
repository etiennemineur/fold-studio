import React from "react";
import { FoldData } from "../helpers/foldEngine";
import { getFaceCentroid } from "../helpers/foldGeometry";

export function StudioCreasePatternGroundFaceIndicator({
  foldData,
  groundFaceIndex
}: {
  foldData: FoldData;
  groundFaceIndex: number;
}) {
  const faceVertices = foldData.facesVertices[groundFaceIndex];
  if (!faceVertices) return null;

  const pointsStr = faceVertices
    .map(v => `${foldData.verticesCoords[v][0]},${foldData.verticesCoords[v][1]}`)
    .join(" ");

  const centroid = getFaceCentroid(groundFaceIndex, foldData);

  return (
    <g style={{ pointerEvents: 'none' }}>
      <polygon 
        points={pointsStr}
        fill="rgba(34, 197, 94, 0.18)"
        stroke="rgba(34, 197, 94, 0.6)"
        strokeWidth={2}
        strokeDasharray="4 2"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={centroid[0]}
        y={centroid[1]}
        fontSize={4.5}
        fill="rgba(34, 197, 94, 1)"
        textAnchor="middle"
        dominantBaseline="central"
      >
        ⚓
      </text>
    </g>
  );
}