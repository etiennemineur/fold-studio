import React from "react";
import styles from "./StudioScaleBar.module.css";

export function StudioScaleBar({
  scaleBarInfo,
  activeVB,
  svgPixelWidth
}: {
  scaleBarInfo: { length: number; label: string } | null;
  activeVB: { w: number };
  svgPixelWidth: number;
}) {
  if (!scaleBarInfo || svgPixelWidth === 0 || activeVB.w === 0) return null;

  const pxWidth = (scaleBarInfo.length / activeVB.w) * svgPixelWidth;

  return (
    <div className={styles.scaleBar}>
      <div className={styles.label}>{scaleBarInfo.label}</div>
      <div className={styles.trackWrapper}>
        <div className={styles.track} style={{ width: pxWidth }}>
          <div className={`${styles.tick} ${styles.tickLeft}`} />
          {scaleBarInfo.length >= 2 && <div className={styles.tickMiddle} />}
          <div className={`${styles.tick} ${styles.tickRight}`} />
        </div>
      </div>
    </div>
  );
}