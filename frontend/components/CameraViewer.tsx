'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { motion } from 'framer-motion';
import '../styles/camera-viewer.css';

interface MenuItem {
  _id: string;
  name: string;
  imageUrl?: string;
}

interface CameraViewerProps {
  item: MenuItem;
  onClose: () => void;
}

export const CameraViewer: React.FC<CameraViewerProps> = ({ item, onClose }) => {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  const startCamera = async () => {
    setLoading(true);
    setErrorMsg('');
    
    // Stop any existing stream before starting a new one
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Browser does not support media device camera feeds.');
      setLoading(false);
      return;
    }

    // Try rear camera first, fallback to ideal/default facingModes
    const constraintsList = [
      { video: { facingMode: { exact: 'environment' } }, audio: false },
      { video: { facingMode: 'environment' }, audio: false },
      { video: true, audio: false }
    ];

    let stream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break; // Successfully got a stream
      } catch (err: any) {
        lastError = err;
        // Continue loop to try next fallback constraints
      }
    }

    if (stream) {
      streamRef.current = stream;
      setPermissionState('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Play video
        videoRef.current.play().catch((playErr) => {
          console.error('Error starting video play:', playErr);
        });
      }
      setLoading(false);
    } else {
      setPermissionState('denied');
      setLoading(false);
      
      // Detailed error translation
      if (lastError?.name === 'NotAllowedError' || lastError?.message?.includes('permission')) {
        setErrorMsg('Camera permission was denied. Please allow camera access in browser settings to continue.');
      } else if (lastError?.name === 'NotFoundError' || lastError?.name === 'DevicesNotFoundError') {
        setErrorMsg('No camera hardware detected on this device.');
      } else if (lastError?.name === 'NotReadableError' || lastError?.name === 'TrackStartError') {
        setErrorMsg('Camera is already in use by another tab or application.');
      } else {
        setErrorMsg(lastError?.message || 'Failed to initialize the live camera feed.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <motion.div 
      className="camera-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="camera-viewport-container">
        {/* Fullscreen Video Element */}
        <video 
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
          autoPlay
        />

        {/* HUD Overlay controls */}
        <div className="camera-hud-overlay">
          <div className="camera-hud-header">
            <button 
              onClick={() => {
                stopCamera();
                onClose();
              }} 
              className="clay-btn ar-exit-btn"
              style={{ pointerEvents: 'auto' }}
            >
              ✕ Close Preview
            </button>
            <span className="ar-status-badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.4)' }}>
              📷 {item.name} AR Preview
            </span>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="camera-status-wrapper">
            <div className="viewer-loader" />
            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: '#e5e7eb', fontFamily: 'var(--font-heading)' }}>
              Initializing Camera Access...
            </p>
          </div>
        )}

        {/* Error Screen with Retry */}
        {errorMsg && (
          <div className="camera-status-wrapper">
            <div className="clay-card camera-error-card float-animation" style={{ maxWidth: '320px', padding: '24px', textAlign: 'center', backgroundColor: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(20px)' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>📷</span>
              <h3 style={{ color: '#ef4444', marginBottom: '8px', fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>Camera Unavailable</h3>
              <p style={{ fontSize: '0.8rem', color: '#d1d5db', lineHeight: 1.5, marginBottom: '20px' }}>
                {errorMsg}
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={startCamera} 
                  className="clay-btn clay-btn-primary" 
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                >
                  Retry
                </button>
                <button 
                  onClick={onClose} 
                  className="clay-btn clay-btn-secondary" 
                  style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
export default CameraViewer;
