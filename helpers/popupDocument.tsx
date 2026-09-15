import { nanoid } from "nanoid";
import { FoldData } from "./foldEngine";
import { getFoldEdgeSignature } from "./foldEdgeInteraction";
import { 
  MechanismType, 
  MechanismParams, 
  PopupMechanism, 
  GluePoint, 
  PopupSheet, 
  PopupDocument,
  generateVFoldGeometry,
  generateVFoldAsymmetricGeometry,
  generateParallelFoldGeometry,
  generatePlatformGeometry,
    generateBoxGeometry,
  getMechanismDisplayName
} from "./popupMechanisms";

export { getMechanismDisplayName };
export type { MechanismType, MechanismParams, PopupMechanism, GluePoint, PopupSheet, PopupDocument };

export interface PopupMechanismFoldMeta {
  id: string;
  type: MechanismType;
  params: MechanismParams;
  localVertices: [number, number][];
  localToGlobal: number[];
  yStart: number;
  yEnd: number;
  faceIndices: number[];
}

export interface PopupFoldData extends FoldData {
  popupMeta: {
    bookWidth: number;
    bookHeight: number;
    paperThickness: number;
    mechanisms: PopupMechanismFoldMeta[];
    leftCoverFaceIndex: number;
    rightCoverFaceIndex: number;
  };
}

/**
 * Creates a new blank pop-up document with covers.
 */
export function createDefaultPopupDocument(bookWidth = 150, bookHeight = 200): PopupDocument {
  return {
    bookWidth,
    bookHeight,
    paperThickness: 0.5,
    mechanisms: [],
    gluePoints: [],
    sheets: [{ id: nanoid(), name: 'Base Cover', faceIndices: [] }],
    paperColor: '#FFFFFF',
    foldOverrides: {}
  };
}

/**
 * Provides sensible default parameters for a new mechanism.
 */
export function getDefaultMechanismParams(type: MechanismType): MechanismParams {
  switch (type) {
    case 'v-fold':
    case 'v-fold-asymmetric':
      return {
        positionY: 100,
        width: 40,
        height: 30,
        depth: 0,
        vAngle: 45,
        armLengthLeft: 30,
        armLengthRight: 30,
        foldDirection: 'up'
      };
    case 'parallel-fold':
    case 'platform':
    case 'box':
    default:
      return {
        positionY: 100,
        width: 40,
        height: 30,
        depth: 30,
        vAngle: 45,
        armLengthLeft: 30,
        armLengthRight: 30,
        foldDirection: 'up'
      };
  }
}

/**
 * Adds a new mechanism to the document.
 */
export function addMechanism(
  doc: PopupDocument, 
  type: MechanismType, 
  customParams?: Partial<MechanismParams>
): PopupDocument {
  const params = { ...getDefaultMechanismParams(type), ...customParams };
  const newMechanism: PopupMechanism = {
    id: nanoid(),
    type,
    params
  };

  return {
    ...doc,
    mechanisms: [...doc.mechanisms, newMechanism]
  };
}

/**
 * Updates an existing mechanism in the document.
 */
export function updateMechanism(
  doc: PopupDocument, 
  mechanismId: string, 
  params: Partial<MechanismParams>
): PopupDocument {
  return {
    ...doc,
    mechanisms: doc.mechanisms.map(m => 
      m.id === mechanismId ? { ...m, params: { ...m.params, ...params } } : m
    )
  };
}

/**
 * Removes a mechanism from the document.
 */
export function removeMechanism(doc: PopupDocument, mechanismId: string): PopupDocument {
  return {
    ...doc,
    mechanisms: doc.mechanisms.filter(m => m.id !== mechanismId)
  };
}

/**
 * Compiles the parametric pop-up document into a precise 3D-ready FoldData structure.
 * Employs a single-sheet kirigami routing approach to ensure strict topological adjacency (uniqueFacesOnEdge === 2)
 * required by the foldEngine's rigid forward kinematics.
 */
