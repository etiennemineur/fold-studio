/// <reference types="@react-three/fiber" />
import React, { useMemo, useEffect, useRef } from "react";
import "../helpers/r3fCompat"; // Must be imported before any R3F usage
import * as THREE from "three";
import { Canvas, useThree, extend } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { SpirogamiParams, generateSpirogamiMeshData } from "../helpers/spirogamiEngine";
import { FoldData } from "../helpers/foldEngine";
import { CameraFixer } from "../helpers/CameraFixer";
import { StudioTrackpadControls } from "./StudioTrackpadControls";
import { CameraBridge, type CameraControlsAPI } from "./Studio3DToolbar";

extend(THREE as any);
import styles from "./StudioSpiroView.module.css";

interface AutoCenterProps {
  radius: number;
}

function AutoCenter({ radius }: AutoCenterProps) {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    camera.position.set(0, radius * 1.5, radius * 2);
    camera.lookAt(0, 0, 0);
    if (controls) {
      (controls as any).target.set(0, 0, 0);
      (controls as any).update();
    }
  }, [radius, camera, controls]);
  
  return null;
}

export interface StudioSpiroViewProps {
  params: SpirogamiParams;
  progress: number;
  foldData: FoldData;
  exteriorColor: string;
  interiorColor: string;
  controlsRef: React.RefObject<CameraControlsAPI | null>;
  highlightedFaceIndex?: number | null;
  onHoverFace?: (faceIndex: number | null) => void;
  onSelectFace?: (faceIndex: number | null) => void;
  selectedEdgeIndex?: number | null;
}

