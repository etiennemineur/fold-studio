import { useState, useCallback, useEffect } from "react";
import { nanoid } from "nanoid";

export const MATERIAL_PRESETS: Record<string, { label: string; exterior: string; interior: string }> = {
  white_cardboard: { label: 'White Cardboard', exterior: '#FFFFFF', interior: '#F0EDE8' },
  kraft: { label: 'Kraft', exterior: '#C4956A', interior: '#B8895E' },
  grey_cardboard: { label: 'Grey Cardboard', exterior: '#B0B0B0', interior: '#999999' },
  black_cardboard: { label: 'Black Cardboard', exterior: '#333333', interior: '#222222' },
  coated_white: { label: 'Coated White', exterior: '#FAFAFA', interior: '#F5F5F0' },
  custom: { label: 'Custom', exterior: '#FFFFFF', interior: '#F0EDE8' },
};

export interface ArtworkLayer {
  id: string;
  name: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  visible: boolean;
  aspectRatio: number;
  refWidth: number;
  refHeight: number;
}

export function useArtworkLayers() {
  const [layers, setLayers] = useState<ArtworkLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [vectorLocked, setVectorLocked] = useState(false);
  const [materialType, setMaterialType] = useState<string>('white_cardboard');
  const [exteriorColor, setExteriorColor] = useState('#FFFFFF');
  const [interiorColor, setInteriorColor] = useState('#F0EDE8');

  const applyMaterialPreset = useCallback((presetKey: string) => {
    setMaterialType(presetKey);
    const preset = MATERIAL_PRESETS[presetKey];
    if (preset && presetKey !== 'custom') {
      setExteriorColor(preset.exterior);
      setInteriorColor(preset.interior);
    }
  }, []);

  const addLayer = useCallback(
    (
      file: File,
      boundingBox: { x: number; y: number; width: number; height: number },
    ) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const naturalWidth = img.naturalWidth || 1;
        const naturalHeight = img.naturalHeight || 1;
        const aspectRatio = naturalWidth / naturalHeight;

        let fitWidth = boundingBox.width;
        let fitHeight = fitWidth / aspectRatio;

        if (fitHeight > boundingBox.height) {
          fitHeight = boundingBox.height;
          fitWidth = fitHeight * aspectRatio;
        }

        const x = boundingBox.x + (boundingBox.width - fitWidth) / 2;
        const y = boundingBox.y + (boundingBox.height - fitHeight) / 2;

        const newLayer: ArtworkLayer = {
          id: nanoid(),
          name: file.name,
          url,
          x,
          y,
          width: fitWidth,
          height: fitHeight,
          rotation: 0,
          locked: false,
          visible: true,
          aspectRatio,
          refWidth: fitWidth,
          refHeight: fitHeight,
        };

        setLayers((prev) => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
      };
      img.src = url;
    },
    [],
  );

  const removeLayer = useCallback((id: string) => {
    setLayers((prev) => {
      const layer = prev.find((l) => l.id === id);
      if (layer) {
        URL.revokeObjectURL(layer.url);
      }
      return prev.filter((l) => l.id !== id);
    });
    setSelectedLayerId((prev) => (prev === id ? null : prev));
  }, []);

  const updateLayer = useCallback(
    (id: string, updates: Partial<ArtworkLayer>) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      );
    },
    [],
  );

  const moveLayerUp = useCallback((id: string) => {
    setLayers((prev) => {
      const index = prev.findIndex((l) => l.id === id);
      // Move up visually means move to the end of the array (rendered last in DOM)
      if (index === -1 || index === prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  }, []);

  const moveLayerDown = useCallback((id: string) => {
    setLayers((prev) => {
      const index = prev.findIndex((l) => l.id === id);
      // Move down visually means move to the start of the array
      if (index <= 0) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  }, []);

  const duplicateLayer = useCallback((id: string) => {
    const newId = nanoid();
    setLayers((prev) => {
      const index = prev.findIndex((l) => l.id === id);
      if (index === -1) return prev;
      
      const original = prev[index];
      const newLayer: ArtworkLayer = {
        ...original,
        id: newId,
        name: `${original.name} copy`,
        x: original.x + 5,
        y: original.y + 5,
      };

      const next = [...prev];
      next.splice(index + 1, 0, newLayer);
      return next;
    });
    setSelectedLayerId(newId);
  }, []);

  const reorderLayers = useCallback((fromIndex: number, toIndex: number) => {
    setLayers((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [movedLayer] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedLayer);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setLayers((prev) => {
      prev.forEach((l) => URL.revokeObjectURL(l.url));
      return [];
    });
    setSelectedLayerId(null);
    setVectorLocked(false);
    setMaterialType('white_cardboard');
    setExteriorColor('#FFFFFF');
    setInteriorColor('#F0EDE8');
  }, []);

  const clearLayers = useCallback(() => {
    setLayers((prev) => {
      prev.forEach((layer) => URL.revokeObjectURL(layer.url));
      return [];
    });
    setSelectedLayerId(null);
    setVectorLocked(false);
  }, []);

  return {
    layers,
    selectedLayerId,
    vectorLocked,
    materialType,
    exteriorColor,
    interiorColor,
    setSelectedLayerId,
    setVectorLocked,
    setMaterialType,
    setExteriorColor,
    setInteriorColor,
    applyMaterialPreset,
    addLayer,
    removeLayer,
    updateLayer,
    moveLayerUp,
    moveLayerDown,
    duplicateLayer,
    reorderLayers,
    clearLayers,
    clearAll,
  };
}