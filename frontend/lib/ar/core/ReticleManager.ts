import * as THREE from 'three';

/**
 * Manages the 3D Reticle placement indicator, updates its world position/rotation
 * relative to the WebXR hit test matrix, and drives smooth visibility animations.
 */
export class ReticleManager {
  private reticleMesh: THREE.Mesh | null = null;
  private targetOpacity: number = 0.85;
  private currentOpacity: number = 0;
  private pulseTime: number = 0;
  private debug: boolean = false;

  constructor(scene: THREE.Scene, debug: boolean = false) {
    this.debug = debug;
    this.createReticleMesh(scene);
  }

  private createReticleMesh(scene: THREE.Scene): void {
    // 1. Create outer placement ring
    const ringGeom = new THREE.RingGeometry(0.11, 0.13, 32);
    ringGeom.rotateX(-Math.PI / 2); // Orient flat on the horizontal surface
    
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false, // Prevents depth buffer conflicts on surface alignment
      blending: THREE.NormalBlending
    });

    this.reticleMesh = new THREE.Mesh(ringGeom, ringMat);
    this.reticleMesh.visible = false;
    
    // Add inner subtle visual pointer dot
    const dotGeom = new THREE.RingGeometry(0, 0.02, 16);
    dotGeom.rotateX(-Math.PI / 2);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    this.reticleMesh.add(dotMesh);

    scene.add(this.reticleMesh);

    if (this.debug) {
      console.log('[WebXR Reticle] Reticle mesh initialized and added to scene.');
    }
  }

  /**
   * Updates reticle transforms, opacities, and animation pulses.
   * Call from the XRAnimationLoop frame processor.
   */
  public update(hasHit: boolean, hitMatrix: THREE.Matrix4, deltaTime: number): void {
    if (!this.reticleMesh) return;

    if (hasHit) {
      // 1. Decouple transforms from hit pose
      this.reticleMesh.position.setFromMatrixPosition(hitMatrix);
      this.reticleMesh.quaternion.setFromRotationMatrix(hitMatrix);
      
      // Smooth fade-in
      this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, this.targetOpacity, 0.12);
      this.reticleMesh.visible = true;
      
      // Subtle pulse scale oscillation
      this.pulseTime += deltaTime * 2.2;
      const pulseScale = 1.0 + Math.sin(this.pulseTime) * 0.04;
      this.reticleMesh.scale.set(pulseScale, 1.0, pulseScale);
    } else {
      // Smooth fade-out
      this.currentOpacity = THREE.MathUtils.lerp(this.currentOpacity, 0, 0.18);
      if (this.currentOpacity < 0.01) {
        this.reticleMesh.visible = false;
      }
    }

    // Apply calculated opacity to main ring and children
    const mainMat = this.reticleMesh.material as THREE.MeshBasicMaterial;
    mainMat.opacity = this.currentOpacity;
    
    this.reticleMesh.children.forEach((child) => {
      const childMesh = child as THREE.Mesh;
      const childMat = childMesh.material as THREE.MeshBasicMaterial;
      childMat.opacity = this.currentOpacity * 0.75; // Make the inner dot slightly softer
    });

    if (this.debug && hasHit && Math.random() < 0.01) {
      console.log(`[WebXR Reticle] Tracking coordinates: X: ${this.reticleMesh.position.x.toFixed(3)}, Y: ${this.reticleMesh.position.y.toFixed(3)}, Z: ${this.reticleMesh.position.z.toFixed(3)}`);
    }
  }

  public isVisible(): boolean {
    return this.reticleMesh ? this.reticleMesh.visible : false;
  }

  public getPosition(): THREE.Vector3 {
    return this.reticleMesh ? this.reticleMesh.position : new THREE.Vector3();
  }

  public getQuaternion(): THREE.Quaternion {
    return this.reticleMesh ? this.reticleMesh.quaternion : new THREE.Quaternion();
  }

  /**
   * Disposes of geometries, materials, and references to prevent GPU leaks.
   */
  public dispose(scene: THREE.Scene): void {
    if (this.reticleMesh) {
      scene.remove(this.reticleMesh);
      
      // Dispose children meshes
      this.reticleMesh.children.forEach((child) => {
        const childMesh = child as THREE.Mesh;
        childMesh.geometry.dispose();
        (childMesh.material as THREE.Material).dispose();
      });

      this.reticleMesh.geometry.dispose();
      (this.reticleMesh.material as THREE.Material).dispose();
      this.reticleMesh = null;
    }
  }
}
