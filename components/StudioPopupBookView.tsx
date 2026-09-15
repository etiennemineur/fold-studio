/// <reference types="@react-three/fiber" />
import React, { useMemo, useState, useEffect, useRef } from "react";
import "../helpers/r3fCompat"; // Must be imported before any R3F usage
import * as THREE from "three";
import { Canvas, extend } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import { PopupDocument } from "../helpers/popupDocument";

extend(THREE as any);
import { solvePopupKinematics } from "../helpers/popupKinematicSolver";
import { FoldData } from "../helpers/foldEngine";
import { CameraFixer } from "../helpers/CameraFixer";
import { StudioTrackpadControls } from "./StudioTrackpadControls";
import { CameraBridge, type CameraControlsAPI } from "./Studio3DToolbar";
import styles from "./StudioPopupBookView.module.css";

interface PopupMechanismMeshProps {
  foldData: FoldData;
  vertexMap: Map<number, [number, number, number]>;
  exteriorColor: string;
  interiorColor: string;
  collidingFaces?: Set<number>;
  highlightedFaceIndex?: number | null;
  onHoverFace?: (faceIndex: number | null) => void;
  onSelectFace?: (faceIndex: number | null) => void;
  selectedEdgeIndex?: number | null;
}

function PopupMechanismMesh({
  foldData,
  vertexMap,
  exteriorColor,
  interiorColor,
  collidingFaces,
  highlightedFaceIndex = null,
  onHoverFace,
  onSelectFace,
  selectedEdgeIndex = null,
}: PopupMechanismMeshProps) {
  const versionRef = useRef(0);
  const prevDepsRef = useRef<{ fd: FoldData; vm: Map<number, [number, number, number]> } | null>(null);
  if (!prevDepsRef.current || prevDepsRef.current.fd !== foldData || prevDepsRef.current.vm !== vertexMap) {
    versionRef.current++;
    prevDepsRef.current = { fd: foldData, vm: vertexMap };
  }

  // Triangulate faces
  const { positions, coverPositions, collisionPositions, faceMap, coverFaceMap, collisionFaceMap } = useMemo(() => {
    const pos: number[] = [];
    const coverPos: number[] = [];
    const collPos: number[] = [];
    const regularMap: number[] = [];
    const coverMap: number[] = [];
    const collisionMap: number[] = [];

    foldData.facesVertices.forEach((face, faceIdx) => {
      // Assuming covers are the last two faces pushed
      const isCover = faceIdx >= foldData.facesVertices.length - 2;
      const isColliding = collidingFaces?.has(faceIdx);

      const targetArray = isCover ? coverPos : (isColliding ? collPos : pos);
      const targetMap = isCover ? coverMap : (isColliding ? collisionMap : regularMap);

      if (face.length < 3) return;
      
      const v0 = vertexMap.get(face[0]) || foldData.verticesCoords[face[0]] as any;
      const origin: [number, number, number] = [v0[0], v0[1], v0[2] ?? 0];

      for (let i = 1; i < face.length - 1; i++) {
        const vi = vertexMap.get(face[i]) || foldData.verticesCoords[face[i]] as any;
        const vi1 = vertexMap.get(face[i + 1]) || foldData.verticesCoords[face[i + 1]] as any;
        
        targetArray.push(
          ...origin,
          vi[0], vi[1], vi[2] ?? 0,
          vi1[0], vi1[1], vi1[2] ?? 0
        );
        targetMap.push(faceIdx);
      }
    });

    return {
      positions: new Float32Array(pos),
      coverPositions: new Float32Array(coverPos),
      collisionPositions: new Float32Array(collPos),
      faceMap: regularMap,
      coverFaceMap: coverMap,
      collisionFaceMap: collisionMap,
    };
  }, [foldData, vertexMap, collidingFaces]);

  const highlightPositions = useMemo(() => {
    if (highlightedFaceIndex === null) return new Float32Array();
    const face = foldData.facesVertices[highlightedFaceIndex];
    if (!face || face.length < 3) return new Float32Array();
    const points: number[] = [];
    const v0 = vertexMap.get(face[0]) || foldData.verticesCoords[face[0]] as any;
    for (let i = 1; i < face.length - 1; i++) {
      const v1 = vertexMap.get(face[i]) || foldData.verticesCoords[face[i]] as any;
      const v2 = vertexMap.get(face[i + 1]) || foldData.verticesCoords[face[i + 1]] as any;
      points.push(v0[0], v0[1], v0[2] ?? 0, v1[0], v1[1], v1[2] ?? 0, v2[0], v2[1], v2[2] ?? 0);
    }
    return new Float32Array(points);
  }, [foldData, vertexMap, highlightedFaceIndex]);

  // Edges grouping
  const { mLines, vLines, bLines, selectedLines } = useMemo(() => {
    const m: number[] = [];
    const v: number[] = [];
    const b: number[] = [];
    const selected: number[] = [];

    foldData.edgesVertices.forEach((edge, i) => {
      const v0 = vertexMap.get(edge[0]) || foldData.verticesCoords[edge[0]] as any;
      const v1 = vertexMap.get(edge[1]) || foldData.verticesCoords[edge[1]] as any;
      
      const p0 = [v0[0], v0[1], v0[2] ?? 0];
      const p1 = [v1[0], v1[1], v1[2] ?? 0];
      
      const type = foldData.edgesAssignment[i];
      if (type === 'M') {
        m.push(...p0, ...p1);
      } else if (type === 'V') {
        v.push(...p0, ...p1);
      } else if (type === 'B') {
        b.push(...p0, ...p1);
      }
      if (i === selectedEdgeIndex) selected.push(...p0, ...p1);
    });

    return {
      mLines: new Float32Array(m),
      vLines: new Float32Array(v),
      bLines: new Float32Array(b),
      selectedLines: new Float32Array(selected),
    };
  }, [foldData, vertexMap, selectedEdgeIndex]);

  const interactionProps = (map: number[]) => ({
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      onHoverFace?.(event.faceIndex == null ? null : map[event.faceIndex] ?? null);
    },
    onPointerOut: () => onHoverFace?.(null),
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelectFace?.(event.faceIndex == null ? null : map[event.faceIndex] ?? null);
    },
  });

  return (
    <group key={versionRef.current}>
      {positions.length > 0 && (
        <>
          <mesh {...interactionProps(faceMap)}>
            <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <meshStandardMaterial color={exteriorColor} side={THREE.FrontSide} roughness={0.6} metalness={0.05} />
          </mesh>
          <mesh raycast={() => {}}>
            <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <meshStandardMaterial color={interiorColor} side={THREE.BackSide} roughness={0.65} metalness={0.03} />
          </mesh>
        </>
      )}

      {coverPositions.length > 0 && (
        <>
          <mesh {...interactionProps(coverFaceMap)}>
            <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
              <bufferAttribute attach="attributes-position" args={[coverPositions, 3]} />
            </bufferGeometry>
            <meshStandardMaterial color={exteriorColor} side={THREE.FrontSide} roughness={0.8} metalness={0} />
          </mesh>
          <mesh raycast={() => {}}>
            <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
              <bufferAttribute attach="attributes-position" args={[coverPositions, 3]} />
            </bufferGeometry>
            <meshStandardMaterial color={interiorColor} side={THREE.BackSide} roughness={0.8} metalness={0} />
          </mesh>
        </>
      )}

      {collisionPositions.length > 0 && (
        <mesh {...interactionProps(collisionFaceMap)}>
          <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
            <bufferAttribute attach="attributes-position" args={[collisionPositions, 3]} />
          </bufferGeometry>
          <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.3} side={THREE.DoubleSide} transparent opacity={0.6} />
        </mesh>
      )}

      {highlightPositions.length > 0 && (
        <mesh raycast={() => {}} renderOrder={10}>
          <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
            <bufferAttribute attach="attributes-position" args={[highlightPositions, 3]} />
          </bufferGeometry>
          <meshBasicMaterial color="#0066FF" side={THREE.DoubleSide} transparent opacity={0.65} depthWrite={false} />
        </mesh>
      )}

      {mLines.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[mLines, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#0055FF" opacity={0.8} transparent />
        </lineSegments>
      )}

      {vLines.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[vLines, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#00AA44" opacity={0.8} transparent />
        </lineSegments>
      )}

      {bLines.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[bLines, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#FF00FF" opacity={0.8} transparent />
        </lineSegments>
      )}

      {selectedLines.length > 0 && (
        <lineSegments renderOrder={20}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[selectedLines, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#FF6600" depthTest={false} transparent opacity={1} />
        </lineSegments>
      )}
    </group>
  );
}

