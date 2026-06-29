import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Simple memory cache for preloaded models
const modelCache = new Map<string, THREE.Group>();

export const loadGLB = (
  url: string,
  onSuccess: (group: THREE.Group) => void,
  onError: (error: any) => void
): (() => void) => {
  // Check cache first
  if (modelCache.has(url)) {
    const cached = modelCache.get(url)!;
    onSuccess(cached.clone(true));
    return () => {};
  }

  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  
  // Set CDN path for Draco decoder files
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(dracoLoader);

  let active = true;

  loader.load(
    url,
    (gltf) => {
      if (!active) {
        // If component unmounted before load finished, clean up
        gltf.scene.traverse((child: any) => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: any) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        return;
      }
      
      // Store in cache
      modelCache.set(url, gltf.scene);
      onSuccess(gltf.scene.clone(true));
    },
    undefined,
    (err) => {
      if (active) {
        onError(err);
      }
    }
  );

  // Return cancel/cleanup function
  return () => {
    active = false;
    dracoLoader.dispose();
  };
};

export const clearModelCache = () => {
  modelCache.clear();
};
