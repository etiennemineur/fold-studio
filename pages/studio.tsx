/// <reference types="@react-three/fiber" />
import "../helpers/r3fCompat"; // Must be imported before any R3F usage
import React, { useState, useMemo, useEffect, useRef } from "react";
import { generateShapeFoldData, BoxParams, FoldData, ShapeType, buildFaceTree, computeFoldedVertices } from "../helpers/foldEngine";
import { applyTabFillets } from "../helpers/applyTabFillets";
import { applyDoubleScoring } from "../helpers/doubleScoring";
import { foldValidation } from "../helpers/foldValidation";
import { collisionDetection } from "../helpers/collisionDetection";
import { TemplateLibrary } from "../components/TemplateLibrary";
import { PopupTemplateLibrary } from "../components/PopupTemplateLibrary";
import { OrigamiTemplateLibrary } from "../components/OrigamiTemplateLibrary";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../components/Resizable";
import { Slider } from "../components/Slider";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../components/DropdownMenu";
import { Canvas, ThreeElements, useThree, extend } from "@react-three/fiber";
import * as THREE from "three";

extend(THREE as any);

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
import { Download, FileText, RotateCcw, Upload, Trash2, ShieldCheck, ShieldAlert, AlertTriangle, LayoutGrid, FoldVertical, Anchor, Layers, Check, Box, FileBox, BookOpen, RotateCw, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { applyCutLine, removeFoldEdge } from "../helpers/cutLineTool";
import { dielineExporter } from "../helpers/dielineExporter";
import { svgDielineImporter } from "../helpers/svgDielineImporter";
import { Studio3DToolbar, CameraBridge, CameraControlsAPI } from "../components/Studio3DToolbar";
import { StudioFoldedGeometry as FoldedGeometry } from "../components/StudioFoldedGeometry";
import { StudioCreasePatternView as CreasePatternView } from "../components/StudioCreasePatternView";

import { useArtworkLayers } from "../helpers/useArtworkLayers";
import { ImperativePanelHandle } from "react-resizable-panels";
import { StudioLayerPanel } from "../components/StudioLayerPanel";
import { useAuth } from "../helpers/useAuth";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { StudioOrigamiSidebar } from "../components/StudioOrigamiSidebar";
import { generateOrigamiPaper } from "../helpers/origamiShapeGenerators";
import { StudioPopupSidebar } from "../components/StudioPopupSidebar";
import { StudioPopupBookView } from "../components/StudioPopupBookView";
import { createDefaultPopupDocument, PopupDocument, popupDocumentToFoldData, getPopupPatternFoldData, addMechanism, updateMechanism, removeMechanism } from "../helpers/popupDocument";
import { validatePopupDocument, detectUnexpectedPopupCollisions } from "../helpers/popupValidation";
import { exportPopupSVG, exportPopupPDF, exportPopupJSON } from "../helpers/popupExporter";
import { solvePopupKinematics, interpolateBookAngle } from "../helpers/popupKinematicSolver";
import { StudioSpiroSidebar } from "../components/StudioSpiroSidebar";
import { StudioSpiroView } from "../components/StudioSpiroView";
import { getDefaultSpirogamiParams, SpirogamiParams, generateSpirogamiFlatFoldData } from "../helpers/spirogamiEngine";
import { StudioPackagingSidebar } from "../components/StudioPackagingSidebar";
import { CameraFixer } from "../helpers/CameraFixer";
import { StudioTrackpadControls } from "../components/StudioTrackpadControls";
import { StudioSelectionControls } from "../components/StudioSelectionControls";
import { getFoldEdgeSignature, setFoldEdgeAssignment } from "../helpers/foldEdgeInteraction";
import styles from "./studio.module.css";

// Stable references for Canvas props — prevents re-initialization on every render 
const CANVAS_CAMERA = { position: [250, -250, 200] as [number, number, number], fov: 40, up: [0, 0, 1] as [number, number, number], near: 0.5, far: 10000 };
const CANVAS_GL = { preserveDrawingBuffer: true };

function CanvasRefCapture({ canvasRef }: { canvasRef: React.MutableRefObject<HTMLCanvasElement | null> }) {
  const { gl } = useThree();
  useEffect(() => { canvasRef.current = gl.domElement; }, [gl, canvasRef]);
  return null;
}

function SceneSetup() {
const { scene } = useThree();
useEffect(() => {
  scene.background = new THREE.Color('#FAFAFA');
}, [scene]);
return null;
}

function CameraAutoCenter({ foldData, shapeType }: { foldData: FoldData | null; shapeType: string }) {
  const { camera, controls } = useThree();
  const hasCenteredRef = useRef(false);
  const prevShapeRef = useRef(shapeType);

  // Reset when shape type changes so the new shape gets properly framed
  if (shapeType !== prevShapeRef.current) {
    prevShapeRef.current = shapeType;
    hasCenteredRef.current = false;
  }

  useEffect(() => {
    if (hasCenteredRef.current) return;
    if (!foldData || !foldData.verticesCoords || foldData.verticesCoords.length === 0) return;

    hasCenteredRef.current = true;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const [x, y] of foldData.verticesCoords) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const size = Math.max(maxX - minX, maxY - minY) || 200;
    const dist = size * 1.8;

    camera.position.set(cx + dist, cy - dist, dist * 0.8);
    camera.updateProjectionMatrix();

    if (controls && (controls as any).target) {
      (controls as any).target.set(cx, cy, 0);
      (controls as any).update();
    }
  }, [foldData, camera, controls]);

  return null;
}

