import * as THREE from 'three';

export interface DetectedPlaneData {
  id: string;
  orientation: 'horizontal' | 'vertical';
  lastChangedTime: number;
  matrix: THREE.Matrix4;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  polygon: { x: number; z: number }[];
}

export type TrackingState = 'scanning' | 'detected' | 'lost';

export interface PlaneManagerEvents {
  onPlaneAdded?: (plane: DetectedPlaneData) => void;
  onPlaneUpdated?: (plane: DetectedPlaneData) => void;
  onPlaneRemoved?: (id: string) => void;
  onTrackingStateChange?: (state: TrackingState) => void;
}

/**
 * Manages WebXR Plane Detection lifecycles and surface tracking.
 * Operates at frame-rate within the XR animation loop.
 */
export class PlaneManager {
  private planes = new Map<XRPlane, DetectedPlaneData>();
  private trackingState: TrackingState = 'scanning';
  private debug: boolean = false;
  private events: PlaneManagerEvents;

  constructor(events: PlaneManagerEvents = {}, debug: boolean = false) {
    this.events = events;
    this.debug = debug;
  }

  public setDebug(enabled: boolean): void {
    this.debug = enabled;
  }

  public getPlanes(): DetectedPlaneData[] {
    return Array.from(this.planes.values());
  }

  public getTrackingState(): TrackingState {
    return this.trackingState;
  }

  private setTrackingState(newState: TrackingState): void {
    if (this.trackingState === newState) return;
    this.trackingState = newState;
    if (this.events.onTrackingStateChange) {
      this.events.onTrackingStateChange(newState);
    }
    if (this.debug) {
      console.log(`[WebXR Planes] Tracking State changed to: ${newState}`);
    }
  }

  /**
   * Main ticking interface. Call this from the XRAnimationLoop on every frame.
   */
  public processFrame(frame: XRFrame, referenceSpace: XRReferenceSpace): void {
    // 1. Verify tracking loss status
    const viewerPose = frame.getViewerPose(referenceSpace);
    if (!viewerPose) {
      this.setTrackingState('lost');
      return;
    }

    // 2. Fallback check for plane-detection availability
    // Note: Some browsers/devices return undefined if the feature wasn't requested or supported
    const framePlanes = (frame as any).detectedPlanes as Set<XRPlane> | undefined;
    if (!framePlanes) {
      if (this.debug) {
        console.warn('[WebXR Planes] frame.detectedPlanes is unavailable in this session.');
      }
      return;
    }

    // Update tracking state based on plane counts
    if (framePlanes.size > 0 && this.trackingState === 'scanning') {
      this.setTrackingState('detected');
    } else if (framePlanes.size === 0 && this.trackingState === 'detected') {
      this.setTrackingState('scanning');
    }

    const currentXRPlanes = new Set<XRPlane>();

    // 3. Track updates and additions
    for (const xrPlane of framePlanes) {
      currentXRPlanes.add(xrPlane);
      
      const planePose = frame.getPose(xrPlane.planeSpace, referenceSpace);
      if (!planePose) continue;

      const position = new THREE.Vector3(
        planePose.transform.position.x,
        planePose.transform.position.y,
        planePose.transform.position.z
      );

      const rotation = new THREE.Quaternion(
        planePose.transform.orientation.x,
        planePose.transform.orientation.y,
        planePose.transform.orientation.z,
        planePose.transform.orientation.w
      );

      const matrix = new THREE.Matrix4().compose(
        position,
        rotation,
        new THREE.Vector3(1, 1, 1)
      );

      // Parse polygon points
      const polygon = (xrPlane.polygon || []).map((point: any) => ({
        x: point.x,
        z: point.z
      }));

      // Generate unique ID based on creation properties
      const id = `plane_${xrPlane.orientation}_${xrPlane.lastChangedTime}`;

      const existingData = this.planes.get(xrPlane);

      if (!existingData) {
        // Plane Added
        const newData: DetectedPlaneData = {
          id,
          orientation: xrPlane.orientation,
          lastChangedTime: xrPlane.lastChangedTime,
          matrix,
          position,
          rotation,
          polygon
        };
        this.planes.set(xrPlane, newData);
        if (this.events.onPlaneAdded) {
          this.events.onPlaneAdded(newData);
        }
        if (this.debug) {
          console.log(`[WebXR Planes] Added plane: ${id} (${xrPlane.orientation})`);
        }
      } else if (existingData.lastChangedTime !== xrPlane.lastChangedTime) {
        // Plane Updated
        const updatedData: DetectedPlaneData = {
          ...existingData,
          lastChangedTime: xrPlane.lastChangedTime,
          matrix,
          position,
          rotation,
          polygon
        };
        this.planes.set(xrPlane, updatedData);
        if (this.events.onPlaneUpdated) {
          this.events.onPlaneUpdated(updatedData);
        }
        if (this.debug) {
          console.log(`[WebXR Planes] Updated plane: ${existingData.id}`);
        }
      }
    }

    // 4. Track removals
    for (const cachedXRPlane of this.planes.keys()) {
      if (!currentXRPlanes.has(cachedXRPlane)) {
        const removedData = this.planes.get(cachedXRPlane);
        if (removedData) {
          this.planes.delete(cachedXRPlane);
          if (this.events.onPlaneRemoved) {
            this.events.onPlaneRemoved(removedData.id);
          }
          if (this.debug) {
            console.log(`[WebXR Planes] Removed plane: ${removedData.id}`);
          }
        }
      }
    }
  }

  /**
   * Performs local state garbage collection during session closures.
   */
  public clear(): void {
    if (this.debug && this.planes.size > 0) {
      console.log('[WebXR Planes] Clearing plane collection.');
    }
    this.planes.clear();
    this.setTrackingState('scanning');
  }
}
