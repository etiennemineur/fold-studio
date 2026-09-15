import React, { useState } from "react";
import { 
  PopupDocument, 
  MechanismType, 
  addMechanism, 
  updateMechanism, 
  removeMechanism,
  getMechanismDisplayName
} from "../helpers/popupDocument";
import { PopupValidationResult, ValidationStatus } from "../helpers/popupValidation";
import { Input } from "./Input";
import { Slider } from "./Slider";
import { Button } from "./Button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./Collapsible";
import { StudioMaterialControls } from "./StudioMaterialControls";
import { 
  Box, 
  FileBox, 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Triangle, 
  AlignJustify, 
  Layers, 
  Scissors, 
  AlertCircle, 
  AlertTriangle, 
  Info,
  Download,
  Settings,
  Activity,
  LayoutGrid,
  RotateCw
} from "lucide-react";
import styles from "./StudioPopupSidebar.module.css";

export interface StudioPopupSidebarProps {
  studioMode: 'packaging' | 'origami' | 'popup' | 'spirogami';
  onModeChange: (mode: 'packaging' | 'origami' | 'popup' | 'spirogami') => void;
  popupDocument: PopupDocument;
  onDocumentChange: (doc: PopupDocument) => void;
  selectedMechanismId: string | null;
  onSelectMechanism: (id: string | null) => void;
  validationResult: PopupValidationResult | null;
  onExportSVG: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
  onExportFold: () => void;
  name: string;
  onNameChange: (n: string) => void;
  onShowTemplateLibrary: () => void;
  materialType: string;
  exteriorColor: string;
  interiorColor: string;
  onMaterialPresetChange: (presetKey: string) => void;
  onExteriorColorChange: (color: string) => void;
  onInteriorColorChange: (color: string) => void;
}

