import { useMemo } from 'react';
import { FoldData } from './foldEngine';
import { dielineExporter } from './dielineExporter';
import { findFaceForBorderEdge, getFaceCentroid, computeEdgeOutwardNormal } from './foldGeometry';

export function useStudioCreasePatternCalculations(
  foldData: FoldData,
  bleedSize: number,
  highlightedFaceIndex?: number | null
) {
  const facePolygons = useMemo(() => {
    return foldData.facesVertices.map(face => 
      face.map(v => [foldData.verticesCoords[v][0], foldData.verticesCoords[v][1]] as [number, number])
    );
  }, [foldData]);

  const faceAdjacency = useMemo(() => {
    const edgeToFaces = new Map<string, number[]>();
    for (let f = 0; f < foldData.facesVertices.length; f++) {
      const face = foldData.facesVertices[f];
      for (let i = 0; i < face.length; i++) {
        const v1 = face[i];
        const v2 = face[(i + 1) % face.length];
        const key = `${Math.min(v1, v2)}-${Math.max(v1, v2)}`;
        if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
        edgeToFaces.get(key)!.push(f);
      }
    }
    const adj = new Map<number, Set<number>>();
    for (const faces of edgeToFaces.values()) {
      if (faces.length === 2) {
        if (!adj.has(faces[0])) adj.set(faces[0], new Set());
        if (!adj.has(faces[1])) adj.set(faces[1], new Set());
        adj.get(faces[0])!.add(faces[1]);
        adj.get(faces[1])!.add(faces[0]);
      }
    }
    return adj;
  }, [foldData]);

  const glueTabs = useMemo(() => dielineExporter.identifyGlueTabFaces(foldData), [foldData]);

  const highlightedFaces = useMemo(() => {
    const set = new Set<number>();
    if (highlightedFaceIndex !== null && highlightedFaceIndex !== undefined) {
      set.add(highlightedFaceIndex);
      const neighbors = faceAdjacency.get(highlightedFaceIndex);
      if (neighbors) {
        for (const n of neighbors) {
          if (glueTabs.has(n)) {
            set.add(n);
          }
        }
      }
    }
    return set;
  }, [highlightedFaceIndex, faceAdjacency, glueTabs]);

  const channelFaces = useMemo(() => {
    const channels = new Set<number>();
    
    const edgeAssignmentMap = new Map<string, string>();
    for (let i = 0; i < foldData.edgesVertices.length; i++) {
      const [v1, v2] = foldData.edgesVertices[i];
      const key = `${Math.min(v1, v2)}-${Math.max(v1, v2)}`;
      edgeAssignmentMap.set(key, foldData.edgesAssignment[i]);
    }

    for (let i = 0; i < foldData.facesVertices.length; i++) {
      const face = foldData.facesVertices[i];
      if (face.length === 4 && !glueTabs.has(i)) {
        let fCount = 0;
        for (let j = 0; j < 4; j++) {
          const v1 = face[j];
          const v2 = face[(j + 1) % 4];
          const key = `${Math.min(v1, v2)}-${Math.max(v1, v2)}`;
          if (edgeAssignmentMap.get(key) === 'F') {
            fCount++;
          }
        }
        if (fCount >= 2) {
          channels.add(i);
        }
      }
    }
    return channels;
  }, [foldData, glueTabs]);

  const exteriorFaceIndices = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < foldData.facesVertices.length; i++) {
      if (!glueTabs.has(i) && !channelFaces.has(i)) {
        set.add(i);
      }
    }
    return set;
  }, [foldData.facesVertices.length, glueTabs, channelFaces]);

  const bleedPolygons = useMemo(() => {
    if (bleedSize <= 0) return [];
    const polys = [];
    for (let i = 0; i < foldData.edgesVertices.length; i++) {
      if (foldData.edgesAssignment[i] === 'B') {
        const v1Idx = foldData.edgesVertices[i][0];
        const v2Idx = foldData.edgesVertices[i][1];
        const v1 = foldData.verticesCoords[v1Idx];
        const v2 = foldData.verticesCoords[v2Idx];
        
        const faceIdx = findFaceForBorderEdge(v1Idx, v2Idx, foldData);
        if (faceIdx !== -1) {
          const centroid = getFaceCentroid(faceIdx, foldData);
          const normal = computeEdgeOutwardNormal([v1[0], v1[1]], [v2[0], v2[1]], centroid);
          
          const p1x = v1[0] + normal[0] * bleedSize;
          const p1y = v1[1] + normal[1] * bleedSize;
          const p2x = v2[0] + normal[0] * bleedSize;
          const p2y = v2[1] + normal[1] * bleedSize;
          
          polys.push({
            id: i,
            points: `${v1[0]},${v1[1]} ${v2[0]},${v2[1]} ${p2x},${p2y} ${p1x},${p1y}`,
            c1: { cx: v1[0], cy: v1[1], r: bleedSize },
            c2: { cx: v2[0], cy: v2[1], r: bleedSize }
          });
        }
      }
    }
    return polys;
  }, [foldData, bleedSize]);

  return {
    facePolygons,
    faceAdjacency,
    glueTabs,
    highlightedFaces,
    channelFaces,
    exteriorFaceIndices,
    bleedPolygons
  };
}