import * as THREE from 'three';

export interface PlacedObject {
  id: string;
  itemId: string;
  group: THREE.Group;
  boundingBox: THREE.Box3;
  selected: boolean;
  metadata: {
    name: string;
    price: number;
    modelScale: number;
  };
}

/**
 * Manages the scene graph nodes, tracks placed items list, handles selection states,
 * and releases GPU resources upon object deletion.
 */
export class SceneManager {
  private scene: THREE.Scene;
  private placedObjects: PlacedObject[] = [];
  private selectedObject: PlacedObject | null = null;
  private selectionCallbacks: ((obj: PlacedObject | null) => void)[] = [];

  constructor() {
    this.scene = new THREE.Scene();
  }

  getThreeScene(): THREE.Scene {
    return this.scene;
  }

  onSelectionChanged(cb: (obj: PlacedObject | null) => void): void {
    this.selectionCallbacks.push(cb);
  }

  addObject(
    itemId: string,
    modelGroup: THREE.Group,
    metadata: { name: string; price: number; modelScale: number }
  ): PlacedObject {
    const id = Math.random().toString(36).substring(2, 9);
    const boundingBox = new THREE.Box3().setFromObject(modelGroup);

    const obj: PlacedObject = {
      id,
      itemId,
      group: modelGroup,
      boundingBox,
      selected: false,
      metadata
    };

    this.placedObjects.push(obj);
    this.scene.add(modelGroup);
    
    // Automatically select the newly spawned item
    this.selectObject(id);

    return obj;
  }

  removeObject(id: string): void {
    const idx = this.placedObjects.findIndex((o) => o.id === id);
    if (idx === -1) return;

    const obj = this.placedObjects[idx];
    this.scene.remove(obj.group);
    
    // Clean up GPU geometries and materials to avoid memory leaks
    obj.group.traverse((node: any) => {
      if (node.isMesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach((m: any) => m.dispose());
        } else {
          node.material.dispose();
        }
      }
    });

    this.placedObjects.splice(idx, 1);
    
    if (this.selectedObject?.id === id) {
      this.selectObject(null);
    }
  }

  getObjects(): PlacedObject[] {
    return this.placedObjects;
  }

  getSelectedObject(): PlacedObject | null {
    return this.selectedObject;
  }

  selectObject(id: string | null): void {
    // Clear existing outlines
    this.placedObjects.forEach((o) => {
      o.selected = false;
      const outline = o.group.getObjectByName('selection-outline');
      if (outline) o.group.remove(outline);
    });

    if (!id) {
      this.selectedObject = null;
      this.selectionCallbacks.forEach((cb) => cb(null));
      return;
    }

    const obj = this.placedObjects.find((o) => o.id === id);
    if (obj) {
      obj.selected = true;
      this.selectedObject = obj;

      // Draw a circular base ring on the floor around the model bounding dimensions
      const size = new THREE.Vector3();
      obj.boundingBox.setFromObject(obj.group).getSize(size);
      const radius = Math.max(size.x, size.z) * 0.65;
      
      const ringGeom = new THREE.RingGeometry(radius * 0.95, radius, 32);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x6366f1, // Dishiq Indigo theme color
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.name = 'selection-outline';
      // Offset slightly to avoid floor plane grid z-clipping
      ring.position.set(0, 0.005, 0);
      obj.group.add(ring);
      
      this.selectionCallbacks.forEach((cb) => cb(obj));
    }
  }

  clearScene(): void {
    const ids = this.placedObjects.map((o) => o.id);
    ids.forEach((id) => this.removeObject(id));
  }
}
