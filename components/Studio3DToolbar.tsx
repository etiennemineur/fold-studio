/// <reference types="@react-three/fiber" />
import "../helpers/r3fCompat";
import React, { forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { FoldData } from "../helpers/foldEngine";
import { ZoomIn, ZoomOut, Maximize, Box } from "lucide-react";
import styles from "./Studio3DToolbar.module.css";

export interface CameraControlsAPI {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  setView: (view: "front" | "top" | "right" | "back" | "iso") => void;
}

export interface CameraBridgeProps {
  foldData: FoldData | null;
}

export const CameraBridge = forwardRef<CameraControlsAPI, CameraBridgeProps>(
  ({ foldData }, ref) => {
    const { camera, controls } = useThree();

    const getCenterAndDist = () => {
      let cx = 0,
        cy = 0,
        cz = 0,
        dist = 200;
      if (
        foldData &&
        foldData.verticesCoords &&
        foldData.verticesCoords.length > 0
      ) {
        let minX = Infinity,
          maxX = -Infinity;
        let minY = Infinity,
          maxY = -Infinity;
        let minZ = Infinity,
          maxZ = -Infinity;

        for (const [x, y, z] of foldData.verticesCoords) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          const realZ = z ?? 0;
          if (realZ < minZ) minZ = realZ;
          if (realZ > maxZ) maxZ = realZ;
        }

        cx = (minX + maxX) / 2;
        cy = (minY + maxY) / 2;
        cz = (minZ + maxZ) / 2;

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        const size = Math.max(sizeX, sizeY, sizeZ) || 200;
        dist = size * 1.8;
      }
      return { cx, cy, cz, dist };
    };

    const updateCamera = (
      px: number,
      py: number,
      pz: number,
      tx: number,
      ty: number,
      tz: number
    ) => {
      camera.position.set(px, py, pz);
      camera.updateProjectionMatrix();
      if (controls && (controls as any).target) {
        (controls as any).target.set(tx, ty, tz);
        (controls as any).update();
      }
    };

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        if ("fov" in camera) {
          if (controls && (controls as any).target) {
            const target = (controls as any).target;
            const dir = new THREE.Vector3().subVectors(camera.position, target);
            dir.multiplyScalar(0.8);
            camera.position.copy(target).add(dir);
            camera.updateProjectionMatrix();
            (controls as any).update();
          }
        }
      },
      zoomOut: () => {
        if ("fov" in camera) {
          if (controls && (controls as any).target) {
            const target = (controls as any).target;
            const dir = new THREE.Vector3().subVectors(camera.position, target);
            dir.multiplyScalar(1.25);
            camera.position.copy(target).add(dir);
            camera.updateProjectionMatrix();
            (controls as any).update();
          }
        }
      },
      resetView: () => {
        const { cx, cy, cz, dist } = getCenterAndDist();
        updateCamera(cx + dist, cy - dist, cz + dist * 0.8, cx, cy, cz);
      },
      setView: (view) => {
        const { cx, cy, cz, dist } = getCenterAndDist();
        switch (view) {
          case "front":
            updateCamera(cx, cy - dist, cz, cx, cy, cz);
            break;
          case "back":
            updateCamera(cx, cy + dist, cz, cx, cy, cz);
            break;
          case "right":
            updateCamera(cx + dist, cy, cz, cx, cy, cz);
            break;
          case "top":
            // Offset y slightly to avoid gimbal lock when up is [0,0,1]
            updateCamera(cx, cy - 0.01, cz + dist, cx, cy, cz);
            break;
          case "iso":
            updateCamera(cx + dist, cy - dist, cz + dist * 0.8, cx, cy, cz);
            break;
        }
      },
    }));

    return null;
  }
);

export interface Studio3DToolbarProps {
  controlsRef: React.RefObject<CameraControlsAPI | null>;
}

export function Studio3DToolbar({ controlsRef }: Studio3DToolbarProps) {
  const handleAction = (action: (api: CameraControlsAPI) => void) => {
    if (controlsRef.current) {
      action(controlsRef.current);
    }
  };

  return (
    <div className={styles.toolbarContainer}>
      <div className={styles.toolbar}>
        <button
          className={styles.button}
          onClick={() => handleAction((api) => api.setView("top"))}
          title="Top View"
        >
          T
        </button>
        <button
          className={styles.button}
          onClick={() => handleAction((api) => api.setView("front"))}
          title="Front View"
        >
          F
        </button>
        <button
          className={styles.button}
          onClick={() => handleAction((api) => api.setView("right"))}
          title="Right View"
        >
          R
        </button>
        <button
          className={styles.button}
          onClick={() => handleAction((api) => api.setView("back"))}
          title="Back View"
        >
          B
        </button>
        <button
          className={styles.button}
          onClick={() => handleAction((api) => api.setView("iso"))}
          title="Isometric View"
        >
          <Box size={14} />
        </button>

        <div className={styles.separator} />

        <button
          className={styles.button}
          onClick={() => handleAction((api) => api.zoomIn())}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          className={styles.button}
          onClick={() => handleAction((api) => api.zoomOut())}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          className={styles.button}
          onClick={() => handleAction((api) => api.resetView())}
          title="Fit / Reset View"
        >
          <Maximize size={14} />
        </button>
      </div>
    </div>
  );
}