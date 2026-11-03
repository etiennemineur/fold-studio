import { FoldData, BoxParams, buildFaceTree, FaceTreeNode } from "./foldEngine";
import { ArtworkLayer } from "./useArtworkLayers";
import { preparePdfArtwork } from './pdfArtwork';
import { loadPdfEngine } from './loadPdfEngine';

async function blobUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Artwork could not be loaded (${response.status}).`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Identifies which faces act as glue tabs.
 * A face is a glue tab if it's a leaf node in the topological tree and folds inwards (Valley).
 */
function identifyGlueTabFaces(foldData: FoldData): Set<number> {
  const tree = buildFaceTree(foldData);
  const glueTabs = new Set<number>();
  
  function traverse(node: FaceTreeNode, parentHingeType: 'M' | 'V' | 'B' | 'F' | 'P' | null) {
    if (node.children.length === 0 && node.hingeEdge) {
      const faceVertices = foldData.facesVertices[node.faceIndex];
      if (faceVertices.length === 4) {
        const h1 = node.hingeEdge[0];
        const h2 = node.hingeEdge[1];
        
        let hingeIdx = -1;
        for (let i = 0; i < 4; i++) {
          const v1 = faceVertices[i];
          const v2 = faceVertices[(i + 1) % 4];
          if ((v1 === h1 && v2 === h2) || (v1 === h2 && v2 === h1)) {
            hingeIdx = i;
            break;
          }
        }
        
        if (hingeIdx !== -1) {
          const opIdx = (hingeIdx + 2) % 4;
          const ov1 = faceVertices[opIdx];
          const ov2 = faceVertices[(opIdx + 1) % 4];
          
          const getLen = (a: number, b: number) => {
            const p1 = foldData.verticesCoords[a];
            const p2 = foldData.verticesCoords[b];
            const dx = p1[0] - p2[0];
            const dy = p1[1] - p2[1];
            return Math.sqrt(dx * dx + dy * dy);
          };
          
          const hingeLen = getLen(h1, h2);
          const oppLen = getLen(ov1, ov2);
          
          if (hingeLen > 0 && oppLen / hingeLen < 0.95) {
            glueTabs.add(node.faceIndex);
          }
        }
      }
    }
    
    for (const child of node.children) {
      let hingeType: 'M' | 'V' | 'B' | 'F' | 'P' = 'B';
      if (child.hingeEdge) {
         const [h1, h2] = child.hingeEdge;
         for (let i = 0; i < foldData.edgesVertices.length; i++) {
           const ev = foldData.edgesVertices[i];
           if ((ev[0] === h1 && ev[1] === h2) || (ev[0] === h2 && ev[1] === h1)) {
             hingeType = foldData.edgesAssignment[i];
             break;
           }
         }
      }
      traverse(child, hingeType);
    }
  }
  
  if (tree.length > 0) {
    traverse(tree[0], null);
  }
  
  return glueTabs;
}

function findFaceForBorderEdge(v1: number, v2: number, foldData: FoldData): number {
  for (let f = 0; f < foldData.facesVertices.length; f++) {
    const face = foldData.facesVertices[f];
    for (let i = 0; i < face.length; i++) {
      const fv1 = face[i];
      const fv2 = face[(i + 1) % face.length];
      if ((fv1 === v1 && fv2 === v2) || (fv1 === v2 && fv2 === v1)) {
        return f;
      }
    }
  }
  return -1;
}

function getFaceCentroid(faceIndex: number, foldData: FoldData): [number, number] {
  const face = foldData.facesVertices[faceIndex];
  let cx = 0;
  let cy = 0;
  for (const v of face) {
    cx += foldData.verticesCoords[v][0];
    cy += foldData.verticesCoords[v][1];
  }
  return [cx / face.length, cy / face.length];
}

function computeEdgeOutwardNormal(
  v1: [number, number],
  v2: [number, number],
  centroid: [number, number]
): [number, number] {
  const dx = v2[0] - v1[0];
  const dy = v2[1] - v1[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx1 = dy / len;
  const ny1 = -dx / len;
  
  const mx = (v1[0] + v2[0]) / 2;
  const my = (v1[1] + v2[1]) / 2;
  
  const vx = mx - centroid[0];
  const vy = my - centroid[1];
  
  const dot = nx1 * vx + ny1 * vy;
  return dot > 0 ? [nx1, ny1] : [-nx1, -ny1];
}

function buildBleedContour(foldData: FoldData, bleed: number): { outerPoints: [number, number][], innerPoints: [number, number][] } | null {
  if (bleed <= 0) return null;

  const adj = new Map<number, number[]>();
  for (let i = 0; i < foldData.edgesVertices.length; i++) {
    if (foldData.edgesAssignment[i] === 'B') {
      const v1 = foldData.edgesVertices[i][0];
      const v2 = foldData.edgesVertices[i][1];
      if (!adj.has(v1)) adj.set(v1, []);
      if (!adj.has(v2)) adj.set(v2, []);
      adj.get(v1)!.push(v2);
      adj.get(v2)!.push(v1);
    }
  }

  if (adj.size === 0) return null;

  const start = adj.keys().next().value as number;
  const loop: number[] = [];
  let curr = start;
  let prev = -1;

  do {
    loop.push(curr);
    const neighbors = adj.get(curr)!;
    let next = neighbors[0] === prev ? neighbors[1] : neighbors[0];
    if (next === undefined) break;
    prev = curr;
    curr = next;
  } while (curr !== start && loop.length < adj.size + 2);

  const innerPoints: [number, number][] = [];
  const outerPoints: [number, number][] = [];

  for (let i = 0; i < loop.length; i++) {
    const vCurrIdx = loop[i];
    const vPrevIdx = loop[(i - 1 + loop.length) % loop.length];
    const vNextIdx = loop[(i + 1) % loop.length];

    const vCurr = foldData.verticesCoords[vCurrIdx];
    const vPrev = foldData.verticesCoords[vPrevIdx];
    const vNext = foldData.verticesCoords[vNextIdx];

    innerPoints.push([vCurr[0], vCurr[1]]);

    const face1Idx = findFaceForBorderEdge(vPrevIdx, vCurrIdx, foldData);
    const face2Idx = findFaceForBorderEdge(vCurrIdx, vNextIdx, foldData);

    let n1 = [0, 0];
    let n2 = [0, 0];

    if (face1Idx !== -1) {
      const c1 = getFaceCentroid(face1Idx, foldData);
      n1 = computeEdgeOutwardNormal([vPrev[0], vPrev[1]], [vCurr[0], vCurr[1]], c1);
    }
    if (face2Idx !== -1) {
      const c2 = getFaceCentroid(face2Idx, foldData);
      n2 = computeEdgeOutwardNormal([vCurr[0], vCurr[1]], [vNext[0], vNext[1]], c2);
    }

    let bx = n1[0] + n2[0];
    let by = n1[1] + n2[1];
    let blen = Math.sqrt(bx * bx + by * by);

    if (blen < 1e-6) {
      bx = n1[0];
      by = n1[1];
      blen = Math.sqrt(bx * bx + by * by) || 1;
    }

    bx /= blen;
    by /= blen;

    const dot = n1[0] * bx + n1[1] * by;
    let miter = bleed;
    if (dot > 0.01) {
      miter = bleed / dot;
    }
    miter = Math.min(miter, bleed * 3);

    outerPoints.push([vCurr[0] + bx * miter, vCurr[1] + by * miter]);
  }

  return { outerPoints, innerPoints };
}

/**
 * Generates an SVG string representation of the dieline.
 */
async function exportDielineSVG(foldData: FoldData, params: BoxParams, projectName: string, artworkLayers?: ArtworkLayer[]): Promise<string> {
  const name = projectName || 'Untitled Project';
  const bleed = params.bleedSize || 0;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of foldData.verticesCoords) {
    minX = Math.min(minX, v[0]);
    minY = Math.min(minY, v[1]);
    maxX = Math.max(maxX, v[0]);
    maxY = Math.max(maxY, v[1]);
  }
  
  minX -= bleed;
  minY -= bleed;
  maxX += bleed;
  maxY += bleed;
  
  const width = maxX - minX;
  const height = maxY - minY;
  const glueTabs = identifyGlueTabFaces(foldData);

  const hasPerf = foldData.edgesAssignment.includes('P');

  const vMinX = minX - 25;
  const vMinY = minY - 25;
  const vWidth = width + 50;
  const vHeight = height + 50;

  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- 
Spot colors: CUT=#FF00FF (Magenta), MOUNTAIN_FOLD=#0055FF (Blue), VALLEY_FOLD=#00AA44 (Green), BLEED=#FFE0E0${hasPerf ? ', PERFORATION=#FF6600 (Orange)' : ''}
IMPORTANT: Set all CUT and FOLD strokes to Overprint in your print software
-->
<svg width="${vWidth}mm" height="${vHeight}mm" viewBox="${vMinX} ${vMinY} ${vWidth} ${vHeight}"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd">
  
  <title>${name.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!) } - Dieline</title>
`;

  // ARTWORK Layer
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="ARTWORK" id="layer_artwork" data-name="ARTWORK">\n`;
  if (artworkLayers) {
    for (const layer of artworkLayers) {
      if (!layer.visible) continue;
      const base64 = await blobUrlToBase64(layer.url);
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      if (layer.rotation !== 0) {
        svg += `    <g transform="rotate(${layer.rotation}, ${cx}, ${cy})">\n`;
        svg += `      <image x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" href="${base64}" preserveAspectRatio="none" />\n`;
        svg += `    </g>\n`;
      } else {
        svg += `    <image x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" href="${base64}" preserveAspectRatio="none" />\n`;
      }
    }
  }
  svg += `  </g>\n`;

  // FOND_PERDU Layer (Bleed)
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="BLEED" id="layer_bleed" data-name="BLEED">\n`;
  if (bleed > 0) {
    const contour = buildBleedContour(foldData, bleed);
    if (contour) {
      const { outerPoints, innerPoints } = contour;
      const outerStr = outerPoints.map(p => `${p[0]},${p[1]}`).join(" L ");
      const innerReversed = [...innerPoints].reverse();
      const innerStr = innerReversed.map(p => `${p[0]},${p[1]}`).join(" L ");
      svg += `    <path d="M ${outerStr} Z M ${innerStr} Z" fill="#FFE0E0" fill-rule="evenodd" />\n`;
    }
  }
  svg += `  </g>\n`;

  // COLLAGE Layer (Glue Zones)
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="GLUE" id="layer_glue" data-name="GLUE">\n`;
  glueTabs.forEach(faceIdx => {
    const faceVertices = foldData.facesVertices[faceIdx];
    const pointsStr = faceVertices
      .map(v => `${foldData.verticesCoords[v][0]},${foldData.verticesCoords[v][1]}`)
      .join(" ");
    
    svg += `    <polygon points="${pointsStr}" fill="#E0E0E0" stroke="#999" stroke-width="0.25" />\n`;
  });
  svg += `  </g>\n`;

  // PLI Layer (Folds)
  // MARKS Layer (Crop marks, Registration, Dimensions)
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="MARKS" id="layer_marks" data-name="MARKS">\n`;
  const d = 3; const l = 5;
  svg += `    <path d="M ${minX-d-l},${minY-d} L ${minX-d},${minY-d} L ${minX-d},${minY-d-l}" stroke="#000000" stroke-width="0.25" fill="none" />\n`;
  svg += `    <path d="M ${maxX+d+l},${minY-d} L ${maxX+d},${minY-d} L ${maxX+d},${minY-d-l}" stroke="#000000" stroke-width="0.25" fill="none" />\n`;
  svg += `    <path d="M ${minX-d-l},${maxY+d} L ${minX-d},${maxY+d} L ${minX-d},${maxY+d+l}" stroke="#000000" stroke-width="0.25" fill="none" />\n`;
  svg += `    <path d="M ${maxX+d+l},${maxY+d} L ${maxX+d},${maxY+d} L ${maxX+d},${maxY+d+l}" stroke="#000000" stroke-width="0.25" fill="none" />\n`;

  const drawReg = (cx: number, cy: number) => {
    svg += `    <circle cx="${cx}" cy="${cy}" r="3" stroke="#000000" stroke-width="0.25" fill="none" />\n`;
    svg += `    <line x1="${cx-3}" y1="${cy}" x2="${cx+3}" y2="${cy}" stroke="#000000" stroke-width="0.25" />\n`;
    svg += `    <line x1="${cx}" y1="${cy-3}" x2="${cx}" y2="${cy+3}" stroke="#000000" stroke-width="0.25" />\n`;
  };
  const midX = minX + width/2;
  const midY = minY + height/2;
  drawReg(midX, minY - 8);
  drawReg(midX, maxY + 8);
  drawReg(minX - 8, midY);
  drawReg(maxX + 8, midY);

  svg += `    <text x="${midX}" y="${minY - 15}" font-family="sans-serif" font-size="3" fill="#666666" text-anchor="middle">${width.toFixed(2)} mm</text>\n`;
  svg += `    <text x="${maxX + 15}" y="${midY}" font-family="sans-serif" font-size="3" fill="#666666" text-anchor="middle" transform="rotate(-90 ${maxX+15} ${midY})">${height.toFixed(2)} mm</text>\n`;
  svg += `  </g>\n`;

  // PLI Layer (Folds)
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="FOLD" id="layer_fold" data-name="FOLD">\n`;
  for (let i = 0; i < foldData.edgesVertices.length; i++) {
    const assign = foldData.edgesAssignment[i];
    if (assign === 'M' || assign === 'V' || assign === 'F' || assign === 'P') {
      const v1Idx = foldData.edgesVertices[i][0];
      const v2Idx = foldData.edgesVertices[i][1];
      const v1 = foldData.verticesCoords[v1Idx];
      const v2 = foldData.verticesCoords[v2Idx];
      
      let stroke = "#999999";
      let dasharray = "1 3";
      
      if (assign === 'M') {
        stroke = "#0055FF";
        dasharray = "6 2";
      } else if (assign === 'V') {
        stroke = "#00AA44";
        dasharray = "3 2 1 2";
      } else if (assign === 'P') {
        stroke = "#FF6600";
        dasharray = "2 1 0.5 1";
      }
      
      svg += `    <line x1="${v1[0]}" y1="${v1[1]}" x2="${v2[0]}" y2="${v2[1]}" stroke="${stroke}" stroke-width="0.5" stroke-dasharray="${dasharray}" fill="none" />\n`;
    }
  }
  svg += `  </g>\n`;

  // DECOUPE Layer (Cut/Border)
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="CUT" id="layer_cut" data-name="CUT">\n`;
  for (let i = 0; i < foldData.edgesVertices.length; i++) {
    if (foldData.edgesAssignment[i] === 'B') {
      const v1Idx = foldData.edgesVertices[i][0];
      const v2Idx = foldData.edgesVertices[i][1];
      const v1 = foldData.verticesCoords[v1Idx];
      const v2 = foldData.verticesCoords[v2Idx];
      svg += `    <line x1="${v1[0]}" y1="${v1[1]}" x2="${v2[0]}" y2="${v2[1]}" stroke="#FF00FF" stroke-width="0.5" fill="none" />\n`;
    }
  }
  svg += `  </g>\n`;

  svg += `</svg>`;
  return svg;
}

/**
 * Generates a PDF blob representing the dieline utilizing pdfmake canvas functions.
 */
async function exportDielinePDF(foldData: FoldData, params: BoxParams, projectName: string, artworkLayers?: ArtworkLayer[]): Promise<Blob> {
    const name = projectName || 'Untitled Project';
    const bleed = params.bleedSize || 0;
    const thickness = params.materialThickness || 0.5;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of foldData.verticesCoords) {
      minX = Math.min(minX, v[0]);
      minY = Math.min(minY, v[1]);
      maxX = Math.max(maxX, v[0]);
      maxY = Math.max(maxY, v[1]);
    }
    
    minX -= bleed;
    minY -= bleed;
    maxX += bleed;
    maxY += bleed;
    
    const width = maxX - minX;
    const height = maxY - minY;

    const MM_TO_PT = 2.83465;
    const margin = 30; // increased margin for marks
    const ptWidth = (width + margin * 2) * MM_TO_PT;
    // Add an extra 80pt at the bottom for the legend without risking overlapping drawing bounds
    const ptHeight = (height + margin * 2) * MM_TO_PT + 80;

    const mapX = (x: number) => (x - minX + margin) * MM_TO_PT;
    const mapY = (y: number) => (y - minY + margin) * MM_TO_PT;
    const hasPerf = foldData.edgesAssignment.includes('P');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasLines: any[] = [];
    
    // 1. Bleed
    if (bleed > 0) {
      const contour = buildBleedContour(foldData, bleed);
      if (contour) {
        const { outerPoints, innerPoints } = contour;
        const pts: { x: number, y: number }[] = [];
        
        for (const p of outerPoints) {
          pts.push({ x: mapX(p[0]), y: mapY(p[1]) });
        }
        
        for (let i = innerPoints.length - 1; i >= 0; i--) {
          pts.push({ x: mapX(innerPoints[i][0]), y: mapY(innerPoints[i][1]) });
        }
        
        canvasLines.push({
          type: 'polyline',
          lineWidth: 0,
          color: '#FFE0E0',
          closePath: true,
          points: pts
        });
      }
    }

    // 2. Glue Tabs
    const glueTabs = identifyGlueTabFaces(foldData);
    glueTabs.forEach(faceIdx => {
      const faceVertices = foldData.facesVertices[faceIdx];
      const points = faceVertices.map(v => ({ x: mapX(foldData.verticesCoords[v][0]), y: mapY(foldData.verticesCoords[v][1]) }));
      canvasLines.push({
        type: 'polyline',
        lineWidth: 0.5,
        color: '#E0E0E0', // solid gray equivalent for PDF
        lineColor: '#999999',
        closePath: true,
        points: points
      });
    });

    // 2.5. Marks Layer (Crop Marks & Reg Marks)
    const strokeW = 0.25 * MM_TO_PT;
    const d_mm = 3; const l_mm = 5;
    // Crop marks
    canvasLines.push({ type: 'polyline', points: [{x: mapX(minX - d_mm - l_mm), y: mapY(minY - d_mm)}, {x: mapX(minX - d_mm), y: mapY(minY - d_mm)}, {x: mapX(minX - d_mm), y: mapY(minY - d_mm - l_mm)}], lineWidth: strokeW, lineColor: '#000000' });
    canvasLines.push({ type: 'polyline', points: [{x: mapX(maxX + d_mm + l_mm), y: mapY(minY - d_mm)}, {x: mapX(maxX + d_mm), y: mapY(minY - d_mm)}, {x: mapX(maxX + d_mm), y: mapY(minY - d_mm - l_mm)}], lineWidth: strokeW, lineColor: '#000000' });
    canvasLines.push({ type: 'polyline', points: [{x: mapX(minX - d_mm - l_mm), y: mapY(maxY + d_mm)}, {x: mapX(minX - d_mm), y: mapY(maxY + d_mm)}, {x: mapX(minX - d_mm), y: mapY(maxY + d_mm + l_mm)}], lineWidth: strokeW, lineColor: '#000000' });
    canvasLines.push({ type: 'polyline', points: [{x: mapX(maxX + d_mm + l_mm), y: mapY(maxY + d_mm)}, {x: mapX(maxX + d_mm), y: mapY(maxY + d_mm)}, {x: mapX(maxX + d_mm), y: mapY(maxY + d_mm + l_mm)}], lineWidth: strokeW, lineColor: '#000000' });

    // Registration Marks
    const r_mm = 3;
    const drawPdfReg = (cx: number, cy: number) => {
      canvasLines.push({ type: 'ellipse', x: mapX(cx), y: mapY(cy), r1: r_mm * MM_TO_PT, r2: r_mm * MM_TO_PT, lineWidth: strokeW, lineColor: '#000000' });
      canvasLines.push({ type: 'line', x1: mapX(cx - r_mm), y1: mapY(cy), x2: mapX(cx + r_mm), y2: mapY(cy), lineWidth: strokeW, lineColor: '#000000' });
      canvasLines.push({ type: 'line', x1: mapX(cx), y1: mapY(cy - r_mm), x2: mapX(cx), y2: mapY(cy + r_mm), lineWidth: strokeW, lineColor: '#000000' });
    };
    const midX = minX + width/2;
    const midY = minY + height/2;
    drawPdfReg(midX, minY - 8);
    drawPdfReg(midX, maxY + 8);
    drawPdfReg(minX - 8, midY);
    drawPdfReg(maxX + 8, midY);

    // 3. Folds
    for (let i = 0; i < foldData.edgesVertices.length; i++) {
      const assign = foldData.edgesAssignment[i];
      if (assign === 'M' || assign === 'V' || assign === 'F' || assign === 'P') {
        const v1Idx = foldData.edgesVertices[i][0];
        const v2Idx = foldData.edgesVertices[i][1];
        const v1 = foldData.verticesCoords[v1Idx];
        const v2 = foldData.verticesCoords[v2Idx];
        
        let lineColor = '#999999';
        let dash = { length: 3, space: 3 };
        
        if (assign === 'M') {
          lineColor = '#0055FF';
          dash = { length: 6, space: 2 };
        } else if (assign === 'V') {
          lineColor = '#00AA44';
          dash = { length: 3, space: 2 }; 
        } else if (assign === 'P') {
          lineColor = '#FF6600';
          dash = { length: 2, space: 1 };
        }
        
        canvasLines.push({
          type: 'line',
          x1: mapX(v1[0]), y1: mapY(v1[1]),
          x2: mapX(v2[0]), y2: mapY(v2[1]),
          lineWidth: 1,
          lineColor: lineColor,
          dash: dash
        });
      }
    }

    // 4. Cut Lines
    for (let i = 0; i < foldData.edgesVertices.length; i++) {
      if (foldData.edgesAssignment[i] === 'B') {
        const v1Idx = foldData.edgesVertices[i][0];
        const v2Idx = foldData.edgesVertices[i][1];
        const v1 = foldData.verticesCoords[v1Idx];
        const v2 = foldData.verticesCoords[v2Idx];
        
        canvasLines.push({
          type: 'line',
          x1: mapX(v1[0]), y1: mapY(v1[1]),
          x2: mapX(v2[0]), y2: mapY(v2[1]),
          lineWidth: 1.5,
          lineColor: '#FF00FF'
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docDefinition: any = {
      pageSize: { width: ptWidth, height: ptHeight },
      pageMargins: [0, 0, 0, 0],
      content: [
        {
          text: `${name} - Dieline`,
          absolutePosition: { x: margin * MM_TO_PT, y: margin * MM_TO_PT / 2 },
          fontSize: 14,
          bold: true,
          color: '#333333'
        },
        {
          text: `Dimensions: ${params.width}x${params.depth}x${params.height}mm | Material: ${thickness}mm | Bleed: ${bleed}mm | Date: ${new Intl.DateTimeFormat('en-US').format(new Date())}`,
          absolutePosition: { x: margin * MM_TO_PT, y: margin * MM_TO_PT / 2 + 18 },
          fontSize: 10,
          color: '#666666'
        },
        {
          text: `${width.toFixed(2)} mm`,
          absolutePosition: { x: mapX(midX) - 30, y: mapY(minY - 15) },
          fontSize: 8,
          color: '#666666',
          alignment: 'center',
          width: 60
        },
        {
          text: `${height.toFixed(2)} mm`,
          absolutePosition: { x: mapX(maxX + 15), y: mapY(midY) - 5 },
          fontSize: 8,
          color: '#666666'
        }
      ]
    };

    if (artworkLayers) {
      for (const layer of artworkLayers) {
        if (!layer.visible) continue;
        const base64 = await blobUrlToBase64(layer.url);
        const rendered = await preparePdfArtwork(layer, base64);
        docDefinition.content.push({
          image: rendered.source,
          width: rendered.width * MM_TO_PT,
          height: rendered.height * MM_TO_PT,
          absolutePosition: { x: mapX(rendered.x), y: mapY(rendered.y) }
        });
      }
    }

    docDefinition.content.push({
      canvas: canvasLines,
      absolutePosition: { x: 0, y: 0 }
    });

    // Construct dynamic legend body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legendBody: any[] = [
      [
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 20, y2: 5, lineWidth: 1.5, lineColor: '#FF00FF' }] },
        { text: 'Cut', fontSize: 9, margin: [0, 0, 0, 0] }
      ],
      [
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 20, y2: 5, lineWidth: 1, lineColor: '#0055FF', dash: { length: 6, space: 2 } }] },
        { text: 'Mountain Fold', fontSize: 9, margin: [0, 0, 0, 0] }
      ],
      [
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 20, y2: 5, lineWidth: 1, lineColor: '#00AA44', dash: { length: 3, space: 2 } }] },
        { text: 'Valley Fold', fontSize: 9, margin: [0, 0, 0, 0] }
      ]
    ];

    if (hasPerf) {
      legendBody.push([
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 20, y2: 5, lineWidth: 1, lineColor: '#FF6600', dash: { length: 2, space: 1 } }] },
        { text: 'Perforation', fontSize: 9, margin: [0, 0, 0, 0] }
      ]);
    }

    legendBody.push([
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 20, h: 10, color: '#E0E0E0', lineColor: '#999999' }] },
      { text: 'Glue Zone', fontSize: 9, margin: [0, 0, 0, 0] }
    ]);
    legendBody.push([
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 20, h: 10, color: '#FFE0E0' }] },
      { text: 'Bleed', fontSize: 9, margin: [0, 0, 0, 0] }
    ]);

    // Legend placed safely below the bounding box drawing block
    docDefinition.content.push({
      absolutePosition: { x: margin * MM_TO_PT, y: (height + margin * 2) * MM_TO_PT },
      table: {
        widths: [ 30, 'auto' ],
        body: legendBody
      },
      layout: 'noBorders'
    });

    const pdfMake = await loadPdfEngine();
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    return new Promise<Blob>(resolve => pdfDocGenerator.getBlob(resolve));
}

export const dielineExporter = {
  identifyGlueTabFaces,
  exportDielineSVG,
  exportDielinePDF
};