import { useEffect, useRef, useState } from 'react';
import { XRSessionManager, XRSessionState } from '@/lib/ar/core/XRSessionManager';
import { WebXRCapability } from '@/lib/ar/core/WebXR';
import * as THREE from 'three';

/**
 * Reusable hook to consume the WebXR session lifecycle in Next.js.
 * Handles automatic initialization checks, permissions, visibility states, and cleanup.
 */
export function useXRSession() {
  const [state, setState] = useState<XRSessionState>('idle');
  const [capability, setCapability] = useState<WebXRCapability | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const managerRef = useRef<XRSessionManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new XRSessionManager({
      onStateChange: (newState) => {
        setState(newState);
      },
      onError: (err) => {
        setError(err);
      },
      onSessionStart: () => {
        setError(null);
      },
      onSessionEnd: () => {
        // Clear any temporary states
      }
    });
  }

  const manager = managerRef.current;

  useEffect(() => {
    // Automatically trigger capability detection on mount
    manager.checkSupport().then((cap) => {
      setCapability(cap);
    });

    return () => {
      // Auto-cleanup on unmount to prevent leaks
      if (manager.getSession()) {
        manager.endAR();
      }
    };
  }, [manager]);

  const startAR = async (renderer: THREE.WebGLRenderer, options: XRSessionInit = {}) => {
    setError(null);
    try {
      return await manager.startAR(renderer, options);
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  const endAR = async () => {
    try {
      await manager.endAR();
    } catch (err: any) {
      setError(err);
      throw err;
    }
  };

  return {
    state,
    capability,
    error,
    isSupported: state !== 'unsupported' && (capability?.supported ?? false),
    isChecking: state === 'checking',
    startAR,
    endAR,
    session: manager.getSession()
  };
}
