import * as THREE from 'three';

/**
 * Aligning placed food meshes with target plane hit vectors.
 */
export class AnchorManager {
  anchorObject(objectGroup: THREE.Group, position: THREE.Vector3, rotationY: number = 0): void {
    // Set position to the exact coordinate mapping returned by hit-test
    objectGroup.position.copy(position);
    objectGroup.rotation.set(0, rotationY, 0);
  }
}
