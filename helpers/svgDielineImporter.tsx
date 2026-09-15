import { FoldData } from "./foldEngine";

const CURVE_SEGMENTS = 8;
const ARC_SEGMENTS = 12;

function tessellateCubic(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, addSeg: (x1: number, y1: number, x2: number, y2: number) => void) {
  let prevX = x0, prevY = y0;
  for (let i = 1; i <= CURVE_SEGMENTS; i++) {
    const t = i / CURVE_SEGMENTS;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;
    const px = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
    const py = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
    addSeg(prevX, prevY, px, py);
    prevX = px;
    prevY = py;
  }
}

function tessellateQuadratic(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, addSeg: (x1: number, y1: number, x2: number, y2: number) => void) {
  const QUAD_SEGMENTS = 6;
  let prevX = x0, prevY = y0;
  for (let i = 1; i <= QUAD_SEGMENTS; i++) {
    const t = i / QUAD_SEGMENTS;
    const mt = 1 - t;
    const px = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const py = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
    addSeg(prevX, prevY, px, py);
    prevX = px;
    prevY = py;
  }
}

function tessellateArc(x1: number, y1: number, rx: number, ry: number, xAxisRotation: number, largeArcFlag: number, sweepFlag: number, x2: number, y2: number, addSeg: (x1: number, y1: number, x2: number, y2: number) => void) {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  
  if (rx === 0 || ry === 0) {
    addSeg(x1, y1, x2, y2);
    return;
  }
  
  const phi = (xAxisRotation * Math.PI) / 180.0;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  
  const dx2 = (x1 - x2) / 2.0;
  const dy2 = (y1 - y2) / 2.0;
  
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;
  
  let rx_sq = rx * rx;
  let ry_sq = ry * ry;
  const x1p_sq = x1p * x1p;
  const y1p_sq = y1p * y1p;
  
  let radiiCheck = x1p_sq / rx_sq + y1p_sq / ry_sq;
  if (radiiCheck > 1) {
    rx = Math.sqrt(radiiCheck) * rx;
    ry = Math.sqrt(radiiCheck) * ry;
    rx_sq = rx * rx;
    ry_sq = ry * ry;
  }
  
  const sign = (largeArcFlag === sweepFlag) ? -1 : 1;
  let sq = ((rx_sq * ry_sq) - (rx_sq * y1p_sq) - (ry_sq * x1p_sq)) / ((rx_sq * y1p_sq) + (ry_sq * x1p_sq));
  sq = (sq < 0) ? 0 : sq;
  const coef = sign * Math.sqrt(sq);
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);
  
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2.0;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2.0;
  
  const angle = (u: number[], v: number[]) => {
    const dot = u[0]*v[0] + u[1]*v[1];
    const len = Math.sqrt(u[0]*u[0] + u[1]*u[1]) * Math.sqrt(v[0]*v[0] + v[1]*v[1]);
    let ang = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (u[0]*v[1] - u[1]*v[0] < 0) ang = -ang;
    return ang;
  };
  
  const startVector = [(x1p - cxp) / rx, (y1p - cyp) / ry];
  const startAngle = angle([1, 0], startVector);
  
  const endVector = [(-x1p - cxp) / rx, (-y1p - cyp) / ry];
  let deltaAngle = angle(startVector, endVector);
  
  if (sweepFlag === 0 && deltaAngle > 0) {
    deltaAngle -= 2 * Math.PI;
  } else if (sweepFlag === 1 && deltaAngle < 0) {
    deltaAngle += 2 * Math.PI;
  }
  
  const segmentsCount = Math.max(1, Math.ceil(ARC_SEGMENTS * Math.abs(deltaAngle) / (2 * Math.PI)));
  
  let prevX = x1;
  let prevY = y1;
  
  for (let i = 1; i <= segmentsCount; i++) {
    const theta = startAngle + (i / segmentsCount) * deltaAngle;
    const xt = rx * Math.cos(theta);
    const yt = ry * Math.sin(theta);
    const pX = cosPhi * xt - sinPhi * yt + cx;
    const pY = sinPhi * xt + cosPhi * yt + cy;
    addSeg(prevX, prevY, pX, pY);
    prevX = pX;
    prevY = pY;
  }
}

