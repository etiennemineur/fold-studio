import { useMemo } from 'react';

export function useStudioCreasePatternGrid(activeVB: { x: number, y: number, w: number, h: number }) {
  const gridLines = useMemo(() => {
    const { x, y, w, h } = activeVB;
    // Extend beyond the viewBox so the grid covers the full SVG viewport
    // even when the container aspect ratio differs from the viewBox ratio
    const margin = Math.max(w, h);
    const ex = x - margin;
    const ey = y - margin;
    const ew = w + margin * 2;
    const eh = h + margin * 2;
    
    const startXCm = Math.floor(ex / 10) * 10;
    const endXCm = Math.ceil((ex + ew) / 10) * 10;
    const startYCm = Math.floor(ey / 10) * 10;
    const endYCm = Math.ceil((ey + eh) / 10) * 10;

    const cmLinesX = [];
    for (let i = startXCm; i <= endXCm; i += 10) cmLinesX.push(i);
    
    const cmLinesY = [];
    for (let i = startYCm; i <= endYCm; i += 10) cmLinesY.push(i);

    let mmLinesX: number[] = [];
    let mmLinesY: number[] = [];

    if (w < 200) {
      const startXMm = Math.floor(ex);
      const endXMm = Math.ceil(ex + ew);
      const startYMm = Math.floor(ey);
      const endYMm = Math.ceil(ey + eh);

      for (let i = startXMm; i <= endXMm; i++) {
        if (i % 10 !== 0) mmLinesX.push(i);
      }
      for (let i = startYMm; i <= endYMm; i++) {
        if (i % 10 !== 0) mmLinesY.push(i);
      }
    }

    return { cmLinesX, cmLinesY, mmLinesX, mmLinesY, ex, ey, ew, eh };
  }, [activeVB.x, activeVB.y, activeVB.w, activeVB.h]);

  return gridLines;
}