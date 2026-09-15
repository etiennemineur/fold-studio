import React, { useState } from "react";
import { FoldData } from "../helpers/foldEngine";

import { 
  Sparkles, 
  Trash2, 
  PenTool, 
  Download, 
  ChevronRight,
  ChevronDown,
  LayoutGrid
} from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "./Select";
import { Slider } from "./Slider";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./Collapsible";
import { Textarea } from "./Textarea";
import { Spinner } from "./Spinner";
import { StudioMaterialControls } from "./StudioMaterialControls";
import styles from "./StudioOrigamiSidebar.module.css";

export interface StudioOrigamiSidebarProps {
  studioMode: 'packaging' | 'origami' | 'popup' | 'spirogami';
  // Paper settings
  paperShape: 'square' | 'rectangle' | 'a4' | 'custom';
  onPaperShapeChange: (shape: 'square' | 'rectangle' | 'a4' | 'custom') => void;
  paperWidth: number;
  paperHeight: number;
  onPaperWidthChange: (w: number) => void;
  onPaperHeightChange: (h: number) => void;
  materialType: string;
  exteriorColor: string;
  interiorColor: string;
  onMaterialPresetChange: (presetKey: string) => void;
  onExteriorColorChange: (color: string) => void;
  onInteriorColorChange: (color: string) => void;
  // Fold tool
  foldToolActive: boolean;
  onFoldToolToggle: () => void;
  foldType: 'M' | 'V';
  onFoldTypeChange: (t: 'M' | 'V') => void;
  foldAngle: number;
  onFoldAngleChange: (a: number) => void;
  // Actions
  onClearAllFolds: () => void;
  onApplyAIPattern: (foldData: FoldData) => void;
  onShowTemplateLibrary: () => void;
  // Export
  onExportFold: () => void;
  onExportSVG: () => void;
  // Name
  name: string;
  onNameChange: (n: string) => void;
}

export function StudioOrigamiSidebar({
  studioMode,
  paperShape,
  onPaperShapeChange,
  paperWidth,
  paperHeight,
  onPaperWidthChange,
  onPaperHeightChange,
  materialType,
  exteriorColor,
  interiorColor,
  onMaterialPresetChange,
  onExteriorColorChange,
  onInteriorColorChange,
  foldToolActive,
  onFoldToolToggle,
  foldType,
  onFoldTypeChange,
  foldAngle,
  onFoldAngleChange,
  onClearAllFolds,
  onApplyAIPattern,
  onShowTemplateLibrary,
  onExportFold,
  onExportSVG,
  name,
  onNameChange,
}: StudioOrigamiSidebarProps) {
  const handleSquareSizeChange = (val: number) => {
    onPaperWidthChange(val);
    onPaperHeightChange(val);
  };

  const handleFoldTypeToggle = (type: 'M' | 'V') => {
    onFoldTypeChange(type);
    if (type === 'M') {
      onFoldAngleChange(-180);
    } else {
      onFoldAngleChange(180);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.viewHeader}>
        <Input 
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={styles.projectNameInput}
          placeholder="Project Name"
        />
      </div>

      <div className={styles.sidebarContent}>
        {studioMode === 'origami' && (
          <>
            <Button 
              variant="outline" 
              className={styles.fullWidthBtn}
              onClick={onShowTemplateLibrary}
            >
              <LayoutGrid size={14} style={{ marginRight: '8px' }} />
              Template Library
            </Button>
            
            {/* Paper Settings */}
            <div className={styles.sidebarSection}>
              <div className={styles.sectionTitle}>Paper Settings</div>
              
              <div className={styles.paramGroup}>
                <label className={styles.paramLabel}>Shape</label>
                <Select value={paperShape} onValueChange={(v) => onPaperShapeChange(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Shape" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                      <SelectItem value="a4">A4 (210×297)</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {paperShape === 'square' && (
                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>Size (mm)</label>
                  <div className={styles.paramInputRow}>
                    <Slider 
                      value={[paperWidth]} 
                      onValueChange={(v) => handleSquareSizeChange(v[0])} 
                      max={400} min={50} step={1}
                      className={styles.paramSlider}
                    />
                    <Input 
                      type="number" 
                      value={paperWidth}
                      onChange={(e) => handleSquareSizeChange(parseInt(e.target.value) || 50)}
                      className={styles.paramNumInput}
                    />
                  </div>
                </div>
              )}

              {(paperShape === 'rectangle' || paperShape === 'custom') && (
                <>
                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Width (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[paperWidth]} 
                        onValueChange={(v) => onPaperWidthChange(v[0])} 
                        max={400} min={50} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={paperWidth}
                        onChange={(e) => onPaperWidthChange(parseInt(e.target.value) || 50)}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>
                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Height (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[paperHeight]} 
                        onValueChange={(v) => onPaperHeightChange(v[0])} 
                        max={400} min={50} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={paperHeight}
                        onChange={(e) => onPaperHeightChange(parseInt(e.target.value) || 50)}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>
                </>
              )}

            </div>

            <StudioMaterialControls
              materialType={materialType}
              exteriorColor={exteriorColor}
              interiorColor={interiorColor}
              onMaterialPresetChange={onMaterialPresetChange}
              onExteriorColorChange={onExteriorColorChange}
              onInteriorColorChange={onInteriorColorChange}
            />

            <div className={styles.divider} />

            {/* Drawing Tools */}
            <div className={styles.sidebarSection}>
              <div className={styles.sectionTitle}>Drawing Tools</div>
              <Button 
                variant={foldToolActive ? "primary" : "outline"} 
                className={styles.fullWidthBtn}
                onClick={onFoldToolToggle}
              >
                <PenTool size={14} style={{ marginRight: '8px' }} />
                {foldToolActive ? "Drawing Active..." : "Draw Fold Line"}
              </Button>

              {foldToolActive && (
                <div className={styles.subTools}>
                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Fold Type</label>
                    <div className={styles.toggleRow}>
                      <button
                        className={`${styles.toggleBtn} ${styles.mountainBtn} ${foldType === 'M' ? styles.toggleBtnActive : ''}`}
                        onClick={() => handleFoldTypeToggle('M')}
                      >
                        Mountain
                      </button>
                      <button
                        className={`${styles.toggleBtn} ${styles.valleyBtn} ${foldType === 'V' ? styles.toggleBtnActive : ''}`}
                        onClick={() => handleFoldTypeToggle('V')}
                      >
                        Valley
                      </button>
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Target Angle (°)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[foldAngle]} 
                        onValueChange={(v) => onFoldAngleChange(v[0])} 
                        max={180} min={-180} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={foldAngle}
                        onChange={(e) => onFoldAngleChange(parseInt(e.target.value) || 0)}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                className={styles.fullWidthBtn}
                onClick={onClearAllFolds}
              >
                <Trash2 size={14} style={{ marginRight: '8px' }} />
                Clear All Folds
              </Button>
            </div>

            <div className={styles.divider} />

            {/* Export Tools */}
            <div className={styles.sidebarSection}>
              <div className={styles.sectionTitle}>Export</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button 
                  variant="outline" 
                  className={styles.flex1Btn}
                  onClick={onExportFold}
                >
                  <Download size={14} style={{ marginRight: '8px' }} />
                  .fold
                </Button>
                <Button 
                  variant="outline" 
                  className={styles.flex1Btn}
                  onClick={onExportSVG}
                >
                  <Download size={14} style={{ marginRight: '8px' }} />
                  .svg
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}