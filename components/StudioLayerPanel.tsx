import React, { useState } from "react";
import {
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Layers,
  FlipHorizontal2,
  Copy,
  GripVertical,
} from "lucide-react";
import { Button } from "./Button";
import { Slider } from "./Slider";
import { Input } from "./Input";
import type { ArtworkLayer } from "../helpers/useArtworkLayers";
import { StudioMaterialControls } from "./StudioMaterialControls";
import styles from "./StudioLayerPanel.module.css";

export interface StudioLayerPanelProps {
  layers: ArtworkLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onRemoveLayer: (id: string) => void;
  onUpdateLayer: (id: string, updates: Partial<ArtworkLayer>) => void;
  onDuplicateLayer: (id: string) => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  vectorLocked: boolean;
  onVectorLockedChange: (locked: boolean) => void;
  isVerso: boolean;
  onVersoChange: (v: boolean) => void;
  onImportImage: () => void;
  materialType: string;
  exteriorColor: string;
  interiorColor: string;
  onMaterialPresetChange: (presetKey: string) => void;
  onExteriorColorChange: (color: string) => void;
  onInteriorColorChange: (color: string) => void;
}

export function StudioLayerPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onRemoveLayer,
  onUpdateLayer,
  onDuplicateLayer,
  onReorderLayers,
  vectorLocked,
  onVectorLockedChange,
  isVerso,
  onVersoChange,
  onImportImage,
  materialType,
  exteriorColor,
  interiorColor,
  onMaterialPresetChange,
  onExteriorColorChange,
  onInteriorColorChange,
}: StudioLayerPanelProps) {
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleScaleChange = (scale: number) => {
    if (!selectedLayer) return;
    const newWidth = selectedLayer.refWidth * scale;
    const newHeight = selectedLayer.refHeight * scale;

    // Adjust X/Y to keep the transform centered on the previous center point
    const cx = selectedLayer.x + selectedLayer.width / 2;
    const cy = selectedLayer.y + selectedLayer.height / 2;

    onUpdateLayer(selectedLayer.id, {
      width: newWidth,
      height: newHeight,
      x: cx - newWidth / 2,
      y: cy - newHeight / 2,
    });
  };

  const handleRotationChange = (rot: number) => {
    if (!selectedLayer) return;
    onUpdateLayer(selectedLayer.id, { rotation: rot });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Layers</h3>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onImportImage}
          title="Import image"
          className={styles.importButton}
        >
          <Plus size={14} />
        </Button>
      </div>

      <div className={styles.layerList}>
        {/* Render layers in reverse so the topmost visual layer appears first in the list */}
        {[...layers].reverse().map((layer, reversedIndex) => {
          const isSelected = layer.id === selectedLayerId;
          const realIndex = layers.length - 1 - reversedIndex;
          const isDragOver = dragOverIndex === realIndex;
          
          return (
            <div
              key={layer.id}
              draggable
              onDragStart={(e) => {
                setDraggedIndex(realIndex);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(realIndex);
              }}
              onDragLeave={() => {
                if (dragOverIndex === realIndex) setDragOverIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== realIndex) {
                  onReorderLayers(draggedIndex, realIndex);
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              className={`${styles.layerRow} ${isSelected ? styles.selected : ""} ${isDragOver ? styles.dragOver : ""}`}
              onClick={() => onSelectLayer(layer.id)}
            >
              <div className={styles.dragHandle}>
                <GripVertical size={14} />
              </div>
              <button
                type="button"
                className={styles.iconButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateLayer(layer.id, { visible: !layer.visible });
                }}
              >
                {layer.visible ? (
                  <Eye size={14} />
                ) : (
                  <EyeOff size={14} className={styles.muted} />
                )}
              </button>

              <span className={styles.layerName} title={layer.name}>
                {layer.name}
              </span>

              <button
                type="button"
                className={styles.iconButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateLayer(layer.id, { locked: !layer.locked });
                }}
              >
                {layer.locked ? (
                  <Lock size={14} />
                ) : (
                  <Unlock size={14} className={styles.muted} />
                )}
              </button>

              <button
                type="button"
                className={styles.iconButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateLayer(layer.id);
                }}
                title="Duplicate"
              >
                <Copy size={14} />
              </button>

              <button
                type="button"
                className={`${styles.iconButton} ${styles.destructive}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveLayer(layer.id);
                }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        {/* Vectors row (Fixed at bottom) */}
        <div className={styles.layerRow}>
          <div className={styles.iconSpacer} />
          <div className={styles.iconSpacer}>
            <Layers size={14} />
          </div>
          <span className={styles.layerName}>Vectors</span>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onVectorLockedChange(!vectorLocked)}
          >
            {vectorLocked ? (
              <Lock size={14} />
            ) : (
              <Unlock size={14} className={styles.muted} />
            )}
          </button>
          <div className={styles.iconSpacer} />
          <div className={styles.iconSpacer} />
        </div>
      </div>

      {selectedLayer && (
        <div className={styles.controls}>
          <div className={styles.paramGroup}>
            <label className={styles.paramLabel}>Scale</label>
            <div className={styles.paramInputRow}>
              <Slider
                min={0.1}
                max={5}
                step={0.1}
                value={[selectedLayer.width / selectedLayer.refWidth]}
                onValueChange={(vals) => handleScaleChange(vals[0])}
                className={styles.slider}
              />
              <Input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={(selectedLayer.width / selectedLayer.refWidth).toFixed(2)}
                onChange={(e) =>
                  handleScaleChange(parseFloat(e.target.value) || 1)
                }
                className={styles.numberInput}
              />
            </div>
          </div>

          <div className={styles.paramGroup}>
            <label className={styles.paramLabel}>Rotation (°)</label>
            <div className={styles.paramInputRow}>
              <Slider
                min={-180}
                max={180}
                step={1}
                value={[selectedLayer.rotation]}
                onValueChange={(vals) => handleRotationChange(vals[0])}
                className={styles.slider}
              />
              <Input
                type="number"
                min={-180}
                max={180}
                step={1}
                value={selectedLayer.rotation.toString()}
                onChange={(e) =>
                  handleRotationChange(parseFloat(e.target.value) || 0)
                }
                className={styles.numberInput}
              />
            </div>
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <Button
          variant={isVerso ? "primary" : "outline"}
          className={styles.versoButton}
          onClick={() => onVersoChange(!isVerso)}
        >
          <FlipHorizontal2 size={16} />
          {isVerso ? "Back View" : "Front View"}
        </Button>
      </div>

      <StudioMaterialControls
        materialType={materialType}
        exteriorColor={exteriorColor}
        interiorColor={interiorColor}
        onMaterialPresetChange={onMaterialPresetChange}
        onExteriorColorChange={onExteriorColorChange}
        onInteriorColorChange={onInteriorColorChange}
      />
    </div>
  );
}