function SpiroPaperMesh({
  positions,
  exteriorColor,
  interiorColor,
  triangleToFaceIndex,
  highlightedFaceIndex,
  onHoverFace,
  onSelectFace,
  opacity = 1,
}: {
  positions: Float32Array;
  exteriorColor: string;
  interiorColor: string;
  triangleToFaceIndex: number[];
  highlightedFaceIndex?: number | null;
  onHoverFace?: (faceIndex: number | null) => void;
  onSelectFace?: (faceIndex: number | null) => void;
  opacity?: number;
}) {
  const highlightPositions = useMemo(() => {
    if (highlightedFaceIndex === null || highlightedFaceIndex === undefined) return new Float32Array();
    const points: number[] = [];
    for (let triangleIndex = 0; triangleIndex < triangleToFaceIndex.length; triangleIndex++) {
      if (triangleToFaceIndex[triangleIndex] !== highlightedFaceIndex) continue;
      const offset = triangleIndex * 9;
      for (let i = 0; i < 9; i++) points.push(positions[offset + i]);
    }
    return new Float32Array(points);
  }, [positions, triangleToFaceIndex, highlightedFaceIndex]);

  const getFaceIndex = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (event.faceIndex === null || event.faceIndex === undefined) return null;
    return triangleToFaceIndex[event.faceIndex] ?? null;
  };

  return (
    <>
      <mesh
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          onHoverFace?.(getFaceIndex(event));
        }}
        onPointerOut={() => onHoverFace?.(null)}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onSelectFace?.(getFaceIndex(event));
        }}
      >
        <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <meshStandardMaterial
          color={exteriorColor}
          side={THREE.FrontSide}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>
      <mesh raycast={() => {}}>
        <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <meshStandardMaterial
          color={interiorColor}
          side={THREE.BackSide}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.65}
          metalness={0.03}
        />
      </mesh>
      {highlightPositions.length > 0 && (
        <mesh raycast={() => {}} renderOrder={10}>
          <bufferGeometry onUpdate={(self: any) => self.computeVertexNormals()}>
            <bufferAttribute attach="attributes-position" args={[highlightPositions, 3]} />
          </bufferGeometry>
          <meshBasicMaterial color="#0066FF" side={THREE.DoubleSide} transparent opacity={0.65} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

export function StudioSpiroView({
  params,
  progress,
  foldData,
  exteriorColor,
  interiorColor,
  controlsRef,
  highlightedFaceIndex = null,
  onHoverFace,
  onSelectFace,
  selectedEdgeIndex = null,
}: StudioSpiroViewProps) {
  const meshData = useMemo(() => generateSpirogamiMeshData(params, progress), [params, progress]);
  const segmentCount = Math.floor(params.turns * params.segmentsPerTurn);
  const baseFaceMap = useMemo(
    () => Array.from({ length: meshData.basePositions.length / 9 }, () => 0),
    [meshData.basePositions],
  );
  const stripFaceMap = useMemo(
    () => Array.from({ length: meshData.stripPositions.length / 9 }, (_, triangleIndex) => 1 + Math.floor(triangleIndex / 2)),
    [meshData.stripPositions],
  );

  const foldLines = useMemo(() => {
    const mountain: number[] = [];
    const valley: number[] = [];
    const selected: number[] = [];
    const foldEdgeOffset = 64;
    const centralPathLength = segmentCount * 6;
    for (let i = 0; i < segmentCount; i++) {
      const start = i * 6;
      const points = Array.from(meshData.spiralLinePositions.slice(start, start + 6));
      const edgeIndex = foldEdgeOffset + i;
      if (foldData.edgesAssignment[edgeIndex] === 'M') mountain.push(...points);
      else valley.push(...points);
      if (edgeIndex === selectedEdgeIndex) selected.push(...points);
    }
    return {
      mountain: new Float32Array(mountain),
      valley: new Float32Array(valley),
      selected: new Float32Array(selected),
      guides: meshData.spiralLinePositions.slice(centralPathLength),
    };
  }, [meshData.spiralLinePositions, foldData, segmentCount, selectedEdgeIndex]);
  
  const versionRef = useRef(0);
  const prevDepsRef = useRef<{ p: SpirogamiParams; prog: number } | null>(null);
  
  if (!prevDepsRef.current || prevDepsRef.current.p !== params || prevDepsRef.current.prog !== progress) {
    versionRef.current++;
    prevDepsRef.current = { p: params, prog: progress };
  }

  return (
    <div className={styles.container}>
      <Canvas camera={{ position: [0, 200, 300], fov: 40 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[100, 200, 100]} intensity={0.8} />
        <directionalLight position={[-100, 100, -100]} intensity={0.4} />
        
        <gridHelper args={[1000, 50, 0x000000, 0xdddddd]} position={[0, -0.1, 0]} />

        <AutoCenter radius={params.discRadius} />

        <group rotation={[-Math.PI / 2, 0, 0]} key={versionRef.current}>
          {meshData.basePositions.length > 0 && (
            <SpiroPaperMesh
              positions={meshData.basePositions}
              exteriorColor={exteriorColor}
              interiorColor={interiorColor}
              triangleToFaceIndex={baseFaceMap}
              highlightedFaceIndex={highlightedFaceIndex}
              onHoverFace={onHoverFace}
              onSelectFace={onSelectFace}
              opacity={0.95}
            />
          )}

          {meshData.stripPositions.length > 0 && (
            <SpiroPaperMesh
              positions={meshData.stripPositions}
              exteriorColor={exteriorColor}
              interiorColor={interiorColor}
              triangleToFaceIndex={stripFaceMap}
              highlightedFaceIndex={highlightedFaceIndex}
              onHoverFace={onHoverFace}
              onSelectFace={onSelectFace}
            />
          )}

          {meshData.stripEdgePositions.length > 0 && (
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[meshData.stripEdgePositions, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color="#E85D04" opacity={0.7} transparent />
            </lineSegments>
          )}

          {foldLines.guides.length > 0 && (
            <lineSegments>
              <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[foldLines.guides, 3]} />
              </bufferGeometry>
              <lineBasicMaterial color="#E85D04" opacity={0.45} transparent />
            </lineSegments>
          )}

          {foldLines.mountain.length > 0 && <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[foldLines.mountain, 3]} /></bufferGeometry><lineBasicMaterial color="#0055FF" opacity={0.9} transparent /></lineSegments>}
          {foldLines.valley.length > 0 && <lineSegments><bufferGeometry><bufferAttribute attach="attributes-position" args={[foldLines.valley, 3]} /></bufferGeometry><lineBasicMaterial color="#00AA44" opacity={0.9} transparent /></lineSegments>}
          {foldLines.selected.length > 0 && <lineSegments renderOrder={20}><bufferGeometry><bufferAttribute attach="attributes-position" args={[foldLines.selected, 3]} /></bufferGeometry><lineBasicMaterial color="#FF6600" depthTest={false} transparent opacity={1} /></lineSegments>}
        </group>

        <CameraFixer />
        <StudioTrackpadControls minDistance={50} maxDistance={5000} zoomSpeed={1.2} />
        <CameraBridge ref={controlsRef} foldData={foldData} />
      </Canvas>
    </div>
  );
}