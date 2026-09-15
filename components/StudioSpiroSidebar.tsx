import React, { useState } from "react";
import { SpirogamiParams } from "../helpers/spirogamiEngine";
import { ChevronDown, ChevronRight, Download, Settings } from "lucide-react";
import { Input } from "./Input";
import { Slider } from "./Slider";
import { Button } from "./Button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./Collapsible";
import { StudioMaterialControls } from "./StudioMaterialControls";
import styles from "./StudioSpiroSidebar.module.css";

export interface StudioSpiroSidebarProps {
  studioMode: 'packaging' | 'origami' | 'popup' | 'spirogami';
  params: SpirogamiParams;
  onParamsChange: (params: SpirogamiParams) => void;
  name: string;
  onNameChange: (n: string) => void;
  onExportSVG: () => void;
  onExportFold: () => void;
  materialType: string;
  exteriorColor: string;
  interiorColor: string;
  onMaterialPresetChange: (presetKey: string) => void;
  onExteriorColorChange: (color: string) => void;
  onInteriorColorChange: (color: string) => void;
}

export function StudioSpiroSidebar({
  studioMode,
  params,
  onParamsChange,
  name,
  onNameChange,
  onExportSVG,
  onExportFold,
  materialType,
  exteriorColor,
  interiorColor,
  onMaterialPresetChange,
  onExteriorColorChange,
  onInteriorColorChange,
}: StudioSpiroSidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(true);

  return (
    <div className={styles.container}>
      <div className={styles.viewHeader}>
        <Input 
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className={styles.projectNameInput}
          placeholder="Project Name"
        />
      </div>

      <div className={styles.sidebarContent}>
        {studioMode === 'spirogami' && (
          <>
            <div className={styles.sidebarSection}>
              <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <CollapsibleTrigger className={styles.collapsibleTrigger}>
                  <div className={styles.collapsibleTitle}>
                    <Settings size={14} />
                    Spiral Settings
                  </div>
                  {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </CollapsibleTrigger>
                <CollapsibleContent className={styles.collapsibleContent}>
                  
                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Disc Radius (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.discRadius]} 
                        onValueChange={(v) => onParamsChange({ ...params, discRadius: v[0] })} 
                        max={200} min={50} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={params.discRadius}
                        onChange={(e) => onParamsChange({ ...params, discRadius: parseInt(e.target.value) || 50 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Inner Radius (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.innerRadius]} 
                        onValueChange={(v) => onParamsChange({ ...params, innerRadius: v[0] })} 
                        max={50} min={5} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={params.innerRadius}
                        onChange={(e) => onParamsChange({ ...params, innerRadius: parseInt(e.target.value) || 5 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Number of Turns</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.turns]} 
                        onValueChange={(v) => onParamsChange({ ...params, turns: v[0] })} 
                        max={10} min={1} step={0.5}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        step="0.5"
                        value={params.turns}
                        onChange={(e) => onParamsChange({ ...params, turns: parseFloat(e.target.value) || 1 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Strip Height (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.stripHeight]} 
                        onValueChange={(v) => onParamsChange({ ...params, stripHeight: v[0] })} 
                        max={100} min={5} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={params.stripHeight}
                        onChange={(e) => onParamsChange({ ...params, stripHeight: parseInt(e.target.value) || 5 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Strip Width (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.stripWidth]} 
                        onValueChange={(v) => onParamsChange({ ...params, stripWidth: v[0] })} 
                        max={20} min={2} step={0.5}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        step="0.5"
                        value={params.stripWidth}
                        onChange={(e) => onParamsChange({ ...params, stripWidth: parseFloat(e.target.value) || 2 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Gap Width (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.gapWidth]} 
                        onValueChange={(v) => onParamsChange({ ...params, gapWidth: v[0] })} 
                        max={10} min={0.5} step={0.5}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        step="0.5"
                        value={params.gapWidth}
                        onChange={(e) => onParamsChange({ ...params, gapWidth: parseFloat(e.target.value) || 0.5 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Paper Thickness (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[params.paperThickness]} 
                        onValueChange={(v) => onParamsChange({ ...params, paperThickness: v[0] })} 
                        max={5} min={0.1} step={0.1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        step="0.1"
                        value={params.paperThickness}
                        onChange={(e) => onParamsChange({ ...params, paperThickness: parseFloat(e.target.value) || 0.1 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                </CollapsibleContent>
              </Collapsible>
            </div>

            <StudioMaterialControls
              materialType={materialType}
              exteriorColor={exteriorColor}
              interiorColor={interiorColor}
              onMaterialPresetChange={onMaterialPresetChange}
              onExteriorColorChange={onExteriorColorChange}
              onInteriorColorChange={onInteriorColorChange}
            />

            <div className={styles.sidebarSection}>
              <div className={styles.sectionTitle}>Export</div>
              <div className={styles.flexRow}>
                <Button variant="outline" className={styles.flex1Btn} onClick={onExportSVG}>
                  <Download size={14} style={{ marginRight: '8px' }} /> SVG
                </Button>
                <Button variant="outline" className={styles.flex1Btn} onClick={onExportFold}>
                  <Download size={14} style={{ marginRight: '8px' }} /> .fold
                </Button>
              </div>
            </div>
            
          </>
        )}
      </div>
    </div>
  );
}