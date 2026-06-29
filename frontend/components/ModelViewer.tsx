'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadGLB } from '../lib/GLBLoader';
import { useToast } from '@/hooks/useToast';
import { motion } from 'framer-motion';
import '../styles/model-viewer.css';

interface MenuItem {
  _id: string;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  imageUrl?: string;
  isVeg: boolean;
  modelUrl?: string;
  modelScale?: number;
}

interface ModelViewerProps {
  item: MenuItem;
  onClose: () => void;
  onAddToCart: () => void;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({ item, onClose, onAddToCart }) => {
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // States
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error'>('loading');
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Refs for Three.js instance controls
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Auto Rotate toggle handler
  const handleToggleAutoRotate = () => {
    setAutoRotate((prev) => {
      const next = !prev;
      if (controlsRef.current) {
        controlsRef.current.autoRotate = next;
      }
      return next;
    });
  };

  // Reset Camera handler
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0.5, 0.35, 0.5);
      controlsRef.current.target.set(0, 0.1, 0);
      controlsRef.current.update();
      toast.success('Camera Reset', 'Restored default viewing perspective.');
    }
  };

  // Fullscreen support
  const handleToggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Fullscreen request rejected:', err);
        toast.error('Fullscreen Error', 'Unable to activate full-screen mode.');
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

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    // 1. Scene setup with transparent background
    const scene = new THREE.Scene();
    scene.background = null;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.05,
      50
    );
    camera.position.set(0.5, 0.35, 0.5);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // 4. Ambient, Hemisphere and Directional Studio Lighting with Soft Shadows
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333333, 0.4);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(1.5, 3.5, 2.0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0008;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.75);
    rimLight.position.set(-1.5, 2.5, -2.0);
    scene.add(rimLight);

    // 5. Shadow Ground plane (Aligned at bottom y = 0)
    const planeGeo = new THREE.PlaneGeometry(10, 10);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const shadowPlane = new THREE.Mesh(planeGeo, planeMat);
    shadowPlane.receiveShadow = true;
    shadowPlane.position.y = 0;
    scene.add(shadowPlane);

    // 6. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent panning under floor
    controls.minDistance = 0.15;
    controls.maxDistance = 4;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;
    controls.target.set(0, 0.1, 0);
    controlsRef.current = controls;

    // 7. Load GLB Model using GLBLoader
    let modelGroup: THREE.Group | null = null;
    
    const cancelLoad = loadGLB(
      item.modelUrl || '',
      (loadedScene) => {
        modelGroup = loadedScene;

        // Configure realistic materials & shadows on meshes
        modelGroup.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.roughness = Math.max(child.material.roughness, 0.25);
              child.material.metalness = Math.min(child.material.metalness, 0.75);
            }
          }
        });

        // Scale and align bottom height to floor
        const scale = item.modelScale || 1.0;
        modelGroup.scale.set(scale, scale, scale);

        const box = new THREE.Box3().setFromObject(modelGroup);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Center on grid axes
        modelGroup.position.x += (modelGroup.position.x - center.x);
        modelGroup.position.z += (modelGroup.position.z - center.z);
        // Put bottom flat on the ground plane at y = 0
        modelGroup.position.y -= box.min.y;

        scene.add(modelGroup);
        setLoadingState('success');
      },
      (err) => {
        console.error('Failed to load GLB:', err);
        setLoadingState('error');
      }
    );

    // 8. Responsive Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // 9. Frame animation loop (using renderer setAnimationLoop to avoid leaks)
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(render);

    // 10. Complete Cleanup
    return () => {
      cancelLoad();
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      
      controls.dispose();
      
      // Traverse scene to release GPU assets
      scene.traverse((child: any) => {
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
      
      renderer.dispose();
    };
  }, [item]);

  return (
    <motion.div 
      className="viewer-overlay" 
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Click propagation stop prevents overlay click from triggering onClose */}
      <div className="viewer-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Left Side: 3D Viewport View */}
        <div ref={containerRef} className="viewer-viewport-area">
          <canvas ref={canvasRef} className="viewer-canvas" />

          {/* Interactive Viewer Controls (Auto Rotate, Reset, Fullscreen) */}
          {loadingState === 'success' && (
            <motion.div 
              className="viewer-controls-overlay"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <button 
                onClick={handleToggleAutoRotate} 
                className={`viewer-control-btn ${autoRotate ? 'active' : ''}`}
                title="Toggle Auto Rotate"
              >
                🔄 {autoRotate ? 'Spin On' : 'Spin Off'}
              </button>
              <button 
                onClick={handleResetCamera} 
                className="viewer-control-btn"
                title="Reset Camera view"
              >
                🎥 Reset View
              </button>
              <button 
                onClick={handleToggleFullscreen} 
                className="viewer-control-btn"
                title="Toggle Fullscreen"
              >
                ⛶ {isFullscreen ? 'Exit Full' : 'Fullscreen'}
              </button>
            </motion.div>
          )}

          {/* Loading Indicator */}
          {loadingState === 'loading' && (
            <div className="viewer-loading-wrapper">
              <div className="viewer-loader" />
              <p style={{ marginTop: '16px', fontSize: '0.85rem', color: '#9ca3af' }}>Loading 3D asset...</p>
            </div>
          )}

          {/* Error Message Display */}
          {loadingState === 'error' && (
            <div className="viewer-loading-wrapper">
              <div className="clay-card viewer-error-card">
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>⚠️</span>
                <h3 style={{ color: '#ef4444', marginBottom: '8px', fontFamily: 'var(--font-heading)' }}>3D Preview Unavailable</h3>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.5, marginBottom: '20px' }}>
                  The 3D model could not be loaded. Please return to the menu or retry later.
                </p>
                <button onClick={onClose} className="clay-btn clay-btn-primary" style={{ width: '100%' }}>
                  Back to Menu
                </button>
              </div>
            </div>
          )}

          {/* Controls Instructions Hint Overlay */}
          {loadingState === 'success' && (
            <div className="viewer-hint">
              🖱️ Drag to Rotate • Scroll to Zoom • Right-Click + Drag to Pan
            </div>
          )}
        </div>

        {/* Right Side: Sidebar Info Panel */}
        <motion.div 
          className="viewer-sidebar"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 210 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header badges */}
            <div className="viewer-header">
              <button 
                onClick={onClose} 
                className="clay-btn clay-btn-secondary" 
                style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '12px' }}
              >
                ✕ Close
              </button>
              <span className="viewer-badge">3D Viewer</span>
            </div>

            {/* Flat dish preview image fallback card */}
            <div className="viewer-image-wrapper">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.name} className="viewer-dish-img" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#1f2937' }}>
                  <span style={{ fontSize: '3rem' }}>🥗</span>
                </div>
              )}
              {item.isVeg ? (
                <span className="viewer-diet-tag" style={{ backgroundColor: 'rgba(16, 185, 129, 0.85)' }}>VEG</span>
              ) : (
                <span className="viewer-diet-tag" style={{ backgroundColor: 'rgba(239, 68, 68, 0.85)' }}>NON-VEG</span>
              )}
            </div>

            {/* Meta details */}
            <div>
              <h1 className="viewer-dish-name">{item.name}</h1>
              
              <div className="viewer-dish-price">
                {item.discountPrice ? (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span>${item.discountPrice}</span>
                    <span style={{ fontSize: '1.05rem', color: '#6b7280', textDecoration: 'line-through', fontWeight: 500 }}>
                      ${item.price}
                    </span>
                  </div>
                ) : (
                  <span>${item.price}</span>
                )}
              </div>

              <p className="viewer-dish-desc">
                {item.description || 'Preview the portion distribution, ingredients rendering, and real-scale model of this item to customize it to your appetite.'}
              </p>
            </div>
          </div>

          {/* Call to Actions Footer */}
          <div>
            <button 
              onClick={() => {
                onAddToCart();
                toast.success('Added to Cart', `${item.name} has been added.`);
              }} 
              className="clay-btn clay-btn-primary" 
              style={{ width: '100%', padding: '14px', borderRadius: '16px', fontSize: '1.02rem' }}
            >
              🛒 Add to Cart
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6b7280', marginTop: '10px' }}>
              Tax and custom preferences managed inside cart
            </p>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
};
export default ModelViewer;
