import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Handles fetching, loading, preloading, and memory caching of 3D GLB models.
 * Ensures model assets are downloaded once and cloned dynamically for multiple instances.
 */
export class AssetManager {
  private loader: GLTFLoader;
  private cache: Map<string, THREE.Group> = new Map();
  private loadingPromises: Map<string, Promise<THREE.Group>> = new Map();

  constructor() {
    this.loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.loader.setDRACOLoader(dracoLoader);
  }

  async loadModel(url: string): Promise<THREE.Group> {
    // 1. Return clone if model exists in memory cache
    if (this.cache.has(url)) {
      const cached = this.cache.get(url)!;
      return cached.clone(true);
    }

    // 2. Return promise if model is currently downloading
    if (this.loadingPromises.has(url)) {
      const promise = this.loadingPromises.get(url)!;
      const loaded = await promise;
      return loaded.clone(true);
    }

    // 3. Initiate file fetch loader
    const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
      this.loader.load(
        url,
        (gltf: any) => {
          const group = gltf.scene;
          
          // Configure shadows and PBR properties for all child meshes
          group.traverse((node: any) => {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              
              if (node.material) {
                // Ensure physical materials react realistically to ambient occlusion
                node.material.roughness = Math.max(node.material.roughness, 0.2);
                node.material.metalness = Math.min(node.material.metalness, 0.8);
              }
            }
          });

          this.cache.set(url, group);
          this.loadingPromises.delete(url);
          resolve(group);
        },
        undefined, // onProgress omitted for simplicity
        (error: any) => {
          this.loadingPromises.delete(url);
          reject(error);
        }
      );
    });

    this.loadingPromises.set(url, loadPromise);
    const group = await loadPromise;
    return group.clone(true);
  }

  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }
}