export function svgDielineImporter(svgString: string): { foldData: FoldData; warnings: string[] } {
  const warnings: string[] = [];
  const segments: { p1: [number, number]; p2: [number, number]; color: string; layer: string }[] = [];

  // Phase 1: SVG Parsing
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    warnings.push("SVG parsing error detected. The output may be incomplete.");
  }

  function applyTransformString(transform: string, mPrev: number[]): number[] {
    let m = [...mPrev];
    const regex = /([a-zA-Z]+)\s*\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(transform))) {
      const op = match[1].toLowerCase();
      const args = match[2].split(/[\s,]+/).map(parseFloat).filter((n) => !isNaN(n));
      let m2 = [1, 0, 0, 1, 0, 0];

      if (op === "matrix" && args.length === 6) {
        m2 = args;
      } else if (op === "translate" && args.length >= 1) {
        m2[4] = args[0];
        m2[5] = args.length >= 2 ? args[1] : 0;
      } else if (op === "scale" && args.length >= 1) {
        m2[0] = args[0];
        m2[3] = args.length >= 2 ? args[1] : args[0];
      } else if (op === "rotate" && args.length >= 1) {
        const rad = (args[0] * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        m2 = [cos, sin, -sin, cos, 0, 0];
        if (args.length === 3) {
          const cx = args[1],
            cy = args[2];
          m2[4] = cx - cos * cx + sin * cy;
          m2[5] = cy - sin * cx - cos * cy;
        }
      }

      const [a1, b1, c1, d1, e1, f1] = m;
      const [a2, b2, c2, d2, e2, f2] = m2;
      m = [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
      ];
    }
    return m;
  }

  function applyTransform(pt: [number, number], m: number[]): [number, number] {
    return [m[0] * pt[0] + m[2] * pt[1] + m[4], m[1] * pt[0] + m[3] * pt[1] + m[5]];
  }

  function traverse(node: Element, currentMatrix: number[], currentColor: string, parentLayer: string) {
    const tag = node.tagName.toLowerCase();
    if (tag === "defs" || tag === "style" || tag === "title" || tag === "desc" || tag === "metadata") return;

    let layerName = parentLayer;
    if (tag === "g") {
      const dataName = node.getAttribute("data-name");
      const inkLabel = node.getAttribute("inkscape:label") || node.getAttributeNS("http://www.inkscape.org/namespaces/inkscape", "label");
      const id = node.getAttribute("id") || "";
      if (dataName) layerName = dataName;
      else if (inkLabel) layerName = inkLabel;
      else if (id.match(/DECOUPE|CUT|PLI|FOLD|CREASE|COLLAGE|GLUE|FOND_PERDU|BLEED/i)) {
        layerName = id;
      }
    }

    let m = [...currentMatrix];
    const transAttr = node.getAttribute("transform");
    if (transAttr) {
      m = applyTransformString(transAttr, m);
    }

    let color = currentColor;
    const strokeAttr = node.getAttribute("stroke");
    if (strokeAttr) color = strokeAttr;

    const styleAttr = node.getAttribute("style");
    if (styleAttr) {
      const mStyle = styleAttr.match(/stroke:\s*([^;]+)/i);
      if (mStyle) color = mStyle[1].trim();
    }

    if (tag === "polygon" || tag === "polyline" || tag === "path") {
      const fillAttr = node.getAttribute("fill") || "";
      const styleFill = styleAttr?.match(/fill:\s*([^;]+)/i)?.[1]?.trim() || "";
      const effectiveFill = styleFill || fillAttr;
      
      const strokeAttrCurrent = node.getAttribute("stroke") || "";
      const styleStroke = styleAttr?.match(/stroke:\s*([^;]+)/i)?.[1]?.trim() || "";
      const effectiveStroke = styleStroke || strokeAttrCurrent;
      
      const isBleedLayer = layerName.match(/FOND_PERDU|BLEED/i);
      const hasFill = effectiveFill && effectiveFill.toLowerCase() !== "none" && effectiveFill.toLowerCase() !== "transparent";
      const hasStroke = effectiveStroke && effectiveStroke.toLowerCase() !== "none" && effectiveStroke.toLowerCase() !== "transparent";

      if (isBleedLayer || (hasFill && !hasStroke)) {
        for (let i = 0; i < node.children.length; i++) {
          traverse(node.children[i], m, color, layerName);
        }
        return;
      }
    }

    if (color && color.toLowerCase() !== "none" && color.toLowerCase() !== "transparent") {
      const addSeg = (x1: number, y1: number, x2: number, y2: number) => {
        const p1 = applyTransform([x1, y1], m);
        const p2 = applyTransform([x2, y2], m);
        segments.push({ p1, p2, color, layer: layerName });
      };

      if (tag === "line") {
        addSeg(
          parseFloat(node.getAttribute("x1") || "0"),
          parseFloat(node.getAttribute("y1") || "0"),
          parseFloat(node.getAttribute("x2") || "0"),
          parseFloat(node.getAttribute("y2") || "0")
        );
      } else if (tag === "polyline" || tag === "polygon") {
        const ptsStr = node.getAttribute("points") || "";
        const pts = ptsStr.split(/[\s,]+/).filter(Boolean).map(parseFloat).filter((n) => !isNaN(n));
        for (let i = 0; i < pts.length - 2; i += 2) {
          addSeg(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
        }
        if (tag === "polygon" && pts.length >= 4) {
          addSeg(pts[pts.length - 2], pts[pts.length - 1], pts[0], pts[1]);
        }
      } else if (tag === "rect") {
        const x = parseFloat(node.getAttribute("x") || "0");
        const y = parseFloat(node.getAttribute("y") || "0");
        const w = parseFloat(node.getAttribute("width") || "0");
        const h = parseFloat(node.getAttribute("height") || "0");
        addSeg(x, y, x + w, y);
        addSeg(x + w, y, x + w, y + h);
        addSeg(x + w, y + h, x, y + h);
        addSeg(x, y + h, x, y);
      } else if (tag === "path") {
        const d = node.getAttribute("d") || "";
        const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
        let i = 0;
        let cmd = "";
        let px = 0, py = 0, startX = 0, startY = 0;
        let lastCpX = 0, lastCpY = 0;
        let lastCommand = "";

        const nextNum = () => {
          if (i < tokens.length) {
            const n = parseFloat(tokens[i]);
            if (!isNaN(n)) { i++; return n; }
          }
          return 0;
        };

        while (i < tokens.length) {
          if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];

          switch (cmd) {
            case "M":
              px = nextNum(); py = nextNum();
              startX = px; startY = py;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              cmd = "L";
              break;
            case "m":
              px += nextNum(); py += nextNum();
              startX = px; startY = py;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              cmd = "l";
              break;
            case "L": {
              const nx = nextNum(), ny = nextNum();
              addSeg(px, py, nx, ny);
              px = nx; py = ny;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              break;
            }
            case "l": {
              const nx = px + nextNum(), ny = py + nextNum();
              addSeg(px, py, nx, ny);
              px = nx; py = ny;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              break;
            }
            case "H": {
              const nx = nextNum();
              addSeg(px, py, nx, py);
              px = nx;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              break;
            }
            case "h": {
              const nx = px + nextNum();
              addSeg(px, py, nx, py);
              px = nx;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              break;
            }
            case "V": {
              const ny = nextNum();
              addSeg(px, py, px, ny);
              py = ny;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              break;
            }
            case "v": {
              const ny = py + nextNum();
              addSeg(px, py, px, ny);
              py = ny;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              break;
            }
            case "Z":
            case "z":
              addSeg(px, py, startX, startY);
              px = startX; py = startY;
              lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              cmd = "M";
              break;
            case "C": {
              const x1 = nextNum(), y1 = nextNum();
              const x2 = nextNum(), y2 = nextNum();
              const nx = nextNum(), ny = nextNum();
              tessellateCubic(px, py, x1, y1, x2, y2, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = x2; lastCpY = y2;
              lastCommand = cmd;
              cmd = "C";
              break;
            }
            case "c": {
              const x1 = px + nextNum(), y1 = py + nextNum();
              const x2 = px + nextNum(), y2 = py + nextNum();
              const nx = px + nextNum(), ny = py + nextNum();
              tessellateCubic(px, py, x1, y1, x2, y2, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = x2; lastCpY = y2;
              lastCommand = cmd;
              cmd = "c";
              break;
            }
            case "S": {
              let x1 = px, y1 = py;
              if ("CcSs".includes(lastCommand)) { x1 = 2 * px - lastCpX; y1 = 2 * py - lastCpY; }
              const x2 = nextNum(), y2 = nextNum();
              const nx = nextNum(), ny = nextNum();
              tessellateCubic(px, py, x1, y1, x2, y2, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = x2; lastCpY = y2;
              lastCommand = cmd;
              cmd = "S";
              break;
            }
            case "s": {
              let x1 = px, y1 = py;
              if ("CcSs".includes(lastCommand)) { x1 = 2 * px - lastCpX; y1 = 2 * py - lastCpY; }
              const x2 = px + nextNum(), y2 = py + nextNum();
              const nx = px + nextNum(), ny = py + nextNum();
              tessellateCubic(px, py, x1, y1, x2, y2, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = x2; lastCpY = y2;
              lastCommand = cmd;
              cmd = "s";
              break;
            }
            case "Q": {
              const x1 = nextNum(), y1 = nextNum();
              const nx = nextNum(), ny = nextNum();
              tessellateQuadratic(px, py, x1, y1, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = x1; lastCpY = y1;
              lastCommand = cmd;
              cmd = "Q";
              break;
            }
            case "q": {
              const x1 = px + nextNum(), y1 = py + nextNum();
              const nx = px + nextNum(), ny = py + nextNum();
              tessellateQuadratic(px, py, x1, y1, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = x1; lastCpY = y1;
              lastCommand = cmd;
              cmd = "q";
              break;
            }
            case "T": {
              let x1 = px, y1 = py;
              if ("QqTt".includes(lastCommand)) { x1 = 2 * px - lastCpX; y1 = 2 * py - lastCpY; }
              const nx = nextNum(), ny = nextNum();
              tessellateQuadratic(px, py, x1, y1, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = x1; lastCpY = y1;
              lastCommand = cmd;
              cmd = "T";
              break;
            }
            case "t": {
              let x1 = px, y1 = py;
              if ("QqTt".includes(lastCommand)) { x1 = 2 * px - lastCpX; y1 = 2 * py - lastCpY; }
              const nx = px + nextNum(), ny = py + nextNum();
              tessellateQuadratic(px, py, x1, y1, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = x1; lastCpY = y1;
              lastCommand = cmd;
              cmd = "t";
              break;
            }
            case "A": {
              const rx = nextNum(), ry = nextNum();
              const xAxisRot = nextNum(), largeArc = nextNum(), sweep = nextNum();
              const nx = nextNum(), ny = nextNum();
              tessellateArc(px, py, rx, ry, xAxisRot, largeArc, sweep, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              cmd = "A";
              break;
            }
            case "a": {
              const rx = nextNum(), ry = nextNum();
              const xAxisRot = nextNum(), largeArc = nextNum(), sweep = nextNum();
              const nx = px + nextNum(), ny = py + nextNum();
              tessellateArc(px, py, rx, ry, xAxisRot, largeArc, sweep, nx, ny, addSeg);
              px = nx; py = ny; lastCpX = px; lastCpY = py;
              lastCommand = cmd;
              cmd = "a";
              break;
            }
            default: i++; break;
          }
        }
      }
    }

    for (let i = 0; i < node.children.length; i++) {
      traverse(node.children[i], m, color, layerName);
    }
  }

  if (doc.documentElement) {
    traverse(doc.documentElement, [1, 0, 0, 1, 0, 0], "none", "");
  }

  // Phase 2: Vertex Welding
  const verticesCoords: [number, number][] = [];
  const epsilon = 0.1;
  const grid = new Map<string, number[]>();

  function addVertex(x: number, y: number): number {
    const gx = Math.floor(x / epsilon);
    const gy = Math.floor(y / epsilon);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = grid.get(`${gx + dx},${gy + dy}`);
        if (cell) {
          for (const idx of cell) {
            const v = verticesCoords[idx];
            if (Math.hypot(v[0] - x, v[1] - y) <= epsilon) {
              return idx;
            }
          }
        }
      }
    }
    const idx = verticesCoords.length;
    verticesCoords.push([x, y]);
    const mainKey = `${gx},${gy}`;
    if (!grid.has(mainKey)) grid.set(mainKey, []);
    grid.get(mainKey)!.push(idx);
    return idx;
  }

  // Color Mapping Helper
  function parseColor(str: string): [number, number, number] | null {
    str = str.trim().toLowerCase();
    if (str === "none" || str === "transparent") return null;
    const named: Record<string, [number, number, number]> = {
      magenta: [255, 0, 255], blue: [0, 85, 255], green: [0, 170, 68],
      gray: [153, 153, 153], red: [255, 0, 0], black: [0, 0, 0], white: [255, 255, 255]
    };
    if (named[str]) return named[str];

    let m = str.match(/^#([0-9a-f]{3})$/i);
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];

    m = str.match(/^#([0-9a-f]{6})$/i);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];

    m = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];

    return null;
  }

  function mapColorToAssignment(color: [number, number, number], layer: string): { assign: "M" | "V" | "B" | "F" | "UNKNOWN"; angle: number } | null {
    if (layer) {
      if (layer.match(/DECOUPE|CUT/i)) return { assign: "B", angle: 0 };
      if (layer.match(/PLI|FOLD|CREASE/i)) {
        if (color[1] > 100 && color[0] < 100) return { assign: "V", angle: 90 };
        return { assign: "M", angle: -90 };
      }
      if (layer.match(/COLLAGE|GLUE/i)) return { assign: "F", angle: 0 };
      if (layer.match(/FOND_PERDU|BLEED/i)) return null;
    }

    const targets = [
      { name: "magenta", rgb: [255, 0, 255], assign: "B" as const, angle: 0 },
      { name: "blue", rgb: [0, 85, 255], assign: "M" as const, angle: -90 },
      { name: "green", rgb: [0, 170, 68], assign: "V" as const, angle: 90 },
      { name: "gray", rgb: [153, 153, 153], assign: "F" as const, angle: 0 },
      { name: "black", rgb: [0, 0, 0], assign: "B" as const, angle: 0 },
    ];
    for (const t of targets) {
      if (Math.abs(color[0] - t.rgb[0]) <= 30 && Math.abs(color[1] - t.rgb[1]) <= 30 && Math.abs(color[2] - t.rgb[2]) <= 30) {
        return { assign: t.assign, angle: t.angle };
      }
    }

    const [r, g, b] = color;
    if (r > 240 && g > 240 && b > 240) return null;
    if (r > 200 && g < 50 && b > 200) return { assign: "B", angle: 0 };
if (r > 200 && g < 50 && b < 50) return { assign: "B", angle: 0 };
// Broader pink/purple/magenta — R and B both present, G much lower
if (r > 120 && b > 120 && g < Math.min(r, b) * 0.75) return { assign: "B", angle: 0 };
    if (r < 80 && b > 150) return { assign: "M", angle: -90 };
    if (r < 80 && g > 100 && g > b) return { assign: "V", angle: 90 };
    if (r < 30 && g < 30 && b < 30) return { assign: "B", angle: 0 };
    if (Math.abs(r - g) < 40 && Math.abs(g - b) < 40 && r > 50 && r < 230) return { assign: "F", angle: 0 };

    return { assign: "UNKNOWN", angle: 0 };
  }

  // Phase 3: Edge Construction
  const edgeMap = new Map<string, { v1: number; v2: number; assign: "M" | "V" | "B" | "F"; angle: number }>();
  const priority: Record<string, number> = { B: 3, M: 2, V: 1, F: 0, UNKNOWN: -1 };
  const detectedLayers = new Set<string>();

  for (const seg of segments) {
    if (seg.layer) detectedLayers.add(seg.layer);

    const v1 = addVertex(seg.p1[0], seg.p1[1]);
    const v2 = addVertex(seg.p2[0], seg.p2[1]);
    if (v1 === v2) continue; // Skip degenerate

    const rgb = parseColor(seg.color);
    if (!rgb) continue;

    let mapped = mapColorToAssignment(rgb, seg.layer);
    if (!mapped) continue;

    if (mapped.assign === "UNKNOWN") {
      if (!warnings.includes(`Unknown color defaulted to Cut: ${seg.color} (layer: ${seg.layer})`)) {
        warnings.push(`Unknown color defaulted to Cut: ${seg.color} (layer: ${seg.layer})`);
      }
      mapped = { assign: "B", angle: 0 };
    }

    const minV = Math.min(v1, v2);
    const maxV = Math.max(v1, v2);
    const key = `${minV}-${maxV}`;
    const assignSafe = mapped.assign as "M" | "V" | "B" | "F";
    if (!edgeMap.has(key) || priority[assignSafe] > priority[edgeMap.get(key)!.assign]) {
      edgeMap.set(key, { v1: minV, v2: maxV, assign: assignSafe, angle: mapped.angle });
    }
  }

  const edges = Array.from(edgeMap.values());
  const edgeCounts = { B: 0, M: 0, V: 0, F: 0 };
  edges.forEach(e => { edgeCounts[e.assign]++; });
  
  console.log(`[SVG Import] Segments extracted: ${segments.length}, Layers detected: [${Array.from(detectedLayers).join(', ')}]`);
  console.log(`[SVG Import] Edges by type: B=${edgeCounts.B}, M=${edgeCounts.M}, V=${edgeCounts.V}, F=${edgeCounts.F}`);

  // Phase 4: Face Detection (Planar Subdivision)
  const adj = new Map<number, number[]>();
  edges.forEach((e) => {
    if (!adj.has(e.v1)) adj.set(e.v1, []);
    if (!adj.has(e.v2)) adj.set(e.v2, []);
    adj.get(e.v1)!.push(e.v2);
    adj.get(e.v2)!.push(e.v1);
  });

  // Prune dead-end vertices (degree <= 1) iteratively
  // Dead ends don't form face boundaries and create face polygons
  // with repeated vertices that corrupt the 3D face tree
  let prunedCount = 0;
  let pruning = true;
  while (pruning) {
    pruning = false;
    const toRemove: number[] = [];
    for (const [v, neighbors] of adj.entries()) {
      if (neighbors.length <= 1) {
        toRemove.push(v);
      }
    }
    for (const v of toRemove) {
      const neighbors = adj.get(v);
      if (neighbors) {
        for (const n of neighbors) {
          const nArr = adj.get(n);
          if (nArr) {
            const idx = nArr.indexOf(v);
            if (idx !== -1) nArr.splice(idx, 1);
          }
        }
        adj.delete(v);
        prunedCount++;
        pruning = true;
      }
    }
  }
  if (prunedCount > 0) {
    console.log(`[SVG Import] Pruned ${prunedCount} dead-end vertices`);
  }

  for (const [v, neighbors] of adj.entries()) {
    const vx = verticesCoords[v][0];
    const vy = verticesCoords[v][1];
    neighbors.sort((a, b) => {
      const ax = verticesCoords[a][0] - vx;
      const ay = verticesCoords[a][1] - vy;
      const bx = verticesCoords[b][0] - vx;
      const by = verticesCoords[b][1] - vy;
      return Math.atan2(ay, ax) - Math.atan2(by, bx);
    });
  }

  const halfEdges = new Set<string>();
  const nextHalfEdge = new Map<string, string>();

  for (const [v, neighbors] of adj.entries()) {
    if (neighbors.length === 1) {
      nextHalfEdge.set(`${neighbors[0]}-${v}`, `${v}-${neighbors[0]}`);
      halfEdges.add(`${neighbors[0]}-${v}`);
      continue;
    }
    for (let i = 0; i < neighbors.length; i++) {
      const w = neighbors[i];
      const u = neighbors[(i + 1) % neighbors.length];
      nextHalfEdge.set(`${u}-${v}`, `${v}-${w}`);
      halfEdges.add(`${u}-${v}`);
    }
  }

  const rawFaces: number[][] = [];
  const usedHalfEdges = new Set<string>();

  for (const he of halfEdges) {
    if (usedHalfEdges.has(he)) continue;

    const face: number[] = [];
    let curr = he;
    let valid = true;
    do {
      if (usedHalfEdges.has(curr)) {
        valid = false;
        break;
      }
      usedHalfEdges.add(curr);
      const [, vStr] = curr.split("-");
      face.push(parseInt(vStr));
      curr = nextHalfEdge.get(curr)!;
      if (!curr) { valid = false; break; }
    } while (curr !== he);

    if (valid && face.length >= 3) {
      rawFaces.push(face);
    }
  }

  // Determine areas and systematically discard outer/unbounded faces
  let maxAbsArea = -1;
  let maxAbsIndex = -1;
  const faceAreas = rawFaces.map((f, i) => {
    let area = 0;
    for (let j = 0; j < f.length; j++) {
      const p1 = verticesCoords[f[j]];
      const p2 = verticesCoords[f[(j + 1) % f.length]];
      area += p1[0] * p2[1] - p2[0] * p1[1];
    }
    area /= 2;
    if (Math.abs(area) > maxAbsArea) {
      maxAbsArea = Math.abs(area);
      maxAbsIndex = i;
    }
    return area;
  });

  // Explicitly follow instruction: discard the absolute largest face
  if (maxAbsIndex !== -1) {
    rawFaces.splice(maxAbsIndex, 1);
    faceAreas.splice(maxAbsIndex, 1);
  }

  const validFaces: number[][] = [];
  for (let i = 0; i < rawFaces.length; i++) {
    const f = rawFaces[i];
    let area = faceAreas[i];
    
    if (area < -1e-5) {
      // Reverse CW back to CCW as requested
      f.reverse();
    }
    if (Math.abs(area) > 1e-5) {
      validFaces.push(f);
    }
  }

  // Deduplicate identical faces (prevents island outer boundaries from stacking)
  const uniqueFaces = new Map<string, number[]>();
  for (const f of validFaces) {
    const sortedKey = [...f].sort((a, b) => a - b).join("-");
    uniqueFaces.set(sortedKey, f);
  }
  const deduplicatedFaces = Array.from(uniqueFaces.values());

  if (deduplicatedFaces.length === 0) {
    warnings.push("No valid polygonal faces could be detected. Check for disconnected lines or gaps in the dieline.");
  }

  console.log(`[SVG Import] Faces detected: ${deduplicatedFaces.length}`);

    // Phase 5: FoldData Assembly — trust SVG color classification
  // The fold engine only uses edges bordering 2 faces for folding,
  // so non-structural edges are harmless but preserve correct display colors
  const finalEdgesAssignment: ("M" | "V" | "B" | "F")[] = [];
  const finalEdgesAngle: number[] = [];
  const finalEdgesVertices: [number, number][] = [];

  for (const e of edges) {
    finalEdgesVertices.push([e.v1, e.v2]);
    finalEdgesAssignment.push(e.assign);
    finalEdgesAngle.push(e.angle);
  }

  const finalCounts = { B: 0, M: 0, V: 0, F: 0 };
  finalEdgesAssignment.forEach(a => { finalCounts[a]++; });
  console.log(`[SVG Import] Final edges output: B=${finalCounts.B}, M=${finalCounts.M}, V=${finalCounts.V}, F=${finalCounts.F}`);

  let internalEdgeCount = 0;
  for (const e of edges) {
    let faceCount = 0;
    for (const f of deduplicatedFaces) {
      for (let j = 0; j < f.length; j++) {
        const u = f[j];
        const w = f[(j + 1) % f.length];
        if ((u === e.v1 && w === e.v2) || (u === e.v2 && w === e.v1)) {
          faceCount++;
          break;
        }
      }
    }
    if (faceCount === 2) {
      internalEdgeCount++;
    }
  }
  console.log(`[SVG Import] Internal edges (connecting 2 faces): ${internalEdgeCount}`);

  return {
    foldData: {
      verticesCoords,
      facesVertices: deduplicatedFaces,
      edgesVertices: finalEdgesVertices,
      edgesAssignment: finalEdgesAssignment,
      edgesFoldAngle: finalEdgesAngle,
    },
    warnings,
  };
}