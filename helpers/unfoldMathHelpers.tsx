// --- Internal Math Helpers ---
export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export function sub3(a: Vec3, b: Vec3): Vec3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
export function add2(a: Vec2, b: Vec2): Vec2 { return [a[0]+b[0], a[1]+b[1]]; }
export function sub2(a: Vec2, b: Vec2): Vec2 { return [a[0]-b[0], a[1]-b[1]]; }
export function dot3(a: Vec3, b: Vec3): number { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }
export function dot2(a: Vec2, b: Vec2): number { return a[0]*b[0] + a[1]*b[1]; }
export function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0]
  ];
}
export function len3(a: Vec3): number { return Math.sqrt(dot3(a, a)); }
export function len2(a: Vec2): number { return Math.sqrt(dot2(a, a)); }
export function normalize3(a: Vec3): Vec3 {
  const l = len3(a);
  return l === 0 ? [0,0,0] : [a[0]/l, a[1]/l, a[2]/l];
}
export function normalize2(a: Vec2): Vec2 {
  const l = len2(a);
  return l === 0 ? [0,0] : [a[0]/l, a[1]/l];
}
export function distance3(a: Vec3, b: Vec3): number { return len3(sub3(a, b)); }

export function getAABB(poly: Vec2[]) {
  let minX = poly[0][0], maxX = minX;
  let minY = poly[0][1], maxY = minY;
  for(let i=1; i<poly.length; i++) {
    if(poly[i][0] < minX) minX = poly[i][0];
    if(poly[i][0] > maxX) maxX = poly[i][0];
    if(poly[i][1] < minY) minY = poly[i][1];
    if(poly[i][1] > maxY) maxY = poly[i][1];
  }
  return {minX, maxX, minY, maxY};
}

export function getPolygonAxes(poly: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const edge = sub2(p2, p1);
    axes.push(normalize2([-edge[1], edge[0]]));
  }
  return axes;
}

export function projectPolygon(poly: Vec2[], axis: Vec2): [number, number] {
  let min = dot2(poly[0], axis);
  let max = min;
  for (let i = 1; i < poly.length; i++) {
    const proj = dot2(poly[i], axis);
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  return [min, max];
}

export function shrinkPolygon(poly: Vec2[], amount: number): Vec2[] {
  let cx = 0, cy = 0;
  for (const p of poly) { cx += p[0]; cy += p[1]; }
  cx /= poly.length;
  cy /= poly.length;
  
  const shrunk: Vec2[] = [];
  for (const p of poly) {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const len = len2([dx, dy]);
    if (len < 0.001) {
      shrunk.push([p[0], p[1]]);
    } else {
      const factor = Math.max(0, (len - amount) / len);
      shrunk.push([cx + dx * factor, cy + dy * factor]);
    }
  }
  return shrunk;
}

export function polygonsOverlapSAT(polyA: Vec2[], polyB: Vec2[], tolerance: number): boolean {
  const sA = shrinkPolygon(polyA, tolerance);
  const sB = shrinkPolygon(polyB, tolerance);
  
  const aabbA = getAABB(sA);
  const aabbB = getAABB(sB);
  
  if (aabbA.maxX <= aabbB.minX || aabbA.minX >= aabbB.maxX || aabbA.maxY <= aabbB.minY || aabbA.minY >= aabbB.maxY) {
    return false;
  }
  
  const axes = [...getPolygonAxes(sA), ...getPolygonAxes(sB)];
  for (const axis of axes) {
    const p1 = projectPolygon(sA, axis);
    const p2 = projectPolygon(sB, axis);
    if (p1[1] <= p2[0] || p2[1] <= p1[0]) {
      return false;
    }
  }
  return true;
}