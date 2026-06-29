import * as THREE from 'three';

/**
 * Manages PerspectiveCamera settings with close-range near planes.
 */
export class ARCamera {
  private camera: THREE.PerspectiveCamera;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75, // 75 Degree Field of View
      window.innerWidth / window.innerHeight,
      0.01, // Near clipping boundary
      100 // Far clipping boundary
    );
    this.camera.position.set(0, 0, 0); // Positioned at origin ready for XR tracking
  }

  getThreeCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
