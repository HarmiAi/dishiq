import * as THREE from 'three';

/**
 * Encapsulates the Three.js Scene, keeping backgrounds transparent 
 * for pass-through camera overlays.
 */
export class ARScene {
  private scene: THREE.Scene;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = null;
  }

  getThreeScene(): THREE.Scene {
    return this.scene;
  }

  clear(): void {
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
    }
  }
}
