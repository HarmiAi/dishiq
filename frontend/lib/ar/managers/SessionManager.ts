import * as THREE from 'three';

export type SessionState =
  | 'idle'
  | 'loading'
  | 'permission'
  | 'initializing'
  | 'scanning'
  | 'placed'
  | 'paused'
  | 'lost'
  | 'recovery'
  | 'exit';

/**
 * Manages the active WebXR session lifecycle and tracks state machine changes.
 */
export class SessionManager {
  private activeSession: XRSession | null = null;
  private state: SessionState = 'idle';
  private onStateChangeCallbacks: ((state: SessionState) => void)[] = [];

  getState(): SessionState {
    return this.state;
  }

  setState(newState: SessionState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.onStateChangeCallbacks.forEach((cb) => cb(newState));
  }

  onStateChange(cb: (state: SessionState) => void): void {
    this.onStateChangeCallbacks.push(cb);
  }

  async startSession(
    renderer: THREE.WebGLRenderer,
    options: XRSessionInit = {}
  ): Promise<XRSession> {
    this.setState('permission');
    
    try {
      const session = await navigator.xr!.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'local-floor'],
        optionalFeatures: ['dom-overlay'],
        ...options
      });

      this.activeSession = session;
      this.setState('initializing');

      // Connect session to the Three.js WebGLRenderer
      await renderer.xr.setSession(session);
      
      session.addEventListener('end', () => {
        this.endSession();
      });

      this.setState('scanning');
      return session;
    } catch (error) {
      this.setState('idle');
      throw error;
    }
  }

  async endSession(): Promise<void> {
    if (!this.activeSession) return;
    
    this.setState('exit');
    try {
      await this.activeSession.end();
    } catch (error) {
      // Capture already closed profiles
    } finally {
      this.activeSession = null;
      this.setState('idle');
    }
  }

  isActive(): boolean {
    return this.activeSession !== null;
  }

  getSession(): XRSession | null {
    return this.activeSession;
  }
}
