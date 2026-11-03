import { PopupDocument, getPopupPatternFoldData } from "./popupDocument";
import { solvePopupKinematics } from "./popupKinematicSolver";
import { collisionDetection } from "./collisionDetection";

export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationStatus = 'valid' | 'warning' | 'invalid'; 

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  mechanismId?: string; 
  category: 'dimensions' | 'collision' | 'closure' | 'fabricability' | 'structure';
}

export interface PopupValidationResult {
  status: ValidationStatus;
  issues: ValidationIssue[];
  dof: number;
  mechanismStatuses: Map<string, ValidationStatus>;
}

export function detectUnexpectedPopupCollisions(doc: PopupDocument, bookAngleDeg: number) {
  const { foldData, vertexMap } = solvePopupKinematics(doc, bookAngleDeg);
  const rawResult = collisionDetection(foldData, vertexMap);
  const faceToMechanism = new Map<number, string>();
  foldData.popupMeta.mechanisms.forEach(mechanism => {
    mechanism.faceIndices.forEach(faceIndex => faceToMechanism.set(faceIndex, mechanism.id));
  });
  const coverFaces = new Set([
    foldData.popupMeta.leftCoverFaceIndex,
    foldData.popupMeta.rightCoverFaceIndex,
  ]);
  const nearClosed = bookAngleDeg <= 18;

  const collisionPairs = rawResult.collisionPairs.filter(([faceA, faceB]) => {
    const mechanismA = faceToMechanism.get(faceA);
    const mechanismB = faceToMechanism.get(faceB);

    // Panels belonging to the same articulated strip are expected to stack
    // against each other while closing. Their chain solver prevents crossing.
    if (mechanismA && mechanismA === mechanismB) return false;

    // Near closure, a mechanism may rest against either cover as part of the
    // normal paper stack. Contacts between different mechanisms still count.
    if (nearClosed && (coverFaces.has(faceA) || coverFaces.has(faceB))) return false;

    return true;
  });

  const collidingFaces = new Set<number>();
  collisionPairs.forEach(([faceA, faceB]) => {
    collidingFaces.add(faceA);
    collidingFaces.add(faceB);
  });

  return {
    foldData,
    vertexMap,
    collisionPairs,
    collidingFaces,
    hasCollisions: collisionPairs.length > 0,
  };
}

export function estimateDOF(doc: PopupDocument): number {
  // A properly designed pop-up driven only by book opening should have DOF = 1
  // For Phase 1: return 1 if all mechanisms are attached to spine (which they are in our kirigami model)
  return 1;
}

export function getMechanismStatus(doc: PopupDocument, mechanismId: string): ValidationStatus {
  const result = validatePopupDocument(doc);
  return result.mechanismStatuses.get(mechanismId) || 'valid';
}

