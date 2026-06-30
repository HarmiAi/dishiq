import { useState, useRef, useCallback } from 'react';
import { PlacementManager, PlacementPose } from '@/lib/ar/core/PlacementManager';
import * as THREE from 'three';

/**
 * Hook to consume user tap placement logic and coordinate valid placement states.
 */
export function usePlacement(initialDebug = false) {
  const [placement, setPlacementState] = useState<PlacementPose | null>(null);
  const [debug, setDebugState] = useState(initialDebug);

  const managerRef = useRef<PlacementManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new PlacementManager(initialDebug);
    managerRef.current.onPlacement((pose) => {
      setPlacementState(pose);
    });
  }

  const manager = managerRef.current;

  const setDebug = useCallback((enabled: boolean) => {
    setDebugState(enabled);
    manager.setDebug(enabled);
  }, [manager]);

  const triggerPlacement = useCallback((
    hasHit: boolean,
    hitMatrix: THREE.Matrix4,
    hitQuaternion: THREE.Quaternion
  ) => {
    return manager.handleSelect(hasHit, hitMatrix, hitQuaternion);
  }, [manager]);

  const clearPlacement = useCallback(() => {
    manager.clear();
    setPlacementState(null);
  }, [manager]);

  return {
    placement,
    isValid: placement?.valid ?? false,
    debug,
    setDebug,
    triggerPlacement,
    clearPlacement
  };
}