export function StudioPopupSidebar({
  studioMode,
  onModeChange,
  popupDocument,
  onDocumentChange,
  selectedMechanismId,
  onSelectMechanism,
  validationResult,
  onExportSVG,
  onExportPDF,
  onExportJSON,
  onExportFold,
  name,
  onNameChange,
  onShowTemplateLibrary,
  materialType,
  exteriorColor,
  interiorColor,
  onMaterialPresetChange,
  onExteriorColorChange,
  onInteriorColorChange,
}: StudioPopupSidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [validationOpen, setValidationOpen] = useState(true);

  const handleAddMechanism = (type: MechanismType) => {
    const newDoc = addMechanism(popupDocument, type);
    onDocumentChange(newDoc);
    // Auto-select the newly added mechanism
    const newMech = newDoc.mechanisms[newDoc.mechanisms.length - 1];
    if (newMech) {
      onSelectMechanism(newMech.id);
    }
  };

  const handleDeleteMechanism = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (selectedMechanismId === id) {
      onSelectMechanism(null);
    }
    onDocumentChange(removeMechanism(popupDocument, id));
  };

  const handleUpdateMechanism = (id: string, paramUpdates: any) => {
    onDocumentChange(updateMechanism(popupDocument, id, paramUpdates));
  };

  const selectedMechanism = popupDocument.mechanisms.find(m => m.id === selectedMechanismId);

  const getStatusClass = (status: ValidationStatus) => {
    if (status === 'invalid') return styles.statusInvalid;
    if (status === 'warning') return styles.statusWarning;
    return styles.statusValid;
  };

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
        {/* Mode Toggle */}
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

        {studioMode === 'popup' && (
          <>
            {/* Book Settings */}
            <div className={styles.sidebarSection}>
              <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <CollapsibleTrigger className={styles.collapsibleTrigger}>
                  <div className={styles.collapsibleTitle}>
                    <Settings size={14} />
                    Book Settings
                  </div>
                  {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </CollapsibleTrigger>
                <CollapsibleContent className={styles.collapsibleContent}>
                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Book Width (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[popupDocument.bookWidth]} 
                        onValueChange={(v) => onDocumentChange({ ...popupDocument, bookWidth: v[0] })} 
                        max={400} min={50} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={popupDocument.bookWidth}
                        onChange={(e) => onDocumentChange({ ...popupDocument, bookWidth: parseInt(e.target.value) || 50 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Book Height (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[popupDocument.bookHeight]} 
                        onValueChange={(v) => onDocumentChange({ ...popupDocument, bookHeight: v[0] })} 
                        max={400} min={50} step={1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        value={popupDocument.bookHeight}
                        onChange={(e) => onDocumentChange({ ...popupDocument, bookHeight: parseInt(e.target.value) || 50 })}
                        className={styles.paramNumInput}
                      />
                    </div>
                  </div>

                  <div className={styles.paramGroup}>
                    <label className={styles.paramLabel}>Paper Thickness (mm)</label>
                    <div className={styles.paramInputRow}>
                      <Slider 
                        value={[popupDocument.paperThickness]} 
                        onValueChange={(v) => onDocumentChange({ ...popupDocument, paperThickness: v[0] })} 
                        max={5} min={0.1} step={0.1}
                        className={styles.paramSlider}
                      />
                      <Input 
                        type="number" 
                        step="0.1"
                        value={popupDocument.paperThickness}
                        onChange={(e) => onDocumentChange({ ...popupDocument, paperThickness: parseFloat(e.target.value) || 0.1 })}
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

            <div className={styles.divider} />

            {/* Mechanism Library */}
            <div className={styles.sidebarSection}>
              <Button 
                variant="outline" 
                className={styles.fullWidthBtn}
                onClick={onShowTemplateLibrary}
              >
                <LayoutGrid size={14} style={{ marginRight: '8px' }} />
                Template Library
              </Button>
              <div className={styles.sectionTitle}>Add Mechanism</div>
              <div className={styles.libraryGrid}>
                <div className={styles.libraryCard} onClick={() => handleAddMechanism('v-fold')}>
                  <Triangle size={20} className={styles.libraryIcon} />
                  <span className={styles.libraryName}>V-Fold</span>
                </div>
                <div className={styles.libraryCard} onClick={() => handleAddMechanism('v-fold-asymmetric')}>
                  <Scissors size={20} className={styles.libraryIcon} />
                  <span className={styles.libraryName}>V-Fold Asym.</span>
                </div>
                <div className={styles.libraryCard} onClick={() => handleAddMechanism('parallel-fold')}>
                  <AlignJustify size={20} className={styles.libraryIcon} />
                  <span className={styles.libraryName}>Parallel</span>
                </div>
                <div className={styles.libraryCard} onClick={() => handleAddMechanism('platform')}>
                  <Layers size={20} className={styles.libraryIcon} />
                  <span className={styles.libraryName}>Platform</span>
                </div>
                <div className={styles.libraryCard} onClick={() => handleAddMechanism('box')} style={{ gridColumn: 'span 2' }}>
                  <Box size={20} className={styles.libraryIcon} />
                  <span className={styles.libraryName}>Box</span>
                </div>
              </div>
            </div>

            {popupDocument.mechanisms.length > 0 && (
              <>
                <div className={styles.divider} />
                
                {/* Mechanism List */}
                <div className={styles.sidebarSection}>
                  <div className={styles.sectionTitle}>Document Layers</div>
                  <div className={styles.mechanismList}>
                    {popupDocument.mechanisms.map((m, index) => {
                      const status = validationResult?.mechanismStatuses.get(m.id) || 'valid';
                      const isSelected = selectedMechanismId === m.id;
                      
                      return (
                        <div 
                          key={m.id}
                          className={`${styles.mechanismItem} ${isSelected ? styles.mechanismItemActive : ''}`}
                          onClick={() => onSelectMechanism(m.id)}
                        >
                          <div className={styles.mechInfo}>
                            <div className={`${styles.statusDot} ${getStatusClass(status)}`} />
                            <span className={styles.mechName}>{getMechanismDisplayName(m.type)} {index + 1}</span>
                          </div>
                          <button className={styles.deleteBtn} onClick={(e) => handleDeleteMechanism(e, m.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Selected Mechanism Params */}
            {selectedMechanism && (
              <div className={styles.selectedParamsContainer}>
                <div className={styles.sectionTitle} style={{ color: 'inherit' }}>
                  Edit {getMechanismDisplayName(selectedMechanism.type)}
                </div>

                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>Position Y (mm)</label>
                  <div className={styles.paramInputRow}>
                    <Slider 
                      value={[selectedMechanism.params.positionY]} 
                      onValueChange={(v) => handleUpdateMechanism(selectedMechanism.id, { positionY: v[0] })} 
                      max={popupDocument.bookHeight} min={0} step={1}
                      className={styles.paramSlider}
                    />
                    <Input 
                      type="number" 
                      value={selectedMechanism.params.positionY}
                      onChange={(e) => handleUpdateMechanism(selectedMechanism.id, { positionY: parseInt(e.target.value) || 0 })}
                      className={styles.paramNumInput}
                    />
                  </div>
                </div>

                <div className={styles.paramGroup}>
                  <label className={styles.paramLabel}>Fold Direction</label>
                  <div className={styles.toggleRow}>
                    <button
                      className={`${styles.toggleBtn} ${selectedMechanism.params.foldDirection === 'up' ? styles.toggleBtnActive : ''}`}
                      onClick={() => handleUpdateMechanism(selectedMechanism.id, { foldDirection: 'up' })}
                    >
                      Up
                    </button>
                    <button
                      className={`${styles.toggleBtn} ${selectedMechanism.params.foldDirection === 'down' ? styles.toggleBtnActive : ''}`}
                      onClick={() => handleUpdateMechanism(selectedMechanism.id, { foldDirection: 'down' })}
                    >
                      Down
                    </button>
                  </div>
                </div>

                {(selectedMechanism.type.includes('v-fold')) && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>Height (mm)</label>
                      <div className={styles.paramInputRow}>
                        <Slider 
                          value={[selectedMechanism.params.height]} 
                          onValueChange={(v) => handleUpdateMechanism(selectedMechanism.id, { height: v[0] })} 
                          max={200} min={5} step={1}
                          className={styles.paramSlider}
                        />
                        <Input 
                          type="number" 
                          value={selectedMechanism.params.height}
                          onChange={(e) => handleUpdateMechanism(selectedMechanism.id, { height: parseInt(e.target.value) || 5 })}
                          className={styles.paramNumInput}
                        />
                      </div>
                    </div>
                    
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>V-Angle (°)</label>
                      <div className={styles.paramInputRow}>
                        <Slider 
                          value={[selectedMechanism.params.vAngle]} 
                          onValueChange={(v) => handleUpdateMechanism(selectedMechanism.id, { vAngle: v[0] })} 
                          max={80} min={10} step={1}
                          className={styles.paramSlider}
                        />
                        <Input 
                          type="number" 
                          value={selectedMechanism.params.vAngle}
                          onChange={(e) => handleUpdateMechanism(selectedMechanism.id, { vAngle: parseInt(e.target.value) || 45 })}
                          className={styles.paramNumInput}
                        />
                      </div>
                    </div>
                  </>
                )}

                {selectedMechanism.type === 'v-fold-asymmetric' && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>Left Arm Length (mm)</label>
                      <div className={styles.paramInputRow}>
                        <Slider 
                          value={[selectedMechanism.params.armLengthLeft]} 
                          onValueChange={(v) => handleUpdateMechanism(selectedMechanism.id, { armLengthLeft: v[0] })} 
                          max={150} min={5} step={1}
                          className={styles.paramSlider}
                        />
                        <Input 
                          type="number" 
                          value={selectedMechanism.params.armLengthLeft}
                          onChange={(e) => handleUpdateMechanism(selectedMechanism.id, { armLengthLeft: parseInt(e.target.value) || 30 })}
                          className={styles.paramNumInput}
                        />
                      </div>
                    </div>
                    
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>Right Arm Length (mm)</label>
                      <div className={styles.paramInputRow}>
                        <Slider 
                          value={[selectedMechanism.params.armLengthRight]} 
                          onValueChange={(v) => handleUpdateMechanism(selectedMechanism.id, { armLengthRight: v[0] })} 
                          max={150} min={5} step={1}
                          className={styles.paramSlider}
                        />
                        <Input 
                          type="number" 
                          value={selectedMechanism.params.armLengthRight}
                          onChange={(e) => handleUpdateMechanism(selectedMechanism.id, { armLengthRight: parseInt(e.target.value) || 30 })}
                          className={styles.paramNumInput}
                        />
                      </div>
                    </div>
                  </>
                )}

                {!selectedMechanism.type.includes('v-fold') && (
                  <>
                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>Width (mm)</label>
                      <div className={styles.paramInputRow}>
                        <Slider 
                          value={[selectedMechanism.params.width]} 
                          onValueChange={(v) => handleUpdateMechanism(selectedMechanism.id, { width: v[0] })} 
                          max={200} min={5} step={1}
                          className={styles.paramSlider}
                        />
                        <Input 
                          type="number" 
                          value={selectedMechanism.params.width}
                          onChange={(e) => handleUpdateMechanism(selectedMechanism.id, { width: parseInt(e.target.value) || 40 })}
                          className={styles.paramNumInput}
                        />
                      </div>
                    </div>

                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>Height (mm)</label>
                      <div className={styles.paramInputRow}>
                        <Slider 
                          value={[selectedMechanism.params.height]} 
                          onValueChange={(v) => handleUpdateMechanism(selectedMechanism.id, { height: v[0] })} 
                          max={200} min={5} step={1}
                          className={styles.paramSlider}
                        />
                        <Input 
                          type="number" 
                          value={selectedMechanism.params.height}
                          onChange={(e) => handleUpdateMechanism(selectedMechanism.id, { height: parseInt(e.target.value) || 30 })}
                          className={styles.paramNumInput}
                        />
                      </div>
                    </div>

                    <div className={styles.paramGroup}>
                      <label className={styles.paramLabel}>Depth (mm)</label>
                      <div className={styles.paramInputRow}>
                        <Slider 
                          value={[selectedMechanism.params.depth]} 
                          onValueChange={(v) => handleUpdateMechanism(selectedMechanism.id, { depth: v[0] })} 
                          max={150} min={5} step={1}
                          className={styles.paramSlider}
                        />
                        <Input 
                          type="number" 
                          value={selectedMechanism.params.depth}
                          onChange={(e) => handleUpdateMechanism(selectedMechanism.id, { depth: parseInt(e.target.value) || 30 })}
                          className={styles.paramNumInput}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className={styles.divider} />

            {/* Validation Panel */}
            {validationResult && (
              <div className={styles.sidebarSection}>
                <Collapsible open={validationOpen} onOpenChange={setValidationOpen}>
                  <CollapsibleTrigger className={styles.collapsibleTrigger}>
                    <div className={styles.collapsibleTitle}>
                      <Activity size={14} />
                      Validation
                    </div>
                    {validationOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className={styles.collapsibleContent}>
                    <div className={styles.validationPanel}>
                      <div className={styles.dofDisplay}>
                        <span>Degrees of Freedom:</span>
                        <span className={`${styles.dofValue} ${validationResult.dof === 1 ? styles.dofValid : styles.dofWarning}`}>
                          {validationResult.dof}
                        </span>
                      </div>
                      
                      {validationResult.issues.length > 0 ? (
                        <div className={styles.issueList}>
                          {validationResult.issues.map((issue, idx) => (
                            <div 
                              key={idx} 
                              className={`${styles.issueItem} ${
                                issue.severity === 'error' ? styles.issueError :
                                issue.severity === 'warning' ? styles.issueWarning : styles.issueInfo
                              }`}
                            >
                              {issue.severity === 'error' && <AlertCircle size={14} className={styles.issueIcon} />}
                              {issue.severity === 'warning' && <AlertTriangle size={14} className={styles.issueIcon} />}
                              {issue.severity === 'info' && <Info size={14} className={styles.issueIcon} />}
                              <span>{issue.message}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`${styles.issueItem} ${styles.issueInfo}`} style={{ color: 'var(--success)', borderColor: 'var(--success)', backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)' }}>
                          No structural issues detected.
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            <div className={styles.divider} />

            {/* Export Tools */}
            <div className={styles.sidebarSection}>
              <div className={styles.sectionTitle}>Export Precision</div>
              <div className={styles.flexRow}>
                <Button variant="outline" className={styles.flex1Btn} onClick={onExportSVG}>
                  <Download size={14} style={{ marginRight: '8px' }} /> SVG
                </Button>
                <Button variant="outline" className={styles.flex1Btn} onClick={onExportPDF}>
                  <Download size={14} style={{ marginRight: '8px' }} /> PDF
                </Button>
              </div>
              <div className={styles.flexRow}>
                <Button variant="outline" className={styles.flex1Btn} onClick={onExportFold}>
                  <Download size={14} style={{ marginRight: '8px' }} /> .fold
                </Button>
                <Button variant="outline" className={styles.flex1Btn} onClick={onExportJSON}>
                  <Download size={14} style={{ marginRight: '8px' }} /> JSON
                </Button>
              </div>
            </div>
            
          </>
        )}
      </div>
    </div>
  );
}