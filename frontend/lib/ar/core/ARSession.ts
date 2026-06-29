import * as THREE from 'three';

export type ARSessionState =
  | 'Idle'
  | 'Checking'
  | 'Supported'
  | 'Unsupported'
  | 'Starting'
  | 'Running'
  | 'Ended'
  | 'Error';

/**
 * Manages navigator.xr sessions request, error reporting, DOM overlay configurations,
 * and tracks the state machine changes.
 */
export class ARSessionManager {
  private session: any = null;
  private state: ARSessionState = 'Idle';
  private onStateChangeCallbacks: ((state: ARSessionState, errorMsg?: string) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && navigator.xr) {
      navigator.xr.addEventListener('devicechange', this.handleDeviceChange.bind(this));
    }
  }

  getState(): ARSessionState {
    return this.state;
  }

  setState(newState: ARSessionState, errorMsg?: string): void {
    if (this.state === newState) return;
    this.state = newState;
    this.onStateChangeCallbacks.forEach((cb) => cb(newState, errorMsg));
  }

  onStateChange(cb: (state: ARSessionState, errorMsg?: string) => void): void {
    this.onStateChangeCallbacks.push(cb);
  }

  async startSession(
    renderer: THREE.WebGLRenderer,
    overlayElement: HTMLElement
  ): Promise<any> {
    this.setState('Starting');

    if (!navigator.xr) {
      const errorMsg = 'WebXR Device API is not available on this device';
      this.setState('Error', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const sessionInit: any = {
        requiredFeatures: ['hit-test', 'local-floor', 'dom-overlay'],
        optionalFeatures: ['light-estimation', 'anchors'],
        domOverlay: { root: overlayElement }
      };

      const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
      this.session = session;
      
      // Bind session to WebGLRenderer
      await renderer.xr.setSession(session);
      
      session.addEventListener('end', this.onSessionEnd.bind(this));
      
      this.setState('Running');
      return session;
    } catch (error: any) {
      let errorMsg = 'Failed to start AR camera session';
      
      if (error?.name === 'NotAllowedError' || error?.message?.includes('permission')) {
        errorMsg = 'Camera permission denied by browser settings';
      } else if (error?.name === 'NotSupportedError') {
        errorMsg = 'Immersive-ar session features not supported by hardware';
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      this.setState('Error', errorMsg);
      throw new Error(errorMsg);
    }
  }

  async endSession(): Promise<void> {
    if (!this.session) return;
    
    try {
      await this.session.end();
    } catch (error) {
      // Catch already ended states
    } finally {
      this.onSessionEnd();
    }
  }

  private onSessionEnd(): void {
    if (!this.session) return;
    this.session = null;
    this.setState('Ended');
  }

  private handleDeviceChange(): void {
    console.log('[WebXR] Platform capabilities modified.');
  }

  dispose(): void {
    if (typeof window !== 'undefined' && navigator.xr) {
      navigator.xr.removeEventListener('devicechange', this.handleDeviceChange.bind(this));
    }
    this.endSession();
  }
}
