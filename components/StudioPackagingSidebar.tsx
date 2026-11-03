import React from "react";
import { BoxParams, ShapeType } from "../helpers/foldEngine";
import { Slider } from "./Slider";
import { Input } from "./Input";
import { Button } from "./Button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { Upload, Trash2, FileText, LayoutGrid, Box, FileBox, BookOpen, RotateCw } from "lucide-react";
import { StudioLayerPanel } from "./StudioLayerPanel";
import styles from "../pages/studio.module.css";

interface StudioPackagingSidebarProps {
  studioMode: string;
  onModeChange: (mode: 'packaging' | 'origami' | 'popup' | 'spirogami') => void;
  name: string;
  onNameChange: (name: string) => void;
  importedMode: boolean;
  importWarnings: string[];
  importFileName: string;
  onSvgImport: (files: File[]) => void;
  onClearImport: () => void;
  shapeType: ShapeType;
  onShapeTypeChange: (type: ShapeType) => void;
  onShowTemplateLibrary: () => void;
  params: BoxParams;
  onParamsChange: React.Dispatch<React.SetStateAction<BoxParams>>;
  artworkLayers: any;
  isVerso: boolean;
  onVersoChange: (isVerso: boolean) => void;
  layerInputRef: React.RefObject<HTMLInputElement | null>;
}