export function popupDocumentToFoldData(doc: PopupDocument, bookAngleDeg: number): PopupFoldData {
  const verticesCoords: [number, number, number?][] = [];
  const facesVertices: number[][] = [];
  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];
  const mechanismMeta: PopupMechanismFoldMeta[] = [];

  const safeBookAngle = Math.max(0, Math.min(180, bookAngleDeg));

  // Sort mechanisms sequentially from top to bottom
  const sortedMechs = [...doc.mechanisms].sort((a, b) => a.params.positionY - b.params.positionY);

  const leftCoverBoundary: number[] = [];
  const rightCoverBoundary: number[] = [];

  // Initialize top corners
  verticesCoords.push([-doc.bookWidth, 0]); // 0: Top-Left
  verticesCoords.push([doc.bookWidth, 0]);  // 1: Top-Right
  verticesCoords.push([0, 0]);              // 2: Spine Top

  leftCoverBoundary.push(0, 2);
  rightCoverBoundary.push(1, 2);

  let currentSpineTopIdx = 2;
  let currentY = 0;

  for (const mech of sortedMechs) {
    let geom;
    switch (mech.type) {
      case 'v-fold': geom = generateVFoldGeometry(mech.params); break;
      case 'v-fold-asymmetric': geom = generateVFoldAsymmetricGeometry(mech.params); break;
      case 'parallel-fold': geom = generateParallelFoldGeometry(mech.params); break;
      case 'platform': geom = generatePlatformGeometry(mech.params); break;
      case 'box': geom = generateBoxGeometry(mech.params); break;
      default: geom = generateParallelFoldGeometry(mech.params);
    }

    // Connect gap along the spine if mechanism doesn't start exactly at currentY
    if (geom.yStart > currentY) {
      const vSpineBottom = verticesCoords.length;
      verticesCoords.push([0, geom.yStart]);
      
      edgesVertices.push([currentSpineTopIdx, vSpineBottom]);
      edgesAssignment.push('V');
      edgesFoldAngle.push(-(180 - safeBookAngle)); // Standard book spine fold

      leftCoverBoundary.push(vSpineBottom);
      rightCoverBoundary.push(vSpineBottom);
      
      currentSpineTopIdx = vSpineBottom;
    }

    const vOffset = verticesCoords.length;
    
    // Push all mechanism vertices
    geom.vertices.forEach(v => verticesCoords.push(v));

    // Map local generator indices to global FoldData indices, seamlessly merging the top spine vertex
    const localToGlobal = new Map<number, number>();
    for (let i = 0; i < geom.vertices.length; i++) {
      // Only local vertex 0 belongs to the cover spine. Other vertices may
      // deliberately share the same flat coordinates while remaining a
      // separate moving hinge in 3D.
      if (i === 0) {
        localToGlobal.set(i, currentSpineTopIdx);
      } else {
        localToGlobal.set(i, vOffset + i);
      }
    }

    // Append left cover indentation cut contour
    let lastLeft = -1;
    for (const idx of geom.leftCoverContour) {
      const globalIdx = localToGlobal.get(idx)!;
      if (globalIdx !== leftCoverBoundary[leftCoverBoundary.length - 1]) {
        leftCoverBoundary.push(globalIdx);
        lastLeft = globalIdx;
      }
    }
    
    // Append right cover indentation cut contour
    let lastRight = -1;
    for (const idx of geom.rightCoverContour) {
      const globalIdx = localToGlobal.get(idx)!;
      if (globalIdx !== rightCoverBoundary[rightCoverBoundary.length - 1]) {
        rightCoverBoundary.push(globalIdx);
        lastRight = globalIdx;
      }
    }

    // Add mechanism internal faces
    const mechanismFaceStart = facesVertices.length;
    for (const face of geom.faces) {
      facesVertices.push(face.map(idx => localToGlobal.get(idx)!));
    }

    // Embed parametric kinematic folds specific to this mechanism
    for (const fold of geom.foldEdges) {
      edgesVertices.push([localToGlobal.get(fold.v1)!, localToGlobal.get(fold.v2)!]);
      edgesAssignment.push('M'); 
      edgesFoldAngle.push(fold.angleFormula(safeBookAngle));
    }

    mechanismMeta.push({
      id: mech.id,
      type: mech.type,
      params: { ...mech.params },
      localVertices: geom.vertices.map(vertex => [...vertex] as [number, number]),
      localToGlobal: geom.vertices.map((_, index) => localToGlobal.get(index)!),
      yStart: geom.yStart,
      yEnd: geom.yEnd,
      faceIndices: geom.faces.map((_, index) => mechanismFaceStart + index),
    });

    currentY = geom.yEnd;
    currentSpineTopIdx = lastLeft; // The contours are mandated to return to [0, yEnd]
  }

  // Final spine segment closing to the bottom of the book
  if (currentY < doc.bookHeight) {
    const vSpineBottom = verticesCoords.length;
    verticesCoords.push([0, doc.bookHeight]);
    
    edgesVertices.push([currentSpineTopIdx, vSpineBottom]);
    edgesAssignment.push('V');
    edgesFoldAngle.push(-(180 - safeBookAngle));

    leftCoverBoundary.push(vSpineBottom);
    rightCoverBoundary.push(vSpineBottom);
  }

  // Close boundaries along the bottom back to the outer edges
  const vBottomLeft = verticesCoords.length;
  verticesCoords.push([-doc.bookWidth, doc.bookHeight]);
  leftCoverBoundary.push(vBottomLeft);
  
  const vBottomRight = verticesCoords.length;
  verticesCoords.push([doc.bookWidth, doc.bookHeight]);
  rightCoverBoundary.push(vBottomRight);

  // Push the macro cover faces. By appending them last, they act as stable root candidates
  facesVertices.push(leftCoverBoundary);
  facesVertices.push(rightCoverBoundary);

  // Complete the FOLD graph with every visible contour. Shared non-hinge edges
  // become flat seams, while one-face edges become cutting boundaries.
  const existingEdges = new Map<string, number>();
  edgesVertices.forEach(([a, b], index) => {
    existingEdges.set(`${Math.min(a, b)}-${Math.max(a, b)}`, index);
  });

  const faceEdgeCounts = new Map<string, { edge: [number, number]; count: number }>();
  facesVertices.forEach(face => {
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
      const entry = faceEdgeCounts.get(key);
      if (entry) entry.count += 1;
      else faceEdgeCounts.set(key, { edge: [a, b], count: 1 });
    }
  });

  faceEdgeCounts.forEach(({ edge, count }, key) => {
    if (existingEdges.has(key)) return;
    edgesVertices.push(edge);
    edgesAssignment.push(count > 1 ? 'F' : 'B');
    edgesFoldAngle.push(0);
  });

  const provisionalFoldData: FoldData = {
    verticesCoords,
    facesVertices,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
  };

  if (doc.foldOverrides) {
    edgesVertices.forEach((_, edgeIndex) => {
      const current = edgesAssignment[edgeIndex];
      if (current !== 'M' && current !== 'V') return;
      const override = doc.foldOverrides?.[getFoldEdgeSignature(provisionalFoldData, edgeIndex)];
      if (!override || override === current) return;
      edgesAssignment[edgeIndex] = override;
      const angle = edgesFoldAngle[edgeIndex] ?? 0;
      edgesFoldAngle[edgeIndex] = angle !== 0 ? -angle : override === 'M' ? -90 : 90;
    });
  }

  return {
    verticesCoords,
    facesVertices,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
    popupMeta: {
      bookWidth: doc.bookWidth,
      bookHeight: doc.bookHeight,
      paperThickness: doc.paperThickness,
      mechanisms: mechanismMeta,
      leftCoverFaceIndex: facesVertices.length - 2,
      rightCoverFaceIndex: facesVertices.length - 1,
    },
  };
}

/**
 * Returns the flat 2D kirigami pattern representation.
 */
export function getPopupPatternFoldData(doc: PopupDocument): PopupFoldData {
  return popupDocumentToFoldData(doc, 180);
}