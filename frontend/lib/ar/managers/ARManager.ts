import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DeviceCapabilityManager } from './DeviceCapabilityManager';
import { SessionManager, SessionState } from './SessionManager';
import { Renderer } from './Renderer';
import { CameraManager } from './CameraManager';
import { SceneManager, PlacedObject } from './SceneManager';
import { LightingManager } from './LightingManager';
import { ShadowManager } from './ShadowManager';
import { PlaneDetectionManager } from './PlaneDetectionManager';
import { HitTestManager } from './HitTestManager';
import { AnchorManager } from './AnchorManager';
import { GestureManager } from './GestureManager';
import { AssetManager } from './AssetManager';
import { EnvironmentManager } from './EnvironmentManager';
import { CollisionManager } from './CollisionManager';
import { SelectionManager } from './SelectionManager';
import { ToolbarManager } from './ToolbarManager';
import { AnalyticsManager } from './AnalyticsManager';
import { PerformanceManager } from './PerformanceManager';

/**
 * The Master Orchestrator coordinating WebGL scenes, WebXR camera feeds,
 * gestural interactions, and physical object anchor transformations.
 */
export class ARManager {
  // Sub-Managers
  public session: SessionManager;
  public renderer: Renderer;
  public camera: CameraManager;
  public scene: SceneManager;
  public lighting: LightingManager;
  public shadow: ShadowManager;
  public plane: PlaneDetectionManager;
  public hitTest: HitTestManager;
  public anchor: AnchorManager;
  public gestures!: GestureManager;
  public assets: AssetManager;
  public environment!: EnvironmentManager;
  public collision: CollisionManager;
  public selection: SelectionManager;
  public toolbar: ToolbarManager;
  public analytics: AnalyticsManager;
  public performance: PerformanceManager;

