'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { resolveAssetUrl } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { WebXRDetector, WebXRCapability } from '@/lib/ar/core/WebXR';

// Global cache for GLB models to enable instant loading on repeated views
const glbCache = new Map<string, THREE.Group>();

function ARContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const slug = searchParams.get('slug') || '';
  const itemId = searchParams.get('items') || searchParams.get('itemId') || '';
  const tableNumber = searchParams.get('table') || '';

  // Core Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Three.js Scene Entities
  const modelRef = useRef<THREE.Group | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);

  // States
  const [sessionToken, setSessionToken] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);
  const [capability, setCapability] = useState<WebXRCapability | null>(null);
  const [sessionState, setSessionState] = useState<'Checking' | 'Unsupported' | 'Supported' | 'Starting' | 'Running' | 'Ended' | 'Error'>('Checking');
  const [isARActive, setIsARActive] = useState(false);
  const [isModelPlaced, setIsModelPlaced] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Model loading states
  const [modelLoadingState, setModelLoadingState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [modelError, setModelError] = useState('');

  // Gesture Tracker Refs
  const isDraggingRef = useRef(false);
  const initialTouchDistanceRef = useRef(0);
  const initialTouchAngleRef = useRef(0);
  const initialScaleRef = useRef(new THREE.Vector3());
  const initialRotationYRef = useRef(0);
  const tableHeightRef = useRef(0);

  // Initialize Session Token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let token = localStorage.getItem('dishiq_customer_session');
      if (!token) {
        token = `cust_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
        localStorage.setItem('dishiq_customer_session', token);
      }
      setSessionToken(token);
    }
  }, []);

  // Fetch Public Menu & Cart
  const { data: menuData, isLoading: isMenuLoading } = useQuery({
    queryKey: ['public-menu', slug],
    queryFn: async () => {
      const res = await api.get(`/public/restaurant/${slug}`);
      return res.data;
    },
    enabled: !!slug
  });

  const restaurant = menuData?.restaurant;
  const items = menuData?.items || [];
  const menuItem = items.find((item: any) => item._id === itemId);

  const { data: cartData } = useQuery({
    queryKey: ['public-cart', sessionToken],
    queryFn: async () => {
      const res = await api.get(`/public/cart/${sessionToken}`);
      return res.data?.cart || { items: [] };
    },
    enabled: !!sessionToken
  });

  const cartItems = cartData?.items || [];

  const syncCartMutation = useMutation({
    mutationFn: async (updatedItems: any[]) => {
      const res = await api.post('/public/cart', {
        sessionToken,
        restaurantId: restaurant?._id,
        tableNumber: tableNumber || undefined,
        items: updatedItems
      });
      return res.data?.cart;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['public-cart', sessionToken], data);
    }
  });

  // Check Platform & WebXR Capabilities
  useEffect(() => {
    const checkCapabilities = async () => {
      setSessionState('Checking');
      const result = await WebXRDetector.checkARSupport();
      setCapability(result);

      const isAndroid = /android/i.test(navigator.userAgent);
      if (result.supported && isAndroid) {
        setSessionState('Supported');
        setIsDesktop(false);
      } else {
        setSessionState('Unsupported');
        setIsDesktop(true);
      }
    };
    checkCapabilities();
  }, []);

  // Initialize Desktop 3D Viewer if running in desktop/fallback mode
  useEffect(() => {
    if (isDesktop && menuItem && menuItem.modelUrl) {
      initThreeDesktop(resolveAssetUrl(menuItem.modelUrl), menuItem.modelScale || 1.0);
    }
    return () => {
      disposeThree();
    };
  }, [isDesktop, menuItem]);

  // Clean up WebXR and Three.js Context
  const disposeThree = () => {
    if ((window as any)._desktopAnimFrame) {
      cancelAnimationFrame((window as any)._desktopAnimFrame);
      (window as any)._desktopAnimFrame = null;
    }

    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null);
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    if (controlsRef.current) {
      controlsRef.current.dispose();
      controlsRef.current = null;
    }

    if (sceneRef.current) {
      sceneRef.current.traverse((child: any) => {
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
      sceneRef.current = null;
    }

    cameraRef.current = null;
    modelRef.current = null;
    reticleRef.current = null;
    shadowPlaneRef.current = null;
    ambientLightRef.current = null;
    directionalLightRef.current = null;
  };

  // Helper: Setup 3D Viewer on Desktop
  const initThreeDesktop = (modelUrl: string, modelScale: number) => {
    if (!canvasRef.current) return;
    disposeThree();

    const canvas = canvasRef.current;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0a0b);

    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0.6, 0.4, 0.6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(2, 4, 3);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);
    directionalLightRef.current = dirLight;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 0.2;
    controls.maxDistance = 5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controlsRef.current = controls;

    const gridHelper = new THREE.GridHelper(2, 20, 0x6366f1, 0x222225);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(10, 10);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.45 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.position.y = 0;
    scene.add(floor);
    shadowPlaneRef.current = floor;

    loadModelToScene(modelUrl, modelScale, scene, false);

    let animationFrameId = 0;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      (window as any)._desktopAnimFrame = animationFrameId;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  };

  // Helper: Load GLB & setup inside scene
  const loadModelToScene = async (url: string, scaleFactor: number, scene: THREE.Scene, isAR: boolean) => {
    setModelLoadingState('loading');
    setModelError('');

    const setupModel = (model: THREE.Group) => {
      model.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.roughness = Math.max(child.material.roughness, 0.2);
            child.material.metalness = Math.min(child.material.metalness, 0.8);
          }
        }
      });

      model.scale.set(scaleFactor, scaleFactor, scaleFactor);
      
      const box = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      box.getCenter(center);
      
      if (!isAR) {
        model.position.x += (model.position.x - center.x);
        model.position.z += (model.position.z - center.z);
        model.position.y -= box.min.y;
        scene.add(model);
        modelRef.current = model;
      } else {
        model.position.set(-center.x, -box.min.y, -center.z);
        const group = new THREE.Group();
        group.add(model);
        modelRef.current = group;
      }
      setModelLoadingState('success');
    };

    try {
      if (glbCache.has(url)) {
        const cachedModel = glbCache.get(url)!.clone(true);
        setupModel(cachedModel);
        return;
      }

      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      loader.setDRACOLoader(dracoLoader);

      loader.load(url, (gltf) => {
        const rawModel = gltf.scene;
        glbCache.set(url, rawModel.clone(true));
        setupModel(rawModel);
      }, undefined, (err) => {
        console.error('Error loading GLB:', err);
        setModelLoadingState('error');
        setModelError('Failed to load 3D model. The file format may be unsupported.');
      });
    } catch (err: any) {
      console.error('GLB Loader initialization error:', err);
      setModelLoadingState('error');
      setModelError(err?.message || 'Failed to initialize model loader.');
    }
  };

  // Helper: Request and Start WebXR Immersive AR Session
  const startARSession = async () => {
    if (!canvasRef.current || !navigator.xr || !menuItem || !menuItem.modelUrl) return;

    setSessionState('Starting');
    setErrorMsg('');

    try {
      const canvas = canvasRef.current;
      const overlayElement = document.getElementById('ar-overlay-root');
      if (!overlayElement) {
        throw new Error('Overlay overlay root element not found');
      }

      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.xr.enabled = true;
      rendererRef.current = renderer;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      ambientLightRef.current = ambientLight;

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(1.5, 3.0, 1.0);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.bias = -0.0005;
      scene.add(dirLight);
      directionalLightRef.current = dirLight;

      const shadowGeo = new THREE.PlaneGeometry(100, 100);
      shadowGeo.rotateX(-Math.PI / 2);
      const shadowMat = new THREE.ShadowMaterial({ opacity: 0.55 });
      const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
      shadowPlane.receiveShadow = true;
      shadowPlane.position.y = 0;
      scene.add(shadowPlane);
      shadowPlaneRef.current = shadowPlane;

      const reticleGeo = new THREE.RingGeometry(0.07, 0.09, 32);
      reticleGeo.rotateX(-Math.PI / 2);
      const reticleMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const reticle = new THREE.Mesh(reticleGeo, reticleMat);
      reticle.visible = false;

      const dotGeo = new THREE.CircleGeometry(0.012, 16);
      dotGeo.rotateX(-Math.PI / 2);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      reticle.add(dot);

      scene.add(reticle);
      reticleRef.current = reticle;

      await loadModelToScene(resolveAssetUrl(menuItem.modelUrl), menuItem.modelScale || 1.0, scene, true);

      const sessionInit = {
        requiredFeatures: ['hit-test', 'local-floor', 'dom-overlay'],
        domOverlay: { root: overlayElement }
      };

      const session: any = await navigator.xr.requestSession('immersive-ar', sessionInit);
      await renderer.xr.setSession(session);

      setSessionState('Running');
      setIsARActive(true);

      let hitTestSource: any = null;
      let localReferenceSpace: any = null;

      session.requestReferenceSpace('viewer').then((refSpace: any) => {
        session.requestHitTestSource({ space: refSpace }).then((source: any) => {
          hitTestSource = source;
        });
      });

      session.requestReferenceSpace('local-floor').then((refSpace: any) => {
        localReferenceSpace = refSpace;
      });

      session.addEventListener('end', () => {
        cleanupSession();
      });

      const onSelect = () => {
        if (reticle.visible && modelRef.current && !scene.children.includes(modelRef.current)) {
          const group = modelRef.current;
          group.position.copy(reticle.position);
          group.quaternion.copy(reticle.quaternion);
          scene.add(group);

          tableHeightRef.current = reticle.position.y;
          shadowPlane.position.y = reticle.position.y;

          reticle.visible = false;
          setIsModelPlaced(true);
          toast.success('Placed!', 'Use fingers to drag, rotate or pinch to scale.');
        }
      };
      session.addEventListener('select', onSelect);

      const onXRFrame = (time: number, frame: any) => {
        if (hitTestSource && localReferenceSpace && !scene.children.includes(modelRef.current!)) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(localReferenceSpace);
            if (pose) {
              reticle.visible = true;
              reticle.position.setFromMatrixPosition(pose.transform.matrix);
              const m = new THREE.Matrix4();
              m.fromArray(pose.transform.matrix);
              reticle.quaternion.setFromRotationMatrix(m);
            }
          } else {
            reticle.visible = false;
          }
        }
        renderer.render(scene, camera);
      };

      renderer.xr.setAnimationLoop(onXRFrame);

    } catch (error: any) {
      console.error('AR session initialization failed:', error);
      let errorMsg = 'Failed to start AR camera session.';
      if (error?.name === 'NotAllowedError' || error?.message?.includes('permission')) {
        errorMsg = 'Camera permission denied. Please grant camera permission in your browser settings to view in AR.';
        setSessionState('Error');
        setErrorMsg(errorMsg);
      } else {
        setSessionState('Unsupported');
        setIsDesktop(true);
      }
    }
  };

  const cleanupSession = () => {
    setIsARActive(false);
    setIsModelPlaced(false);
    disposeThree();
    setSessionState('Ended');
  };

  // Drag, Rotate & Scale interactions in AR mode
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isModelPlaced || !modelRef.current || !cameraRef.current) return;
    const touches = e.touches;

    if (touches.length === 1) {
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      mouse.x = (touches[0].clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touches[0].clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObject(modelRef.current, true);

      if (intersects.length > 0) {
        isDraggingRef.current = true;
      }
    } else if (touches.length === 2) {
      isDraggingRef.current = false;
      const t1 = touches[0];
      const t2 = touches[1];

      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      initialTouchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      initialTouchAngleRef.current = Math.atan2(dy, dx);

      initialScaleRef.current.copy(modelRef.current.scale);
      initialRotationYRef.current = modelRef.current.rotation.y;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isModelPlaced || !modelRef.current || !cameraRef.current) return;
    const touches = e.touches;

    if (touches.length === 1 && isDraggingRef.current) {
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      mouse.x = (touches[0].clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touches[0].clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      const tableHeight = tableHeightRef.current;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -tableHeight);
      const intersection = new THREE.Vector3();

      if (raycaster.ray.intersectPlane(plane, intersection)) {
        modelRef.current.position.set(intersection.x, tableHeight, intersection.z);
      }
    } else if (touches.length === 2 && initialTouchDistanceRef.current > 0) {
      const t1 = touches[0];
      const t2 = touches[1];

      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;

      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const ratio = currentDistance / initialTouchDistanceRef.current;
      const targetScaleVal = initialScaleRef.current.x * ratio;
      const clampedScale = Math.max(0.3, Math.min(targetScaleVal, 3.0));
      modelRef.current.scale.set(clampedScale, clampedScale, clampedScale);

      const currentAngle = Math.atan2(dy, dx);
      const angleDelta = currentAngle - initialTouchAngleRef.current;
      modelRef.current.rotation.y = initialRotationYRef.current + angleDelta;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    initialTouchDistanceRef.current = 0;
  };

  // HUD Action Handlers
  const handleAddToCart = () => {
    if (!menuItem) return;
    const existingIndex = cartItems.findIndex((item: any) => {
      const id = item.menuItemId?._id || item.menuItemId;
      return id === menuItem._id;
    });

    let updatedItems = [...cartItems];

    if (existingIndex > -1) {
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        quantity: updatedItems[existingIndex].quantity + 1
      };
    } else {
      updatedItems.push({
        menuItemId: menuItem._id,
        quantity: 1,
        notes: ''
      });
    }

    const flatItems = updatedItems.map((item: any) => ({
      menuItemId: item.menuItemId?._id || item.menuItemId,
      quantity: item.quantity,
      notes: item.notes || ''
    }));

    syncCartMutation.mutate(flatItems);
    toast.success('Added to Cart', `${menuItem.name} has been added to your cart.`);
  };

  const handleResetPosition = () => {
    if (modelRef.current) {
      modelRef.current.position.set(0, tableHeightRef.current, -0.4);
      modelRef.current.rotation.set(0, 0, 0);
      const defaultScale = menuItem?.modelScale || 1.0;
      modelRef.current.scale.set(defaultScale, defaultScale, defaultScale);
      toast.success('Reset Position', 'Restored original scale, rotation and position.');
    }
  };

  const handleRemoveModel = () => {
    if (modelRef.current && sceneRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current.traverse((child: any) => {
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
      setIsModelPlaced(false);
      toast.success('Model Removed', 'Tap to scan a new spot on the table.');
    }
  };

  const handleExitAR = async () => {
    const session = rendererRef.current?.xr.getSession() as any;
    if (session) {
      await session.end();
    } else {
      cleanupSession();
    }
    router.back();
  };

  // Fullscreen support for Desktop
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        toast.error('Fullscreen Error', 'Could not enter fullscreen mode.');
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleBackToMenu = () => {
    router.back();
  };

  if (isMenuLoading || modelLoadingState === 'loading' && isDesktop) {
    return (
      <div style={loaderContainerStyle}>
        <div className="pulse-glow-indicator" style={{ width: 44, height: 44 }} />
        <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading dish preview...</p>
      </div>
    );
  }

  if (!menuItem) {
    return (
      <div style={errorContainerStyle}>
        <div className="clay-card" style={{ textAlign: 'center', padding: '40px', maxWidth: '400px' }}>
          <span style={{ fontSize: '3rem' }}>🚫</span>
          <h2 style={{ margin: '16px 0 8px' }}>Dish Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            This dish is currently offline or the URL is invalid. Please return to the menu and select again.
          </p>
          <button onClick={handleBackToMenu} className="clay-btn clay-btn-primary" style={{ width: '100%', marginTop: '20px' }}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  if (!menuItem.modelUrl) {
    return (
      <div style={errorContainerStyle}>
        <div className="clay-card" style={{ textAlign: 'center', padding: '40px', maxWidth: '400px' }}>
          <span style={{ fontSize: '3rem' }}>📐</span>
          <h2 style={{ margin: '16px 0 8px' }}>No 3D Model Available</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            This item does not have a 3D model configuration.
          </p>
          <button onClick={handleBackToMenu} className="clay-btn clay-btn-primary" style={{ width: '100%', marginTop: '20px' }}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // --- DESKTOP 3D VIEW RENDERING ---
  if (isDesktop) {
    return (
      <div ref={containerRef} style={desktopLayoutContainerStyle}>
        {/* Left Side: 3D Scene Viewport */}
        <div style={desktopViewportStyle}>
          {modelLoadingState === 'error' && (
            <div style={desktopLoadingOverlayStyle}>
              <div className="clay-card" style={{ maxWidth: '360px', padding: '24px', textAlign: 'center' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>⚠️</span>
                <h3 style={{ marginBottom: '8px', color: '#ef4444' }}>Model Load Failure</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>{modelError}</p>
                <button onClick={() => initThreeDesktop(menuItem.modelUrl!, menuItem.modelScale || 1.0)} className="clay-btn clay-btn-primary" style={{ width: '100%' }}>
                  Retry Loading
                </button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          
          {/* Controls hint overlay */}
          <div style={desktopControlsHintStyle}>
            🖱️ Left Click + Drag to Rotate • Scroll to Zoom • Right Click + Drag to Pan
          </div>

          {/* Fullscreen Button */}
          <button onClick={toggleFullscreen} style={desktopFullscreenBtnStyle} title="Toggle Fullscreen">
            {isFullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>

        {/* Right Side: Sidebar Panel Details */}
        <div style={desktopSidebarStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={handleBackToMenu} className="clay-btn clay-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                ◀ Back
              </button>
              <span style={previewBadgeStyle}>3D PREVIEW</span>
            </div>

            {/* Dish Image preview card */}
            <div className="clay-card" style={{ padding: '0', overflow: 'hidden', height: '180px', position: 'relative' }}>
              {menuItem.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveAssetUrl(menuItem.imageUrl)} alt={menuItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1f2937' }}>
                  <span style={{ fontSize: '3rem' }}>🥗</span>
                </div>
              )}
              {menuItem.isVeg ? (
                <span style={{ ...dietBadgeStyle, backgroundColor: 'rgba(16, 185, 129, 0.85)' }}>VEG</span>
              ) : (
                <span style={{ ...dietBadgeStyle, backgroundColor: 'rgba(239, 68, 68, 0.85)' }}>NON-VEG</span>
              )}
            </div>

            {/* Info details */}
            <div>
              <h1 style={dishTitleStyle}>{menuItem.name}</h1>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                {menuItem.discountPrice ? (
                  <>
                    <span style={{ fontSize: '1.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>${menuItem.discountPrice}</span>
                    <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>${menuItem.price}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '1.6rem', color: 'var(--accent-color)', fontWeight: 800 }}>${menuItem.price}</span>
                )}
              </div>

              <p style={dishDescStyle}>
                {menuItem.description || 'No detailed description available for this dish. Take a look at our immersive 3D preview model to inspect portion size, ingredient presentation, and preparation layout.'}
              </p>
            </div>
          </div>

          {/* Action button */}
          <div>
            <button onClick={handleAddToCart} className="clay-btn clay-btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '16px', fontSize: '1.05rem' }}>
              🛒 Add to Cart
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px' }}>
              Select item and customize inside your cart
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- ANDROID WEBXR MOBILE AR RENDERING ---
  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      {/* WEBXR DOM OVERLAY PORTAL */}
      <div 
        id="ar-overlay-root" 
        style={overlayRootStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Step 1: Initial Prompt Screen */}
        {sessionState === 'Supported' && (
          <div style={modalWrapperStyle}>
            <div className="clay-card float-animation" style={clayCardStyle}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '16px' }}>📱</span>
              <h2 style={overlayTitleStyle}>Augmented Reality</h2>
              <p style={overlayDescStyle}>
                Visualize <strong>{menuItem.name}</strong> directly on your table to inspect actual portion size and layout in 3D.
              </p>

              {menuItem.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={resolveAssetUrl(menuItem.imageUrl)} 
                  alt={menuItem.name} 
                  style={{ width: '80px', height: '80px', borderRadius: '16px', objectFit: 'cover', margin: '0 auto 20px', display: 'block', border: '1px solid var(--border-color)' }} 
                />
              )}

              <button onClick={startARSession} className="clay-btn clay-btn-primary float-animation" style={{ width: '100%', padding: '14px' }}>
                Open Camera & Place AR 🚀
              </button>

              <button onClick={handleBackToMenu} className="clay-btn clay-btn-secondary" style={{ width: '100%', marginTop: '12px' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Camera handshakes & loading permission status */}
        {sessionState === 'Starting' && (
          <div style={modalWrapperStyle}>
            <div className="clay-card float-animation" style={{ ...clayCardStyle, maxWidth: '280px' }}>
              <div className="pulse-glow-indicator" style={{ width: 36, height: 36, margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 750, color: 'var(--text-primary)' }}>Starting Session</h3>
              <p style={{ ...overlayDescStyle, marginBottom: 0 }}>Please allow camera permission requested by your browser to start scanning surfaces.</p>
            </div>
          </div>
        )}

        {/* Step 3: Immersive WebXR running HUD */}
        {sessionState === 'Running' && (
          <div style={runningHUDStyle}>
            {/* HUD Header */}
            <div style={hudHeaderStyle}>
              <button onClick={handleExitAR} style={exitBtnStyle}>
                ✕ Exit AR
              </button>
              <span style={activeBadgeStyle}>
                ● Live 3D Placement
              </span>
            </div>

            {/* Scanning surface instruction */}
            {!isModelPlaced ? (
              <div style={scanningHintStyle}>
                <span style={{ display: 'block', fontSize: '1.5rem', marginBottom: '6px' }}>📱</span>
                Move device slowly to scan table surface. Tap the green reticle to place the model.
              </div>
            ) : (
              /* Floating HUD toolbar overlay (when model placed) */
              <div style={hudToolbarStyle}>
                <button onClick={handleAddToCart} className="clay-btn clay-btn-primary" style={{ flex: 2, padding: '12px', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                  🛒 Add to Cart
                </button>
                <button onClick={handleResetPosition} className="clay-btn clay-btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}>
                  Reset
                </button>
                <button onClick={handleRemoveModel} className="clay-btn clay-btn-danger" style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}>
                  Remove
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Closed / Ended AR Session */}
        {sessionState === 'Ended' && (
          <div style={modalWrapperStyle}>
            <div className="clay-card float-animation" style={clayCardStyle}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>🏁</span>
              <h2 style={overlayTitleStyle}>Session Concluded</h2>
              <p style={overlayDescStyle}>The augmented reality preview has ended.</p>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', width: '100%' }}>
                <button onClick={handleBackToMenu} className="clay-btn clay-btn-secondary" style={{ flex: 1 }}>
                  Return Menu
                </button>
                <button onClick={startARSession} className="clay-btn clay-btn-primary" style={{ flex: 1 }}>
                  Restart Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: WebXR Error State */}
        {sessionState === 'Error' && (
          <div style={modalWrapperStyle}>
            <div className="clay-card float-animation" style={clayCardStyle}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>⚠️</span>
              <h2 style={{ ...overlayTitleStyle, color: '#ef4444' }}>AR Error</h2>
              <p style={overlayDescStyle}>{errorMsg}</p>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', width: '100%' }}>
                <button onClick={handleBackToMenu} className="clay-btn clay-btn-secondary" style={{ flex: 1 }}>
                  Go Back
                </button>
                <button onClick={startARSession} className="clay-btn clay-btn-primary" style={{ flex: 1 }}>
                  Retry AR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ARPage() {
  return (
    <Suspense fallback={
      <div style={loaderContainerStyle}>
        <div className="pulse-glow-indicator" style={{ width: 40, height: 40 }} />
      </div>
    }>
      <ARContent />
    </Suspense>
  );
}

// styling rules
const loaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#0a0a0b',
  color: '#ffffff',
  fontFamily: 'var(--font-sans)'
};

const errorContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  backgroundColor: '#0a0a0b',
  padding: '24px'
};

const containerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  backgroundColor: '#000000',
  fontFamily: 'var(--font-sans)'
};

const canvasStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: 1,
  display: 'block'
};

const overlayRootStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: 10,
  pointerEvents: 'none'
};

const modalWrapperStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '24px',
  boxSizing: 'border-box',
  pointerEvents: 'auto',
  backgroundColor: 'rgba(9, 9, 11, 0.75)'
};

const clayCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '340px',
  padding: '28px',
  borderRadius: '24px',
  backgroundColor: 'rgba(25, 25, 28, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  boxShadow: '8px 12px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(20px)',
  display: 'flex',
  flexDirection: 'column',
  textAlign: 'center',
  boxSizing: 'border-box'
};

const overlayTitleStyle: React.CSSProperties = {
  fontSize: '1.35rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  marginBottom: '8px',
  color: '#ffffff',
  fontFamily: 'var(--font-heading)'
};

const overlayDescStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#d1d5db',
  lineHeight: 1.5,
  marginBottom: '20px'
};

const runningHUDStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '20px',
  boxSizing: 'border-box'
};

const hudHeaderStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  pointerEvents: 'auto'
};

const exitBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: '16px',
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.4)',
  color: '#ef4444',
  fontSize: '0.8rem',
  fontWeight: 700,
  cursor: 'pointer',
  backdropFilter: 'blur(10px)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  fontFamily: 'var(--font-heading)'
};

const activeBadgeStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '14px',
  backgroundColor: 'rgba(34, 197, 94, 0.12)',
  border: '1px solid rgba(34, 197, 94, 0.4)',
  color: '#22c55e',
  fontSize: '0.75rem',
  fontWeight: 600,
  backdropFilter: 'blur(10px)'
};

const scanningHintStyle: React.CSSProperties = {
  alignSelf: 'center',
  padding: '12px 18px',
  borderRadius: '16px',
  backgroundColor: 'rgba(10, 10, 11, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  fontSize: '0.8rem',
  textAlign: 'center',
  color: '#d1d5db',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  marginBottom: '40px',
  pointerEvents: 'auto',
  maxWidth: '280px',
  lineHeight: 1.4
};

const hudToolbarStyle: React.CSSProperties = {
  alignSelf: 'center',
  display: 'flex',
  gap: '10px',
  width: '100%',
  maxWidth: '360px',
  marginBottom: '20px',
  pointerEvents: 'auto'
};

// Desktop 3D View specific styles
const desktopLayoutContainerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  overflow: 'hidden',
  backgroundColor: '#0a0a0b',
  display: 'flex',
  color: '#f9fafb',
  fontFamily: 'var(--font-sans)'
};

const desktopViewportStyle: React.CSSProperties = {
  flex: 1,
  height: '100%',
  position: 'relative',
  backgroundColor: '#000000'
};

const desktopSidebarStyle: React.CSSProperties = {
  width: '380px',
  height: '100%',
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  borderLeft: '1px solid rgba(255,255,255,0.06)',
  padding: '32px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  backdropFilter: 'blur(20px)',
  boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
  zIndex: 5
};

const previewBadgeStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: '10px',
  backgroundColor: 'rgba(99, 102, 241, 0.15)',
  border: '1px solid rgba(99, 102, 241, 0.4)',
  color: '#6366f1',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.05em'
};

const dietBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '12px',
  left: '12px',
  padding: '4px 10px',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
};

const dishTitleStyle: React.CSSProperties = {
  fontSize: '1.8rem',
  fontWeight: 800,
  fontFamily: 'var(--font-heading)',
  color: '#ffffff',
  letterSpacing: '-0.02em'
};

const dishDescStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#9ca3af',
  lineHeight: 1.6,
  marginTop: '16px'
};

const desktopControlsHintStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '10px 20px',
  borderRadius: '14px',
  backgroundColor: 'rgba(10, 10, 11, 0.75)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  fontSize: '0.75rem',
  color: '#d1d5db',
  pointerEvents: 'none',
  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
  whiteSpace: 'nowrap'
};

const desktopFullscreenBtnStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '24px',
  right: '24px',
  padding: '10px 16px',
  borderRadius: '12px',
  backgroundColor: 'rgba(31, 41, 55, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: '#ffffff',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
  pointerEvents: 'auto',
  fontFamily: 'var(--font-heading)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
};

const desktopLoadingOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(9, 9, 11, 0.85)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10
};
