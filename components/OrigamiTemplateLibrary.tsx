import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import type { FoldData } from "../helpers/foldEngine";
import styles from "./OrigamiTemplateLibrary.module.css";

interface TemplateDef {
  id: string;
  label: string;
  description: string;
  paperWidth: number;
  paperHeight: number;
  foldData: FoldData;
}

interface CategoryDef {
  category: string;
  templates: TemplateDef[];
}

/**
 * Utility to safely compile FoldData from manual faces and known internal fold assignments.
 */
function buildFoldData(
  verticesCoords: [number, number][],
  facesVertices: number[][],
  internalFolds: Record<string, { assignment: 'M' | 'V' | 'F'; foldAngle: number }>
): FoldData {
  const edgeMap = new Map<string, { count: number; vertices: [number, number]; faces: number[] }>();

  facesVertices.forEach((face, faceIndex) => {
    for (let i = 0; i < face.length; i++) {
      const v1 = face[i];
      const v2 = face[(i + 1) % face.length];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const key = `${minV}-${maxV}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 1, vertices: [v1, v2], faces: [faceIndex] });
      } else {
        const edge = edgeMap.get(key)!;
        edge.count++;
        edge.faces.push(faceIndex);
      }
    }
  });

  const edgesVertices: [number, number][] = [];
  const edgesAssignment: ('M' | 'V' | 'B' | 'F')[] = [];
  const edgesFoldAngle: number[] = [];

  for (const edge of edgeMap.values()) {
    edgesVertices.push(edge.vertices);
    if (edge.count === 1) {
      edgesAssignment.push('B');
      edgesFoldAngle.push(0);
    } else {
      const key1 = `${edge.vertices[0]}-${edge.vertices[1]}`;
      const key2 = `${edge.vertices[1]}-${edge.vertices[0]}`;
      const fold = internalFolds[key1] || internalFolds[key2];
      if (fold) {
        edgesAssignment.push(fold.assignment);
        edgesFoldAngle.push(fold.foldAngle);
      } else {
        edgesAssignment.push('F');
        edgesFoldAngle.push(0);
      }
    }
  }

  return {
    verticesCoords,
    facesVertices,
    edgesVertices,
    edgesAssignment,
    edgesFoldAngle,
  };
}

const ORIGAMI_CATEGORIES: CategoryDef[] = [
  {
    category: "Basic Folds",
    templates: [
      {
        id: "book-fold",
        label: "Book Fold",
        description: "Single horizontal fold through center",
        paperWidth: 150,
        paperHeight: 150,
        foldData: buildFoldData(
          [
            [-75, -75], [75, -75], [75, 75], [-75, 75],
            [-75, 0], [75, 0]
          ],
          [
            [0, 1, 5, 4],
            [4, 5, 2, 3]
          ],
          {
            "4-5": { assignment: "M", foldAngle: -180 }
          }
        )
      },
      {
        id: "gate-fold",
        label: "Gate Fold",
        description: "Two parallel vertical folds creating doors",
        paperWidth: 150,
        paperHeight: 150,
        foldData: buildFoldData(
          [
            [-75, -75], [75, -75], [75, 75], [-75, 75],
            [-25, -75], [-25, 75], [25, -75], [25, 75]
          ],
          [
            [0, 4, 5, 3],
            [4, 6, 7, 5],
            [6, 1, 2, 7]
          ],
          {
            "4-5": { assignment: "V", foldAngle: 180 },
            "6-7": { assignment: "V", foldAngle: 180 }
          }
        )
      },
      {
        id: "accordion",
        label: "Accordion",
        description: "Zigzag fan with alternating mountain and valley folds",
        paperWidth: 150,
        paperHeight: 150,
        foldData: buildFoldData(
          [
            [-75, -75], [75, -75],
            [-75, -45], [75, -45],
            [-75, -15], [75, -15],
            [-75, 15], [75, 15],
            [-75, 45], [75, 45],
            [-75, 75], [75, 75]
          ],
          [
            [0, 1, 3, 2],
            [2, 3, 5, 4],
            [4, 5, 7, 6],
            [6, 7, 9, 8],
            [8, 9, 11, 10]
          ],
          {
            "2-3": { assignment: "M", foldAngle: -180 },
            "4-5": { assignment: "V", foldAngle: 180 },
            "6-7": { assignment: "M", foldAngle: -180 },
            "8-9": { assignment: "V", foldAngle: 180 }
          }
        )
      }
    ]
  },
  {
    category: "Classic Bases",
    templates: [
      {
        id: "waterbomb-base",
        label: "Waterbomb Base",
        description: "Diagonals and center cross — collapses to a triangle",
        paperWidth: 150,
        paperHeight: 150,
        foldData: buildFoldData(
          [
            [-75, -75], [75, -75], [75, 75], [-75, 75],
            [0, -75], [75, 0], [0, 75], [-75, 0], [0, 0]
          ],
          [
            [0, 4, 8], [4, 1, 8], [1, 5, 8], [5, 2, 8],
            [2, 6, 8], [6, 3, 8], [3, 7, 8], [7, 0, 8]
          ],
          {
            "0-8": { assignment: "V", foldAngle: 180 },
            "1-8": { assignment: "V", foldAngle: 180 },
            "2-8": { assignment: "V", foldAngle: 180 },
            "3-8": { assignment: "V", foldAngle: 180 },
            "4-8": { assignment: "M", foldAngle: -180 },
            "5-8": { assignment: "M", foldAngle: -180 },
            "6-8": { assignment: "M", foldAngle: -180 },
            "7-8": { assignment: "M", foldAngle: -180 }
          }
        )
      },
      {
        id: "preliminary-base",
        label: "Preliminary Base",
        description: "Inverted waterbomb — collapses to a square",
        paperWidth: 150,
        paperHeight: 150,
        foldData: buildFoldData(
          [
            [-75, -75], [75, -75], [75, 75], [-75, 75],
            [0, -75], [75, 0], [0, 75], [-75, 0], [0, 0]
          ],
          [
            [0, 4, 8], [4, 1, 8], [1, 5, 8], [5, 2, 8],
            [2, 6, 8], [6, 3, 8], [3, 7, 8], [7, 0, 8]
          ],
          {
            "0-8": { assignment: "M", foldAngle: -180 },
            "1-8": { assignment: "M", foldAngle: -180 },
            "2-8": { assignment: "M", foldAngle: -180 },
            "3-8": { assignment: "M", foldAngle: -180 },
            "4-8": { assignment: "V", foldAngle: 180 },
            "5-8": { assignment: "V", foldAngle: 180 },
            "6-8": { assignment: "V", foldAngle: 180 },
            "7-8": { assignment: "V", foldAngle: 180 }
          }
        )
      },
      {
        id: "blintz-fold",
        label: "Blintz Fold",
        description: "Four corners fold to center diamond",
        paperWidth: 150,
        paperHeight: 150,
        foldData: buildFoldData(
          [
            [-75, -75], [75, -75], [75, 75], [-75, 75],
            [0, -75], [75, 0], [0, 75], [-75, 0]
          ],
          [
            [4, 5, 6, 7], // center diamond
            [0, 4, 7],
            [1, 5, 4],
            [2, 6, 5],
            [3, 7, 6]
          ],
          {
            "4-7": { assignment: "V", foldAngle: 180 },
            "4-5": { assignment: "V", foldAngle: 180 },
            "5-6": { assignment: "V", foldAngle: 180 },
            "6-7": { assignment: "V", foldAngle: 180 }
          }
        )
      }
    ]
  },
  {
    category: "Patterns",
    templates: [
      {
        id: "grid-3x3",
        label: "Grid 3×3",
        description: "Nine-cell grid for tessellation exploration",
        paperWidth: 150,
        paperHeight: 150,
        foldData: (() => {
          const verticesCoords: [number, number][] = [];
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
              verticesCoords.push([-75 + c * 50, -75 + r * 50]);
            }
          }
          const facesVertices: number[][] = [];
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              facesVertices.push([
                r * 4 + c,
                r * 4 + c + 1,
                (r + 1) * 4 + c + 1,
                (r + 1) * 4 + c
              ]);
            }
          }
          const internalFolds: Record<string, { assignment: 'M' | 'V' | 'F'; foldAngle: number }> = {
            // Horizontal lines
            "4-5": { assignment: "M", foldAngle: -180 },
            "5-6": { assignment: "M", foldAngle: -180 },
            "6-7": { assignment: "M", foldAngle: -180 },
            "8-9": { assignment: "V", foldAngle: 180 },
            "9-10": { assignment: "V", foldAngle: 180 },
            "10-11": { assignment: "V", foldAngle: 180 },
            // Vertical lines
            "1-5": { assignment: "V", foldAngle: 180 },
            "5-9": { assignment: "V", foldAngle: 180 },
            "9-13": { assignment: "V", foldAngle: 180 },
            "2-6": { assignment: "M", foldAngle: -180 },
            "6-10": { assignment: "M", foldAngle: -180 },
            "10-14": { assignment: "M", foldAngle: -180 }
          };
          return buildFoldData(verticesCoords, facesVertices, internalFolds);
        })()
      },
      {
        id: "diagonal-cross",
        label: "Diagonal Cross",
        description: "Two diagonal folds creating four triangles",
        paperWidth: 150,
        paperHeight: 150,
        foldData: buildFoldData(
          [
            [-75, -75], [75, -75], [75, 75], [-75, 75],
            [0, 0]
          ],
          [
            [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]
          ],
          {
            "0-4": { assignment: "M", foldAngle: -180 },
            "1-4": { assignment: "M", foldAngle: -180 },
            "2-4": { assignment: "M", foldAngle: -180 },
            "3-4": { assignment: "M", foldAngle: -180 }
          }
        )
      }
    ]
  },
  {
    category: "Curved Folds",
    templates: [
      {
        id: "concentric-rings",
        label: "Concentric Rings",
        description: "Circular paper with alternating curved mountain and valley rings",
        paperWidth: 150,
        paperHeight: 150,
        foldData: (() => {
          const verticesCoords: [number, number][] = [];
          verticesCoords.push([0, 0]); // 0: center

          const numSpokes = 20;
          const numRings = 4;
          const radii = [14, 28, 44, 60];
          const boundaryR = 75;

          for (let r = 0; r <= numRings; r++) {
            const radius = r < numRings ? radii[r] : boundaryR;
            for (let s = 0; s < numSpokes; s++) {
              const angle = (s / numSpokes) * 2 * Math.PI - Math.PI / 2;
              verticesCoords.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
            }
          }

          const facesVertices: number[][] = [];
          for (let s = 0; s < numSpokes; s++) {
            const nextS = (s + 1) % numSpokes;
            facesVertices.push([0, 1 + s, 1 + nextS]);
          }

          for (let r = 0; r < numRings; r++) {
            for (let s = 0; s < numSpokes; s++) {
              const nextS = (s + 1) % numSpokes;
              const currRingStart = 1 + r * numSpokes;
              const nextRingStart = 1 + (r + 1) * numSpokes;
              facesVertices.push([
                currRingStart + s,
                nextRingStart + s,
                nextRingStart + nextS,
                currRingStart + nextS
              ]);
            }
          }

          const internalFolds: Record<string, { assignment: 'M' | 'V' | 'F'; foldAngle: number }> = {};
          for (let r = 0; r < numRings; r++) {
            const assignment = r % 2 === 0 ? "M" : "V";
            const foldAngle = r % 2 === 0 ? -70 : 70;
            const ringStart = 1 + r * numSpokes;
            for (let s = 0; s < numSpokes; s++) {
              const nextS = (s + 1) % numSpokes;
              const v1 = ringStart + s;
              const v2 = ringStart + nextS;
              internalFolds[`${v1}-${v2}`] = { assignment, foldAngle };
            }
          }

          return buildFoldData(verticesCoords, facesVertices, internalFolds);
        })()
      },
      {
        id: "sine-waves",
        label: "Sine Waves",
        description: "Parallel sinusoidal fold lines creating an undulating surface",
        paperWidth: 150,
        paperHeight: 150,
        foldData: (() => {
          const verticesCoords: [number, number][] = [];
          const N = 20;
          const numWaves = 4;
          const amp = 8;
          const freq = 2;
          const numRows = numWaves + 2;
          const rowSpacing = 150 / (numWaves + 1);

          for (let r = 0; r < numRows; r++) {
            for (let c = 0; c <= N; c++) {
              const x = -75 + (c / N) * 150;
              const baseY = -75 + r * rowSpacing;
              let y = baseY;
              if (r > 0 && r < numRows - 1) {
                const phase = r % 2 === 0 ? 0 : Math.PI;
                y += amp * Math.sin(freq * 2 * Math.PI * c / N + phase);
              }
              verticesCoords.push([x, y]);
            }
          }

          const facesVertices: number[][] = [];
          for (let r = 0; r < numRows - 1; r++) {
            for (let c = 0; c < N; c++) {
              const topLeft = r * (N + 1) + c;
              const topRight = topLeft + 1;
              const bottomLeft = (r + 1) * (N + 1) + c;
              const bottomRight = bottomLeft + 1;
              facesVertices.push([topLeft, topRight, bottomRight, bottomLeft]);
            }
          }

          const internalFolds: Record<string, { assignment: 'M' | 'V' | 'F'; foldAngle: number }> = {};
          for (let r = 1; r < numRows - 1; r++) {
            const assignment = r % 2 !== 0 ? "M" : "V";
            const foldAngle = r % 2 !== 0 ? -50 : 50;
            for (let c = 0; c < N; c++) {
              const v1 = r * (N + 1) + c;
              const v2 = v1 + 1;
              internalFolds[`${v1}-${v2}`] = { assignment, foldAngle };
            }
          }

          return buildFoldData(verticesCoords, facesVertices, internalFolds);
        })()
      }
    ]
  }
];

function OrigamiPreview({ foldData }: { foldData: FoldData }) {
  const viewBox = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    foldData.verticesCoords.forEach(v => {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    });
    const pad = 10;
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  }, [foldData]);

  return (
    <svg viewBox={viewBox} className={styles.svgPreview}>
      {foldData.edgesVertices.map((edge, i) => {
        const v1 = foldData.verticesCoords[edge[0]];
        const v2 = foldData.verticesCoords[edge[1]];
        const assignment = foldData.edgesAssignment[i];

        let stroke = "#FF00FF"; // Border / Cut
        let strokeDasharray = "none";

        if (assignment === 'M') {
          stroke = "#0055FF";
          strokeDasharray = "6 2";
        } else if (assignment === 'V') {
          stroke = "#00AA44";
          strokeDasharray = "3 2 1 2";
        } else if (assignment === 'F') {
          stroke = "#999999";
          strokeDasharray = "1 3";
        }

        return (
          <line
            key={i}
            x1={v1[0]} y1={v1[1]}
            x2={v2[0]} y2={v2[1]}
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray={strokeDasharray}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

export interface OrigamiTemplateLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: { paperWidth: number; paperHeight: number; foldData: FoldData }) => void;
}

export function OrigamiTemplateLibrary({ open, onClose, onSelect }: OrigamiTemplateLibraryProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Origami Template Library</DialogTitle>
          <DialogDescription>
            Select a crease pattern template. Fold lines can be modified afterwards in the studio.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.scrollArea}>
          {ORIGAMI_CATEGORIES.map((categoryDef) => (
            <div key={categoryDef.category}>
              <h3 className={styles.categoryTitle}>{categoryDef.category}</h3>
              <div className={styles.grid}>
                {categoryDef.templates.map((template) => {
                  return (
                    <div
                      key={template.id}
                      className={styles.card}
                      onClick={() => {
                        onSelect({
                          paperWidth: template.paperWidth,
                          paperHeight: template.paperHeight,
                          foldData: template.foldData
                        });
                        onClose();
                      }}
                    >
                      <div className={styles.cardPreview}>
                        <OrigamiPreview foldData={template.foldData} />
                      </div>
                      <div className={styles.cardTitleArea}>
                        <span className={styles.cardTitle}>{template.label}</span>
                        <span className={styles.cardDescription}>{template.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}