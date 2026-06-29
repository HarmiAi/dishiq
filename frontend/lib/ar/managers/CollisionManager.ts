import * as THREE from 'three';
import { PlacedObject } from './SceneManager';

/**
 * Monitors bounding boxes overlaps in real-time, calculating 3D separation vectors 
 * and pushing items away horizontally to prevent overlapping or clipping.
 */
export class CollisionManager {
  checkCollisions(
    movingObj: PlacedObject,
    allObjects: PlacedObject[],
    targetPosition: THREE.Vector3
  ): { collides: boolean; adjustedPosition: THREE.Vector3 } {
    const adjustedPosition = targetPosition.clone();
    let collides = false;

    // 1. Project target bounding box
    const tempGroup = movingObj.group.clone();
    tempGroup.position.copy(targetPosition);
    const movingBox = new THREE.Box3().setFromObject(tempGroup);

    // 2. Scan for intersections
    for (const otherObj of allObjects) {
      if (otherObj.id === movingObj.id) continue;

      const otherBox = new THREE.Box3().setFromObject(otherObj.group);
      if (movingBox.intersectsBox(otherBox)) {
        collides = true;
        
        // Calculate separation push vector away from collision center
        const movingCenter = new THREE.Vector3();
        const otherCenter = new THREE.Vector3();
        movingBox.getCenter(movingCenter);
        otherBox.getCenter(otherCenter);

        const pushDirection = new THREE.Vector3()
          .subVectors(movingCenter, otherCenter)
          .setY(0) // Lock separation to floor horizontal plane
          .normalize();

        // Push model slightly past intersection boundaries
        const overlapSize = new THREE.Vector3();
        movingBox.intersect(otherBox).getSize(overlapSize);
        const pushDistance = Math.max(overlapSize.x, overlapSize.z) + 0.01;

        adjustedPosition.addScaledVector(pushDirection, pushDistance);
      }
    }

    return { collides, adjustedPosition };
  }
}
