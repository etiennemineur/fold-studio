import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import { generateShapeFoldData, ShapeType } from "../helpers/foldEngine";
import styles from "./TemplateLibrary.module.css";

const CATEGORIES: { title: string, shapes: { id: ShapeType, label: string }[] }[] = [
  {
    title: "Classic Boxes",
    shapes: [
      { id: "box", label: "Box" },
      { id: "tray", label: "Tray" },
      { id: "sleeve", label: "Sleeve" }
    ]
  },
  {
    title: "Polygonal Shapes",
    shapes: [
      { id: "hexagonal", label: "Hexagonal Box" },
      { id: "triangular", label: "Triangular Box" },
      { id: "octagonal", label: "Octagonal Box" },
      { id: "pentagonal", label: "Pentagonal Box" },
      { id: "pyramid", label: "Pyramid" }
    ]
  },
  {
    title: "Specialty Packaging",
    shapes: [
      { id: "mailer", label: "Mailer" },
      { id: "tuckEnd", label: "Tuck-End Box" },
      { id: "display", label: "Display Box" },
      { id: "flipTop", label: "Flip-Top Box" },
      { id: "gable", label: "Gable Box" },
      { id: "sealEnd", label: "Seal End Box" },
      { id: "snapLock", label: "Snap-Lock Tray" }
    ]
  },
  {
    title: "Curved Folds",
    shapes: [
      { id: "concentricRings", label: "Concentric Rings" },
      { id: "sineWaves", label: "Sine Waves" }
    ]
  }
];

function ShapePreview({ shape }: { shape: ShapeType }) {
  const defaultParams = { width: 60, height: 40, depth: 30, glueTabSize: 8, materialThickness: 0, bleedSize: 0 };
  const foldData = useMemo(() => generateShapeFoldData(shape, defaultParams, { skipDoubleScoring: true }), [shape]);
  
  const viewBox = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    foldData.verticesCoords.forEach(v => {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    });
    const pad = 10;
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad*2} ${maxY - minY + pad*2}`;
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

export interface TemplateLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (shapeType: ShapeType) => void;
  currentShape?: ShapeType;
}

export function TemplateLibrary({ open, onClose, onSelect, currentShape }: TemplateLibraryProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>Template Library</DialogTitle>
          <DialogDescription>
            Select a base shape for your packaging. Dimensions can be adjusted afterwards in the studio.
          </DialogDescription>
        </DialogHeader>
        
        <div className={styles.scrollArea}>
          {CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className={styles.categoryTitle}>{category.title}</h3>
              <div className={styles.grid}>
                {category.shapes.map((shape) => {
                  const isActive = currentShape === shape.id;
                  return (
                    <div 
                      key={shape.id} 
                      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
                      onClick={() => {
                        onSelect(shape.id);
                        onClose();
                      }}
                    >
                      <div className={styles.cardPreview}>
                        <ShapePreview shape={shape.id} />
                      </div>
                      <div className={styles.cardTitleArea}>
                        <span className={styles.cardTitle}>{shape.label}</span>
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