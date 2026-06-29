import * as THREE from 'three';

/**
 * Manages perspective camera setups, aspect calculations, and viewport projection matrices.
 */
export class CameraManager {
  private camera: THREE.PerspectiveCamera;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      45, // Field of view
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.01, // Near plane (0.01 allows close-up camera angles)
      20 // Far plane
    );
    // Preset starting camera coords for Desktop 3D Orbit view
    this.camera.position.set(0, 0.4, 0.6);
  }

  getThreeCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