export function StudioPackagingSidebar({
  studioMode,
  onModeChange,
  name,
  onNameChange,
  importedMode,
  importWarnings,
  importFileName,
  onSvgImport,
  onClearImport,
  shapeType,
  onShapeTypeChange,
  onShowTemplateLibrary,
  params,
  onParamsChange,
  artworkLayers,
  isVerso,
  onVersoChange,
  layerInputRef
}: StudioPackagingSidebarProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <>
      <div className={styles.viewHeader}>
        <Input 
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={styles.projectNameInput}
          placeholder="Project Name"
        />
      </div>
      <div className={styles.sidebarContent}>
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${studioMode === 'packaging' ? styles.modeBtnActive : ''}`}
            onClick={() => onModeChange('packaging')}
          >
            <Box size={14} />
            PACK
          </button>
          <button
            className={`${styles.modeBtn} ${studioMode === 'origami' ? styles.modeBtnActive : ''}`}
            onClick={() => onModeChange('origami')}
          >
            <FileBox size={14} />
            FOLD
          </button>
          <button
            className={`${styles.modeBtn} ${studioMode === 'popup' ? styles.modeBtnActive : ''}`}
            onClick={() => onModeChange('popup')}
          >
            <BookOpen size={14} />
            POPUP
          </button>
          <button
            className={`${styles.modeBtn} ${studioMode === 'spirogami' ? styles.modeBtnActive : ''}`}
            onClick={() => onModeChange('spirogami')}
          >
            <RotateCw size={14} />
            SPIRO
          </button>
        </div>
        <div className={styles.sidebarSection}>
          {!importedMode ? (
            <>
              <input
                type="file"
                accept=".svg"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onSvgImport(Array.from(e.target.files));
                    e.target.value = "";
                  }
                }}
                style={{ display: "none" }}
              />
              <Button 
                variant="outline" 
                className={styles.applyBtn}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} style={{ marginRight: '6px' }} />
                Import SVG
              </Button>
            </>
          ) : (
            <div className={styles.fileCard}>
              <div className={styles.fileInfo}>
                <FileText size={16} className={styles.fileIcon} />
                <span className={styles.fileName}>{importFileName}</span>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClearImport} title="Clear import">
                <Trash2 size={14} />
              </Button>
            </div>
          )}
          {importedMode && importWarnings.length > 0 && (
            <ul className={styles.importWarningList}>
              {importWarnings.map((warning, i) => (
                <li key={i} className={styles.importWarningItem}>{warning}</li>
              ))}
            </ul>
          )}
          {importedMode && (
            <Button variant="outline" onClick={onClearImport} style={{ marginTop: '8px' }}>
              Back to parametric mode
            </Button>
          )}
        </div>
        
        {!importedMode && (
          <div className={styles.sidebarSection}>
            <div className={styles.paramGroup}>
              <label className={styles.paramLabel}>Shape Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <Select value={shapeType} onValueChange={(v) => onShapeTypeChange(v as ShapeType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Shape" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="box">Box</SelectItem>
                        <SelectItem value="pyramid">Pyramid</SelectItem>
                        <SelectItem value="tray">Tray</SelectItem>
                        <SelectItem value="sleeve">Sleeve</SelectItem>
                        <SelectItem value="hexagonal">Hexagonal Box</SelectItem>
                        <SelectItem value="triangular">Triangular Box</SelectItem>
                        <SelectItem value="octagonal">Octagonal Box</SelectItem>
                        <SelectItem value="pentagonal">Pentagonal Box</SelectItem>
                        <SelectItem value="mailer">Mailer (Hinged Lid)</SelectItem>
                        <SelectItem value="tuckEnd">Tuck-End Box</SelectItem>
                        <SelectItem value="display">Display Box</SelectItem>
                        <SelectItem value="flipTop">Flip-Top Box</SelectItem>
                        <SelectItem value="gable">Gable Box</SelectItem>
                        <SelectItem value="sealEnd">Seal End Box</SelectItem>
                        <SelectItem value="snapLock">Snap-Lock Tray</SelectItem>
                        <SelectItem value="concentricRings">Concentric Rings — experimental, non-rigid</SelectItem>
                        <SelectItem value="sineWaves">Sine Waves — experimental, non-rigid</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="icon-md" onClick={onShowTemplateLibrary} title="Template Library">
                  <LayoutGrid size={14} />
                </Button>
              </div>
            </div>
            <div className={styles.paramGroup}>
              {!importedMode && (shapeType === 'concentricRings' || shapeType === 'sineWaves') && (
                <p role="note" className={styles.importWarningItem}>
                  Experimental, non-rigid preview: faces deform during folding. These patterns are not validated for fabrication.
                </p>
              )}
              <label className={styles.paramLabel}>Width (mm)</label>
              <div className={styles.paramInputRow}>
                <Slider 
                  value={[params.width]} 
                  onValueChange={(v) => onParamsChange(p => ({...p, width: v[0]}))} 
                  max={300} min={10} step={1}
                  className={styles.paramSlider}
                />
                <Input 
                  type="number" 
                  value={params.width}
                  onChange={(e) => onParamsChange(p => ({...p, width: parseInt(e.target.value) || 10}))}
                  className={styles.paramNumInput}
                />
              </div>
            </div>
            <div className={styles.paramGroup}>
              <label className={styles.paramLabel}>Height (mm)</label>
              <div className={styles.paramInputRow}>
                <Slider 
                  value={[params.height]} 
                  onValueChange={(v) => onParamsChange(p => ({...p, height: v[0]}))} 
                  max={300} min={10} step={1}
                  className={styles.paramSlider}
                />
                <Input 
                  type="number" 
                  value={params.height}
                  onChange={(e) => onParamsChange(p => ({...p, height: parseInt(e.target.value) || 10}))}
                  className={styles.paramNumInput}
                />
              </div>
            </div>
            <div className={styles.paramGroup}>
              <label className={styles.paramLabel}>Depth (mm)</label>
              <div className={styles.paramInputRow}>
                <Slider 
                  value={[params.depth]} 
                  onValueChange={(v) => onParamsChange(p => ({...p, depth: v[0]}))} 
                  max={300} min={10} step={1}
                  className={styles.paramSlider}
                />
                <Input 
                  type="number" 
                  value={params.depth}
                  onChange={(e) => onParamsChange(p => ({...p, depth: parseInt(e.target.value) || 10}))}
                  className={styles.paramNumInput}
                />
              </div>
            </div>
            <div className={styles.paramGroup}>
              <label className={styles.paramLabel}>Glue Tab Size (mm)</label>
              <div className={styles.paramInputRow}>
                <Slider 
                  value={[params.glueTabSize]} 
                  onValueChange={(v) => onParamsChange(p => ({...p, glueTabSize: v[0]}))} 
                  max={50} min={5} step={1}
                  className={styles.paramSlider}
                />
                <Input 
                  type="number" 
                  value={params.glueTabSize}
                  onChange={(e) => onParamsChange(p => ({...p, glueTabSize: parseInt(e.target.value) || 5}))}
                  className={styles.paramNumInput}
                />
              </div>
            </div>
            <div className={styles.paramGroup}>
              <label className={styles.paramLabel}>Material Thickness (mm)</label>
              <div className={styles.paramInputRow}>
                <Slider 
                  value={[params.materialThickness]} 
                  onValueChange={(v) => onParamsChange(p => ({...p, materialThickness: v[0]}))} 
                  max={5} min={0.1} step={0.1}
                  className={styles.paramSlider}
                />
                <Input 
                  type="number" 
                  value={params.materialThickness}
                  onChange={(e) => onParamsChange(p => ({...p, materialThickness: parseFloat(e.target.value) || 0.1}))}
                  className={styles.paramNumInput}
                />
              </div>
            </div>
            <div className={styles.paramGroup}>
              <label className={styles.paramLabel}>Bleed (mm)</label>
              <div className={styles.paramInputRow}>
                <Slider 
                  value={[params.bleedSize]} 
                  onValueChange={(v) => onParamsChange(p => ({...p, bleedSize: v[0]}))} 
                  max={10} min={0} step={0.5}
                  className={styles.paramSlider}
                />
                <Input 
                  type="number" 
                  value={params.bleedSize}
                  onChange={(e) => onParamsChange(p => ({...p, bleedSize: parseFloat(e.target.value) || 0}))}
                  className={styles.paramNumInput}
                />
              </div>
            </div>
            <div className={styles.paramGroup}>
              <label className={styles.paramLabel}>Tab Fillet (mm)</label>
              <div className={styles.paramInputRow}>
                <Slider 
                  value={[params.tabFilletRadius ?? 0]} 
                  onValueChange={(v) => onParamsChange(p => ({...p, tabFilletRadius: v[0]}))} 
                  max={8} min={0} step={0.5}
                  className={styles.paramSlider}
                />
                <Input 
                  type="number" 
                  value={params.tabFilletRadius ?? 0}
                  onChange={(e) => onParamsChange(p => ({...p, tabFilletRadius: parseFloat(e.target.value) || 0}))}
                  className={styles.paramNumInput}
                />
              </div>
            </div>
            <div className={styles.paramGroup}>
              <label className={styles.paramLabel}>Tab Taper</label>
              <div className={styles.paramInputRow}>
                <Slider 
                  value={[params.tabTaperRatio ?? 0.3]} 
                  onValueChange={(v) => onParamsChange(p => ({...p, tabTaperRatio: v[0]}))} 
                  max={0.8} min={0.1} step={0.05}
                  className={styles.paramSlider}
                />
                <Input 
                  type="number" 
                  value={params.tabTaperRatio ?? 0.3}
                  onChange={(e) => onParamsChange(p => ({...p, tabTaperRatio: parseFloat(e.target.value) || 0.3}))}
                  className={styles.paramNumInput}
                />
              </div>
            </div>
          </div>
        )}

        <StudioLayerPanel
          layers={artworkLayers.layers}
          selectedLayerId={artworkLayers.selectedLayerId}
          onSelectLayer={artworkLayers.setSelectedLayerId}
          onRemoveLayer={artworkLayers.removeLayer}
          onUpdateLayer={artworkLayers.updateLayer}
          onDuplicateLayer={artworkLayers.duplicateLayer}
          onReorderLayers={artworkLayers.reorderLayers}
          vectorLocked={artworkLayers.vectorLocked}
          onVectorLockedChange={artworkLayers.setVectorLocked}
          isVerso={isVerso}
          onVersoChange={onVersoChange}
          onImportImage={() => layerInputRef.current?.click()}
          materialType={artworkLayers.materialType}
          exteriorColor={artworkLayers.exteriorColor}
          interiorColor={artworkLayers.interiorColor}
          onMaterialPresetChange={artworkLayers.applyMaterialPreset}
          onExteriorColorChange={artworkLayers.setExteriorColor}
          onInteriorColorChange={artworkLayers.setInteriorColor}
        />
      </div>
    </>
  );
}