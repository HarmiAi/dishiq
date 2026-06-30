import * as THREE from 'three';
import { WebXRDetector, WebXRCapability } from './WebXR';

export type XRSessionState =
  | 'idle'
  | 'checking'
  | 'supported'
  | 'unsupported'
  | 'permission'
  | 'initializing'
  | 'running'
  | 'paused'
  | 'lost'
  | 'exit'
  | 'error';

export interface XRSessionEvents {
  onStateChange?: (state: XRSessionState) => void;
  onError?: (error: Error) => void;
  onSessionStart?: (session: XRSession) => void;
  onSessionEnd?: () => void;
}

/**
 * Robust production-ready WebXR Session Manager that handles session lifecycles,
 * visibility changes (pause/resume), hardware capability checks, and error boundaries.
 */
export class XRSessionManager {
  private activeSession: XRSession | null = null;
  private state: XRSessionState = 'idle';
  private capability: WebXRCapability | null = null;
  private events: XRSessionEvents = {};

  constructor(events: XRSessionEvents = {}) {
    this.events = events;
  }

  public getState(): XRSessionState {
    return this.state;
  }

  public getSession(): XRSession | null {
    return this.activeSession;
  }

  public getCapability(): WebXRCapability | null {
    return this.capability;
  }

  private setState(newState: XRSessionState): void {
    if (this.state === newState) return;
    this.state = newState;
    if (this.events.onStateChange) {
      this.events.onStateChange(newState);
    }
  }

  private handleError(error: Error): void {
    this.setState('error');
    if (this.events.onError) {
      this.events.onError(error);
    }
  }

  /**
   * Performs an asynchronous hardware and software capability audit.
   */
  public async checkSupport(): Promise<WebXRCapability> {
    this.setState('checking');
    try {
      const result = await WebXRDetector.checkARSupport();
      this.capability = result;
      this.setState(result.supported ? 'supported' : 'unsupported');
      return result;
    } catch (e: any) {
      const err = new Error(e?.message || 'Failed checking AR capabilities');
      this.handleError(err);
      return {
        supported: false,
        reason: err.message,
        device: 'Unknown',
        browser: 'Unknown'
      };
    }
  }

  /**
   * Starts an immersive WebXR AR session.
   */
  public async startAR(
    renderer: THREE.WebGLRenderer,
    options: XRSessionInit = {}
  ): Promise<XRSession> {
    if (this.activeSession) {
      console.warn('[WebXR] An active session is already running.');
      return this.activeSession;
    }

    this.setState('permission');

    try {
      if (!navigator.xr) {
        throw new Error('WebXR Device API is not available on this browser/platform.');
      }

      // Configure overlays and requested features
      const sessionInit: XRSessionInit = {
        requiredFeatures: ['hit-test', 'local-floor'],
        optionalFeatures: ['dom-overlay'],
        ...options
      };

      const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
      this.activeSession = session;
      this.setState('initializing');

      // Bind WebXR context to WebGLRenderer
      await renderer.xr.setSession(session);

      // Event binding
      session.addEventListener('end', this.onSessionEnd.bind(this));
      session.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));

      this.setState('running');
      if (this.events.onSessionStart) {
        this.events.onSessionStart(session);
      }

      return session;
    } catch (error: any) {
      let friendlyError = error;
      if (error?.name === 'NotAllowedError') {
        friendlyError = new Error('Camera permissions were denied. Please allow camera access in your browser settings to launch AR.');
      } else if (error?.name === 'SecurityError') {
        friendlyError = new Error('WebXR requires a secure context (HTTPS) or local development environment.');
      } else {
        friendlyError = new Error(error?.message || 'Failed to initialize WebXR AR session.');
      }
      
      this.handleError(friendlyError);
      throw friendlyError;
    }
  }

  /**
   * Safely terminates the active WebXR session and restores browser rendering.
   */
  public async endAR(): Promise<void> {
    if (!this.activeSession) return;

    this.setState('exit');
    try {
      await this.activeSession.end();
    } catch (error) {
      console.warn('[WebXR] Error closing active session:', error);
    } finally {
      this.onSessionEnd();
    }
  }

  private onSessionEnd(): void {
    if (this.activeSession) {
      this.activeSession.removeEventListener('end', this.onSessionEnd.bind(this));
      this.activeSession.removeEventListener('visibilitychange', this.onVisibilityChange.bind(this));
      this.activeSession = null;
    }

    this.setState('idle');
    if (this.events.onSessionEnd) {
      this.events.onSessionEnd();
    }
  }

  private onVisibilityChange(event: any): void {
    if (!this.activeSession) return;
    
    // Manage session pauses (like native phone background shifts)
    const visibility = this.activeSession.visibilityState;
    if (visibility === 'hidden') {
      this.setState('paused');
    } else if (visibility === 'visible') {
      this.setState('running');
    }
  }
}