export interface StudioPopupBookViewProps {
  popupDocument: PopupDocument;
  bookAngleDeg: number;
  selectedMechanismId: string | null;
  onSelectMechanism: (id: string | null) => void;
  showCollisions: boolean;
  collidingFaces?: Set<number>;
  exteriorColor: string;
  interiorColor: string;
  controlsRef: React.RefObject<CameraControlsAPI | null>;
  highlightedFaceIndex?: number | null;
  onHoverFace?: (faceIndex: number | null) => void;
  onSelectFace?: (faceIndex: number | null) => void;
  selectedEdgeIndex?: number | null;
}

export function StudioPopupBookView({
  popupDocument,
  bookAngleDeg,
  selectedMechanismId, // Not explicitly highlighted in mesh due to topological merge, but kept for interface completion
  onSelectMechanism,
  showCollisions,
  collidingFaces,
  exteriorColor,
  interiorColor,
  controlsRef,
  highlightedFaceIndex = null,
  onHoverFace,
  onSelectFace,
  selectedEdgeIndex = null,
}: StudioPopupBookViewProps) {
  const { foldData, vertexMap } = useMemo(() => {
    try {
      return solvePopupKinematics(popupDocument, bookAngleDeg);
    } catch (e) {
      console.warn("Kinematics solve failed for current geometry layout:", e);
      return { foldData: null, vertexMap: null };
    }
  }, [popupDocument, bookAngleDeg]);

  const handleSelectFace = (faceIndex: number | null) => {
    onSelectFace?.(faceIndex);
    if (faceIndex === null || !foldData?.popupMeta) {
      onSelectMechanism(null);
      return;
    }
    const mechanism = foldData.popupMeta.mechanisms.find(meta => meta.faceIndices.includes(faceIndex));
    onSelectMechanism(mechanism?.id ?? null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.canvasContainer}>
        <Canvas camera={{ position: [0, 200, 300], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[100, 200, 100]} intensity={0.8} />
          <directionalLight position={[-100, 100, -100]} intensity={0.4} />
          
          <gridHelper args={[1000, 50, 0x000000, 0xdddddd]} position={[0, -0.5, 0]} />

          <Center>
            {foldData && vertexMap && (
              <PopupMechanismMesh 
                foldData={foldData} 
                vertexMap={vertexMap} 
                exteriorColor={exteriorColor}
                interiorColor={interiorColor}
                collidingFaces={showCollisions ? collidingFaces : undefined}
                highlightedFaceIndex={highlightedFaceIndex}
                onHoverFace={onHoverFace}
                onSelectFace={handleSelectFace}
                selectedEdgeIndex={selectedEdgeIndex}
              />
            )}
          </Center>

          <CameraFixer />
          <StudioTrackpadControls minDistance={50} maxDistance={5000} zoomSpeed={1.2} />
          <CameraBridge ref={controlsRef} foldData={foldData} />
        </Canvas>
      </div>
    </div>
  );
}