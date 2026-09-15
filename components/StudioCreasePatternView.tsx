import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { FoldData } from "../helpers/foldEngine";
import { FoldValidationResult } from "../helpers/foldValidation";
import { useCallbackRef } from "../helpers/useCallbackRef";
import { pointInPolygon } from "../helpers/foldGeometry";
import { Magnet } from "lucide-react";
import { StudioScaleBar } from "./StudioScaleBar";
import { useStudioCreasePatternCalculations } from "../helpers/useStudioCreasePatternCalculations";
import { useStudioCreasePatternGrid } from "../helpers/useStudioCreasePatternGrid";
import { StudioCreasePatternGroundFaceIndicator } from "./StudioCreasePatternGroundFaceIndicator";
import type { ArtworkLayer } from "../helpers/useArtworkLayers";
import styles from "./StudioCreasePatternView.module.css";

export function StudioCreasePatternView({ 
  foldData, 
  bleedSize = 0,
  materialThickness = 0,
  onToggleEdge,
  onDragVertices,
  onDragEnd,
  layerVisibility = { decoupe: true, pli: true, collage: true, fondPerdu: true },
  highlightedFaceIndex = null,
  onHoverFace,
  onSelectFace,
  artworkUrl,
  artworkLayers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  validationResults,
  showGrid = true,
  isVerso = false,
  artworkOffset,
  onArtworkOffsetChange,
  artworkScale,
  artworkRotation,
  vectorLocked = false,
  imageLocked = false,
  cutToolActive = false,
  onApplyCutLine,
  onCancelCutTool,
  groundFaceToolActive = false,
  onSelectGroundFace,
  groundFaceIndex = null,
  selectedEdgeIndex = null,
  onSelectEdge,
  origamiFoldMode = false,
  origamiFoldType = 'M',
}: { 
  foldData: FoldData;
  bleedSize?: number;
  materialThickness?: number;
  onToggleEdge?: (index: number) => void;
  onDragVertices?: (newVerticesCoords: [number, number, number?][]) => void;
  onDragEnd?: () => void;
  layerVisibility?: { decoupe: boolean; pli: boolean; collage: boolean; fondPerdu: boolean };
  highlightedFaceIndex?: number | null;
  onHoverFace?: (faceIndex: number | null) => void;
  onSelectFace?: (faceIndex: number | null) => void;
  artworkUrl?: string;
  artworkLayers?: ArtworkLayer[];
  selectedLayerId?: string | null;
  onSelectLayer?: (id: string | null) => void;
  onUpdateLayer?: (id: string, updates: Partial<ArtworkLayer>) => void;
  validationResults?: FoldValidationResult;
  showGrid?: boolean;
  isVerso?: boolean;
  artworkOffset?: { x: number; y: number };
  onArtworkOffsetChange?: (offset: { x: number; y: number }) => void;
  artworkScale?: number;
  artworkRotation?: number;
  vectorLocked?: boolean;
  imageLocked?: boolean;
  cutToolActive?: boolean;
  onApplyCutLine?: (points: [number, number][]) => void;
  onCancelCutTool?: () => void;
  groundFaceToolActive?: boolean;
  onSelectGroundFace?: (faceIndex: number) => void;
  groundFaceIndex?: number | null;
  selectedEdgeIndex?: number | null;
  onSelectEdge?: (index: number | null) => void;
  origamiFoldMode?: boolean;
  origamiFoldType?: 'M' | 'V';
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgPixelWidth, setSvgPixelWidth] = useState(0);
  const [snapEnabled, setSnapEnabled] = useState(true);
  
  const [dragState, setDragState] = useState<{
    edgeIndex: number;
    startSVGPoint: [number, number];
    originalVertices: [number, number, number?][];
    movingVertexIndices: Set<number>;
    perpendicular: [number, number] | null;
  } | null>(null);

  const [artworkDragState, setArtworkDragState] = useState<{
    startSVGPoint: [number, number];
    startOffset: { x: number; y: number };
  } | null>(null);

  const [layerDragState, setLayerDragState] = useState<{
    layerId: string;
    type: 'move' | 'resize';
    corner?: 'tl' | 'tr' | 'bl' | 'br';
    startSVGPoint: [number, number];
    startBounds: { x: number; y: number; width: number; height: number };
    aspectRatio: number;
  } | null>(null);

  // Zoom & Pan states
  const [cutPoints, setCutPoints] = useState<[number, number][]>([]);
  const [cutPreviewPoint, setCutPreviewPoint] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!cutToolActive) {
      setCutPoints([]);
      setCutPreviewPoint(null);
    }
  }, [cutToolActive]);

  useEffect(() => {
    if (!cutToolActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCutPoints(prev => {
          if (prev.length > 0) return prev.slice(0, -1);
          onCancelCutTool?.();
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cutToolActive, onCancelCutTool]);

  // Zoom & Pan states
  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const panState = useRef<{ startX: number; startY: number; startVB: { x: number; y: number; w: number; h: number } } | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setSvgPixelWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, []);

  const boundingBoxInfo = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    foldData.verticesCoords.forEach(v => {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    });
    const pad = 20 + bleedSize;
    return {
      tightMinX: minX,
      tightMinY: minY,
      tightWidth: maxX - minX,
      tightHeight: maxY - minY,
      minX: minX - pad,
      minY: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2
    };
  }, [foldData, bleedSize]);

  const centerX = boundingBoxInfo.tightMinX + boundingBoxInfo.tightWidth / 2;
  const versoTransform = isVerso ? `translate(${2 * centerX}, 0) scale(-1, 1)` : undefined;

    // Only auto-fit the view on initial mount (when viewBox is null).
  // Never reset zoom/pan when parameters change — the user's view must stay stable.
  useEffect(() => {
    if (!viewBox) {
      const cx = boundingBoxInfo.tightMinX + boundingBoxInfo.tightWidth / 2;
      const cy = boundingBoxInfo.tightMinY + boundingBoxInfo.tightHeight / 2;
      setViewBox({ x: cx - 210, y: cy - 148.5, w: 420, h: 297 });
    }
  }, [boundingBoxInfo]);

  const activeVB = viewBox || { x: boundingBoxInfo.minX, y: boundingBoxInfo.minY, w: boundingBoxInfo.width, h: boundingBoxInfo.height };
  const viewBoxStr = `${activeVB.x} ${activeVB.y} ${activeVB.w} ${activeVB.h}`;

  const imgCX = boundingBoxInfo.tightMinX + (artworkOffset?.x || 0) + boundingBoxInfo.tightWidth / 2;
  const imgCY = boundingBoxInfo.tightMinY + (artworkOffset?.y || 0) + boundingBoxInfo.tightHeight / 2;
  const scaleVal = artworkScale || 1;
  const rotVal = artworkRotation || 0;
  const imageTransform = `translate(${imgCX}, ${imgCY}) rotate(${rotVal}) scale(${scaleVal}) translate(${-imgCX}, ${-imgCY})`;

  const screenToSVG = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0] as [number, number];
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return [pt.x, pt.y] as [number, number];
    const res = pt.matrixTransform(ctm.inverse());
    return [res.x, res.y] as [number, number];
  }, []);

  const handleWheel = useCallbackRef((e: WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    let svgPt = [0, 0];
    if (ctm) {
      const res = pt.matrixTransform(ctm.inverse());
      svgPt = [res.x, res.y];
    }
    const zoom = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    setViewBox((prev) => {
      const curr = prev || { x: boundingBoxInfo.minX, y: boundingBoxInfo.minY, w: boundingBoxInfo.width, h: boundingBoxInfo.height };
      const newW = curr.w * zoom;
      const newH = curr.h * zoom;
      if (newW < 10 || newW > 5000) return curr;
      const newX = svgPt[0] - (svgPt[0] - curr.x) * zoom;
      const newY = svgPt[1] - (svgPt[1] - curr.y) * zoom;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const {
    facePolygons,
    glueTabs,
    highlightedFaces,
    channelFaces,
    exteriorFaceIndices,
    bleedPolygons
  } = useStudioCreasePatternCalculations(foldData, bleedSize, highlightedFaceIndex);

  const getSnappedPoint = (pt: [number, number]): [number, number] => {
    if (!snapEnabled) return pt;
    return [Math.round(pt[0]), Math.round(pt[1])];
  };

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (cutToolActive && e.button === 2) {
      e.preventDefault();
      setCutPoints(prev => {
        if (prev.length > 0) return prev.slice(0, -1);
        onCancelCutTool?.();
        return prev;
      });
      return;
    }

    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      panState.current = { startX: e.clientX, startY: e.clientY, startVB: activeVB };
    } else {
      const pt = screenToSVG(e.clientX, e.clientY);
      let testPt = pt;
      if (isVerso) {
        testPt = [2 * centerX - pt[0], pt[1]];
      }

      if (groundFaceToolActive) {
        let foundFace: number | null = null;
        for (let i = facePolygons.length - 1; i >= 0; i--) {
          if (pointInPolygon(testPt[0], testPt[1], facePolygons[i])) {
            foundFace = i;
            break;
          }
        }
        if (foundFace !== null) {
          onSelectGroundFace?.(foundFace);
        }
        return;
      }

      if (cutToolActive) {
        const snapped = getSnappedPoint(testPt);
        const newPoints: [number, number][] = [...cutPoints, snapped];
        if (newPoints.length >= 2) {
          onApplyCutLine?.(newPoints);
          setCutPoints([]);
          setCutPreviewPoint(null);
        } else {
          setCutPoints(newPoints);
        }
        return;
      }

      let foundFace: number | null = null;
      for (let i = facePolygons.length - 1; i >= 0; i--) {
        if (pointInPolygon(testPt[0], testPt[1], facePolygons[i])) {
          foundFace = i;
          break;
        }
      }
      onSelectFace?.(foundFace);
      onSelectEdge?.(null);
      onSelectLayer?.(null);
    }
  };

  const handleSvgDoubleClick = (e: React.MouseEvent) => {
    const cx = boundingBoxInfo.tightMinX + boundingBoxInfo.tightWidth / 2;
    const cy = boundingBoxInfo.tightMinY + boundingBoxInfo.tightHeight / 2;
    setViewBox({ x: cx - 210, y: cy - 148.5, w: 420, h: 297 });
  };

  const handleArtworkMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = screenToSVG(e.clientX, e.clientY);
    setArtworkDragState({
      startSVGPoint: pt,
      startOffset: artworkOffset || { x: 0, y: 0 }
    });
  };

  const handleLayerMouseDown = (e: React.MouseEvent, layer: ArtworkLayer) => {
    if (e.button === 1 || e.button === 2) return;
    if (layer.locked) return;
    e.stopPropagation();
    onSelectLayer?.(layer.id);
    const pt = screenToSVG(e.clientX, e.clientY);
    setLayerDragState({
      layerId: layer.id,
      type: 'move',
      startSVGPoint: pt,
      startBounds: { x: layer.x, y: layer.y, width: layer.width, height: layer.height },
      aspectRatio: layer.aspectRatio
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, layer: ArtworkLayer, corner: 'tl' | 'tr' | 'bl' | 'br') => {
    if (e.button === 1 || e.button === 2) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectLayer?.(layer.id);
    const pt = screenToSVG(e.clientX, e.clientY);
    setLayerDragState({
      layerId: layer.id,
      type: 'resize',
      corner,
      startSVGPoint: pt,
      startBounds: { x: layer.x, y: layer.y, width: layer.width, height: layer.height },
      aspectRatio: layer.aspectRatio
    });
  };

  const handleVertexMouseDown = (e: React.MouseEvent, vertexIndex: number) => {
    if (e.button === 1 || e.button === 2) return;
    e.stopPropagation();
    const pt = screenToSVG(e.clientX, e.clientY);
    setDragState({
      edgeIndex: -1,
      startSVGPoint: pt,
      originalVertices: foldData.verticesCoords.map(v => [...v] as [number, number, number?]),
      movingVertexIndices: new Set([vertexIndex]),
      perpendicular: null
    });
  };

  const handleMouseDown = (e: React.MouseEvent, edgeIndex: number) => {
    if (e.button === 1 || e.button === 2) return;
    e.stopPropagation();
    const pt = screenToSVG(e.clientX, e.clientY);
    const indices = foldData.edgesVertices[edgeIndex];
    const v0 = foldData.verticesCoords[indices[0]];
    const v1 = foldData.verticesCoords[indices[1]];

    const dx = v1[0] - v0[0];
    const dy = v1[1] - v0[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ndx = dx / len;
    const ndy = dy / len;
    const perp: [number, number] = [-ndy, ndx];

    const movingVertexIndices = new Set<number>();
    if (Math.abs(ndx) > Math.abs(ndy)) {
      foldData.verticesCoords.forEach((v, i) => {
        if (Math.abs(v[1] - v0[1]) < 0.01 || Math.abs(v[1] - v1[1]) < 0.01) movingVertexIndices.add(i);
      });
    } else if (Math.abs(ndy) >= Math.abs(ndx)) {
      foldData.verticesCoords.forEach((v, i) => {
        if (Math.abs(v[0] - v0[0]) < 0.01 || Math.abs(v[0] - v1[0]) < 0.01) movingVertexIndices.add(i);
      });
    } else {
      movingVertexIndices.add(indices[0]);
      movingVertexIndices.add(indices[1]);
    }

    setDragState({
      edgeIndex,
      startSVGPoint: pt,
      originalVertices: foldData.verticesCoords.map(v => [...v] as [number, number, number?]),
      movingVertexIndices,
      perpendicular: perp
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (panState.current) {
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      const currVB = panState.current.startVB;
      const scaleX = currVB.w / svgPixelWidth;
      setViewBox({ ...currVB, x: currVB.x - dx * scaleX, y: currVB.y - dy * scaleX });
      return;
    }

    const pt = screenToSVG(e.clientX, e.clientY);

    let testPt = pt;
    if (isVerso) {
      testPt = [2 * centerX - pt[0], pt[1]];
    }

    if (cutToolActive) {
      setCutPreviewPoint(getSnappedPoint(testPt));
    }

    if (cutToolActive) {
      // Still allow face hover detection, but disable dragging
      let foundFace: number | null = null;
      for (let i = facePolygons.length - 1; i >= 0; i--) {
        if (pointInPolygon(testPt[0], testPt[1], facePolygons[i])) {
          foundFace = i;
          break;
        }
      }
      onHoverFace?.(foundFace);
      return;
    }

    if (layerDragState) {
      const deltaX = pt[0] - layerDragState.startSVGPoint[0];
      const deltaY = pt[1] - layerDragState.startSVGPoint[1];
      const mappedDeltaX = isVerso ? -deltaX : deltaX;

      if (layerDragState.type === 'move') {
        onUpdateLayer?.(layerDragState.layerId, {
          x: layerDragState.startBounds.x + mappedDeltaX,
          y: layerDragState.startBounds.y + deltaY
        });
      } else if (layerDragState.type === 'resize' && layerDragState.corner) {
        const { x: startX, y: startY, width: startW, height: startH } = layerDragState.startBounds;
        let anchorX = 0, anchorY = 0;
        let startCornerX = 0, startCornerY = 0;

        if (layerDragState.corner === 'br') { anchorX = startX; anchorY = startY; startCornerX = startX + startW; startCornerY = startY + startH; }
        else if (layerDragState.corner === 'tl') { anchorX = startX + startW; anchorY = startY + startH; startCornerX = startX; startCornerY = startY; }
        else if (layerDragState.corner === 'tr') { anchorX = startX; anchorY = startY + startH; startCornerX = startX + startW; startCornerY = startY; }
        else if (layerDragState.corner === 'bl') { anchorX = startX + startW; anchorY = startY; startCornerX = startX; startCornerY = startY + startH; }

        const currentCornerX = startCornerX + mappedDeltaX;
        const currentCornerY = startCornerY + deltaY;

        const startDiagX = startCornerX - anchorX;
        const startDiagY = startCornerY - anchorY;
        const startDiagLen = Math.sqrt(startDiagX * startDiagX + startDiagY * startDiagY);

        const currentDiagX = currentCornerX - anchorX;
        const currentDiagY = currentCornerY - anchorY;
        
        const dot = (currentDiagX * startDiagX + currentDiagY * startDiagY) / startDiagLen;
        const scaleFactor = Math.max(0.05, dot / startDiagLen);

        const newW = startW * scaleFactor;
        const newH = startH * scaleFactor;

        let newX = startX;
        let newY = startY;
        if (layerDragState.corner === 'tl') { newX = anchorX - newW; newY = anchorY - newH; }
        else if (layerDragState.corner === 'tr') { newX = anchorX; newY = anchorY - newH; }
        else if (layerDragState.corner === 'bl') { newX = anchorX - newW; newY = anchorY; }
        else if (layerDragState.corner === 'br') { newX = anchorX; newY = anchorY; }

        onUpdateLayer?.(layerDragState.layerId, {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
      }
      return;
    }

    if (artworkDragState) {
      const deltaX = pt[0] - artworkDragState.startSVGPoint[0];
      const deltaY = pt[1] - artworkDragState.startSVGPoint[1];
      const finalDeltaX = isVerso ? -deltaX : deltaX;

      onArtworkOffsetChange?.({
        x: artworkDragState.startOffset.x + finalDeltaX,
        y: artworkDragState.startOffset.y + deltaY
      });
      return;
    }

    if (dragState) {
      const deltaX = pt[0] - dragState.startSVGPoint[0];
      const deltaY = pt[1] - dragState.startSVGPoint[1];
      const mappedDeltaX = isVerso ? -deltaX : deltaX;

      const newVertices = dragState.originalVertices.map((v, i) => {
        if (dragState.movingVertexIndices.has(i)) {
          if (dragState.perpendicular) {
            let projectedDist = mappedDeltaX * dragState.perpendicular[0] + deltaY * dragState.perpendicular[1];
            if (snapEnabled) projectedDist = Math.round(projectedDist);
            return [
              v[0] + projectedDist * dragState.perpendicular[0],
              v[1] + projectedDist * dragState.perpendicular[1],
              v[2]
            ] as [number, number, number?];
          } else {
            let newX = v[0] + mappedDeltaX;
            let newY = v[1] + deltaY;
            if (snapEnabled) {
              newX = Math.round(newX);
              newY = Math.round(newY);
            }
            return [newX, newY, v[2]] as [number, number, number?];
          }
        }
        return v;
      });

      onDragVertices?.(newVertices);
      return;
    }

        let foundFace: number | null = null;
    for (let i = facePolygons.length - 1; i >= 0; i--) {
      if (pointInPolygon(testPt[0], testPt[1], facePolygons[i])) {
        foundFace = i;
        break;
      }
    }
        onHoverFace?.(foundFace);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (panState.current) {
      panState.current = null;
      return;
    }
    if (layerDragState) {
      setLayerDragState(null);
      return;
    }
    if (artworkDragState) {
      setArtworkDragState(null);
      return;
    }
    if (!dragState) return;
    
    const pt = screenToSVG(e.clientX, e.clientY);
    const dx = pt[0] - dragState.startSVGPoint[0];
    const dy = pt[1] - dragState.startSVGPoint[1];
    const dist = Math.sqrt(dx * dx + dy * dy);

        if (dragState.edgeIndex !== -1 && dist < 3) {
      onToggleEdge?.(dragState.edgeIndex);
      onSelectEdge?.(dragState.edgeIndex);
    } else {
      onDragEnd?.();
    }
    setDragState(null);
  };

  const gridLines = useStudioCreasePatternGrid(activeVB);

  const scaleBarInfo = useMemo(() => {
    if (svgPixelWidth === 0 || activeVB.w === 0) return null;
    const mmPerPixel = activeVB.w / svgPixelWidth;
    const targetMm = 100 * mmPerPixel;
    const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    let niceMm = niceValues[0];
    let minDiff = Math.abs(targetMm - niceMm);
    for (let i = 1; i < niceValues.length; i++) {
      const diff = Math.abs(targetMm - niceValues[i]);
      if (diff < minDiff) {
        minDiff = diff;
        niceMm = niceValues[i];
      }
    }
    const label = niceMm >= 10 ? `${niceMm / 10} cm` : `${niceMm} mm`;
    return { length: niceMm, label };
  }, [svgPixelWidth, activeVB.w]);

  return (
    <div className={styles.wrapper}>
      <StudioScaleBar 
        scaleBarInfo={scaleBarInfo} 
        activeVB={activeVB} 
        svgPixelWidth={svgPixelWidth} 
      />
      <svg 
        ref={svgRef}
        viewBox={viewBoxStr} 
        className={`${styles.svgCanvas} ${dragState || artworkDragState ? styles.svgDragging : ""} ${cutToolActive || groundFaceToolActive ? styles.svgCrosshair : ""}`}
        onMouseDown={handleSvgMouseDown}
        onDoubleClick={handleSvgDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => {
          handleMouseUp(e);
          onHoverFace?.(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {showGrid && (
          <g style={{ pointerEvents: 'none' }}>
            {gridLines.mmLinesX.map(lx => (
              <line key={`mmx-${lx}`} x1={lx} y1={gridLines.ey} x2={lx} y2={gridLines.ey + gridLines.eh} stroke="var(--border)" strokeOpacity={0.07} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            ))}
            {gridLines.mmLinesY.map(ly => (
              <line key={`mmy-${ly}`} x1={gridLines.ex} y1={ly} x2={gridLines.ex + gridLines.ew} y2={ly} stroke="var(--border)" strokeOpacity={0.07} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            ))}
            {gridLines.cmLinesX.map(lx => (
              <line key={`cmx-${lx}`} x1={lx} y1={gridLines.ey} x2={lx} y2={gridLines.ey + gridLines.eh} stroke="var(--border)" strokeOpacity={0.12} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {gridLines.cmLinesY.map(ly => (
              <line key={`cmy-${ly}`} x1={gridLines.ex} y1={ly} x2={gridLines.ex + gridLines.ew} y2={ly} stroke="var(--border)" strokeOpacity={0.12} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}

        <g transform={versoTransform}>
          {/* Invisible face detection layer */}
          <g>
            {foldData.facesVertices.map((faceVertices, faceIdx) => {
              const pointsStr = faceVertices
                .map(v => `${foldData.verticesCoords[v][0]},${foldData.verticesCoords[v][1]}`)
                .join(" ");
              return (
                <polygon 
                  key={`detect-${faceIdx}`}
                  points={pointsStr} 
                  fill="transparent" 
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                />
              );
            })}
          </g>

          {/* Artwork Layers */}
          {artworkLayers && artworkLayers.length > 0 ? (
            artworkLayers.filter(l => l.visible).map(layer => {
              const cx = layer.x + layer.width / 2;
              const cy = layer.y + layer.height / 2;
              return (
                <image
                  key={layer.id}
                  href={layer.url}
                  x={layer.x}
                  y={layer.y}
                  width={layer.width}
                  height={layer.height}
                  preserveAspectRatio="none"
                  opacity={0.85}
                  transform={`translate(${cx}, ${cy}) rotate(${layer.rotation}) translate(${-cx}, ${-cy})`}
                  style={{ pointerEvents: layer.locked || cutToolActive ? 'none' : 'all', cursor: layer.locked ? 'default' : 'move' }}
                  onMouseDown={cutToolActive ? undefined : (e) => handleLayerMouseDown(e, layer)}
                />
              );
            })
          ) : artworkUrl ? (
            <image
              href={artworkUrl}
              x={boundingBoxInfo.tightMinX + (artworkOffset?.x || 0)}
              y={boundingBoxInfo.tightMinY + (artworkOffset?.y || 0)}
              width={boundingBoxInfo.tightWidth}
              height={boundingBoxInfo.tightHeight}
              preserveAspectRatio="none"
              opacity={0.85}
              style={{ pointerEvents: imageLocked || cutToolActive ? 'none' : 'all', cursor: imageLocked ? 'default' : 'move' }}
              transform={imageTransform}
              onMouseDown={imageLocked || cutToolActive ? undefined : handleArtworkMouseDown}
            />
          ) : null}

          {/* Face Highlight Layer */}
          {highlightedFaces.size > 0 && (
            <g style={{ pointerEvents: 'none' }}>
              {Array.from(highlightedFaces).map(faceIdx => foldData.facesVertices[faceIdx] && (
                <polygon 
                  key={`hi-${faceIdx}`}
                  points={foldData.facesVertices[faceIdx]
                    .map(v => `${foldData.verticesCoords[v][0]},${foldData.verticesCoords[v][1]}`)
                    .join(" ")}
                  fill="rgba(0, 140, 255, 0.35)"
                  stroke="rgba(0, 120, 255, 0.85)"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}

          {/* Bleed Layer (FOND_PERDU) */}
          {layerVisibility.fondPerdu && (
            <g style={{ pointerEvents: 'none' }}>
              {bleedPolygons.map(poly => (
                <React.Fragment key={`bleed-${poly.id}`}>
                  <polygon points={poly.points} fill="#FFB8B8" opacity="0.55" />
                  <circle cx={poly.c1.cx} cy={poly.c1.cy} r={poly.c1.r} fill="#FFB8B8" opacity="0.55" />
                  <circle cx={poly.c2.cx} cy={poly.c2.cy} r={poly.c2.r} fill="#FFB8B8" opacity="0.55" />
                </React.Fragment>
              ))}
            </g>
          )}

          {/* Glue Tabs Layer (COLLAGE) */}
          {layerVisibility.collage && Array.from(glueTabs).map(faceIdx => {
            const faceVertices = foldData.facesVertices[faceIdx];
            const pointsStr = faceVertices
              .map(v => `${foldData.verticesCoords[v][0]},${foldData.verticesCoords[v][1]}`)
              .join(" ");
            return (
              <g key={`glue-${faceIdx}`} style={{ pointerEvents: 'none' }}>
                <polygon points={pointsStr} fill="rgba(0,0,0,0.12)" />
              </g>
            );
          })}

          {/* Ground Face Indicator */}
          {groundFaceIndex != null && (
            <StudioCreasePatternGroundFaceIndicator foldData={foldData} groundFaceIndex={groundFaceIndex} />
          )}

          {/* Channel Faces Layer (PLI) */}
          {layerVisibility.pli && Array.from(channelFaces).map(faceIdx => {
            const faceVertices = foldData.facesVertices[faceIdx];
            const pointsStr = faceVertices
              .map(v => `${foldData.verticesCoords[v][0]},${foldData.verticesCoords[v][1]}`)
              .join(" ");
            return (
              <g key={`channel-${faceIdx}`} style={{ pointerEvents: 'none' }}>
                <polygon points={pointsStr} fill="rgba(0, 85, 255, 0.06)" />
              </g>
            );
          })}

          {foldData.edgesVertices.map((indices, i) => {
            const v0 = foldData.verticesCoords[indices[0]];
            const v1 = foldData.verticesCoords[indices[1]];
            const assign = foldData.edgesAssignment[i];
            
            if (assign === 'B' && !layerVisibility.decoupe) return null;
            if ((assign === 'M' || assign === 'V' || assign === 'F') && !layerVisibility.pli) return null;
            
            let strokeColor = "#FF00FF";
            let strokeDasharray = "none";
            let isClickable = true;
            
            if (assign === 'M') { strokeColor = "#0055FF"; strokeDasharray = "6 2"; isClickable = true; }
            else if (assign === 'V') { strokeColor = "#00AA44"; strokeDasharray = "3 2 1 2"; isClickable = true; }
            else if (assign === 'F') { strokeColor = "#999999"; strokeDasharray = "1 3"; }

            return (
              <React.Fragment key={`edge-${i}`}>
                {isClickable && (
                  <line
                    x1={v0[0]} y1={v0[1]}
                    x2={v1[0]} y2={v1[1]}
                    stroke="transparent"
                    strokeWidth={24}
                  vectorEffect="non-scaling-stroke"
                  className={styles.clickableEdge}
                  onMouseDown={vectorLocked || cutToolActive ? undefined : (e) => handleMouseDown(e, i)}
                  style={{ pointerEvents: vectorLocked || cutToolActive ? 'none' : 'all' }}
                />
                )}
                <line
                  x1={v0[0]} y1={v0[1]}
                  x2={v1[0]} y2={v1[1]}
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  strokeDasharray={strokeDasharray}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: 'none' }}
                />
                {dragState?.edgeIndex === i && (
                  <line
                    x1={v0[0]} y1={v0[1]}
                    x2={v1[0]} y2={v1[1]}
                    stroke="var(--primary)"
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    className={styles.dragHighlight}
                  />
                )}
                {selectedEdgeIndex === i && (
                  <line
                    x1={v0[0]} y1={v0[1]}
                    x2={v1[0]} y2={v1[1]}
                    stroke="#FF6600"
                    strokeWidth={4}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                    opacity={0.7}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Cut Line Tool Layer */}
          {cutToolActive && cutPoints.length > 0 && (
            <g style={{ pointerEvents: 'none' }}>
              {cutPoints.map((pt, i) => {
                if (i === 0) return null;
                const prev = cutPoints[i - 1];
                return (
                  <line
                    key={`cut-${i}`}
                    x1={prev[0]} y1={prev[1]}
                    x2={pt[0]} y2={pt[1]}
                    stroke={origamiFoldMode && origamiFoldType === 'V' ? '#00AA44' : '#0055FF'}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {cutPreviewPoint && (
                <line
                  x1={cutPoints[cutPoints.length - 1][0]} y1={cutPoints[cutPoints.length - 1][1]}
                  x2={cutPreviewPoint[0]} y2={cutPreviewPoint[1]}
                  stroke={origamiFoldMode && origamiFoldType === 'V' ? '#00AA44' : '#0055FF'}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.7}
                />
              )}
              {cutPoints.map((pt, i) => (
                <circle
                  key={`cut-pt-${i}`}
                  cx={pt[0]} cy={pt[1]}
                  r={2}
                  fill={origamiFoldMode && origamiFoldType === 'V' ? '#00AA44' : '#0055FF'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )}

          {foldData.verticesCoords.map((v, i) => (
            <React.Fragment key={`v-${i}`}>
              <circle
                cx={v[0]}
                cy={v[1]}
                r={8}
                fill="transparent"
                className={styles.clickableEdge}
                onMouseDown={vectorLocked || cutToolActive ? undefined : (e) => handleVertexMouseDown(e, i)}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: vectorLocked || cutToolActive ? 'none' : 'all' }}
              />
              <circle 
                cx={v[0]} 
                cy={v[1]} 
                r={0.5} 
                fill="var(--foreground)" 
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
              {dragState?.edgeIndex === -1 && dragState.movingVertexIndices.has(i) && (
                <circle
                  cx={v[0]}
                  cy={v[1]}
                  r={4}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                  className={styles.dragHighlight}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </React.Fragment>
          ))}

          {/* Validation Layer */}
          {validationResults && (
            <g style={{ pointerEvents: 'none' }}>
              {validationResults.vertices.map((v, i) => {
                if (!v.isInterior || (v.kawasakiValid && v.maekawValid)) return null;

                let color = "#EF4444";
                let strokeColor = "#B91C1C";
                let fillObj = "rgba(239, 68, 68, 0.3)";
                let opacity = 0.7;

                if (!v.kawasakiValid && v.maekawValid) {
                  color = "#F97316";
                  strokeColor = "#C2410C";
                  fillObj = "rgba(249, 115, 22, 0.3)";
                  opacity = 0.6;
                } else if (v.kawasakiValid && !v.maekawValid) {
                  color = "#EAB308";
                  strokeColor = "#A16207";
                  fillObj = "rgba(234, 179, 8, 0.3)";
                  opacity = 0.6;
                }

                return (
                  <React.Fragment key={`val-${v.vertexIndex}`}>
                    <circle
                      cx={v.position[0]}
                      cy={v.position[1]}
                      r={3}
                      fill={fillObj}
                      stroke={strokeColor}
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                      opacity={opacity}
                    />
                    <text
                      x={v.position[0] + 2}
                      y={v.position[1] + 1}
                      fontSize={2.5}
                      fill={strokeColor}
                      fontWeight="bold"
                    >
                      !
                    </text>
                  </React.Fragment>
                );
              })}
            </g>
          )}
          {/* Resize handles */}
          {artworkLayers && selectedLayerId && (() => {
            const layer = artworkLayers.find(l => l.id === selectedLayerId);
            if (!layer || !layer.visible || layer.locked) return null;
            const cx = layer.x + layer.width / 2;
            const cy = layer.y + layer.height / 2;
            return (
              <g transform={`translate(${cx}, ${cy}) rotate(${layer.rotation}) translate(${-cx}, ${-cy})`}>
                <rect 
                  x={layer.x} y={layer.y} width={layer.width} height={layer.height} 
                  fill="none" stroke="var(--primary)" strokeWidth={1} strokeDasharray="4 4" 
                  vectorEffect="non-scaling-stroke"
                />
                {[
                  { id: 'tl', cx: layer.x, cy: layer.y },
                  { id: 'tr', cx: layer.x + layer.width, cy: layer.y },
                  { id: 'bl', cx: layer.x, cy: layer.y + layer.height },
                  { id: 'br', cx: layer.x + layer.width, cy: layer.y + layer.height },
                ].map(corner => (
                  <circle 
                    key={corner.id} cx={corner.cx} cy={corner.cy} r={3} fill="var(--primary)"
                  style={{ cursor: `${corner.id}-resize`, pointerEvents: cutToolActive ? 'none' : 'all' }}
                  vectorEffect="non-scaling-stroke"
                  onMouseDown={cutToolActive ? undefined : (e) => handleResizeMouseDown(e, layer, corner.id as any)}
                  />
                ))}
              </g>
            );
          })()}
        </g>
      </svg>
      <button 
        type="button"
        className={`${styles.snapToggle} ${snapEnabled ? styles.snapToggleActive : ""}`}
        onClick={() => setSnapEnabled(!snapEnabled)}
        title="Toggle Snap to Grid (1mm)"
      >
        <Magnet size={16} />
        <span>1mm</span>
      </button>
    </div>
  );
}