import * as THREE from 'three';

/**
 * Manages soft ground shadows using an invisible ShadowMaterial plane 
 * that catches real-time shadows without drawing a solid floor grid.
 */
export class ShadowManager {
  private shadowPlane: THREE.Mesh | null = null;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create a large floor mesh that only receives shadows
    const planeGeo = new THREE.PlaneGeometry(100, 100);
    planeGeo.rotateX(-Math.PI / 2);
    
    const planeMat = new THREE.ShadowMaterial({
      opacity: 0.5 // Default soft shadow blend opacity
    });

    this.shadowPlane = new THREE.Mesh(planeGeo, planeMat);
    this.shadowPlane.receiveShadow = true;
    // Align shadow collector exactly with hit-test horizontal target planes
    this.shadowPlane.position.y = 0; 
    this.scene.add(this.shadowPlane);
  }

  setIntensity(opacity: number): void {
    if (this.shadowPlane) {
      const mat = this.shadowPlane.material as THREE.ShadowMaterial;
      mat.opacity = opacity;
    }
  }

  getFloorY(): number {
    return this.shadowPlane ? this.shadowPlane.position.y : 0;
  }
}
