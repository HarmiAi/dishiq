import * as THREE from 'three';
import { PlacedObject } from './SceneManager';

/**
 * Handles 3D gesture translation mapping. Listens to:
 * - Single-finger drag: Moves selected item on y = 0 horizontal plane
 * - Two-finger pinch: Scales the selected item
 * - Two-finger twist: Rotates the selected item around y-axis
 * - Double tap: Resets scale and rotation
 * - Tap empty/mesh: Object selection raycasting
 */
export class GestureManager {
  private domElement: HTMLElement;
  private camera: THREE.Camera;
  private sceneManager: any;
  
  private initialTouchDistance: number = 0;
  private initialRotationY: number = 0;
  private initialScale = new THREE.Vector3();
  
  private lastTapTime: number = 0;
  private longPressTimeout: any = null;

  constructor(domElement: HTMLElement, camera: THREE.Camera, sceneManager: any) {
    this.domElement = domElement;
    this.camera = camera;
    this.sceneManager = sceneManager;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touches = e.touches;
    
    // 1. Double Tap detect
    const now = Date.now();
    if (touches.length === 1) {
      if (now - this.lastTapTime < 300) {
        this.handleDoubleTap();
      }
      this.lastTapTime = now;

      // Long press detect
      this.longPressTimeout = setTimeout(() => {
        this.handleLongPress(touches[0].clientX, touches[0].clientY);
      }, 800);
    }

    // 2. Select target object
    if (touches.length === 1) {
      this.handleObjectSelection(touches[0].clientX, touches[0].clientY);
    }

    // 3. Pinch details cache
    if (touches.length === 2) {
      this.initialTouchDistance = this.getTouchDistance(touches[0], touches[1]);
      
      const selected = this.sceneManager.getSelectedObject();
      if (selected) {
        this.initialRotationY = selected.group.rotation.y;
        this.initialScale.copy(selected.group.scale);
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }

    const touches = e.touches;
    const selected = this.sceneManager.getSelectedObject();
    if (!selected) return;

    // Single finger swipe -> translation
    if (touches.length === 1) {
      this.moveObject(selected, touches[0].clientX, touches[0].clientY);
    }

    // Double finger -> pinch to scale & twist to rotate
    if (touches.length === 2) {
      const currentDistance = this.getTouchDistance(touches[0], touches[1]);
      if (this.initialTouchDistance > 0 && currentDistance > 0) {
        const ratio = currentDistance / this.initialTouchDistance;
        const targetScale = this.initialScale.clone().multiplyScalar(ratio);
        // Clamp scale ranges between 0.3x and 3.0x to avoid extreme sizes
        const scaleVal = Math.max(0.3, Math.min(targetScale.x, 3.0));
        selected.group.scale.set(scaleVal, scaleVal, scaleVal);
      }

      // Rotate calculations
      const dx = touches[1].clientX - touches[0].clientX;
      const angle = Math.atan2(touches[1].clientY - touches[0].clientY, dx);
      if (!(this as any).initialAngle) {
        (this as any).initialAngle = angle;
      } else {
        const deltaAngle = angle - (this as any).initialAngle;
        selected.group.rotation.y = this.initialRotationY + deltaAngle;
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
    (this as any).initialAngle = null;
  }

  private getTouchDistance(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private handleObjectSelection(clientX: number, clientY: number): void {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const rect = this.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, this.camera);
    
    const objects = this.sceneManager.getObjects();
    const intersectables = objects.map((o: any) => o.group);

    const intersects = raycaster.intersectObjects(intersectables, true);
    if (intersects.length > 0) {
      let hitNode = intersects[0].object;
      while (hitNode.parent && !intersectables.includes(hitNode as any)) {
        hitNode = hitNode.parent;
      }
      const matched = objects.find((o: any) => o.group === hitNode);
      if (matched) {
        this.sceneManager.selectObject(matched.id);
      }
    }
  }

  private moveObject(obj: PlacedObject, clientX: number, clientY: number): void {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const rect = this.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, this.camera);

    // Intersect invisible floor plane at y = 0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, target)) {
      obj.group.position.set(target.x, obj.group.position.y, target.z);
    }
  }

  private handleDoubleTap(): void {
    const selected = this.sceneManager.getSelectedObject();
    if (selected) {
      selected.group.rotation.set(0, 0, 0);
      const scale = selected.metadata.modelScale || 1.0;
      selected.group.scale.set(scale, scale, scale);
      toastInfo('Reset', 'Restored original scale and rotation.');
    }
  }

  private handleLongPress(clientX: number, clientY: number): void {
    const selected = this.sceneManager.getSelectedObject();
    if (selected) {
      const CustomEvent = new window.CustomEvent('ar-long-press', {
        detail: {
          name: selected.metadata.name,
          price: selected.metadata.price
        }
      });
      window.dispatchEvent(CustomEvent);
    }
  }
}

function toastInfo(title: string, desc: string): void {
  const Event = new window.CustomEvent('ar-toast', { detail: { title, desc } });
  window.dispatchEvent(Event);
}
