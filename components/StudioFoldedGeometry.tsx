/// <reference types="@react-three/fiber" />
import React, { useMemo, useRef, useState, useEffect } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { FoldData, buildFaceTree, computeFoldedVertices } from "../helpers/foldEngine";
import { dielineExporter } from "../helpers/dielineExporter";

export function StudioFoldedGeometry({ 
  foldData, 
  progress,
  highlightedFaceIndex = null,
  onHoverFace,
  onSelectFace,
  selectedEdgeIndex = null,
  sequential = false,
  rootFaceIndex = null,
  artworkUrl,
  artworkLayers,
  collidingFaces,
  artworkOffset,
  artworkScale,
  artworkRotation,
  exteriorColor = '#FFFFFF',
  interiorColor = '#E8E8ED'
}: { 
  foldData: FoldData;
  progress: number;
  highlightedFaceIndex?: number | null;
  onHoverFace?: (faceIndex: number | null) => void;
  onSelectFace?: (faceIndex: number | null) => void;
  selectedEdgeIndex?: number | null;
  sequential?: boolean;
  rootFaceIndex?: number | null;
  artworkUrl?: string;
  artworkLayers?: import("../helpers/useArtworkLayers").ArtworkLayer[];
  collidingFaces?: Set<number>;
  artworkOffset?: { x: number; y: number };
  artworkScale?: number;
  artworkRotation?: number;
  exteriorColor?: string;
  interiorColor?: string;
}) {
  const tree = useMemo(() => {
    const t = buildFaceTree(foldData);
    let count = 0;
    const countNodes = (nodes: any[]) => {
      for (const n of nodes) {
        count++;
        countNodes(n.children);
      }
    };
    countNodes(t);
    console.log(`[3D] Face tree: ${count}/${foldData.facesVertices.length} faces in tree, ${foldData.edgesVertices.length} total edges`);
    return t;
  }, [foldData]);
  
  const vertexMap = useMemo(() => computeFoldedVertices(foldData, tree, progress, sequential), [foldData, tree, progress, sequential]);

  const orientedVertexMap = useMemo(() => {
    if (rootFaceIndex === null || rootFaceIndex === undefined) return vertexMap;

    const faceIndices = foldData.facesVertices[rootFaceIndex];
    if (!faceIndices || faceIndices.length < 3) return vertexMap;

    const v0 = vertexMap.get(faceIndices[0]) || [0,0,0];
    const v1 = vertexMap.get(faceIndices[1]) || [0,0,0];
    const v2 = vertexMap.get(faceIndices[2]) || [0,0,0];

    const vec0 = new THREE.Vector3(...v0);
    const vec1 = new THREE.Vector3(...v1);
    const vec2 = new THREE.Vector3(...v2);

    const edge1 = new THREE.Vector3().subVectors(vec1, vec0);
    const edge2 = new THREE.Vector3().subVectors(vec2, vec1);

    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < faceIndices.length; i++) {
      const v = vertexMap.get(faceIndices[i]) || [0,0,0];
      cx += v[0];
      cy += v[1];
      cz += v[2];
    }
    cx /= faceIndices.length;
    cy /= faceIndices.length;
    cz /= faceIndices.length;
    const centroid = new THREE.Vector3(cx, cy, cz);

    const q = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, -1));

    const applyRotation = (quaternion: THREE.Quaternion) => {
      const result = new Map<number, [number, number, number]>();
      for (const [vIdx, pos] of vertexMap.entries()) {
        const p = new THREE.Vector3(...pos).sub(centroid);
        p.applyQuaternion(quaternion);
        p.add(centroid);
        result.set(vIdx, [p.x, p.y, p.z]);
      }
      return result;
    };

    let tempMap = applyRotation(q);
    
    let totalZ = 0;
    let count = 0;
    for (const pos of tempMap.values()) {
      totalZ += pos[2];
      count++;
    }
    const centerOfMassZ = count > 0 ? totalZ / count : 0;
    
    if (centerOfMassZ < centroid.z) {
      const q2 = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, 1));
      tempMap = applyRotation(q2);
    }
    
    let minZ = Infinity;
    for (const pos of tempMap.values()) {
      if (pos[2] < minZ) minZ = pos[2];
    }
    
    const transformedMap = new Map<number, [number, number, number]>();
    for (const [vIdx, pos] of tempMap.entries()) {
      transformedMap.set(vIdx, [pos[0], pos[1], pos[2] - minZ]);
    }

    return transformedMap;
  }, [vertexMap, rootFaceIndex, foldData]);

  // Version counter — increments when geometry data changes, used as key to
  // force React to recreate Three.js objects (avoids infinite useEffect loops)
  const versionRef = useRef(0);
  const prevDepsRef = useRef<{ fd: FoldData; p: number; seq: boolean; root: number | null } | null>(null);
  if (!prevDepsRef.current || prevDepsRef.current.fd !== foldData || prevDepsRef.current.p !== progress || prevDepsRef.current.seq !== sequential || prevDepsRef.current.root !== rootFaceIndex) {
    versionRef.current++;
    prevDepsRef.current = { fd: foldData, p: progress, seq: sequential, root: rootFaceIndex };
  }

  // Texture loading
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!artworkUrl) { 
      setTexture(null); 
      return; 
    }
    const loader = new THREE.TextureLoader();
    let isCancelled = false;
    let texToDispose: THREE.Texture | null = null;
    
    loader.load(artworkUrl, (tex) => {
      if (isCancelled) {
        tex.dispose();
        return;
      }
      tex.colorSpace = THREE.SRGBColorSpace;
      texToDispose = tex;
      setTexture(tex);
    });
    
    return () => { 
      isCancelled = true;
      if (texToDispose) texToDispose.dispose(); 
    };
  }, [artworkUrl]);

  const [textureVersion, setTextureVersion] = useState(0);
  const imageMapRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    if (!artworkLayers) return;
    let isCancelled = false;
    const currentUrls = new Set<string>();

    artworkLayers.forEach(layer => {
      currentUrls.add(layer.url);
      if (!imageMapRef.current.has(layer.url)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!isCancelled) {
            imageMapRef.current.set(layer.url, img);
            setTextureVersion(v => v + 1);
          }
        };
        img.src = layer.url;
      }
    });

    for (const url of imageMapRef.current.keys()) {
      if (!currentUrls.has(url)) {
        imageMapRef.current.delete(url);
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [artworkLayers]);

  const compositeTexture = useMemo(() => {
    if (!artworkLayers || artworkLayers.length === 0) return null;
    const visibleLayers = artworkLayers.filter(l => l.visible);
    if (visibleLayers.length === 0) return null;
    
    for (const layer of visibleLayers) {
      if (!imageMapRef.current.has(layer.url)) return null;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    foldData.verticesCoords.forEach(v => {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    });

    const w = maxX - minX || 1;
    const h = maxY - minY || 1;

    const canvas = document.createElement('canvas');
    const MAX_RES = 2048;
    const scale = Math.min(MAX_RES / w, MAX_RES / h);
    const pixelRatio = Math.max(1, Math.min(scale, 4));

    canvas.width = w * pixelRatio;
    canvas.height = h * pixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = exteriorColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const layer of visibleLayers) {
      const img = imageMapRef.current.get(layer.url);
      if (!img) continue;

      const lx = (layer.x - minX) * pixelRatio;
      const ly = (layer.y - minY) * pixelRatio;
      const lw = layer.width * pixelRatio;
      const lh = layer.height * pixelRatio;

      const cx = lx + lw / 2;
      const cy = ly + lh / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(layer.rotation * Math.PI / 180);
      ctx.translate(-cx, -cy);
      ctx.drawImage(img, lx, ly, lw, lh);
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [artworkLayers, foldData, textureVersion, exteriorColor]);

  const glueTabs = useMemo(() => dielineExporter.identifyGlueTabFaces(foldData), [foldData]);

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
      if (!glueTabs.has(i)) {
        set.add(i);
      }
    }
    return set;
  }, [foldData.facesVertices.length, glueTabs]);

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

  // Faces & UVs
  const { facePositions, uvPositions, triangleToFaceIndex } = useMemo(() => {
    let totalTriangles = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    foldData.verticesCoords.forEach(v => {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    });
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    foldData.facesVertices.forEach(face => { totalTriangles += Math.max(0, face.length - 2); });
    
    const arr = new Float32Array(totalTriangles * 9);
    const uvArr = new Float32Array(totalTriangles * 6);
    const triToFace: number[] = [];
    
    let offset = 0;
    let uvOffset = 0;
    
    foldData.facesVertices.forEach((indices, faceIdx) => {
      const v0Idx = indices[0];
      const v0 = orientedVertexMap.get(v0Idx) || [0,0,0];
      const c0 = foldData.verticesCoords[v0Idx];
      const u0 = (c0[0] - minX) / width;
      const v0_uv = 1 - ((c0[1] - minY) / height);
      
      for (let i = 1; i < indices.length - 1; i++) {
        const viIdx = indices[i];
        const vi1Idx = indices[i + 1];
        
        const vi = orientedVertexMap.get(viIdx) || [0,0,0];
        const vi1 = orientedVertexMap.get(vi1Idx) || [0,0,0];
        
        const ci = foldData.verticesCoords[viIdx];
        const ci1 = foldData.verticesCoords[vi1Idx];
        
        const ui = (ci[0] - minX) / width;
        const vi_uv = 1 - ((ci[1] - minY) / height);
        
        const ui1 = (ci1[0] - minX) / width;
        const vi1_uv = 1 - ((ci1[1] - minY) / height);
        
        arr.set([...v0, ...vi, ...vi1], offset);
        offset += 9;
        
        uvArr.set([u0, v0_uv, ui, vi_uv, ui1, vi1_uv], uvOffset);
        uvOffset += 6;
        
        triToFace.push(faceIdx);
      }
    });
    return { facePositions: arr, uvPositions: uvArr, triangleToFaceIndex: triToFace };
  }, [foldData, orientedVertexMap]);

  // Exterior faces & UVs for Artwork
  const { exteriorPositions, exteriorUVs } = useMemo(() => {
    if (exteriorFaceIndices.size === 0) return { exteriorPositions: null, exteriorUVs: null };
    
    let totalTriangles = 0;
    for (const faceIdx of exteriorFaceIndices) {
      totalTriangles += Math.max(0, foldData.facesVertices[faceIdx].length - 2);
    }
    
    if (totalTriangles <= 0) return { exteriorPositions: null, exteriorUVs: null };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    foldData.verticesCoords.forEach(v => {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    });
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    const cx = minX + width / 2 + (artworkOffset?.x || 0);
    const cy = minY + height / 2 + (artworkOffset?.y || 0);
    const scale = artworkScale || 1;
    const thetaRad = (artworkRotation || 0) * Math.PI / 180;
    const cosT = Math.cos(thetaRad);
    const sinT = Math.sin(thetaRad);

    let posArr = new Float32Array();
    let uvArr = new Float32Array();

    if (artworkLayers && artworkLayers.length > 0) {
      posArr = new Float32Array(totalTriangles * 9);
      uvArr = new Float32Array(totalTriangles * 6);
      let offset = 0;
      let uvOffset = 0;

      for (const faceIdx of exteriorFaceIndices) {
        const indices = foldData.facesVertices[faceIdx];
        if (!indices || indices.length < 3) continue;

        const v0Idx = indices[0];
        const v0 = orientedVertexMap.get(v0Idx) || [0,0,0];
        const c0 = foldData.verticesCoords[v0Idx];
        const u0 = (c0[0] - minX) / width;
        const v0_uv = 1 - ((c0[1] - minY) / height);

        for (let i = 1; i < indices.length - 1; i++) {
          const viIdx = indices[i];
          const vi1Idx = indices[i + 1];

          const vi = orientedVertexMap.get(viIdx) || [0,0,0];
          const vi1 = orientedVertexMap.get(vi1Idx) || [0,0,0];

          const ci = foldData.verticesCoords[viIdx];
          const ci1 = foldData.verticesCoords[vi1Idx];

          const ui = (ci[0] - minX) / width;
          const vi_uv = 1 - ((ci[1] - minY) / height);

          const ui1 = (ci1[0] - minX) / width;
          const vi1_uv = 1 - ((ci1[1] - minY) / height);

          posArr.set([...v0, ...vi, ...vi1], offset);
          offset += 9;

          uvArr.set([u0, v0_uv, ui, vi_uv, ui1, vi1_uv], uvOffset);
          uvOffset += 6;
        }
      }
    } else {
      posArr = new Float32Array(totalTriangles * 9);
      uvArr = new Float32Array(totalTriangles * 6);
      
      let offset = 0;
      let uvOffset = 0;

      for (const faceIdx of exteriorFaceIndices) {
        const indices = foldData.facesVertices[faceIdx];
        if (!indices || indices.length < 3) continue;

        const v0Idx = indices[0];
        const v0 = orientedVertexMap.get(v0Idx) || [0,0,0];
        const c0 = foldData.verticesCoords[v0Idx];
        
        const dx0 = c0[0] - cx;
        const dy0 = c0[1] - cy;
        const rx0 = dx0 * cosT + dy0 * sinT;
        const ry0 = -dx0 * sinT + dy0 * cosT;
        const u0 = rx0 / (scale * width) + 0.5;
        const v0_uv = 0.5 - ry0 / (scale * height);

        for (let i = 1; i < indices.length - 1; i++) {
          const viIdx = indices[i];
          const vi1Idx = indices[i + 1];

          const vi = orientedVertexMap.get(viIdx) || [0,0,0];
          const vi1 = orientedVertexMap.get(vi1Idx) || [0,0,0];

          const ci = foldData.verticesCoords[viIdx];
          const ci1 = foldData.verticesCoords[vi1Idx];

          const dxi = ci[0] - cx;
          const dyi = ci[1] - cy;
          const rxi = dxi * cosT + dyi * sinT;
          const ryi = -dxi * sinT + dyi * cosT;
          const ui = rxi / (scale * width) + 0.5;
          const vi_uv = 0.5 - ryi / (scale * height);

          const dxi1 = ci1[0] - cx;
          const dyi1 = ci1[1] - cy;
          const rxi1 = dxi1 * cosT + dyi1 * sinT;
          const ryi1 = -dxi1 * sinT + dyi1 * cosT;
          const ui1 = rxi1 / (scale * width) + 0.5;
          const vi1_uv = 0.5 - ryi1 / (scale * height);

          posArr.set([...v0, ...vi, ...vi1], offset);
          offset += 9;

          uvArr.set([u0, v0_uv, ui, vi_uv, ui1, vi1_uv], uvOffset);
          uvOffset += 6;
        }
      }
    }
    
    return { exteriorPositions: posArr, exteriorUVs: uvArr };
  }, [foldData, orientedVertexMap, exteriorFaceIndices, texture, compositeTexture, artworkLayers, artworkOffset, artworkScale, artworkRotation]);

  // Highlight geometry
  const highlightPositions = useMemo(() => {
    if (highlightedFaces.size === 0) return null;
    
    let totalTriangles = 0;
    for (const faceIdx of highlightedFaces) {
      const indices = foldData.facesVertices[faceIdx];
      if (indices) {
        totalTriangles += Math.max(0, indices.length - 2);
      }
    }
    
    if (totalTriangles <= 0) return null;
    
    const arr = new Float32Array(totalTriangles * 9);
    let offset = 0;
    
    for (const faceIdx of highlightedFaces) {
      const indices = foldData.facesVertices[faceIdx];
      if (!indices || indices.length < 3) continue;
      
      const v0 = orientedVertexMap.get(indices[0]) || [0,0,0];
      for (let i = 1; i < indices.length - 1; i++) {
        const vi = orientedVertexMap.get(indices[i]) || [0,0,0];
        const vi1 = orientedVertexMap.get(indices[i + 1]) || [0,0,0];
        arr.set([...v0, ...vi, ...vi1], offset);
        offset += 9;
      }
    }
    
    return arr;
  }, [foldData, orientedVertexMap, highlightedFaces]);

  // Edges
  const collisionPositions = useMemo(() => {
    if (!collidingFaces || collidingFaces.size === 0) return null;
    
    let totalTriangles = 0;
    collidingFaces.forEach(faceIdx => {
      const indices = foldData.facesVertices[faceIdx];
      if (indices) {
        totalTriangles += Math.max(0, indices.length - 2);
      }
    });

    if (totalTriangles === 0) return null;

    const arr = new Float32Array(totalTriangles * 9);
    let offset = 0;
    collidingFaces.forEach(faceIdx => {
      const indices = foldData.facesVertices[faceIdx];
      if (!indices || indices.length < 3) return;

      const v0 = orientedVertexMap.get(indices[0]) || [0,0,0];
      for (let i = 1; i < indices.length - 1; i++) {
        const vi = orientedVertexMap.get(indices[i]) || [0,0,0];
        const vi1 = orientedVertexMap.get(indices[i + 1]) || [0,0,0];
        arr.set([...v0, ...vi, ...vi1], offset);
        offset += 9;
      }
    });

    return arr;
  }, [foldData, orientedVertexMap, collidingFaces]);

  // Edges
  const edgePositions = useMemo(() => {
    const mountain: number[] = [];
    const valley: number[] = [];
    const border: number[] = [];
    const flat: number[] = [];
    const selected: number[] = [];
    foldData.edgesVertices.forEach((indices, edgeIndex) => {
      const v0 = orientedVertexMap.get(indices[0]) || [0,0,0];
      const v1 = orientedVertexMap.get(indices[1]) || [0,0,0];
      const target = foldData.edgesAssignment[edgeIndex] === 'M' ? mountain
        : foldData.edgesAssignment[edgeIndex] === 'V' ? valley
        : foldData.edgesAssignment[edgeIndex] === 'B' ? border
        : flat;
      target.push(...v0, ...v1);
      if (edgeIndex === selectedEdgeIndex) selected.push(...v0, ...v1);
    });
    return {
      mountain: new Float32Array(mountain),
      valley: new Float32Array(valley),
      border: new Float32Array(border),
      flat: new Float32Array(flat),
      selected: new Float32Array(selected),
    };
  }, [foldData, orientedVertexMap, selectedEdgeIndex]);

  const exteriorMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useEffect(() => {
    if (exteriorMatRef.current) {
      exteriorMatRef.current.needsUpdate = true;
    }
  }, [compositeTexture, texture, exteriorColor]);

  return (
    <group key={versionRef.current}>
      <mesh
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          const triIdx = e.faceIndex;
          if (triIdx !== undefined && triIdx !== null) {
            const faceIdx = triangleToFaceIndex[triIdx];
            onHoverFace?.(faceIdx ?? null);
          }
        }}
        onPointerOut={() => onHoverFace?.(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const triIdx = e.faceIndex;
          if (triIdx !== undefined && triIdx !== null) {
            onSelectFace?.(triangleToFaceIndex[triIdx] ?? null);
          }
        }}
      >
        <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
          <bufferAttribute
            attach="attributes-position"
            args={[facePositions, 3]}
          />
          <bufferAttribute
            attach="attributes-uv"
            args={[uvPositions, 2]}
          />
        </bufferGeometry>
        <meshStandardMaterial 
          color={interiorColor}
          side={THREE.DoubleSide} 
          transparent 
          opacity={0.9} 
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>

      {exteriorPositions && exteriorUVs && (
        <mesh raycast={() => {}}>
          <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
            <bufferAttribute
              attach="attributes-position"
              args={[exteriorPositions, 3]}
            />
            <bufferAttribute
              attach="attributes-uv"
              args={[exteriorUVs, 2]}
            />
          </bufferGeometry>
          <meshStandardMaterial
            ref={exteriorMatRef}
            color={compositeTexture ? '#FFFFFF' : exteriorColor}
            map={compositeTexture || texture || null}
toneMapped={false}
side={THREE.BackSide}
roughness={0.5}
metalness={0.02}
polygonOffset
polygonOffsetFactor={-1}
polygonOffsetUnits={-1}
/>
        </mesh>
      )}

      {highlightPositions && (
        <mesh raycast={() => {}}>
          <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
            <bufferAttribute
              attach="attributes-position"
              args={[highlightPositions, 3]}
            />
          </bufferGeometry>
          <meshBasicMaterial 
                        color="#0066FF" 
            side={THREE.DoubleSide} 
            transparent 
            opacity={0.65} 
            depthWrite={false}
          />
        </mesh>
      )}

      {collisionPositions && (
        <mesh raycast={() => {}}>
          <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
            <bufferAttribute
              attach="attributes-position"
              args={[collisionPositions, 3]}
            />
          </bufferGeometry>
          <meshStandardMaterial 
            color="#EF4444" 
            emissive="#EF4444"
            emissiveIntensity={0.3}
            side={THREE.DoubleSide} 
            transparent 
            opacity={0.45} 
          />
        </mesh>
      )}
      
      {edgePositions.mountain.length > 0 && <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[edgePositions.mountain, 3]} /></bufferGeometry><lineBasicMaterial color="#0055FF" opacity={0.9} transparent /></lineSegments>}
      {edgePositions.valley.length > 0 && <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[edgePositions.valley, 3]} /></bufferGeometry><lineBasicMaterial color="#00AA44" opacity={0.9} transparent /></lineSegments>}
      {edgePositions.border.length > 0 && <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[edgePositions.border, 3]} /></bufferGeometry><lineBasicMaterial color="#FF00FF" opacity={0.8} transparent /></lineSegments>}
      {edgePositions.flat.length > 0 && <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[edgePositions.flat, 3]} /></bufferGeometry><lineBasicMaterial color="#888888" opacity={0.45} transparent /></lineSegments>}
      {edgePositions.selected.length > 0 && <lineSegments renderOrder={20}><bufferGeometry><bufferAttribute attach="attributes-position" args={[edgePositions.selected, 3]} /></bufferGeometry><lineBasicMaterial color="#FF6600" depthTest={false} transparent opacity={1} /></lineSegments>}
    </group>
  );
}