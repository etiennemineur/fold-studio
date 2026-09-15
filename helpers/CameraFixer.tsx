import { useThree } from "@react-three/fiber";

/**
 * Fixes an issue where R3F v10 alpha might not correctly set `isPerspectiveCamera = true` 
 * on PerspectiveCamera instances, which breaks OrbitControls functionality like zoom/dolly.
 */
export function CameraFixer() {
  const { camera } = useThree();
  if (camera && 'fov' in camera && !(camera as any).isPerspectiveCamera) {
    (camera as any).isPerspectiveCamera = true;
  }
  return null;
}