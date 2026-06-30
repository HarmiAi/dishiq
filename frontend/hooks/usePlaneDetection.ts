import { useState, useRef, useCallback } from 'react';
import { PlaneManager, DetectedPlaneData, TrackingState } from '@/lib/ar/core/PlaneManager';

/**
 * Hook to consume plane detection surface events and track scanning status.
 */
export function usePlaneDetection(initialDebug = false) {
  const [planes, setPlanes] = useState<DetectedPlaneData[]>([]);
  const [trackingState, setTrackingState] = useState<TrackingState>('scanning');
  const [debug, setDebugState] = useState(initialDebug);

  const managerRef = useRef<PlaneManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new PlaneManager({
      onPlaneAdded: () => {
        if (managerRef.current) {
          setPlanes(managerRef.current.getPlanes());
        }
      },
      onPlaneUpdated: () => {
        if (managerRef.current) {
          setPlanes(managerRef.current.getPlanes());
        }
      },
      onPlaneRemoved: () => {
        if (managerRef.current) {
          setPlanes(managerRef.current.getPlanes());
        }
      },
      onTrackingStateChange: (state) => {
        setTrackingState(state);
      }
    }, initialDebug);
  }

  const manager = managerRef.current;

  const setDebug = useCallback((enabled: boolean) => {
    setDebugState(enabled);
    manager.setDebug(enabled);
  }, [manager]);

  const processPlaneFrame = useCallback((frame: XRFrame, referenceSpace: XRReferenceSpace) => {
    manager.processFrame(frame, referenceSpace);
  }, [manager]);

  const clearPlanes = useCallback(() => {
    manager.clear();
    setPlanes([]);
    setTrackingState('scanning');
  }, [manager]);

  return {
    planes,
    trackingState,
    debug,
    setDebug,
    processPlaneFrame,
    clearPlanes
  };
}