  // Desktop Orbit Controls
  private orbitControls: OrbitControls | null = null;
  private isARActive: boolean = false;
  private canvas: HTMLCanvasElement;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement, restaurantId: string) {
    this.canvas = canvas;

    // 1. Initialize core managers
    this.session = new SessionManager();
    this.renderer = new Renderer(canvas);
    this.camera = new CameraManager();
    this.scene = new SceneManager();
    this.lighting = new LightingManager(this.scene.getThreeScene());
    this.shadow = new ShadowManager(this.scene.getThreeScene());
    this.plane = new PlaneDetectionManager(this.scene.getThreeScene());
    this.hitTest = new HitTestManager();
    this.anchor = new AnchorManager();
    this.assets = new AssetManager();
    this.collision = new CollisionManager();
    this.selection = new SelectionManager(this.scene);
    this.toolbar = new ToolbarManager();
    this.analytics = new AnalyticsManager(restaurantId);
    this.performance = new PerformanceManager();

    // 2. Setup environment reflections
    this.environment = new EnvironmentManager(
      this.renderer.getThreeRenderer(),
      this.scene.getThreeScene()
    );

    // 3. Register performance throttling callbacks
    this.performance.onLowPerformance(() => {
      console.warn('[AR Performance] Throttling shadow map resolution to maintain target FPS.');
      this.renderer.getThreeRenderer().shadowMap.enabled = false; // Disable heavy maps
    });

    // 4. Bind window events
    window.addEventListener('resize', this.onResize.bind(this));
  }

  /**
   * Initializes interactive OrbitControls for desktop browsers and iOS fallbacks.
   */
  public init3DInspector(): void {
    this.renderer.enableXR(false);
    this.isARActive = false;

    // Create desktop helper grids
    const gridHelper = new THREE.GridHelper(10, 20, 0x6366f1, 0x222225);
    gridHelper.name = 'desktop-grid';
    gridHelper.position.y = -0.01;
    this.scene.getThreeScene().add(gridHelper);

    this.orbitControls = new OrbitControls(
      this.camera.getThreeCamera(),
      this.renderer.getThreeRenderer().domElement
    );
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera clipping below floor
    this.orbitControls.minDistance = 0.1;
    this.orbitControls.maxDistance = 5;

    // Instantiates gestures for click selection
    this.gestures = new GestureManager(
      this.renderer.getThreeRenderer().domElement,
      this.camera.getThreeCamera(),
      this.scene
    );

    // Boot standard animation loops
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      
      this.orbitControls?.update();
      this.performance.tick();
      this.renderer.getThreeRenderer().render(
        this.scene.getThreeScene(),
        this.camera.getThreeCamera()
      );
    };
    animate();
  }

  /**
   * Triggers immersive WebXR session starts on mobile devices
   */
  public async startAR(): Promise<void> {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clean desktop indicators
    const grid = this.scene.getThreeScene().getObjectByName('desktop-grid');
    if (grid) this.scene.getThreeScene().remove(grid);

    this.renderer.enableXR(true);
    this.isARActive = true;

    // Request session
    const session = await this.session.startSession(this.renderer.getThreeRenderer(), {
      optionalFeatures: ['local-floor', 'hit-test', 'dom-overlay'],
      domOverlay: { root: document.getElementById('ar-overlay-container')! }
    });

    await this.hitTest.requestHitTestSource(session);

    // Instantiates touchscreen drag handlers
    this.gestures = new GestureManager(
      this.renderer.getThreeRenderer().domElement,
      this.camera.getThreeCamera(),
      this.scene
    );

    // Setup WebXR frame ticking
    const renderer = this.renderer.getThreeRenderer();
    renderer.setAnimationLoop(this.onXRFrame.bind(this));
  }

  /**
   * Spawns a food item mesh in the scene.
   */
  public async placeFoodItem(
    itemId: string,
    modelUrl: string,
    metadata: { name: string; price: number; modelScale: number; rotation?: number }
  ): Promise<PlacedObject> {
    this.session.setState('loading');
    
    try {
      const modelGroup = await this.assets.loadModel(modelUrl);
      
      // Apply default item transforms
      const scale = metadata.modelScale || 1.0;
      modelGroup.scale.set(scale, scale, scale);
      
      if (metadata.rotation) {
        modelGroup.rotation.y = metadata.rotation;
      }

      let spawnPos = new THREE.Vector3(0, 0, -0.4); // spawn 40cm in front of camera default

      if (this.isARActive && this.hitTest.hasValidHit()) {
        const matrix = this.hitTest.getHitResultMatrix();
        spawnPos.setFromMatrixPosition(matrix);
      } else if (this.orbitControls) {
        spawnPos.set(0, 0, 0); // place center on grid helper
      }

      // 1. Run Collision checks
      const collisionResult = this.collision.checkCollisions(
        { id: '', itemId, group: modelGroup, boundingBox: new THREE.Box3(), selected: false, metadata } as any,
        this.scene.getObjects(),
        spawnPos
      );

      modelGroup.position.copy(collisionResult.adjustedPosition);

      // 2. Anchor object
      this.anchor.anchorObject(modelGroup, collisionResult.adjustedPosition, metadata.rotation || 0);

      // 3. Register to Scene Graph
      const placedObj = this.scene.addObject(itemId, modelGroup, metadata);

      // 4. Log analytics metrics
      this.analytics.trackPlacement(itemId);

      this.session.setState('placed');
      return placedObj;
    } catch (error) {
      console.error('Failed to spawn GLB food item:', error);
      this.session.setState('scanning');
      throw error;
    }
  }

  /**
   * Main WebXR Tick loop
   */
  private onXRFrame(time: number, frame: XRFrame): void {
    const session = this.session.getSession();
    if (!session) return;

    // 1. Process hit testing
    const referenceSpace = this.renderer.getThreeRenderer().xr.getReferenceSpace();
    if (referenceSpace) {
      const hasHit = this.hitTest.processFrame(frame, referenceSpace);
      if (hasHit) {
        this.plane.update(this.hitTest.getHitResultMatrix());
        this.plane.setVisible(true);
        this.plane.setValid(true);
      } else {
        this.plane.setVisible(false);
      }
    }

    // 2. Frame stats tick
    this.performance.tick();

    // 3. Render frame scene sweep
    this.renderer.getThreeRenderer().render(
      this.scene.getThreeScene(),
      this.camera.getThreeCamera()
    );
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h);
    this.camera.resize(w, h);
  }

  /**
   * Shutdown WebXR, cancel animation frames, dispose GPU resources
   */
  public async dispose(addedToCart: boolean = false): Promise<void> {
    window.removeEventListener('resize', this.onResize.bind(this));

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const renderer = this.renderer.getThreeRenderer();
    renderer.setAnimationLoop(null);

    // 1. Exit active AR session
    await this.session.endSession();

    // 2. Dispatches analytics conversions
    await this.analytics.trackExit(addedToCart);

    // 3. Clear scene entities
    this.scene.clearScene();
    this.environment.dispose();
    this.renderer.dispose();
    this.assets.clearCache();
    this.hitTest.dispose();
  }
}
