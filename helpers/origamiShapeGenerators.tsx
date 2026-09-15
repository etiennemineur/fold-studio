import { FoldData } from "./foldEngine";

export type OrigamiPaperShape = 'square' | 'rectangle' | 'a4' | 'custom';

/**
 * Generates FoldData for a flat square sheet centered at the origin.
 * @param size The size of the square (width and height)
 */
export function generateOrigamiSquare(size: number): FoldData {
  const half = size / 2;
  return {
    verticesCoords: [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ],
    edgesVertices: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
    edgesAssignment: ['B', 'B', 'B', 'B'],
    edgesFoldAngle: [0, 0, 0, 0],
    facesVertices: [[0, 1, 2, 3]],
  };
}

/**
 * Generates FoldData for a flat rectangular sheet centered at the origin.
 * @param width The width of the rectangle
 * @param height The height of the rectangle
 */
export function generateOrigamiRectangle(width: number, height: number): FoldData {
  const halfW = width / 2;
  const halfH = height / 2;
  return {
    verticesCoords: [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ],
    edgesVertices: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
    edgesAssignment: ['B', 'B', 'B', 'B'],
    edgesFoldAngle: [0, 0, 0, 0],
    facesVertices: [[0, 1, 2, 3]],
  };
}

/**
 * Generates FoldData for a flat A4 sheet centered at the origin.
 */
export function generateOrigamiA4(): FoldData {
  return generateOrigamiRectangle(210, 297);
}

/**
 * Dispatcher function to generate FoldData for a specific paper shape.
 * @param paperShape The type of paper ('square', 'rectangle', 'a4', 'custom')
 * @param width The width of the paper (used for square, rectangle, custom)
 * @param height The height of the paper (used for rectangle, custom)
 */
export function generateOrigamiPaper(
  paperShape: OrigamiPaperShape,
  width: number,
  height: number
): FoldData {
  switch (paperShape) {
    case 'square':
      return generateOrigamiSquare(width);
    case 'a4':
      return generateOrigamiA4();
    case 'rectangle':
    case 'custom':
    default:
      return generateOrigamiRectangle(width, height);
  }
}