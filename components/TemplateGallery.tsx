import React, { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { ShapeType, generateShapeFoldData } from "../helpers/foldEngine";
import { dielineExporter } from "../helpers/dielineExporter";
import { Button } from "./Button";
import styles from "./TemplateGallery.module.css";

const CATEGORIES: { title: string; shapes: { id: ShapeType; label: string }[] }[] = [
  {
    title: "Classic Boxes",
    shapes: [
      { id: "box", label: "Box" },
      { id: "tray", label: "Tray" },
      { id: "sleeve", label: "Sleeve" },
    ],
  },
  {
    title: "Polygonal Shapes",
    shapes: [
      { id: "hexagonal", label: "Hexagonal Box" },
      { id: "triangular", label: "Triangular Box" },
      { id: "octagonal", label: "Octagonal Box" },
      { id: "pentagonal", label: "Pentagonal Box" },
      { id: "pyramid", label: "Pyramid" },
    ],
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
      { id: "snapLock", label: "Snap-Lock Tray" },
    ],
  },
];

function ShapePreview({ shape }: { shape: ShapeType }) {
  const defaultParams = { width: 60, height: 40, depth: 30, glueTabSize: 8, materialThickness: 0, bleedSize: 0 };
  const foldData = useMemo(() => generateShapeFoldData(shape, defaultParams, { skipDoubleScoring: true }), [shape]);

  const viewBox = useMemo(() => {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    foldData.verticesCoords.forEach((v) => {
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

        if (assignment === "M") {
          stroke = "#0055FF";
          strokeDasharray = "6 2";
        } else if (assignment === "V") {
          stroke = "#00AA44";
          strokeDasharray = "3 2 1 2";
        } else if (assignment === "F") {
          stroke = "#999999";
          strokeDasharray = "1 3";
        }

        return (
          <line
            key={i}
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

function ShapeCard({ shape }: { shape: { id: ShapeType; label: string } }) {
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [downloadingSVG, setDownloadingSVG] = useState(false);

  const handleDownloadPDF = async () => {
    setDownloadingPDF(true);
    try {
      const params = { width: 100, height: 60, depth: 40, glueTabSize: 15, materialThickness: 0, bleedSize: 3 };
      const foldData = generateShapeFoldData(shape.id, params, { skipDoubleScoring: true });
      const blob = await dielineExporter.exportDielinePDF(foldData, params, shape.label);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${shape.label.replace(/\s+/g, "_").toLowerCase()}-dieline.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to generate PDF");
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadSVG = async () => {
    setDownloadingSVG(true);
    try {
      const params = { width: 100, height: 60, depth: 40, glueTabSize: 15, materialThickness: 0, bleedSize: 3 };
      const foldData = generateShapeFoldData(shape.id, params, { skipDoubleScoring: true });
      const svgStr = await dielineExporter.exportDielineSVG(foldData, params, shape.label);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${shape.label.replace(/\s+/g, "_").toLowerCase()}-dieline.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to generate SVG");
    } finally {
      setDownloadingSVG(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardPreview}>
        <ShapePreview shape={shape.id} />
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.cardTitle}>{shape.label}</span>
        <div className={styles.cardActions}>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            title="Download PDF"
          >
            {downloadingPDF ? <span className={styles.spinner} /> : <span className={styles.downloadLabel}>PDF</span>}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleDownloadSVG}
            disabled={downloadingSVG}
            title="Download SVG"
          >
            {downloadingSVG ? <span className={styles.spinner} /> : <span className={styles.downloadLabel}>SVG</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TemplateGallery() {
  return (
    <section className={styles.gallerySection}>
      <div className={styles.galleryHeader}>
        <h2 className={styles.galleryTitle}>Template Library</h2>
        <p className={styles.gallerySubtitle}>
          Download structural templates as PDF or SVG to modify and re-import
        </p>
      </div>

      <div className={styles.galleryContent}>
        {CATEGORIES.map((category) => (
          <div key={category.title} className={styles.categoryBlock}>
            <h3 className={styles.categoryTitle}>{category.title}</h3>
            <div className={styles.grid}>
              {category.shapes.map((shape) => (
                <ShapeCard key={shape.id} shape={shape} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}