export type MechanismType = 'v-fold' | 'v-fold-asymmetric' | 'parallel-fold' | 'platform' | 'box';

export interface MechanismParams {
  positionY: number;       
  width: number;           
  height: number;          
  depth: number;           
  vAngle: number;          
  armLengthLeft: number;   
  armLengthRight: number;  
  foldDirection: 'up' | 'down'; 
}

export interface PopupMechanism {
  id: string;
  type: MechanismType;
  params: MechanismParams;
}

export interface GluePoint {
  id: string;
  mechanismId: string;
  side: 'left' | 'right';
  position: [number, number];
}

export interface PopupSheet {
  id: string;
  name: string;
  faceIndices: number[];
}

export interface PopupDocument {
  bookWidth: number;        
  bookHeight: number;       
  paperThickness: number;   
  mechanisms: PopupMechanism[];
  gluePoints: GluePoint[];
  sheets: PopupSheet[];
  paperColor: string;
  foldOverrides?: Record<string, 'M' | 'V'>;
}

export interface MechanismGeometry {
  vertices: [number, number][];
  faces: number[][]; 
  foldEdges: { v1: number; v2: number; angleFormula: (bookAngleDeg: number) => number }[];
  leftCoverContour: number[];
  rightCoverContour: number[];
  yStart: number;
  yEnd: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Smooth, stable mechanical response from fully open (0) to fully closed (1). */
function foldPhase(bookAngleDeg: number, exponent = 1): number {
  const closure = clamp01(1 - bookAngleDeg / 180);
  const smooth = closure * closure * (3 - 2 * closure);
  return Math.pow(smooth, exponent);
}

function foldDirectionSign(params: MechanismParams): number {
  return params.foldDirection === 'down' ? -1 : 1;
}

export function getMechanismDisplayName(type: MechanismType): string {
  const names: Record<MechanismType, string> = {
    'v-fold': 'V-Fold',
    'v-fold-asymmetric': 'Asymmetric V-Fold',
    'parallel-fold': 'Parallel Step',
    'platform': 'Platform',
    'box': 'Box'
  };
  return names[type] || type;
}

export function getMechanismDescription(type: MechanismType): string {
  const desc: Record<MechanismType, string> = {
    'v-fold': 'A symmetric triangular popup that rises when the page opens.',
    'v-fold-asymmetric': 'An off-center V-fold creating angled dynamic motion.',
    'parallel-fold': 'A rectangular step parallel to the page edges.',
    'platform': 'A flat raised surface supported by walls.',
    'box': 'A complete 3D cubic volume extending from the spine.'
  };
  return desc[type] || '';
}

/**
 * Generates the geometry for a Parallel Step mechanism.
 */
export function generateParallelFoldGeometry(params: MechanismParams): MechanismGeometry {
  const { positionY, width, height } = params;
  const yStart = positionY;
  const yEnd = positionY + width;
  const h = height;

  const vertices: [number, number][] = [
    [0, yStart],    // 0: Shared Spine Top
    [-h, yStart],   // 1: LC Hinge Top
    [-h, yEnd],     // 2: LC Hinge Bottom
    [0, yEnd],      // 3: Shared Spine Bottom
    [h, yStart],    // 4: RC Hinge Top
    [h, yEnd],      // 5: RC Hinge Bottom
    [0, yStart],    // 6: Step Center Top (duplicate of 0 for pop-up face)
    [0, yEnd],      // 7: Step Center Bottom (duplicate of 3 for pop-up face)
  ];

  const leftCoverContour = [0, 1, 2, 3];
  const rightCoverContour = [0, 4, 5, 3];

  const faces = [
    [6, 1, 2, 7], // Left step panel
    [6, 7, 5, 4]  // Right step panel
  ];

  const sign = foldDirectionSign(params);
  const foldEdges = [
    { v1: 1, v2: 2, angleFormula: (theta: number) => -90 * foldPhase(theta) * sign },
    { v1: 4, v2: 5, angleFormula: (theta: number) => -90 * foldPhase(theta) * sign },
    { v1: 6, v2: 7, angleFormula: (theta: number) => 180 * foldPhase(theta) * sign }
  ];

  return { vertices, faces, foldEdges, leftCoverContour, rightCoverContour, yStart, yEnd };
}

/**
 * Generates the geometry for a classic symmetric V-Fold mechanism.
 */
export function generateVFoldGeometry(params: MechanismParams): MechanismGeometry {
  const { positionY, height, vAngle } = params;
  const yStart = positionY;
  const vAngleRad = (vAngle * Math.PI) / 180;
  const width = height * Math.tan(vAngleRad);
  const yEnd = positionY + height;

  const vertices: [number, number][] = [
    [0, yStart],    // 0: Apex (Shared Spine Top)
    [-width, yEnd], // 1: Left Hinge Bottom
    [0, yEnd],      // 2: Spine Bottom LC/RC
    [width, yEnd],  // 3: Right Hinge Bottom
    [0, yEnd],      // 4: Mech Center Bottom (Duplicate for center hinge)
  ];

  const leftCoverContour = [0, 1, 2];
  const rightCoverContour = [0, 3, 2];

  const faces = [
    [0, 1, 4], // Left V-Arm
    [0, 4, 3]  // Right V-Arm
  ];

  const sign = foldDirectionSign(params);
  const foldEdges = [
    { v1: 0, v2: 1, angleFormula: (theta: number) => -90 * foldPhase(theta) * sign },
    { v1: 0, v2: 3, angleFormula: (theta: number) => -90 * foldPhase(theta) * sign },
    { v1: 0, v2: 4, angleFormula: (theta: number) => 180 * foldPhase(theta) * sign }
  ];

  return { vertices, faces, foldEdges, leftCoverContour, rightCoverContour, yStart, yEnd };
}

/**
 * Generates an asymmetric V-Fold by forcing horizontal cuts but varying the arm projection widths.
 */
export function generateVFoldAsymmetricGeometry(params: MechanismParams): MechanismGeometry {
  const { positionY, height, armLengthLeft, armLengthRight } = params;
  const yStart = positionY;
  const yEnd = positionY + height;

  const vertices: [number, number][] = [
    [0, yStart],             // 0: Apex (Shared)
    [-armLengthLeft, yEnd],  // 1: Left Hinge Bottom
    [0, yEnd],               // 2: Spine Bottom
    [armLengthRight, yEnd],  // 3: Right Hinge Bottom
    [0, yEnd],               // 4: Mech Center Bottom
  ];

  const leftCoverContour = [0, 1, 2];
  const rightCoverContour = [0, 3, 2];

  const faces = [
    [0, 1, 4], 
    [0, 4, 3]  
  ];

  const sign = foldDirectionSign(params);
  const totalArm = Math.max(armLengthLeft + armLengthRight, 1);
  const leftExponent = Math.max(0.78, Math.min(1.22, (armLengthLeft / totalArm) * 2));
  const rightExponent = Math.max(0.78, Math.min(1.22, (armLengthRight / totalArm) * 2));
  const foldEdges = [
    { v1: 0, v2: 1, angleFormula: (theta: number) => -90 * foldPhase(theta, leftExponent) * sign },
    { v1: 0, v2: 3, angleFormula: (theta: number) => -90 * foldPhase(theta, rightExponent) * sign },
    { v1: 0, v2: 4, angleFormula: (theta: number) => 180 * foldPhase(theta) * sign }
  ];

  return { vertices, faces, foldEdges, leftCoverContour, rightCoverContour, yStart, yEnd };
}

export function generatePlatformGeometry(params: MechanismParams): MechanismGeometry {
  const { positionY, width, height, depth } = params;
  const yStart = positionY;
  const yEnd = positionY + width;
  const topHalf = Math.max(2, depth / 2);
  const support = Math.max(2, height);
  const outer = topHalf + support;

  const vertices: [number, number][] = [
    [0, yStart], [-outer, yStart], [-outer, yEnd], [0, yEnd],
    [outer, yStart], [outer, yEnd],
    [0, yStart], [0, yEnd],
    [-topHalf, yStart], [-topHalf, yEnd],
    [topHalf, yStart], [topHalf, yEnd]
  ];

  const faces = [
    [1, 8, 9, 2],
    [8, 6, 7, 9],
    [6, 10, 11, 7],
    [10, 4, 5, 11]
  ];

  const sign = foldDirectionSign(params);
  const foldEdges = [
    { v1: 1, v2: 2, angleFormula: (theta: number) => -90 * foldPhase(theta) * sign },
    { v1: 8, v2: 9, angleFormula: (theta: number) => 90 * foldPhase(theta) * sign },
    { v1: 6, v2: 7, angleFormula: (theta: number) => 180 * foldPhase(theta) * sign },
    { v1: 10, v2: 11, angleFormula: (theta: number) => 90 * foldPhase(theta) * sign },
    { v1: 4, v2: 5, angleFormula: (theta: number) => -90 * foldPhase(theta) * sign }
  ];

  return {
    vertices,
    faces,
    foldEdges,
    leftCoverContour: [0, 1, 2, 3],
    rightCoverContour: [0, 4, 5, 3],
    yStart,
    yEnd
  };
}

export function generateBoxGeometry(params: MechanismParams): MechanismGeometry {
  const { positionY, width, height, depth } = params;
  const yStart = positionY;
  const yEnd = positionY + width;
  const d = Math.max(3, depth / 2);
  const outer = Math.max(d + 3, d + height);

  const xs = [-outer, -d, -d / 2, 0, d / 2, d, outer];
  const vertices: [number, number][] = [
    [0, yStart], [xs[0], yStart], [xs[0], yEnd], [0, yEnd],
    [xs[6], yStart], [xs[6], yEnd],
    [0, yStart], [0, yEnd],
    [xs[1], yStart], [xs[1], yEnd],
    [xs[2], yStart], [xs[2], yEnd],
    [xs[4], yStart], [xs[4], yEnd],
    [xs[5], yStart], [xs[5], yEnd]
  ];

  const faces = [
    [1, 8, 9, 2],
    [8, 10, 11, 9],
    [10, 6, 7, 11],
    [6, 12, 13, 7],
    [12, 14, 15, 13],
    [14, 4, 5, 15]
  ];

  const sign = foldDirectionSign(params);
  const phase = (theta: number) => foldPhase(theta);
  const foldEdges = [
    { v1: 1, v2: 2, angleFormula: (theta: number) => -90 * phase(theta) * sign },
    { v1: 8, v2: 9, angleFormula: (theta: number) => 90 * phase(theta) * sign },
    { v1: 10, v2: 11, angleFormula: (theta: number) => -90 * phase(theta) * sign },
    { v1: 6, v2: 7, angleFormula: (theta: number) => 180 * phase(theta) * sign },
    { v1: 12, v2: 13, angleFormula: (theta: number) => -90 * phase(theta) * sign },
    { v1: 14, v2: 15, angleFormula: (theta: number) => 90 * phase(theta) * sign },
    { v1: 4, v2: 5, angleFormula: (theta: number) => -90 * phase(theta) * sign }
  ];

  return {
    vertices,
    faces,
    foldEdges,
    leftCoverContour: [0, 1, 2, 3],
    rightCoverContour: [0, 4, 5, 3],
    yStart,
    yEnd
  };
}