export function validatePopupDocument(doc: PopupDocument, bookAngleDeg?: number): PopupValidationResult {
  const issues: ValidationIssue[] = [];
  const mechanismStatuses = new Map<string, ValidationStatus>();
  
  doc.mechanisms.forEach(m => mechanismStatuses.set(m.id, 'valid'));
  
  const addIssue = (issue: ValidationIssue) => {
    issues.push(issue);
    if (!issue.mechanismId && issue.severity === 'error') {
      for (const id of mechanismStatuses.keys()) mechanismStatuses.set(id, 'invalid');
    }
    if (issue.mechanismId) {
      const current = mechanismStatuses.get(issue.mechanismId) || 'valid';
      if (issue.severity === 'error') {
        mechanismStatuses.set(issue.mechanismId, 'invalid');
      } else if (issue.severity === 'warning' && current === 'valid') {
        mechanismStatuses.set(issue.mechanismId, 'warning');
      }
    }
  };

  // 1. Minimum dimensions
  doc.mechanisms.forEach(m => {
    const { width, height, depth } = m.params;
    if (width < 5 || height < 5 || (m.type !== 'v-fold' && m.type !== 'v-fold-asymmetric' && depth < 5)) {
      addIssue({
        severity: 'error',
        message: `Mechanism dimensions are too small (< 5mm)`,
        mechanismId: m.id,
        category: 'dimensions'
      });
    }
  });

  // 2. Book bounds (at 180 flat)
  const flatFoldData = getPopupPatternFoldData(doc);
  let outOfBounds = false;
  flatFoldData.verticesCoords.forEach(v => {
    if (v[0] < -doc.bookWidth - 0.1 || v[0] > doc.bookWidth + 0.1 || 
        v[1] < -0.1 || v[1] > doc.bookHeight + 0.1) {
      outOfBounds = true;
    }
  });
  if (outOfBounds) {
    addIssue({
      severity: 'error',
      message: 'Panels extend beyond book covers',
      category: 'dimensions'
    });
  }

  // 3. Mechanism overlap
  for (let i = 0; i < doc.mechanisms.length; i++) {
    for (let j = i + 1; j < doc.mechanisms.length; j++) {
      const m1 = doc.mechanisms[i];
      const m2 = doc.mechanisms[j];
      const m1Start = m1.params.positionY;
      const m1End = m1Start + (m1.type.includes('v-fold') ? m1.params.height : m1.params.width); 
      const m2Start = m2.params.positionY;
      const m2End = m2Start + (m2.type.includes('v-fold') ? m2.params.height : m2.params.width);
      
      if (m1Start < m2End && m2Start < m1End) {
        addIssue({
          severity: 'warning',
          message: 'Mechanisms may physically overlap along the spine',
          mechanismId: m1.id,
          category: 'structure'
        });
        addIssue({
          severity: 'warning',
          message: 'Mechanisms may physically overlap along the spine',
          mechanismId: m2.id,
          category: 'structure'
        });
      }
    }
  }

  // 4. Closure check (0 deg)
  try {
    const { vertexMap: closedVertexMap } = solvePopupKinematics(doc, 0);
    let pokesOut = false;
    for (const vPos of closedVertexMap.values()) {
      const distToSpine = Math.sqrt(vPos[0] * vPos[0] + (vPos[2] || 0) * (vPos[2] || 0));
      if (distToSpine > doc.bookWidth + 0.1 || vPos[1] < -0.1 || vPos[1] > doc.bookHeight + 0.1) {
        pokesOut = true;
      }
    }
    if (pokesOut) {
      addIssue({
        severity: 'warning',
        message: 'Parts extend beyond covers when book is closed (0°)',
        category: 'closure'
      });
    }
  } catch (e) {
    addIssue({ severity: 'error', category: 'closure', message: 'Closure could not be verified: the kinematic solver failed.' });
  }

  // 5. Tab size
  doc.mechanisms.forEach(m => {
    if (m.type === 'v-fold-asymmetric') {
      if (m.params.armLengthLeft < 5 || m.params.armLengthRight < 5) {
        addIssue({
          severity: 'error',
          message: 'V-Fold arms should be at least 5mm',
          mechanismId: m.id,
          category: 'dimensions'
        });
      }
    }
  });

  // 6. Distance between folds >= 2mm 
  let shortFold = false;
  flatFoldData.edgesVertices.forEach((ev, i) => {
    const type = flatFoldData.edgesAssignment[i];
    if (type === 'M' || type === 'V') {
      const v1 = flatFoldData.verticesCoords[ev[0]];
      const v2 = flatFoldData.verticesCoords[ev[1]];
      const dist = Math.sqrt(Math.pow(v1[0] - v2[0], 2) + Math.pow(v1[1] - v2[1], 2));
      if (dist > 0 && dist < 2) shortFold = true;
    }
  });
  if (shortFold) {
    addIssue({
      severity: 'warning',
      message: 'Some fold lines are extremely short (< 2mm)',
      category: 'fabricability'
    });
  }

  // 7. Piece size
  let tinyPiece = false;
  flatFoldData.facesVertices.forEach(face => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    face.forEach(vIdx => {
      const v = flatFoldData.verticesCoords[vIdx];
      minX = Math.min(minX, v[0]);
      maxX = Math.max(maxX, v[0]);
      minY = Math.min(minY, v[1]);
      maxY = Math.max(maxY, v[1]);
    });
    if (maxX - minX < 10 || maxY - minY < 10) {
      tinyPiece = true;
    }
  });
  if (tinyPiece) {
    addIssue({
      severity: 'warning',
      message: 'Some panels are smaller than 10mm in bounding box footprint',
      category: 'fabricability'
    });
  }

  // 8. Thickness warning
  if (doc.paperThickness >= 1) {
    addIssue({
      severity: 'warning',
      message: 'Thick paper (>=1mm) may cause binding stress. Consider double-scoring strategies.',
      category: 'fabricability'
    });
  }

  // 9. Collision sweep
  const checkAngles = bookAngleDeg !== undefined ? [bookAngleDeg] : [0, 45, 90, 135, 180];
  let collisionFound = false;
  
  for (const angle of checkAngles) {
    try {
      const result = detectUnexpectedPopupCollisions(doc, angle);
      if (result.hasCollisions) {
        collisionFound = true;
        break;
      }
    } catch (e) {
      addIssue({ severity: 'error', category: 'collision', message: `Collision check could not be completed at ${angle}°: the kinematic solver failed.` });
      break;
    }
  }
  
  if (collisionFound) {
    addIssue({
      severity: 'error',
      message: 'Physical collision detected between components during kinematics sweep',
      category: 'collision'
    });
  }

  let overallStatus: ValidationStatus = 'valid';
  if (issues.some(i => i.severity === 'error')) {
    overallStatus = 'invalid';
  } else if (issues.some(i => i.severity === 'warning')) {
    overallStatus = 'warning';
  }

  return {
    status: overallStatus,
    issues,
    dof: estimateDOF(doc),
    mechanismStatuses
  };
}