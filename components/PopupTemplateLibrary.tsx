import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import {
  PopupDocument,
  createDefaultPopupDocument,
  addMechanism,
  getPopupPatternFoldData,
} from "../helpers/popupDocument";
import { solvePopupKinematics } from "../helpers/popupKinematicSolver";
import styles from "./PopupTemplateLibrary.module.css";

export interface PopupTemplateDef {
  id: string;
  label: string;
  description: string;
  family: string;
  document: PopupDocument;
}

interface CategoryDef {
  category: string;
  description: string;
  templates: PopupTemplateDef[];
}

function makeDocument(
  bookWidth: number,
  bookHeight: number,
  mechanisms: Array<{
    type: Parameters<typeof addMechanism>[1];
    params: Parameters<typeof addMechanism>[2];
  }>,
): PopupDocument {
  return mechanisms.reduce(
    (doc, mechanism) => addMechanism(doc, mechanism.type, mechanism.params),
    createDefaultPopupDocument(bookWidth, bookHeight),
  );
}

export const POPUP_CATEGORIES: CategoryDef[] = [
  {
    category: "Classic mechanisms",
    description: "Fundamental one-degree-of-freedom pop-up structures.",
    templates: [
      {
        id: "classic-symmetric-v",
        label: "Symmetric V-Fold",
        family: "V-fold",
        description: "The standard triangular lift, centered on the book spine.",
        document: makeDocument(130, 180, [
          { type: "v-fold", params: { positionY: 62, height: 42, vAngle: 45, foldDirection: "up" } },
        ]),
      },
      {
        id: "classic-asymmetric-v",
        label: "Asymmetric V-Fold",
        family: "V-fold",
        description: "Unequal arms create an oblique and more dynamic opening.",
        document: makeDocument(135, 185, [
          { type: "v-fold-asymmetric", params: { positionY: 64, height: 44, armLengthLeft: 48, armLengthRight: 28, foldDirection: "up" } },
        ]),
      },
      {
        id: "classic-reverse-v",
        label: "Reverse V-Fold",
        family: "V-fold",
        description: "A downward V-fold for recessed shapes and mouths.",
        document: makeDocument(130, 180, [
          { type: "v-fold", params: { positionY: 64, height: 40, vAngle: 42, foldDirection: "down" } },
        ]),
      },
      {
        id: "classic-parallel-step",
        label: "Parallel Step",
        family: "Parallel fold",
        description: "The classic rectangular step cut parallel to the spine.",
        document: makeDocument(130, 180, [
          { type: "parallel-fold", params: { positionY: 62, width: 52, height: 28, foldDirection: "up" } },
        ]),
      },
      {
        id: "classic-floating-platform",
        label: "Floating Platform",
        family: "Platform",
        description: "Four articulated panels form a stable raised display surface.",
        document: makeDocument(145, 195, [
          { type: "platform", params: { positionY: 66, width: 58, height: 24, depth: 40, foldDirection: "up" } },
        ]),
      },
      {
        id: "classic-tunnel-box",
        label: "Tunnel Box",
        family: "Box fold",
        description: "Six articulated panels create a compact box-like tunnel.",
        document: makeDocument(150, 200, [
          { type: "box", params: { positionY: 68, width: 58, height: 20, depth: 40, foldDirection: "up" } },
        ]),
      },
    ],
  },
  {
    category: "Cards and expressive folds",
    description: "Recognizable constructions used in greeting cards and illustration.",
    templates: [
      {
        id: "classic-mouth",
        label: "Beak / Mouth",
        family: "Opposed V-folds",
        description: "Two opposite V-folds produce a classic opening mouth.",
        document: makeDocument(140, 195, [
          { type: "v-fold", params: { positionY: 58, height: 30, vAngle: 42, foldDirection: "up" } },
          { type: "v-fold", params: { positionY: 94, height: 30, vAngle: 42, foldDirection: "down" } },
        ]),
      },
      {
        id: "butterfly-wings",
        label: "Butterfly Wings",
        family: "Asymmetric V-folds",
        description: "Two offset asymmetric folds create a paired wing movement.",
        document: makeDocument(150, 210, [
          { type: "v-fold-asymmetric", params: { positionY: 42, height: 42, armLengthLeft: 46, armLengthRight: 24, foldDirection: "up" } },
          { type: "v-fold-asymmetric", params: { positionY: 116, height: 42, armLengthLeft: 24, armLengthRight: 46, foldDirection: "up" } },
        ]),
      },
      {
        id: "double-step-card",
        label: "Double Step",
        family: "Parallel folds",
        description: "Two independent levels for lettering, figures or scenery.",
        document: makeDocument(145, 205, [
          { type: "parallel-fold", params: { positionY: 42, width: 42, height: 20, foldDirection: "up" } },
          { type: "parallel-fold", params: { positionY: 118, width: 44, height: 32, foldDirection: "up" } },
        ]),
      },
      {
        id: "three-step-staircase",
        label: "Three-Level Staircase",
        family: "Parallel folds",
        description: "Three increasingly deep steps form a classical staircase.",
        document: makeDocument(155, 225, [
          { type: "parallel-fold", params: { positionY: 28, width: 34, height: 14, foldDirection: "up" } },
          { type: "parallel-fold", params: { positionY: 86, width: 36, height: 24, foldDirection: "up" } },
          { type: "parallel-fold", params: { positionY: 148, width: 38, height: 34, foldDirection: "up" } },
        ]),
      },
      {
        id: "layered-stage",
        label: "Layered Stage",
        family: "Platform + V-fold",
        description: "A platform carries the main subject while a V-fold forms the backdrop.",
        document: makeDocument(160, 225, [
          { type: "v-fold", params: { positionY: 34, height: 38, vAngle: 38, foldDirection: "up" } },
          { type: "platform", params: { positionY: 118, width: 56, height: 22, depth: 36, foldDirection: "up" } },
        ]),
      },
      {
        id: "city-block",
        label: "City Block",
        family: "Box + steps",
        description: "A tunnel box and two steps create an architectural scene.",
        document: makeDocument(170, 240, [
          { type: "parallel-fold", params: { positionY: 24, width: 34, height: 16, foldDirection: "up" } },
          { type: "box", params: { positionY: 82, width: 56, height: 22, depth: 40, foldDirection: "up" } },
          { type: "parallel-fold", params: { positionY: 170, width: 36, height: 26, foldDirection: "up" } },
        ]),
      },
    ],
  },
  {
    category: "Display and scenic structures",
    description: "Layered compositions for exhibits, products and narrative scenes.",
    templates: [
      {
        id: "center-pedestal",
        label: "Center Pedestal",
        family: "Platform + box",
        description: "A raised platform and compact tunnel form a central display plinth.",
        document: makeDocument(170, 235, [
          { type: "platform", params: { positionY: 42, width: 52, height: 20, depth: 36, foldDirection: "up" } },
          { type: "box", params: { positionY: 132, width: 50, height: 18, depth: 40, foldDirection: "up" } },
        ]),
      },
      {
        id: "triple-v-fan",
        label: "Triple V-Fan",
        family: "V-fold sequence",
        description: "Three V-folds with changing angles create a fan-like deployment.",
        document: makeDocument(165, 235, [
          { type: "v-fold", params: { positionY: 28, height: 32, vAngle: 32, foldDirection: "up" } },
          { type: "v-fold", params: { positionY: 88, height: 38, vAngle: 45, foldDirection: "up" } },
          { type: "v-fold", params: { positionY: 158, height: 32, vAngle: 58, foldDirection: "up" } },
        ]),
      },
      {
        id: "exhibition-stage",
        label: "Exhibition Stage",
        family: "Mixed mechanisms",
        description: "Steps, a platform and a V-fold create a complete display scene.",
        document: makeDocument(180, 255, [
          { type: "parallel-fold", params: { positionY: 22, width: 34, height: 16, foldDirection: "up" } },
          { type: "platform", params: { positionY: 82, width: 58, height: 24, depth: 38, foldDirection: "up" } },
          { type: "v-fold", params: { positionY: 174, height: 38, vAngle: 42, foldDirection: "up" } },
        ]),
      },
      {
        id: "recessed-window",
        label: "Recessed Window",
        family: "Opposed V-folds",
        description: "A recessed V-fold and an outward V-fold create foreground depth.",
        document: makeDocument(165, 230, [
          { type: "v-fold", params: { positionY: 46, height: 34, vAngle: 38, foldDirection: "down" } },
          { type: "v-fold", params: { positionY: 142, height: 34, vAngle: 42, foldDirection: "up" } },
        ]),
      },
    ],
  },
];

