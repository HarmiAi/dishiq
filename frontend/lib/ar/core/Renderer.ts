import * as THREE from 'three';

/**
 * Creates the WebGLRenderer core module with antialiasing, alpha channels,
 * ACES Filmic tonemappings, and WebXR bindings.
 */
export class ARRenderer {
  private renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true, // Transparent backdrop for AR camera feeds
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Set color space mapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Bind session settings
    this.renderer.xr.enabled = true;
  }

  getThreeRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
