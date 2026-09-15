import React from "react";
import { FoldData } from "../helpers/foldEngine";
import { Button } from "./Button";
import styles from "./StudioSelectionControls.module.css";

export interface StudioSelectionControlsProps {
  foldData: FoldData | null;
  selectedFaceIndex: number | null;
  selectedEdgeIndex: number | null;
  onSetEdgeAssignment: (assignment: "M" | "V") => void;
}

export function StudioSelectionControls({
  foldData,
  selectedFaceIndex,
  selectedEdgeIndex,
  onSetEdgeAssignment,
}: StudioSelectionControlsProps) {
  const assignment = selectedEdgeIndex === null
    ? null
    : foldData?.edgesAssignment[selectedEdgeIndex] ?? null;

  if (selectedFaceIndex === null && selectedEdgeIndex === null) return null;

  return (
    <div className={styles.container} aria-label="Current 2D selection">
      {selectedFaceIndex !== null && (
        <span className={styles.selectionLabel}>FACE {selectedFaceIndex + 1}</span>
      )}

      {selectedEdgeIndex !== null && (
        <>
          <span className={styles.selectionLabel}>FOLD {selectedEdgeIndex + 1}</span>
          {assignment === "M" || assignment === "V" ? (
            <div className={styles.foldButtons}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${styles.foldButton} ${assignment === "M" ? styles.mountainActive : ""}`}
                onClick={() => onSetEdgeAssignment("M")}
                title="Set selected fold to Mountain"
              >
                Mountain
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`${styles.foldButton} ${assignment === "V" ? styles.valleyActive : ""}`}
                onClick={() => onSetEdgeAssignment("V")}
                title="Set selected fold to Valley"
              >
                Valley
              </Button>
            </div>
          ) : (
            <span className={styles.edgeType}>{assignment === "B" ? "CUT" : "FLAT"}</span>
          )}
        </>
      )}
    </div>
  );
}