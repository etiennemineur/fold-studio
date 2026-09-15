import React, { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

interface StudioTrackpadControlsProps {
  minDistance?: number;
  maxDistance?: number;
  dampingFactor?: number;
  rotateSpeed?: number;
  panSpeed?: number;
  zoomSpeed?: number;
}

type GestureEventLike = Event & {
  scale: number;
  rotation: number;
};

/**
 * Orbit navigation tuned for precision trackpads:
 * - click + drag: orbit
 * - two-finger scroll: pan
 * - pinch: zoom
 * - shift + two-finger scroll: orbit
 * - Safari two-finger rotation gesture: orbit around the target
 */
export function StudioTrackpadControls({
  minDistance = 10,
  maxDistance = 10000,
  dampingFactor = 0.12,
  rotateSpeed = 0.8,
  panSpeed = 0.9,
  zoomSpeed = 1.15,
}: StudioTrackpadControlsProps) {
  const orbitRef = useRef<any>(null);
  const { camera, gl, invalidate } = useThree();
  const isPerspectiveCamera = "fov" in camera;
  const isOrthographicCamera = "zoom" in camera && "top" in camera && !isPerspectiveCamera;

  // Floot's R3F alpha can load Three.js through more than one module instance.
  // Feature flags are therefore more reliable than instanceof checks.
  if (isPerspectiveCamera && !(camera as any).isPerspectiveCamera) {
    (camera as any).isPerspectiveCamera = true;
  }
  if (isOrthographicCamera && !(camera as any).isOrthographicCamera) {
    (camera as any).isOrthographicCamera = true;
  }

  useEffect(() => {
    const element = gl.domElement;
    let gestureScale = 1;
    let gestureRotation = 0;

    const finishUpdate = () => {
      camera.updateProjectionMatrix();
      orbitRef.current?.update();
      invalidate();
    };

    const zoomByFactor = (factor: number) => {
      const controls = orbitRef.current;
      if (!controls) return;

      if (isPerspectiveCamera) {
        const offset = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(
          offset.length() * factor,
          minDistance,
          maxDistance
        );
        if (offset.lengthSq() === 0) offset.set(0, 0, 1);
        offset.setLength(distance);
        camera.position.copy(controls.target).add(offset);
      } else if (isOrthographicCamera) {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, 0.02, 100);
      }

      finishUpdate();
    };

    const panByPixels = (deltaX: number, deltaY: number) => {
      const controls = orbitRef.current;
      if (!controls) return;

      camera.updateMatrix();
      const viewportHeight = Math.max(element.clientHeight, 1);
      let unitsPerPixel = 1;

      if (isPerspectiveCamera) {
        const distance = camera.position.distanceTo(controls.target);
        const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        unitsPerPixel = visibleHeight / viewportHeight;
      } else if (isOrthographicCamera) {
        unitsPerPixel = (camera.top - camera.bottom) / camera.zoom / viewportHeight;
      }

      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      const offset = right
        .multiplyScalar(deltaX * unitsPerPixel * panSpeed)
        .add(up.multiplyScalar(-deltaY * unitsPerPixel * panSpeed));

      camera.position.add(offset);
      controls.target.add(offset);
      finishUpdate();
    };

    const rotateByPixels = (deltaX: number, deltaY: number) => {
      const controls = orbitRef.current;
      if (!controls) return;

      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= deltaX * 0.004 * rotateSpeed;
      spherical.phi -= deltaY * 0.004 * rotateSpeed;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.01, Math.PI - 0.01);

      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      camera.lookAt(controls.target);
      finishUpdate();
    };

    const handleWheel = (event: WheelEvent) => {
      if (!orbitRef.current) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.ctrlKey || event.metaKey) {
        zoomByFactor(Math.exp(event.deltaY * 0.0025 * zoomSpeed));
      } else if (event.shiftKey) {
        rotateByPixels(event.deltaX || event.deltaY, event.deltaY);
      } else {
        panByPixels(event.deltaX, event.deltaY);
      }
    };

    const handleGestureStart = (event: Event) => {
      const gesture = event as GestureEventLike;
      event.preventDefault();
      gestureScale = gesture.scale || 1;
      gestureRotation = gesture.rotation || 0;
    };

    const handleGestureChange = (event: Event) => {
      const gesture = event as GestureEventLike;
      event.preventDefault();
      event.stopImmediatePropagation();

      const nextScale = gesture.scale || gestureScale;
      if (nextScale > 0 && gestureScale > 0) {
        zoomByFactor(gestureScale / nextScale);
      }

      const nextRotation = gesture.rotation || 0;
      rotateByPixels((nextRotation - gestureRotation) * 1.5, 0);
      gestureScale = nextScale;
      gestureRotation = nextRotation;
    };

    element.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    element.addEventListener("gesturestart", handleGestureStart, { passive: false });
    element.addEventListener("gesturechange", handleGestureChange, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel, { capture: true });
      element.removeEventListener("gesturestart", handleGestureStart);
      element.removeEventListener("gesturechange", handleGestureChange);
    };
  }, [camera, gl, invalidate, maxDistance, minDistance, panSpeed, rotateSpeed, zoomSpeed]);

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enableDamping
      dampingFactor={dampingFactor}
      rotateSpeed={rotateSpeed}
      zoomSpeed={zoomSpeed}
      panSpeed={panSpeed}
      minDistance={minDistance}
      maxDistance={maxDistance}
      enableRotate
      enableZoom
      enablePan
      screenSpacePanning
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  );
}