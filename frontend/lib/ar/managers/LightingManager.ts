import * as THREE from 'three';

/**
 * Configures directional and ambient lighting rigs, setups shadow map cameras,
 * and updates color temp preset matrices (Warm, Cool, Restaurant, Outdoor).
 */
export class LightingManager {
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Ambient light coordinates for overall illumination base
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambientLight);

    // Directional light casting soft ground contact shadows
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(1.5, 3.0, 1.0);
    this.directionalLight.castShadow = true;
    
    // Configure shadow map dimensions
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.camera.near = 0.1;
    this.directionalLight.shadow.camera.far = 10;
    
    const d = 1.0;
    this.directionalLight.shadow.camera.left = -d;
    this.directionalLight.shadow.camera.right = d;
    this.directionalLight.shadow.camera.top = d;
    this.directionalLight.shadow.camera.bottom = -d;
    // Bias protects against shadow-acne striping artifacts
    this.directionalLight.shadow.bias = -0.0005;

    this.scene.add(this.directionalLight);
  }

  setPreset(preset: string): void {
    switch (preset) {
      case 'warm':
        this.ambientLight.color.setHex(0xfff7e6);
        this.ambientLight.intensity = 0.5;
        this.directionalLight.color.setHex(0xfffaed);
        this.directionalLight.intensity = 1.0;
        break;
      case 'cool':
        this.ambientLight.color.setHex(0xe6f0ff);
        this.ambientLight.intensity = 0.4;
        this.directionalLight.color.setHex(0xebf3ff);
        this.directionalLight.intensity = 0.8;
        break;
      case 'restaurant':
        this.ambientLight.color.setHex(0xfff9e6);
        this.ambientLight.intensity = 0.6;
        this.directionalLight.color.setHex(0xffeed4);
        this.directionalLight.intensity = 1.1;
        break;
      case 'outdoor':
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.7;
        this.directionalLight.color.setHex(0xffffff);
        this.directionalLight.intensity = 1.4;
        break;
      default:
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.5;
        this.directionalLight.color.setHex(0xffffff);
        this.directionalLight.intensity = 0.8;
    }
  }

  setIntensity(intensity: number): void {
    this.directionalLight.intensity = intensity;
  }
}
