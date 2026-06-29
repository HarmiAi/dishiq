import * as THREE from 'three';

/**
 * Handles WebXR Hit Test operations, requesting viewer reference spaces,
 * capturing pose matrices, and updating hit coordinate flags.
 */
export class HitTestManager {
  private xrHitTestSource: any = null;
  private hitTestResultMatrix = new THREE.Matrix4();
  private hasHit: boolean = false;

  async requestHitTestSource(session: any): Promise<void> {
    try {
      const referenceSpace = await session.requestReferenceSpace('viewer');
      this.xrHitTestSource = await session.requestHitTestSource({ space: referenceSpace });
    } catch (error) {
      console.error('Failed to request WebXR Hit Test Source:', error);
      this.xrHitTestSource = null;
    }
  }

  processFrame(frame: any, referenceSpace: any): boolean {
    this.hasHit = false;
    if (!this.xrHitTestSource) return false;

    const hitTestResults = frame.getHitTestResults(this.xrHitTestSource);
    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      const pose = hit.getPose(referenceSpace);
      if (pose) {
        this.hasHit = true;
        this.hitTestResultMatrix.fromArray(pose.transform.matrix);
        return true;
      }
    }
    return false;
  }

  getHitResultMatrix(): THREE.Matrix4 {
    return this.hitTestResultMatrix;
  }

  hasValidHit(): boolean {
    return this.hasHit;
  }

  dispose(): void {
    if (this.xrHitTestSource) {
      this.xrHitTestSource.cancel();
      this.xrHitTestSource = null;
    }
  }
}
