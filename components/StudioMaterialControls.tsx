import React from "react";
import { Input } from "./Input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { MATERIAL_PRESETS } from "../helpers/useArtworkLayers";
import styles from "./StudioMaterialControls.module.css";

export interface StudioMaterialControlsProps {
  materialType: string;
  exteriorColor: string;
  interiorColor: string;
  onMaterialPresetChange: (presetKey: string) => void;
  onExteriorColorChange: (color: string) => void;
  onInteriorColorChange: (color: string) => void;
}

export function StudioMaterialControls({
  materialType,
  exteriorColor,
  interiorColor,
  onMaterialPresetChange,
  onExteriorColorChange,
  onInteriorColorChange,
}: StudioMaterialControlsProps) {
  return (
    <section className={styles.section}>
      <h3 className={styles.title}>Material</h3>

      <div className={styles.paramGroup}>
        <label className={styles.paramLabel}>Material Type</label>
        <Select value={materialType} onValueChange={onMaterialPresetChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                <SelectItem key={key} value={key}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className={styles.paramGroup}>
        <label className={styles.paramLabel}>Exterior Color</label>
        <div className={styles.colorRow}>
          <input
            type="color"
            value={exteriorColor}
            onChange={(event) => onExteriorColorChange(event.target.value)}
            className={styles.colorPicker}
          />
          <Input
            type="text"
            value={exteriorColor}
            onChange={(event) => onExteriorColorChange(event.target.value)}
            className={styles.colorHexInput}
          />
        </div>
      </div>

      <div className={styles.paramGroup}>
        <label className={styles.paramLabel}>Interior Color</label>
        <div className={styles.colorRow}>
          <input
            type="color"
            value={interiorColor}
            onChange={(event) => onInteriorColorChange(event.target.value)}
            className={styles.colorPicker}
          />
          <Input
            type="text"
            value={interiorColor}
            onChange={(event) => onInteriorColorChange(event.target.value)}
            className={styles.colorHexInput}
          />
        </div>
      </div>
    </section>
  );
}