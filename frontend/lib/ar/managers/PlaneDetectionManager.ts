import * as THREE from 'three';

/**
 * Manages the target placement reticle (Green ring and dot indicators) 
 * which projects onto the detected surface to guide the user before placing food.
 */
export class PlaneDetectionManager {
  private reticle: THREE.Mesh;
  private scene: THREE.Scene;
  private visible: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create placement ring
    const geometry = new THREE.RingGeometry(0.08, 0.1, 32);
    geometry.rotateX(-Math.PI / 2);
    
    const material = new THREE.MeshBasicMaterial({
      color: 0x22c55e, // Green = valid plane surface found
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });

    this.reticle = new THREE.Mesh(geometry, material);
    this.reticle.name = 'ar-reticle';
    this.reticle.visible = false;
    
    // Add center alignment dot
    const centerDotGeo = new THREE.CircleGeometry(0.015, 16);
    centerDotGeo.rotateX(-Math.PI / 2);
    const centerDotMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.8
    });
    const centerDot = new THREE.Mesh(centerDotGeo, centerDotMat);
    this.reticle.add(centerDot);

    this.scene.add(this.reticle);
  }

  update(matrix: THREE.Matrix4): void {
    // Copy projection matrix from XR hit-test results directly
    this.reticle.matrixAutoUpdate = false;
    this.reticle.matrix.copy(matrix);
    this.reticle.matrix.decompose(
      this.reticle.position,
      this.reticle.quaternion,
      this.reticle.scale
    );
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.reticle.visible = visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getReticleMesh(): THREE.Mesh {
    return this.reticle;
  }

  setValid(isValid: boolean): void {
    const mat = this.reticle.material as THREE.MeshBasicMaterial;
    mat.color.setHex(isValid ? 0x22c55e : 0xef4444); // Green vs. Red
    
    const center = this.reticle.children[0] as THREE.Mesh;
    const centerMat = center.material as THREE.MeshBasicMaterial;
    centerMat.color.setHex(isValid ? 0x22c55e : 0xef4444);
  }
}
