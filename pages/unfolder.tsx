/// <reference types="@react-three/fiber" />
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Canvas, ThreeElements, extend } from "@react-three/fiber";
import "../helpers/r3fCompat"; // Must be imported before any R3F usage
import * as THREE from "three";

extend(THREE as any);
import { 
  Download, 
  FileText, 
  Upload, 
  Trash2, 
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Anchor,
  ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../components/Resizable";
import { Slider } from "../components/Slider";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";

import { objParser, ParsedMesh } from "../helpers/objParser";
import { meshSimplifier, SimplifyResult } from "../helpers/meshSimplifier";
import { meshUnfolder, UnfoldResult } from "../helpers/meshUnfolder";
import { dielineExporter } from "../helpers/dielineExporter";
import { BoxParams, buildFaceTree, computeFoldedVertices } from "../helpers/foldEngine";
import { foldValidation } from "../helpers/foldValidation";
import { collisionDetection } from "../helpers/collisionDetection";
import { StudioCreasePatternView as CreasePatternView } from "../components/StudioCreasePatternView";
import { StudioFoldedGeometry as FoldedGeometry } from "../components/StudioFoldedGeometry";
import { Studio3DToolbar, CameraBridge, type CameraControlsAPI } from "../components/Studio3DToolbar";
import { StudioTrackpadControls } from "../components/StudioTrackpadControls";
import { CameraFixer } from "../helpers/CameraFixer";
import { StudioMaterialControls } from "../components/StudioMaterialControls";
import { StudioSelectionControls } from "../components/StudioSelectionControls";
import { useArtworkLayers } from "../helpers/useArtworkLayers";
import { setFoldEdgeAssignment, toggleFoldEdgeAssignment } from "../helpers/foldEdgeInteraction";

import { FoldPlayback } from "../components/FoldPlayback";
import styles from "./unfolder.module.css";

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export default function UnfolderPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("Untitled Unfold");
  
  const [parsedMesh, setParsedMesh] = useState<ParsedMesh | null>(null);
  const [simplifyResult, setSimplifyResult] = useState<SimplifyResult | null>(null);
  const [unfoldResult, setUnfoldResult] = useState<UnfoldResult | null>(null);
  
  const [progress, setProgress] = useState(0); // 0 to 100
  const [sequential, setSequential] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [params, setParams] = useState({
    glueTabSize: 15,
    glueTabAngle: 45
  });

  const [hoveredFaceIndex, setHoveredFaceIndex] = useState<number | null>(null);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);
  const activeFaceIndex = hoveredFaceIndex ?? selectedFaceIndex;
  const [showValidation, setShowValidation] = useState(false);
  const [showCollisions, setShowCollisions] = useState(false);
  const [groundFaceToolActive, setGroundFaceToolActive] = useState(false);
  const [groundFaceIndex, setGroundFaceIndex] = useState<number | null>(null);

  const [layerVisibility, setLayerVisibility] = useState({
    decoupe: true,
    pli: true,
    collage: true,
    fondPerdu: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraControlsRef = useRef<CameraControlsAPI | null>(null);
  const navigate = useNavigate();
  const material = useArtworkLayers();

  const validationResult = useMemo(() => {
    if (!showValidation || !unfoldResult?.foldData) return undefined;
    return foldValidation(unfoldResult.foldData);
  }, [unfoldResult?.foldData, showValidation]);

  const collidingFaces = useMemo(() => {
    if (!showCollisions || !unfoldResult?.foldData) return undefined;
    const tree = buildFaceTree(unfoldResult.foldData);
    const vMap = computeFoldedVertices(unfoldResult.foldData, tree, progress / 100);
    const result = collisionDetection(unfoldResult.foldData, vMap);
    return result.collidingFaces;
  }, [unfoldResult?.foldData, progress, showCollisions]);

  // Handle File Selection
  const handleFilesSelected = (files: File[]) => {
    const selectedFile = files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setFileName(selectedFile.name.replace(/\.[^/.]+$/, ""));
    setError(null);
    setUnfoldResult(null);
    setGroundFaceIndex(null);
    setHoveredFaceIndex(null);
    setSelectedFaceIndex(null);
    setSelectedEdgeIndex(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = objParser(text);
        if (parsed.faces.length === 0) {
          throw new Error("No valid polygonal faces found in the OBJ file.");
        }
        setParsedMesh(parsed);
      } catch (err) {
        setParsedMesh(null);
        setError(err instanceof Error ? err.message : "Failed to parse OBJ file");
      }
    };
    reader.onerror = () => {
      setError("Failed to read the file");
    };
    reader.readAsText(selectedFile);
  };

  const handleClear = () => {
    setFile(null);
    setFileName("Untitled Unfold");
    setParsedMesh(null);
    setSimplifyResult(null);
    setUnfoldResult(null);
    setError(null);
    setGroundFaceIndex(null);
    setHoveredFaceIndex(null);
    setSelectedFaceIndex(null);
    setSelectedEdgeIndex(null);
  };

  const [unfoldRevision, setUnfoldRevision] = useState(0);

  // Perform Unfolding
  useEffect(() => {
    if (!parsedMesh) {
      setUnfoldResult(null);
      setSimplifyResult(null);
      return;
    }

    setIsProcessing(true);
    
    // Slight timeout to allow UI to render loading state before heavy computation
    const timer = setTimeout(() => {
      try {
        const sResult = meshSimplifier(parsedMesh, {
          maxFaces: 200,
          coplanarAngleThreshold: 5
        });
        setSimplifyResult(sResult);

        const result = meshUnfolder(sResult.mesh, {
          glueTabSize: params.glueTabSize,
          glueTabAngle: params.glueTabAngle,
          forcedCuts: []
        });
        setUnfoldResult(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to unfold mesh.");
        setUnfoldResult(null);
      } finally {
        setIsProcessing(false);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [parsedMesh, params.glueTabSize, params.glueTabAngle, unfoldRevision]);

  const forceReunfold = () => {
    // Explicit invalidation: parameters can remain identical.
    setUnfoldRevision(revision => revision + 1);
  };

  const handleToggleEdge = (edgeIndex: number) => {
    setUnfoldResult((current) => {
      if (!current?.foldData) return current;
      const foldData = toggleFoldEdgeAssignment(current.foldData, edgeIndex);
      return foldData === current.foldData ? current : { ...current, foldData };
    });
  };

  const handleSetEdgeAssignment = (assignment: 'M' | 'V') => {
    if (selectedEdgeIndex === null) return;
    setUnfoldResult((current) => {
      if (!current?.foldData) return current;
      const foldData = setFoldEdgeAssignment(current.foldData, selectedEdgeIndex, assignment);
      return foldData === current.foldData ? current : { ...current, foldData };
    });
  };

  const handleSelectEdge = (index: number | null) => {
    setSelectedEdgeIndex(index);
    if (index !== null) setSelectedFaceIndex(null);
  };

  const handleSelectFace = (index: number | null) => {
    setSelectedFaceIndex(index);
    if (index !== null) setSelectedEdgeIndex(null);
  };

  useEffect(() => {
    const foldData = unfoldResult?.foldData;
    if (!foldData) {
      setSelectedFaceIndex(null);
      setSelectedEdgeIndex(null);
      return;
    }
    setSelectedFaceIndex(current => current !== null && current >= foldData.facesVertices.length ? null : current);
    setSelectedEdgeIndex(current => current !== null && current >= foldData.edgesVertices.length ? null : current);
  }, [unfoldResult?.foldData]);

  // Export Logic
  const buildDummyParams = (): BoxParams => ({
    width: 100,
    height: 100,
    depth: 100,
    glueTabSize: params.glueTabSize,
    materialThickness: 0,
    bleedSize: 0
  });

  const handleExportSVG = async () => {
    if (!unfoldResult?.foldData) return;
    const svg = await dielineExporter.exportDielineSVG(unfoldResult.foldData, buildDummyParams(), fileName);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\s+/g, "_")}_DECOUPE.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!unfoldResult?.foldData) return;
    const blob = await dielineExporter.exportDielinePDF(unfoldResult.foldData, buildDummyParams(), fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\s+/g, "_")}_DECOUPE.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportFold = () => {
    if (!unfoldResult?.foldData) return;
    const blob = new Blob([JSON.stringify(unfoldResult.foldData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\s+/g, "_")}.fold`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.workspace}>
      <ResizablePanelGroup direction="horizontal">
        
        {/* Left Sidebar - Controls */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className={styles.sidebarPanel}>
          <div className={styles.viewHeader}>
            <Input 
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className={styles.projectNameInput}
              placeholder="Project Name"
            />
          </div>
          <div className={styles.sidebarContent}>
            
            <div className={styles.sidebarSection}>
              <h3 className={styles.sectionTitle}>Source Mesh</h3>
              {!file ? (
                <>
                  <input
                    type="file"
                    accept=".obj"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFilesSelected(Array.from(e.target.files));
                        e.target.value = "";
                      }
                    }}
                    style={{ display: "none" }}
                  />
                  <Button 
                    variant="outline" 
                    className={styles.applyBtn}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} style={{ marginRight: '6px' }} />
                    Import .obj
                  </Button>
                </>
              ) : (
                <div className={styles.fileCard}>
                  <div className={styles.fileInfo}>
                    <FileText size={16} className={styles.fileIcon} />
                    <span className={styles.fileName}>{file.name}</span>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={handleClear}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
              {error && (
                <div className={styles.errorMessage}>
                  {error}
                </div>
              )}
            </div>

            <StudioMaterialControls
              materialType={material.materialType}
              exteriorColor={material.exteriorColor}
              interiorColor={material.interiorColor}
              onMaterialPresetChange={material.applyMaterialPreset}
              onExteriorColorChange={material.setExteriorColor}
              onInteriorColorChange={material.setInteriorColor}
            />

            {parsedMesh && (
              <>
                <div className={styles.sidebarSection}>
                  <h3 className={styles.sectionTitle}>Unfold Settings</h3>
                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Glue Tab Size (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.glueTabSize]} 
                        onValueChange={(v) => setParams(p => ({...p, glueTabSize: v[0]}))} 
                        max={50} min={5} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={params.glueTabSize}
                        onChange={(e) => setParams(p => ({...p, glueTabSize: parseInt(e.target.value) || 5}))}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>
                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Glue Tab Angle (°)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.glueTabAngle]} 
                        onValueChange={(v) => setParams(p => ({...p, glueTabAngle: v[0]}))} 
                        max={75} min={30} step={5}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={params.glueTabAngle}
                        onChange={(e) => setParams(p => ({...p, glueTabAngle: parseInt(e.target.value) || 30}))}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    variant="primary" 
                    className={styles.applyBtn} 
                    onClick={forceReunfold}
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Spinner size="sm" /> : <RotateCcw size={14} style={{marginRight: '6px'}} />}
                    Force Re-unfold
                  </Button>
                </div>

                <div className={styles.sidebarSection}>
                  <Button 
                    variant="primary" 
                    className={styles.applyBtn} 
                    onClick={() => {
                      if (unfoldResult?.foldData) {
                        navigate('/studio', { state: { foldData: unfoldResult.foldData, name: fileName } });
                      }
                    }}
                    disabled={!unfoldResult || isProcessing}
                  >
                    Send to Fold Studio Lab
                    <ArrowRight size={14} style={{marginLeft: '6px'}} />
                  </Button>
                </div>

                <div className={styles.sidebarSection}>
                  <h3 className={styles.sectionTitle}>Export</h3>
                  <Button variant="outline" onClick={handleExportSVG} className={styles.applyBtn} disabled={!unfoldResult || isProcessing}>
                    <Download size={14} style={{marginRight: '6px'}} />
                    Export SVG Dieline
                  </Button>
                  <Button variant="outline" onClick={handleExportPDF} className={styles.applyBtn} disabled={!unfoldResult || isProcessing}>
                    <Download size={14} style={{marginRight: '6px'}} />
                    Export PDF Dieline
                  </Button>
                  <Button variant="outline" onClick={handleExportFold} className={styles.applyBtn} disabled={!unfoldResult || isProcessing}>
                    <Download size={14} style={{marginRight: '6px'}} />
                    Export .fold format
                  </Button>
                </div>
              </>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle={false} />

        {/* Center - 2D SVG Canvas */}
        <ResizablePanel defaultSize={40} className={styles.viewPanel}>
          <div className={styles.viewHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className={styles.viewLabel}>2D Unfolded Pattern</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <Button 
                  variant={showValidation ? "secondary" : "ghost"} 
                  size="icon-sm" 
                  onClick={() => setShowValidation(v => !v)}
                  title="Validation Kawasaki / Maekawa"
                >
                  {showValidation && validationResult && !validationResult.isValid ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
                </Button>
                <Button 
                  variant={showCollisions ? "secondary" : "ghost"} 
                  size="icon-sm" 
                  onClick={() => setShowCollisions(v => !v)}
                  title="Collision Detection"
                >
                  <AlertTriangle size={14} />
                </Button>
                <Button 
                  variant={groundFaceToolActive ? "secondary" : "ghost"} 
                  size="icon-sm" 
                  onClick={() => setGroundFaceToolActive(prev => !prev)}
                  title="Ground Face — Click a face to set it as the base for 3D preview"
                >
                  <Anchor size={14} />
                </Button>
              </div>
              {showValidation && validationResult && (
                <span style={{ fontSize: '0.75rem', color: validationResult.isValid ? 'var(--success)' : 'var(--error)' }}>
                  {validationResult.isValid 
                    ? "✓ Valid pattern" 
                    : `⚠ ${validationResult.kawasakiViolations.length} violation(s) Kawasaki, ${validationResult.maekawViolations.length} violation(s) Maekawa`}
                </span>
              )}
              <StudioSelectionControls
                foldData={unfoldResult?.foldData ?? null}
                selectedFaceIndex={selectedFaceIndex}
                selectedEdgeIndex={selectedEdgeIndex}
                onSetEdgeAssignment={handleSetEdgeAssignment}
              />
              
            </div>
            <div className={styles.legend}>
              <button 
                className={`${styles.layerToggle} ${!layerVisibility.decoupe ? styles.layerToggleInactive : ''}`}
                onClick={() => setLayerVisibility(l => ({...l, decoupe: !l.decoupe}))}
              >
                <div className={styles.legendColor} style={{backgroundColor: '#FF00FF'}}></div>
                Cut
              </button>
              <button 
                className={`${styles.layerToggle} ${!layerVisibility.pli ? styles.layerToggleInactive : ''}`}
                onClick={() => setLayerVisibility(l => ({...l, pli: !l.pli}))}
              >
                <div className={styles.legendColor} style={{backgroundColor: '#0055FF'}}></div>
                Fold
              </button>
              <button 
                className={`${styles.layerToggle} ${!layerVisibility.fondPerdu ? styles.layerToggleInactive : ''}`}
                onClick={() => setLayerVisibility(l => ({...l, fondPerdu: !l.fondPerdu}))}
              >
                <div className={styles.legendColor} style={{backgroundColor: '#FFB8B8'}}></div>
                Bleed
              </button>
            </div>
          </div>
          
          <div className={styles.viewCanvasContainer}>
            {!parsedMesh ? (
              <div className={styles.placeholderContainer}>
                <span className={styles.placeholderText}>Import an .obj file to get started</span>
              </div>
            ) : isProcessing ? (
              <div className={styles.placeholderContainer}>
                <Spinner size="lg" />
                <span className={styles.placeholderText}>Computing unfolding MST...</span>
              </div>
            ) : unfoldResult?.foldData ? (
              <CreasePatternView 
                foldData={unfoldResult.foldData}
                bleedSize={0}
                materialThickness={0}
                layerVisibility={layerVisibility}
                highlightedFaceIndex={activeFaceIndex}
                onHoverFace={setHoveredFaceIndex}
                onSelectFace={handleSelectFace}
                validationResults={validationResult}
                groundFaceToolActive={groundFaceToolActive}
                onSelectGroundFace={(idx) => {
                  setGroundFaceIndex(prev => prev === idx ? null : idx);
                  setGroundFaceToolActive(false);
                }}
                groundFaceIndex={groundFaceIndex}
                onToggleEdge={handleToggleEdge}
                selectedEdgeIndex={selectedEdgeIndex}
                onSelectEdge={handleSelectEdge}
              />
            ) : (
              <div className={styles.placeholderContainer}>
                <span className={styles.placeholderText}>Unfolding failed or generated empty data</span>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle={false} />

        {/* Right - 3D Three.js View */}
        <ResizablePanel defaultSize={40} className={styles.viewPanel}>
          <div className={styles.viewHeader}>
            <span className={styles.viewLabel}>
              3D Folded Preview
            </span>
            <Studio3DToolbar controlsRef={cameraControlsRef} />
          </div>
          
          <div className={styles.viewCanvasContainer}>
            {!unfoldResult?.foldData ? (
              <div className={styles.placeholderContainer}>
                <span className={styles.placeholderText}>Upload and unfold a model to view 3D fold preview</span>
              </div>
            ) : (
              <Canvas 
                camera={{ position: [250, -250, 200], fov: 40, up: [0, 0, 1], near: 0.5, far: 10000 }} 
                scene={{ background: new THREE.Color('#FAFAFA') }}
              >
                <ambientLight intensity={1.5} />
                <directionalLight position={[100, 100, 200]} intensity={1.5} />
                <directionalLight position={[-100, -100, -200]} intensity={0.5} />
                
                <gridHelper args={[1000, 20, '#E6E8EB', '#E6E8EB']} position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]} />
                
                <FoldedGeometry foldData={unfoldResult.foldData} progress={progress / 100} sequential={sequential} highlightedFaceIndex={activeFaceIndex} onHoverFace={setHoveredFaceIndex} onSelectFace={handleSelectFace} selectedEdgeIndex={selectedEdgeIndex} collidingFaces={collidingFaces} rootFaceIndex={groundFaceIndex} exteriorColor={material.exteriorColor} interiorColor={material.interiorColor} />
                
                <CameraFixer />
                <StudioTrackpadControls minDistance={50} maxDistance={5000} zoomSpeed={1.2} />
                <CameraBridge ref={cameraControlsRef} foldData={unfoldResult.foldData} />
              </Canvas>
            )}
          </div>
          
          {unfoldResult?.foldData && (
            <FoldPlayback progress={progress} onChange={setProgress} sequential={sequential} onSequentialChange={() => setSequential(s => !s)} />
          )}
        </ResizablePanel>
        
      </ResizablePanelGroup>
    </div>
  );
}