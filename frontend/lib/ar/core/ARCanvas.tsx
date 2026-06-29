import React, { useEffect, useRef } from 'react';
import { ARRenderer } from './Renderer';
import { ARScene } from './Scene';
import { ARCamera } from './Camera';

interface ARCanvasProps {
  onInit: (renderer: ARRenderer, scene: ARScene, camera: ARCamera) => void;
  onUpdate?: (time: number, frame: any) => void;
}

/**
 * Reusable React component that initializes Three.js WebGL & WebXR context,
 * hooks resizing, and executes cleanup on component unmount to prevent leaks.
 */
export const ARCanvas: React.FC<ARCanvasProps> = ({ onInit, onUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<ARRenderer | null>(null);
  const sceneRef = useRef<ARScene | null>(null);
  const cameraRef = useRef<ARCamera | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    
    // Create core Three.js modules
    const renderer = new ARRenderer(canvas);
    const scene = new ARScene();
    const camera = new ARCamera();

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    // Trigger parent callback
    onInit(renderer, scene, camera);

    // Responsive resize handler
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.resize(w, h);
      camera.resize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Setup WebGL rendering tick animation loop
    const threeRenderer = renderer.getThreeRenderer();
    threeRenderer.setAnimationLoop((time, frame) => {
      if (onUpdate) {
        onUpdate(time, frame);
      }
      threeRenderer.render(scene.getThreeScene(), camera.getThreeCamera());
    });

    // Cleanup and release GPU resources on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      threeRenderer.setAnimationLoop(null);
      scene.clear();
      renderer.dispose();
    };
  }, [onInit, onUpdate]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1
      }}
    />
  );
};
