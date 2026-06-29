import * as THREE from 'three';

/**
 * Procedurally generates high-quality PBR reflection environment maps (PMREM)
 * using offscreen shaders, providing realistic metal/roughness reflections 
 * without downloading heavy external HDRI image textures.
 */
export class EnvironmentManager {
  private pmremGenerator: THREE.PMREMGenerator;
  private scene: THREE.Scene;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.scene = scene;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();

    this.setupProceduralEnvironment();
  }

  private setupProceduralEnvironment(): void {
    const envScene = new THREE.Scene();
    
    // Procedural sky dome
    const geometry = new THREE.SphereGeometry(1, 32, 16);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec3 direction = normalize(vWorldPosition);
          float factor = direction.y * 0.5 + 0.5;
          // Gradient between warm restaurant horizon and neutral studio zenith
          vec3 warmHorizon = vec3(0.95, 0.88, 0.80);
          vec3 studioZenith = vec3(0.55, 0.60, 0.65);
          gl_FragColor = vec4(mix(warmHorizon, studioZenith, factor), 1.0);
        }
      `
    });

    const envMesh = new THREE.Mesh(geometry, material);
    envScene.add(envMesh);

    // Convert offscreen shader scene to PBR reflection texture
    const renderTarget = this.pmremGenerator.fromScene(envScene);
    this.scene.environment = renderTarget.texture;

    // Dispose temporary geometry and materials
    envMesh.geometry.dispose();
    material.dispose();
  }

  dispose(): void {
    this.pmremGenerator.dispose();
    if (this.scene.environment) {
      this.scene.environment.dispose();
      this.scene.environment = null;
    }
  }
}