function PatternPreview({ document }: { document: PopupDocument }) {
  const foldData = useMemo(() => getPopupPatternFoldData(document), [document]);

  const viewBox = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    foldData.verticesCoords.forEach((vertex) => {
      minX = Math.min(minX, vertex[0]);
      maxX = Math.max(maxX, vertex[0]);
      minY = Math.min(minY, vertex[1]);
      maxY = Math.max(maxY, vertex[1]);
    });
    const pad = 10;
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  }, [foldData]);

  return (
    <svg viewBox={viewBox} className={styles.svgPreview} aria-label="Flat crease pattern">
      {foldData.edgesVertices.map((edge, index) => {
        const v1 = foldData.verticesCoords[edge[0]];
        const v2 = foldData.verticesCoords[edge[1]];
        const assignment = foldData.edgesAssignment[index];
        let stroke = "#FF00FF";
        let strokeDasharray = "none";

        if (assignment === "M") {
          stroke = "#0055FF";
          strokeDasharray = "6 2";
        } else if (assignment === "V") {
          stroke = "#00AA44";
          strokeDasharray = "3 2 1 2";
        } else if (assignment === "F") {
          stroke = "#A3A3A3";
          strokeDasharray = "1 3";
        }

        return (
          <line
            key={index}
            x1={v1[0]}
            y1={v1[1]}
            x2={v2[0]}
            y2={v2[1]}
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

function FoldedPreview({ document }: { document: PopupDocument }) {
  const preview = useMemo(() => {
    const { foldData, vertexMap } = solvePopupKinematics(document, 95);
    const polygons = foldData.facesVertices.map((face, faceIndex) => {
      const points = face.map((vertexIndex) => {
        const [x, y, z] = vertexMap.get(vertexIndex) || [0, 0, 0];
        return [x + z * 0.55, y - z * 0.3] as [number, number];
      });
      return {
        points,
        isCover: faceIndex >= foldData.facesVertices.length - 2,
      };
    });

    const allPoints = polygons.flatMap((polygon) => polygon.points);
    const minX = Math.min(...allPoints.map((point) => point[0]));
    const maxX = Math.max(...allPoints.map((point) => point[0]));
    const minY = Math.min(...allPoints.map((point) => point[1]));
    const maxY = Math.max(...allPoints.map((point) => point[1]));
    const pad = 12;

    return {
      polygons,
      viewBox: `${minX - pad} ${minY - pad} ${Math.max(1, maxX - minX) + pad * 2} ${Math.max(1, maxY - minY) + pad * 2}`,
    };
  }, [document]);

  return (
    <svg viewBox={preview.viewBox} className={styles.svgPreview} aria-label="Half-open pop-up preview">
      {preview.polygons.map((polygon, index) => (
        <polygon
          key={index}
          points={polygon.points.map((point) => point.join(",")).join(" ")}
          className={polygon.isCover ? styles.coverPolygon : styles.mechanismPolygon}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

export interface PopupTemplateLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (doc: PopupDocument) => void;
}

export function PopupTemplateLibrary({ open, onClose, onSelect }: PopupTemplateLibraryProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Classic Pop-Up Template Library</DialogTitle>
          <DialogDescription>
            Each card compares the flat cutting and crease pattern with the same mechanism half-open at 95°.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.legend}>
          <span><i className={styles.cutLegend} />Cut</span>
          <span><i className={styles.mountainLegend} />Mountain</span>
          <span><i className={styles.valleyLegend} />Valley</span>
        </div>

        <div className={styles.scrollArea}>
          {POPUP_CATEGORIES.map((categoryDef) => (
            <section key={categoryDef.category} className={styles.categorySection}>
              <div className={styles.categoryHeader}>
                <h3 className={styles.categoryTitle}>{categoryDef.category}</h3>
                <p className={styles.categoryDescription}>{categoryDef.description}</p>
              </div>
              <div className={styles.grid}>
                {categoryDef.templates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className={styles.card}
                    onClick={() => {
                      onSelect(JSON.parse(JSON.stringify(template.document)) as PopupDocument);
                      onClose();
                    }}
                  >
                    <div className={styles.cardPreview}>
                      <div className={styles.previewCell}>
                        <span className={styles.previewLabel}>Flat pattern</span>
                        <PatternPreview document={template.document} />
                      </div>
                      <div className={styles.previewDivider} />
                      <div className={styles.previewCell}>
                        <span className={styles.previewLabel}>Half-open</span>
                        <FoldedPreview document={template.document} />
                      </div>
                    </div>
                    <div className={styles.cardTitleArea}>
                      <div className={styles.cardTitleRow}>
                        <span className={styles.cardTitle}>{template.label}</span>
                        <span className={styles.familyTag}>{template.family}</span>
                      </div>
                      <span className={styles.cardDescription}>{template.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
