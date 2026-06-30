import * as THREE from 'three';

export interface PlacementPose {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  matrix: THREE.Matrix4;
  timestamp: number;
  valid: boolean;
}

/**
 * Handles target placement selection on active surfaces.
 * Validates hits, captures position/rotation matrices, and records timestamps.
 */
export class PlacementManager {
  private placement: PlacementPose | null = null;
  private debug: boolean = false;
  private onPlacementCallback: ((pose: PlacementPose) => void) | null = null;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  public setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  public onPlacement(cb: (pose: PlacementPose) => void): void {
    this.onPlacementCallback = cb;
  }

  /**
   * Processes a tap input event. If a valid tracking hit exists,
   * it captures and caches the target 3D transform pose.
   */
  public handleSelect(
    hasHit: boolean,
    hitMatrix: THREE.Matrix4,
    hitQuaternion: THREE.Quaternion
  ): boolean {
    if (!hasHit) {
      if (this.debug) {
        console.log('[WebXR Placement] Select ignored: no tracking target surface.');
      }
      return false;
    }

    const position = new THREE.Vector3().setFromMatrixPosition(hitMatrix);
    const rotation = hitQuaternion.clone();
    const matrix = hitMatrix.clone();
    
    this.placement = {
      position,
      rotation,
      matrix,
      timestamp: Date.now(),
      valid: true
    };

    if (this.debug) {
      console.log(`[WebXR Placement] Placement Point Stored:
        Position: X: ${position.x.toFixed(3)}, Y: ${position.y.toFixed(3)}, Z: ${position.z.toFixed(3)}
        Rotation: W: ${rotation.w.toFixed(3)}, X: ${rotation.x.toFixed(3)}`);
    }

    if (this.onPlacementCallback) {
      this.onPlacementCallback(this.placement);
    }

    return true;
  }

  public getPlacement(): PlacementPose | null {
    return this.placement;
  }

  public clear(): void {
    this.placement = null;
    if (this.debug) {
      console.log('[WebXR Placement] Placement cleared.');
    }
  }
}