export default function StudioPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraControlsRef = useRef<CameraControlsAPI | null>(null);
  const panel2DRef = useRef<ImperativePanelHandle>(null);
  const panel3DRef = useRef<ImperativePanelHandle>(null);
  const panelAIRef = useRef<ImperativePanelHandle>(null);
  const [is2DCollapsed, setIs2DCollapsed] = useState(false);
  const [is3DCollapsed, setIs3DCollapsed] = useState(false);
  const [isAICollapsed, setIsAICollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const expandWithAnimation = (panelRef: React.RefObject<ImperativePanelHandle | null>) => {
    setIsAnimating(true);
    panelRef.current?.expand();
    setTimeout(() => setIsAnimating(false), 500);
  };

  const [studioMode, setStudioMode] = useState<'packaging' | 'origami' | 'popup' | 'spirogami'>(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    if (m === 'origami' || m === 'popup' || m === 'spirogami') return m;
    return 'packaging';
  });
  const [paperShape, setPaperShape] = useState<'square' | 'rectangle' | 'a4' | 'custom'>('square');
  const [origamiPaperWidth, setOrigamiPaperWidth] = useState(150);
  const [origamiPaperHeight, setOrigamiPaperHeight] = useState(150);
  const [origamiFoldType, setOrigamiFoldType] = useState<'M' | 'V'>('M');
  const [origamiFoldAngle, setOrigamiFoldAngle] = useState(-180);

  const [popupDocument, setPopupDocument] = useState<PopupDocument>(() => createDefaultPopupDocument());
  const [spirogamiParams, setSpirogamiParams] = useState<SpirogamiParams>(() => getDefaultSpirogamiParams());
  const [selectedMechanismId, setSelectedMechanismId] = useState<string | null>(null);
  const [showPopupCollisions, setShowPopupCollisions] = useState(false);

  const [progress, setProgress] = useState(0); // 0 to 100
  const [sequential, setSequential] = useState(false);
  const [popupPlaying, setPopupPlaying] = useState(false);
  const popupPlaybackDirectionRef = useRef<1 | -1>(1);

  const bookAngleDeg = studioMode === 'popup'
    ? interpolateBookAngle(0, 180, progress / 100)
    : (progress / 100) * 180;

  useEffect(() => {
    if (!popupPlaying || studioMode !== 'popup') return;

    let animationFrame = 0;
    let previousTime = performance.now();

    const animate = (time: number) => {
      const deltaSeconds = Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;

      setProgress((current) => {
        let next = current + popupPlaybackDirectionRef.current * deltaSeconds * 32;
        if (next >= 100) {
          next = 100;
          popupPlaybackDirectionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          popupPlaybackDirectionRef.current = 1;
        }
        return next;
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [popupPlaying, studioMode]);
  
  const [hoveredFaceIndex, setHoveredFaceIndex] = useState<number | null>(null);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [showCollisions, setShowCollisions] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showPopupTemplateLibrary, setShowPopupTemplateLibrary] = useState(false);
  const [showOrigamiTemplateLibrary, setShowOrigamiTemplateLibrary] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [cutToolActive, setCutToolActive] = useState(false);
  const [groundFaceToolActive, setGroundFaceToolActive] = useState(false);
  const [groundFaceIndex, setGroundFaceIndex] = useState<number | null>(null);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);
  const activeFaceIndex = hoveredFaceIndex ?? selectedFaceIndex;
  
  const [layerVisibility, setLayerVisibility] = useState({
    decoupe: true,
    pli: true,
    collage: true,
    fondPerdu: true,
  });

  const [importedMode, setImportedMode] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isVerso, setIsVerso] = useState(false);
  
  const artworkLayers = useArtworkLayers();

  useEffect(() => {
    setPopupDocument((current) => current.paperColor === artworkLayers.exteriorColor
      ? current
      : { ...current, paperColor: artworkLayers.exteriorColor });
    setSpirogamiParams((current) => current.paperColor === artworkLayers.exteriorColor
      ? current
      : { ...current, paperColor: artworkLayers.exteriorColor });
  }, [artworkLayers.exteriorColor]);
  
  const layerInputRef = useRef<HTMLInputElement>(null);
  const handleImportFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !displayFoldData) return;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    displayFoldData.verticesCoords.forEach(v => {
      minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
      minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    });
    const bb = { x: minX, y: minY, width: maxX-minX, height: maxY-minY };
    for (const file of Array.from(files)) {
      artworkLayers.addLayer(file, bb);
    }
    e.target.value = '';
  };

  // Local state for editing
  const [name, setName] = useState("Untitled Box");
  const [shapeType, setShapeType] = useState<ShapeType>('box');
    const [params, setParams] = useState<BoxParams>({ 
    width: 100, 
    height: 60, 
    depth: 40, 
    glueTabSize: 15,
    materialThickness: 0.5,
    bleedSize: 3,
    tabFilletRadius: 0,
    tabTaperRatio: 0.3
  });
  
  const [baseFoldData, setBaseFoldData] = useState<FoldData | null>(null);
  const [displayFoldData, setDisplayFoldData] = useState<FoldData | null>(null);

  const handleModeChange = (mode: 'packaging' | 'origami' | 'popup' | 'spirogami') => {
    setStudioMode(mode);
    setHoveredFaceIndex(null);
    setSelectedFaceIndex(null);
    setSelectedEdgeIndex(null);
    if (mode === 'origami') {
      setName("Untitled Origami");
      setBaseFoldData(generateOrigamiPaper(paperShape, origamiPaperWidth, origamiPaperHeight));
      setImportedMode(false);
      setImportWarnings([]);
      setImportFileName("");
      artworkLayers.clearLayers();
      setCutToolActive(false);
    } else if (mode === 'popup') {
      setName("Untitled Pop-up");
      try {
        setBaseFoldData(getPopupPatternFoldData(popupDocument));
      } catch { }
      setImportedMode(false);
      setImportWarnings([]);
      setImportFileName("");
      artworkLayers.clearLayers();
      setCutToolActive(false);
    } else if (mode === 'spirogami') {
      setName("Untitled Spirogami");
      try {
        setBaseFoldData(generateSpirogamiFlatFoldData(spirogamiParams));
      } catch {}
      setImportedMode(false);
      setImportWarnings([]);
      setImportFileName("");
      artworkLayers.clearLayers();
      setCutToolActive(false);
    } else {
      setName("Untitled Box");
      setBaseFoldData(generateShapeFoldData(shapeType, params, { skipDoubleScoring: true }));
      artworkLayers.clearLayers();
      setCutToolActive(false);
    }
    navigate(`/studio?mode=${mode}`, { replace: true });
  };

  const studioModeRef = useRef(studioMode);
  studioModeRef.current = studioMode;

  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode && ['packaging', 'origami', 'popup', 'spirogami'].includes(urlMode) && urlMode !== studioModeRef.current) {
      handleModeChange(urlMode as 'packaging' | 'origami' | 'popup' | 'spirogami');
    }
  }, [searchParams]);

  const handleOrigamiPaperChange = (shape: 'square' | 'rectangle' | 'a4' | 'custom', w: number, h: number) => {
    setBaseFoldData(generateOrigamiPaper(shape, w, h));
    setProgress(0);
  };

  const handleOrigamiTemplateSelect = (template: { paperWidth: number; paperHeight: number; foldData: FoldData }) => {
    setPaperShape('square');
    setOrigamiPaperWidth(template.paperWidth);
    setOrigamiPaperHeight(template.paperHeight);
    setBaseFoldData(template.foldData);
    setProgress(0);
  };

  const handlePopupTemplateSelect = (doc: PopupDocument) => {
    setPopupDocument(doc);
    setSelectedMechanismId(null);
    setProgress(50);
    try {
      setBaseFoldData(getPopupPatternFoldData(doc));
    } catch {}
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedEdgeIndex === null || !baseFoldData) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        
        const baseIdx = doubledToBaseMapRef.current.get(selectedEdgeIndex);
        if (baseIdx === undefined) return;
        
        const result = removeFoldEdge(baseFoldData, baseIdx);
        if (result.success) {
          setBaseFoldData(result.foldData);
          setSelectedEdgeIndex(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeIndex, baseFoldData]);
  const doubledToBaseMapRef = useRef(new Map<number, number>());
  
  const prevParamsRef = useRef(params);

  const handleSvgImport = (files: File[]) => {
    const file = files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { foldData, warnings } = svgDielineImporter(text);
        
        setBaseFoldData(foldData);
        setImportWarnings(warnings);
        setImportFileName(file.name);
        setImportedMode(true);
        setName(file.name.replace(/\.[^/.]+$/, ""));
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleClearImport = () => {
    setImportedMode(false);
    setImportWarnings([]);
    setImportFileName("");
    setBaseFoldData(generateShapeFoldData(shapeType, params, { skipDoubleScoring: true }));
    artworkLayers.clearLayers();
  };

  const initRef = useRef(false);

  // Initialize baseFoldData
  useEffect(() => {
    if (initRef.current) return;
    
    if (location.state?.foldData) {
      initRef.current = true;
      setBaseFoldData(location.state.foldData);
      setImportedMode(true);
      setImportWarnings([]);
      const importedName = location.state.name || 'Unfold Import';
      setImportFileName(importedName);
      setName(importedName);
      artworkLayers.clearLayers();
      window.history.replaceState({}, '');
    } else if (!baseFoldData) {
      initRef.current = true;
      if (studioMode === 'origami') {
        setBaseFoldData(generateOrigamiPaper(paperShape, origamiPaperWidth, origamiPaperHeight));
        setName("Untitled Origami");
      } else if (studioMode === 'popup') {
        try { setBaseFoldData(getPopupPatternFoldData(popupDocument)); } catch {}
        setName("Untitled Pop-up");
      } else if (studioMode === 'spirogami') {
        try { setBaseFoldData(generateSpirogamiFlatFoldData(spirogamiParams)); } catch {}
        setName("Untitled Spirogami");
      } else {
        setBaseFoldData(generateShapeFoldData(shapeType, params, { skipDoubleScoring: true }));
      }
    }
  }, [location.state, baseFoldData, params, shapeType, artworkLayers, studioMode, paperShape, origamiPaperWidth, origamiPaperHeight, popupDocument, spirogamiParams]);

  const popupValidationResult = useMemo(() => {
    if (studioMode !== 'popup') return null;
    return validatePopupDocument(popupDocument, bookAngleDeg);
  }, [popupDocument, bookAngleDeg, studioMode]);

  const popupCollidingFaces = useMemo(() => {
    if (!showPopupCollisions || studioMode !== 'popup') return undefined;
    try {
      return detectUnexpectedPopupCollisions(popupDocument, bookAngleDeg).collidingFaces;
    } catch { return undefined; }
  }, [popupDocument, bookAngleDeg, showPopupCollisions, studioMode]);

  const validationResult = useMemo(() => {
    if (!showValidation || !displayFoldData) return undefined;
    return foldValidation(displayFoldData);
  }, [displayFoldData, showValidation]);

  const collidingFaces = useMemo(() => {
    if (!showCollisions || !displayFoldData) return undefined;
        const tree = buildFaceTree(displayFoldData);
    const vMap = computeFoldedVertices(displayFoldData, tree, progress / 100);
    const result = collisionDetection(displayFoldData, vMap);
    return result.collidingFaces;
  }, [displayFoldData, progress, showCollisions]);

  // Derive displayFoldData
  useEffect(() => {
    if (studioMode === 'popup') {
      try {
        const pfd = getPopupPatternFoldData(popupDocument);
        setDisplayFoldData(pfd);
        const identityMap = new Map<number, number>();
        for (let i = 0; i < pfd.edgesVertices.length; i++) identityMap.set(i, i);
        doubledToBaseMapRef.current = identityMap;
      } catch { }
      return;
    }

    if (studioMode === 'spirogami') {
      try {
        const sfd = generateSpirogamiFlatFoldData(spirogamiParams);
        setDisplayFoldData(sfd);
        const identityMap = new Map<number, number>();
        for (let i = 0; i < sfd.edgesVertices.length; i++) identityMap.set(i, i);
        doubledToBaseMapRef.current = identityMap;
      } catch {}
      return;
    }

    if (!baseFoldData) { 
      setDisplayFoldData(null); 
      return; 
    }
    if (studioMode === 'origami') {
      setDisplayFoldData(JSON.parse(JSON.stringify(baseFoldData)));
      const identityMap = new Map<number, number>();
      for (let i = 0; i < baseFoldData.edgesVertices.length; i++) {
        identityMap.set(i, i);
      }
      doubledToBaseMapRef.current = identityMap;
    } else {
      const result = applyDoubleScoring(baseFoldData, params.materialThickness);
      const filletedData = applyTabFillets(result.foldData, params.tabFilletRadius ?? 0);
      setDisplayFoldData(filletedData);
      doubledToBaseMapRef.current = result.doubledToBaseMap;
    }
  }, [baseFoldData, params.materialThickness, params.tabFilletRadius, studioMode, popupDocument, spirogamiParams]);

  useEffect(() => {
    if (!displayFoldData) {
      setSelectedEdgeIndex(null);
      setSelectedFaceIndex(null);
      return;
    }
    setSelectedEdgeIndex(current => current !== null && current >= displayFoldData.edgesVertices.length ? null : current);
    setSelectedFaceIndex(current => current !== null && current >= displayFoldData.facesVertices.length ? null : current);
  }, [displayFoldData]);

  const applyEdgeAssignment = (displayEdgeIndex: number, assignment: 'M' | 'V') => {
    if (!displayFoldData) return;
    const displayAssign = displayFoldData.edgesAssignment[displayEdgeIndex];
    if ((displayAssign !== 'M' && displayAssign !== 'V') || displayAssign === assignment) return;

    const edgeSignature = getFoldEdgeSignature(displayFoldData, displayEdgeIndex);

    if (studioMode === 'popup') {
      setPopupDocument((current) => ({
        ...current,
        foldOverrides: { ...(current.foldOverrides ?? {}), [edgeSignature]: assignment },
      }));
      return;
    }

    if (studioMode === 'spirogami') {
      setSpirogamiParams((current) => ({
        ...current,
        foldOverrides: { ...(current.foldOverrides ?? {}), [edgeSignature]: assignment },
      }));
      return;
    }

    const baseIdx = doubledToBaseMapRef.current.get(displayEdgeIndex);
    if (baseIdx === undefined) return;
    setBaseFoldData(prev => prev ? setFoldEdgeAssignment(prev, baseIdx, assignment) : prev);
  };

  const handleToggleEdge = (displayEdgeIndex: number) => {
    if (!displayFoldData) return;
    const displayAssign = displayFoldData.edgesAssignment[displayEdgeIndex];
    if (displayAssign !== 'M' && displayAssign !== 'V') return;
    applyEdgeAssignment(displayEdgeIndex, displayAssign === 'M' ? 'V' : 'M');
  };

  const handleApplyCutLine = (points: [number, number][]) => {
    if (!baseFoldData || points.length < 2) return;
    
    if (studioMode === 'origami') {
      const result = applyCutLine(baseFoldData, points, { assignment: origamiFoldType, foldAngle: origamiFoldAngle });
      if (result.cutCount > 0) {
        setBaseFoldData(result.foldData);
      }
    } else {
      const result = applyCutLine(baseFoldData, points);
      if (result.cutCount > 0) {
          setBaseFoldData(result.foldData);
      }
      setCutToolActive(false);
    }
  };

  const handleDragVertices = (newVerticesCoords: [number, number, number?][]) => {
    if (params.materialThickness < 1.0) {
      setBaseFoldData(prev => prev ? { ...prev, verticesCoords: newVerticesCoords } : prev);
    } else {
      setDisplayFoldData(prev => prev ? { ...prev, verticesCoords: newVerticesCoords } : prev);
    }
  };

  // Handle manual parameter application (Fallback just in case)
  const handleApplyParams = () => {
    const newBase = generateShapeFoldData(shapeType, params, { skipDoubleScoring: true });
    setBaseFoldData(newBase);
    setImportedMode(false);
    setImportWarnings([]);
    setImportFileName("");
    artworkLayers.clearLayers();
  };

  // Auto-regenerate pattern locally on slider changes
  const isFirstParamRender = useRef(true);
  const prevShapeTypeRef = useRef(shapeType);
  
  useEffect(() => {
    if (isFirstParamRender.current) {
      isFirstParamRender.current = false;
      prevShapeTypeRef.current = shapeType;
      prevParamsRef.current = params;
      return;
    }
    
    const prevP = prevParamsRef.current;
    const prevShape = prevShapeTypeRef.current;
    prevParamsRef.current = params;
    prevShapeTypeRef.current = shapeType;

        const baseParamsChanged = 
      params.width !== prevP.width ||
      params.height !== prevP.height ||
      params.depth !== prevP.depth ||
      params.glueTabSize !== prevP.glueTabSize ||
      params.tabTaperRatio !== prevP.tabTaperRatio ||
      shapeType !== prevShape;

    if (!baseParamsChanged || importedMode) return;
    
    setBaseFoldData(prevBase => {
      if (!prevBase) return prevBase;
      
      const newBase = generateShapeFoldData(shapeType, params, { skipDoubleScoring: true });
      const sameShape = shapeType === prevShape;
      
      if (sameShape && newBase.edgesAssignment.length === prevBase.edgesAssignment.length) {
        const preservedAssignments = [...newBase.edgesAssignment];
        const preservedAngles = [...newBase.edgesFoldAngle];
        for (let i = 0; i < newBase.edgesAssignment.length; i++) {
          const oldA = prevBase.edgesAssignment[i];
          const newA = newBase.edgesAssignment[i];
          if ((oldA === 'M' || oldA === 'V') && (newA === 'M' || newA === 'V') && oldA !== newA) {
            preservedAssignments[i] = oldA;
            preservedAngles[i] = -newBase.edgesFoldAngle[i];
          }
        }
        return {
          ...newBase,
          edgesAssignment: preservedAssignments,
          edgesFoldAngle: preservedAngles
        };
      }
    return newBase;
  });
}, [params, shapeType, importedMode]);

const handleExport = () => {
    if (!displayFoldData) return;
    const blob = new Blob([JSON.stringify(displayFoldData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_") || "box"}.fold`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSVG = async () => {
    if (!displayFoldData) return;
    const svg = await dielineExporter.exportDielineSVG(displayFoldData, params, name, artworkLayers.layers);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_") || "dieline"}_DECOUPE.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!displayFoldData) return;
    const blob = await dielineExporter.exportDielinePDF(displayFoldData, params, name, artworkLayers.layers);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_") || "dieline"}_DECOUPE.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePopupExportSVG = () => {
    const svg = exportPopupSVG(popupDocument, name);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_") || "popup"}_pattern.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePopupExportPDF = async () => {
    const blob = await exportPopupPDF(popupDocument, name);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_") || "popup"}_pattern.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePopupExportJSON = () => {
    const json = exportPopupJSON(popupDocument);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_") || "popup"}_document.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!displayFoldData) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="lg" />
        <span className={styles.loadingText}>Loading studio workspace...</span>
      </div>
    );
  }

  return (
    <div className={styles.workspace} data-animating={isAnimating || undefined}>
      <ResizablePanelGroup direction="horizontal">
        {/* Left Sidebar - Controls */}
        <ResizablePanel defaultSize={18} minSize={15} maxSize={30} className={styles.sidebarPanel}>
          {studioMode === 'spirogami' ? (
            <StudioSpiroSidebar
              studioMode={studioMode}
              params={spirogamiParams}
              onParamsChange={setSpirogamiParams}
              name={name}
              onNameChange={setName}
              onExportSVG={handleExportSVG}
              onExportFold={handleExport}
              materialType={artworkLayers.materialType}
              exteriorColor={artworkLayers.exteriorColor}
              interiorColor={artworkLayers.interiorColor}
              onMaterialPresetChange={artworkLayers.applyMaterialPreset}
              onExteriorColorChange={artworkLayers.setExteriorColor}
              onInteriorColorChange={artworkLayers.setInteriorColor}
            />
          ) : studioMode === 'popup' ? (
            <StudioPopupSidebar
              studioMode={studioMode}
              onModeChange={handleModeChange}
              popupDocument={popupDocument}
              onDocumentChange={setPopupDocument}
              selectedMechanismId={selectedMechanismId}
              onSelectMechanism={setSelectedMechanismId}
              validationResult={popupValidationResult}
              onExportSVG={handlePopupExportSVG}
              onExportPDF={handlePopupExportPDF}
              onExportJSON={handlePopupExportJSON}
              onExportFold={handleExport}
              name={name}
              onNameChange={setName}
              onShowTemplateLibrary={() => setShowPopupTemplateLibrary(true)}
              materialType={artworkLayers.materialType}
              exteriorColor={artworkLayers.exteriorColor}
              interiorColor={artworkLayers.interiorColor}
              onMaterialPresetChange={artworkLayers.applyMaterialPreset}
              onExteriorColorChange={artworkLayers.setExteriorColor}
              onInteriorColorChange={artworkLayers.setInteriorColor}
            />
          ) : studioMode === 'origami' ? (
            <StudioOrigamiSidebar
              studioMode={studioMode}
              paperShape={paperShape}
              onPaperShapeChange={(v) => { setPaperShape(v); handleOrigamiPaperChange(v, origamiPaperWidth, origamiPaperHeight); }}
              paperWidth={origamiPaperWidth}
              paperHeight={origamiPaperHeight}
              onPaperWidthChange={(v) => { setOrigamiPaperWidth(v); handleOrigamiPaperChange(paperShape, v, origamiPaperHeight); }}
              onPaperHeightChange={(v) => { setOrigamiPaperHeight(v); handleOrigamiPaperChange(paperShape, origamiPaperWidth, v); }}
              materialType={artworkLayers.materialType}
              exteriorColor={artworkLayers.exteriorColor}
              interiorColor={artworkLayers.interiorColor}
              onMaterialPresetChange={artworkLayers.applyMaterialPreset}
              onExteriorColorChange={artworkLayers.setExteriorColor}
              onInteriorColorChange={artworkLayers.setInteriorColor}
              foldToolActive={cutToolActive}
              onFoldToolToggle={() => setCutToolActive(prev => !prev)}
              foldType={origamiFoldType}
              onFoldTypeChange={setOrigamiFoldType}
              foldAngle={origamiFoldAngle}
              onFoldAngleChange={setOrigamiFoldAngle}
              onClearAllFolds={() => handleOrigamiPaperChange(paperShape, origamiPaperWidth, origamiPaperHeight)}
              onApplyAIPattern={(fd) => { setBaseFoldData(fd); setProgress(0); }}
              onShowTemplateLibrary={() => setShowOrigamiTemplateLibrary(true)}
              onExportFold={handleExport}
              onExportSVG={handleExportSVG}
              name={name}
              onNameChange={setName}
            />
          ) : (
            <>
              <StudioPackagingSidebar
                studioMode={studioMode}
                onModeChange={handleModeChange}
                name={name}
                onNameChange={setName}
                importedMode={importedMode}
                importWarnings={importWarnings}
                importFileName={importFileName}
                onSvgImport={handleSvgImport}
                onClearImport={handleClearImport}
                shapeType={shapeType}
                onShapeTypeChange={setShapeType}
                onShowTemplateLibrary={() => setShowTemplateLibrary(true)}
                params={params}
                onParamsChange={setParams}
                artworkLayers={artworkLayers}
                isVerso={isVerso}
                onVersoChange={setIsVerso}
                layerInputRef={layerInputRef}
              />
              <input 
                type="file" 
                accept="image/*" 
                ref={layerInputRef} 
                onChange={handleImportFiles} 
                style={{ display: 'none' }} 
                multiple 
              />
            </>
          )}
        </ResizablePanel>

        <ResizableHandle withHandle={false} />

        {/* Center - 2D SVG Canvas */}
        <ResizablePanel 
          ref={panel2DRef}
          defaultSize={30} 
          minSize={15}
          collapsible={true}
          collapsedSize={2}
          onCollapse={() => setIs2DCollapsed(true)}
          onExpand={() => setIs2DCollapsed(false)}
          className={styles.viewPanel}
        >
          {is2DCollapsed ? (
            <div className={styles.collapsedBar} onClick={() => expandWithAnimation(panel2DRef)}>
              <span className={styles.collapsedLabel}>2D</span>
            </div>
          ) : (
            <>
              <div className={styles.viewHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className={styles.viewLabel}>2D </span>
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
                  variant={cutToolActive ? "secondary" : "ghost"} 
                  size="icon-sm" 
                  onClick={() => {
                    setCutToolActive(prev => !prev);
                    if (!cutToolActive) setGroundFaceToolActive(false);
                  }}
                  title="Fold Tool — Draw a line to add a fold"
                >
                  <FoldVertical size={14} />
                </Button>
                <Button 
                  variant={groundFaceToolActive ? "secondary" : "ghost"} 
                  size="icon-sm" 
                  onClick={() => {
                    setGroundFaceToolActive(prev => !prev);
                    if (!groundFaceToolActive) setCutToolActive(false);
                  }}
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
                foldData={displayFoldData}
                selectedFaceIndex={selectedFaceIndex}
                selectedEdgeIndex={selectedEdgeIndex}
                onSetEdgeAssignment={(assignment) => {
                  if (selectedEdgeIndex !== null) applyEdgeAssignment(selectedEdgeIndex, assignment);
                }}
              />
              
              
            </div>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" title="Layer Visibility">
                    <Layers size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem 
                    onSelect={(e) => { e.preventDefault(); setLayerVisibility(l => ({...l, decoupe: !l.decoupe})) }}
                    style={{ opacity: layerVisibility.decoupe ? 1 : 0.4, gap: '8px', minWidth: '140px' }}
                  >
                    <div className={styles.legendColor} style={{backgroundColor: '#FF00FF'}}></div>
                    Cut
                    {layerVisibility.decoupe && <Check size={14} style={{ marginLeft: 'auto' }} />}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={(e) => { e.preventDefault(); setLayerVisibility(l => ({...l, pli: !l.pli})) }}
                    style={{ opacity: layerVisibility.pli ? 1 : 0.4, gap: '8px', minWidth: '140px' }}
                  >
                    <div className={styles.legendColor} style={{backgroundColor: '#0055FF'}}></div>
                    Fold
                    {layerVisibility.pli && <Check size={14} style={{ marginLeft: 'auto' }} />}
                  </DropdownMenuItem>
                  {studioMode === 'packaging' && (
                    <>
                      <DropdownMenuItem 
                        onSelect={(e) => { e.preventDefault(); setLayerVisibility(l => ({...l, collage: !l.collage})) }}
                        style={{ opacity: layerVisibility.collage ? 1 : 0.4, gap: '8px', minWidth: '140px' }}
                      >
                        <div className={styles.legendColor} style={{backgroundColor: '#999999'}}></div>
                        Glue
                        {layerVisibility.collage && <Check size={14} style={{ marginLeft: 'auto' }} />}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onSelect={(e) => { e.preventDefault(); setLayerVisibility(l => ({...l, fondPerdu: !l.fondPerdu})) }}
                        style={{ opacity: layerVisibility.fondPerdu ? 1 : 0.4, gap: '8px', minWidth: '140px' }}
                      >
                        <div className={styles.legendColor} style={{backgroundColor: '#FFB8B8'}}></div>
                        Bleed
                        {layerVisibility.fondPerdu && <Check size={14} style={{ marginLeft: 'auto' }} />}
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem 
                    onSelect={(e) => { e.preventDefault(); setShowGrid(g => !g) }}
                    style={{ opacity: showGrid ? 1 : 0.4, gap: '8px', minWidth: '140px' }}
                  >
                    <div className={styles.legendColor} style={{backgroundColor: '#AAAAAA'}}></div>
                    Grid
                    {showGrid && <Check size={14} style={{ marginLeft: 'auto' }} />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className={styles.layerToggle} onClick={handleApplyParams} title="Reset shape">
                <RotateCcw size={14} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={styles.layerToggle} title="Export Options">
                    <Download size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleExportSVG}>
                    <FileText size={14} style={{ marginRight: '8px' }} />
                    Export SVG Dieline
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText size={14} style={{ marginRight: '8px' }} />
                    Export PDF Dieline
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport}>
                    <Download size={14} style={{ marginRight: '8px' }} />
                    Export .fold format
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {cutToolActive && (
            <div className={styles.cutToolBanner} style={studioMode === 'origami' ? { backgroundColor: origamiFoldType === 'V' ? 'rgba(0, 170, 68, 0.08)' : 'rgba(0, 85, 255, 0.08)', color: origamiFoldType === 'V' ? '#00AA44' : '#0055FF', borderBottomColor: origamiFoldType === 'V' ? 'rgba(0, 170, 68, 0.2)' : 'rgba(0, 85, 255, 0.2)' } : undefined}>
              <FoldVertical size={14} />
              <span>Click two points to draw a fold line. Press Esc to cancel.</span>
            </div>
          )}
          <div className={styles.viewCanvasContainer}>
            <CreasePatternView 
              foldData={displayFoldData}
              bleedSize={params.bleedSize}
              materialThickness={params.materialThickness}  
              onToggleEdge={handleToggleEdge} 
              onDragVertices={handleDragVertices}
              onDragEnd={() => {}} 
              layerVisibility={layerVisibility}
              highlightedFaceIndex={activeFaceIndex}
              onHoverFace={setHoveredFaceIndex}
              onSelectFace={handleSelectFace}
              artworkLayers={artworkLayers.layers}
              selectedLayerId={artworkLayers.selectedLayerId}
              onSelectLayer={artworkLayers.setSelectedLayerId}
              onUpdateLayer={artworkLayers.updateLayer}
              validationResults={validationResult}
              showGrid={showGrid}
              isVerso={isVerso}
              vectorLocked={artworkLayers.vectorLocked}
              cutToolActive={cutToolActive}
              onApplyCutLine={handleApplyCutLine}
              onCancelCutTool={() => setCutToolActive(false)}
              groundFaceToolActive={groundFaceToolActive}
              onSelectGroundFace={(idx) => {
                setGroundFaceIndex(prev => prev === idx ? null : idx);
                setGroundFaceToolActive(false);
              }}
              groundFaceIndex={groundFaceIndex}
              selectedEdgeIndex={selectedEdgeIndex}
              onSelectEdge={handleSelectEdge}
              origamiFoldMode={studioMode === 'origami'}
              origamiFoldType={origamiFoldType}
            />
          </div>
            </>
          )}
        </ResizablePanel>

        <ResizableHandle withHandle={false} />

        {/* Right - 3D Three.js View */}
        <ResizablePanel 
          ref={panel3DRef}
          defaultSize={30} 
          minSize={15}
          collapsible={true}
          collapsedSize={2}
          onCollapse={() => setIs3DCollapsed(true)}
          onExpand={() => setIs3DCollapsed(false)}
          className={styles.viewPanel}
        >
          {is3DCollapsed ? (
            <div className={styles.collapsedBar} onClick={() => expandWithAnimation(panel3DRef)}>
              <span className={styles.collapsedLabel}>3D Folded Preview</span>
            </div>
          ) : (
            <>
              <div className={styles.viewHeader}>
                <span className={styles.viewLabel}>3D Folded Preview</span>
                <Studio3DToolbar controlsRef={cameraControlsRef} />
              </div>
          <div className={styles.viewCanvasContainer}>
            {studioMode === 'spirogami' ? (
              <StudioSpiroView
                params={spirogamiParams}
                progress={progress / 100}
                foldData={displayFoldData}
                exteriorColor={artworkLayers.exteriorColor}
                interiorColor={artworkLayers.interiorColor}
                controlsRef={cameraControlsRef}
                highlightedFaceIndex={activeFaceIndex}
                onHoverFace={setHoveredFaceIndex}
                onSelectFace={handleSelectFace}
                selectedEdgeIndex={selectedEdgeIndex}
              />
            ) : studioMode === 'popup' ? (
              <StudioPopupBookView
                popupDocument={popupDocument}
                bookAngleDeg={bookAngleDeg}
                selectedMechanismId={selectedMechanismId}
                onSelectMechanism={setSelectedMechanismId}
                showCollisions={showPopupCollisions}
                collidingFaces={popupCollidingFaces}
                exteriorColor={artworkLayers.exteriorColor}
                interiorColor={artworkLayers.interiorColor}
                controlsRef={cameraControlsRef}
                highlightedFaceIndex={activeFaceIndex}
                onHoverFace={setHoveredFaceIndex}
                onSelectFace={handleSelectFace}
                selectedEdgeIndex={selectedEdgeIndex}
              />
                        ) : (
              <>
                <Canvas gl={CANVAS_GL} camera={CANVAS_CAMERA}>
                  <SceneSetup />
                  <ambientLight intensity={1.5} />
                  <directionalLight position={[100, 100, 200]} intensity={1.5} />
                  <directionalLight position={[-100, -100, -200]} intensity={0.5} />
                  <gridHelper args={[1000, 20, '#E6E8EB', '#E6E8EB']} position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]} />
                  <FoldedGeometry foldData={displayFoldData} progress={progress / 100} sequential={sequential} highlightedFaceIndex={activeFaceIndex} onHoverFace={setHoveredFaceIndex} onSelectFace={handleSelectFace} selectedEdgeIndex={selectedEdgeIndex} artworkLayers={artworkLayers.layers} collidingFaces={collidingFaces} exteriorColor={artworkLayers.exteriorColor} interiorColor={artworkLayers.interiorColor} rootFaceIndex={groundFaceIndex} />
                  <CameraFixer />
                  <StudioTrackpadControls minDistance={50} maxDistance={5000} zoomSpeed={1.2} />
                  <CameraAutoCenter foldData={displayFoldData} shapeType={shapeType} />
                  <CanvasRefCapture canvasRef={canvasRef} />
                  <CameraBridge ref={cameraControlsRef} foldData={displayFoldData} />
                </Canvas>
              </>
            )}
          </div>
          
          {/* Bottom Bar Slider inside the 3D panel */}
          <div className={styles.progressContainer}>
            <span className={styles.progressLabel}>{studioMode === 'popup' ? 'Book Opening' : 'Fold Progress'}</span>
            <div className={styles.progressSlider}>
              <Slider 
                value={[progress]} 
                onValueChange={v => {
                  if (studioMode === 'popup') setPopupPlaying(false);
                  setProgress(v[0]);
                }} 
                max={100} 
                step={0.5} 
              />
            </div>
            <div className={styles.progressActions}>
              {studioMode === 'popup' && (
                <div className={styles.popupPlaybackControls}>
                  <button
                    type="button"
                    className={styles.progressIconButton}
                    onClick={() => {
                      setPopupPlaying(false);
                      popupPlaybackDirectionRef.current = 1;
                      setProgress(0);
                    }}
                    title="Close pop-up"
                    aria-label="Close pop-up"
                  >
                    <SkipBack size={14} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.progressIconButton} ${popupPlaying ? styles.progressIconButtonActive : ''}`}
                    onClick={() => setPopupPlaying((playing) => !playing)}
                    title={popupPlaying ? "Pause folding animation" : "Play folding and unfolding"}
                    aria-label={popupPlaying ? "Pause folding animation" : "Play folding and unfolding"}
                  >
                    {popupPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    type="button"
                    className={styles.progressIconButton}
                    onClick={() => {
                      setPopupPlaying(false);
                      popupPlaybackDirectionRef.current = -1;
                      setProgress(100);
                    }}
                    title="Open pop-up"
                    aria-label="Open pop-up"
                  >
                    <SkipForward size={14} />
                  </button>
                </div>
              )}
              {studioMode !== 'popup' && studioMode !== 'spirogami' && (
                <button 
                  className={`${styles.layerToggle} ${sequential ? styles.layerToggleActive : styles.layerToggleInactive}`}
                  onClick={() => setSequential(s => !s)}
                  title="Sequential animation"
                >
                  Sequential
                </button>
              )}
              <span className={styles.progressValue}>{progress.toFixed(0)}%</span>
            </div>
          </div>
            </>
          )}
        </ResizablePanel>


      </ResizablePanelGroup>

      <TemplateLibrary 
        open={showTemplateLibrary} 
        onClose={() => setShowTemplateLibrary(false)}
        onSelect={(type) => setShapeType(type)} 
        currentShape={shapeType}
      />
      <PopupTemplateLibrary
        open={showPopupTemplateLibrary}
        onClose={() => setShowPopupTemplateLibrary(false)}
        onSelect={handlePopupTemplateSelect}
      />
      <OrigamiTemplateLibrary
        open={showOrigamiTemplateLibrary}
        onClose={() => setShowOrigamiTemplateLibrary(false)}
        onSelect={handleOrigamiTemplateSelect}
      />
    </div>
  );
}