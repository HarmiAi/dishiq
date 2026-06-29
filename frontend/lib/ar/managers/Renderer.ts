import * as THREE from 'three';

/**
 * Instantiates the WebGLRenderer and configures colorspaces, shadow maps, 
 * antialiasing, ACES filmic tonemappings, and XR activation flags.
 */
export class Renderer {
  private renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true, // Alpha must be true for WebXR camera feeds
      preserveDrawingBuffer: true // Required to allow scene screenshot captures
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  getThreeRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  enableXR(enable: boolean = true): void {
    this.renderer.xr.enabled = enable;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
