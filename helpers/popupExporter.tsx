import { PopupDocument, getPopupPatternFoldData } from "./popupDocument";
// @ts-ignore
import * as pdfMake from "pdfmake/build/pdfmake";
// @ts-ignore
import * as pdfFonts from "pdfmake/build/vfs_fonts";

(pdfMake as any).addVirtualFileSystem(pdfFonts);

export function exportPopupJSON(doc: PopupDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function exportPopupSVG(doc: PopupDocument, projectName: string): string {
  const foldData = getPopupPatternFoldData(doc);
  const name = projectName || 'Untitled Pop-up';
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  foldData.verticesCoords.forEach(v => {
    minX = Math.min(minX, v[0]);
    minY = Math.min(minY, v[1]);
    maxX = Math.max(maxX, v[0]);
    maxY = Math.max(maxY, v[1]);
  });
  
  const pad = 20;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  
  const width = maxX - minX;
  const height = maxY - minY;

  let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- 
Spot colors: CUT=#FF00FF (Magenta), MOUNTAIN_FOLD=#0055FF (Blue), VALLEY_FOLD=#00AA44 (Green), GLUE=#E0E0E0
-->
<svg width="${width}mm" height="${height}mm" viewBox="${minX} ${minY} ${width} ${height}"
  xmlns="http://www.w3.org/2000/svg"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#000" />
    </marker>
  </defs>
  <title>${name} - Pop-up Pattern</title>
`;

  // GLUE ZONES Layer
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="GLUE ZONES" id="layer_glue">\n`;
  doc.gluePoints.forEach((gp, i) => {
    const x = gp.position[0] - 5;
    const y = gp.position[1] - 5;
    svg += `    <rect x="${x}" y="${y}" width="10" height="10" fill="#E0E0E0" stroke="#999" stroke-width="0.25" />\n`;
    svg += `    <text x="${x+5}" y="${y+5}" font-family="sans-serif" font-size="3" text-anchor="middle" dominant-baseline="middle" fill="#333">G${i+1}</text>\n`;
  });
  svg += `  </g>\n`;

  // FOLD Layers
  let mountainFolds = '';
  let valleyFolds = '';
  let cutLines = '';
  
  foldData.edgesVertices.forEach((ev, i) => {
    const assign = foldData.edgesAssignment[i];
    const v1 = foldData.verticesCoords[ev[0]];
    const v2 = foldData.verticesCoords[ev[1]];
    
    if (assign === 'M') {
      mountainFolds += `    <line x1="${v1[0]}" y1="${v1[1]}" x2="${v2[0]}" y2="${v2[1]}" stroke="#0055FF" stroke-width="0.5" stroke-dasharray="6 2" fill="none" />\n`;
    } else if (assign === 'V') {
      valleyFolds += `    <line x1="${v1[0]}" y1="${v1[1]}" x2="${v2[0]}" y2="${v2[1]}" stroke="#00AA44" stroke-width="0.5" stroke-dasharray="3 2 1 2" fill="none" />\n`;
    } else if (assign === 'B') {
      cutLines += `    <line x1="${v1[0]}" y1="${v1[1]}" x2="${v2[0]}" y2="${v2[1]}" stroke="#FF00FF" stroke-width="0.5" fill="none" />\n`;
    }
  });

  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="MOUNTAIN FOLD" id="layer_mountain">\n${mountainFolds}  </g>\n`;
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="VALLEY FOLD" id="layer_valley">\n${valleyFolds}  </g>\n`;
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="CUT" id="layer_cut">\n${cutLines}  </g>\n`;

  // PIECE NUMBERS
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="PIECE NUMBERS" id="layer_pieces">\n`;
  doc.mechanisms.forEach((m, i) => {
    const x = 0; 
    const y = m.params.positionY + 15; 
    svg += `    <text x="${x}" y="${y}" font-family="sans-serif" font-size="4" text-anchor="middle" fill="#666">P${i+1}: ${m.type}</text>\n`;
  });
  svg += `  </g>\n`;

  // DIMENSIONS
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="DIMENSIONS" id="layer_dims">\n`;
  svg += `    <line x1="${-doc.bookWidth}" y1="${-10}" x2="${doc.bookWidth}" y2="${-10}" stroke="#000" stroke-width="0.2" marker-start="url(#arrow)" marker-end="url(#arrow)" />\n`;
  svg += `    <text x="0" y="${-12}" font-family="sans-serif" font-size="3" text-anchor="middle">${doc.bookWidth * 2}mm (Full Width)</text>\n`;
  svg += `    <line x1="${doc.bookWidth + 10}" y1="0" x2="${doc.bookWidth + 10}" y2="${doc.bookHeight}" stroke="#000" stroke-width="0.2" marker-start="url(#arrow)" marker-end="url(#arrow)" />\n`;
  svg += `    <text x="${doc.bookWidth + 12}" y="${doc.bookHeight / 2}" font-family="sans-serif" font-size="3" transform="rotate(90, ${doc.bookWidth + 12}, ${doc.bookHeight / 2})" text-anchor="middle">${doc.bookHeight}mm</text>\n`;
  svg += `  </g>\n`;

  // ASSEMBLY MARKS
  svg += `\n  <g inkscape:groupmode="layer" inkscape:label="ASSEMBLY MARKS" id="layer_assembly">\n`;
  doc.gluePoints.forEach(gp => {
    const x = gp.position[0];
    const y = gp.position[1];
    svg += `    <path d="M ${x-2} ${y} L ${x+2} ${y} M ${x} ${y-2} L ${x} ${y+2}" stroke="#000" stroke-width="0.2" fill="none" />\n`;
  });
  svg += `  </g>\n`;

  svg += `</svg>`;
  return svg;
}

export function exportPopupPDF(doc: PopupDocument, projectName: string): Promise<Blob> {
  return new Promise((resolve) => {
    const foldData = getPopupPatternFoldData(doc);
    const name = projectName || 'Untitled Pop-up';
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    foldData.verticesCoords.forEach(v => {
      minX = Math.min(minX, v[0]);
      minY = Math.min(minY, v[1]);
      maxX = Math.max(maxX, v[0]);
      maxY = Math.max(maxY, v[1]);
    });
    
    const pad = 20;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    
    const width = maxX - minX;
    const height = maxY - minY;

    const MM_TO_PT = 2.83465;
    const ptWidth = width * MM_TO_PT;
    const ptHeight = height * MM_TO_PT + 120; // Extra room reserved for document layout boundaries and legend

    const mapX = (x: number) => (x - minX) * MM_TO_PT;
    const mapY = (y: number) => (y - minY) * MM_TO_PT;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvasLines: any[] = [];
    
    // GLUE ZONES
    doc.gluePoints.forEach(gp => {
      canvasLines.push({
        type: 'rect',
        x: mapX(gp.position[0] - 5),
        y: mapY(gp.position[1] - 5),
        w: 10 * MM_TO_PT,
        h: 10 * MM_TO_PT,
        color: '#E0E0E0',
        lineColor: '#999999',
        lineWidth: 0.5
      });
    });

    // EDGES
    foldData.edgesVertices.forEach((ev, i) => {
      const assign = foldData.edgesAssignment[i];
      const v1 = foldData.verticesCoords[ev[0]];
      const v2 = foldData.verticesCoords[ev[1]];
      
      let lineColor = '#FF00FF';
      let dash = undefined;
      let lineWidth = 1;
      
      if (assign === 'M') {
        lineColor = '#0055FF';
        dash = { length: 6, space: 2 };
      } else if (assign === 'V') {
        lineColor = '#00AA44';
        dash = { length: 3, space: 2 };
      } else if (assign === 'B') {
        lineColor = '#FF00FF';
        lineWidth = 1.5;
      }
      
      if (assign === 'M' || assign === 'V' || assign === 'B') {
        canvasLines.push({
          type: 'line',
          x1: mapX(v1[0]), y1: mapY(v1[1]),
          x2: mapX(v2[0]), y2: mapY(v2[1]),
          lineWidth,
          lineColor,
          dash
        });
      }
    });

    // ASSEMBLY MARKS
    doc.gluePoints.forEach(gp => {
      const cx = mapX(gp.position[0]);
      const cy = mapY(gp.position[1]);
      const r = 2 * MM_TO_PT;
      canvasLines.push({ type: 'line', x1: cx - r, y1: cy, x2: cx + r, y2: cy, lineWidth: 0.5, lineColor: '#000000' });
      canvasLines.push({ type: 'line', x1: cx, y1: cy - r, x2: cx, y2: cy + r, lineWidth: 0.5, lineColor: '#000000' });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docDefinition: any = {
      pageSize: { width: ptWidth, height: ptHeight },
      pageMargins: [0, 0, 0, 0],
      content: [
        {
          text: `${name} - Pop-up Pattern`,
          absolutePosition: { x: 20, y: 20 },
          fontSize: 14,
          bold: true
        },
        {
          text: `Book: ${doc.bookWidth}x${doc.bookHeight}mm | Thickness: ${doc.paperThickness}mm | Mechanisms: ${doc.mechanisms.length}`,
          absolutePosition: { x: 20, y: 40 },
          fontSize: 10,
          color: '#666666'
        },
        {
          canvas: canvasLines,
          absolutePosition: { x: 0, y: 0 }
        },
        // LEGEND
        {
          absolutePosition: { x: 20, y: ptHeight - 100 },
          table: {
            widths: [30, 'auto'],
            body: [
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
              ],
              [
                { canvas: [{ type: 'rect', x: 0, y: 0, w: 20, h: 10, color: '#E0E0E0', lineColor: '#999999' }] },
                { text: 'Glue Zone', fontSize: 9, margin: [0, 0, 0, 0] }
              ]
            ]
          },
          layout: 'noBorders'
        }
      ]
    };
    
    // PIECE NUMBERS
    doc.mechanisms.forEach((m, i) => {
      const cx = mapX(0); 
      const cy = mapY(m.params.positionY + 15);
      docDefinition.content.push({
        text: `P${i+1}: ${m.type}`,
        absolutePosition: { x: cx - 20, y: cy - 5 },
        fontSize: 8,
        color: '#666666',
        alignment: 'center',
        width: 40
      });
    });

    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.getBlob((blob: Blob) => {
      resolve(blob);
    });
  });
}