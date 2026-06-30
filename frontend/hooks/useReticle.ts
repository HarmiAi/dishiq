import { useState, useRef, useCallback } from 'react';
import { ReticleManager } from '@/lib/ar/core/ReticleManager';
import * as THREE from 'three';

/**
 * Hook to consume AR Reticle placement indicators and bridge updates to components.
 */
export function useReticle(initialDebug = false) {
  const [isVisible, setIsVisible] = useState(false);
  const [debug, setDebugState] = useState(initialDebug);
  
  const managerRef = useRef<ReticleManager | null>(null);

  const initReticle = useCallback((scene: THREE.Scene) => {
    if (!managerRef.current) {
      managerRef.current = new ReticleManager(scene, initialDebug);
    }
  }, [initialDebug]);

  const updateReticle = useCallback((hasHit: boolean, hitMatrix: THREE.Matrix4, deltaTime: number) => {
    if (managerRef.current) {
      managerRef.current.update(hasHit, hitMatrix, deltaTime);
      setIsVisible(managerRef.current.isVisible());
    }
  }, []);

  const clearReticle = useCallback((scene: THREE.Scene) => {
    if (managerRef.current) {
      managerRef.current.dispose(scene);
      managerRef.current = null;
      setIsVisible(false);
    }
  }, []);

  const setDebug = useCallback((enabled: boolean) => {
    setDebugState(enabled);
  }, []);

  return {
    isVisible,
    debug,
    setDebug,
    initReticle,
    updateReticle,
    clearReticle,
    position: managerRef.current ? managerRef.current.getPosition() : new THREE.Vector3(),
    quaternion: managerRef.current ? managerRef.current.getQuaternion() : new THREE.Quaternion()
  };
}
