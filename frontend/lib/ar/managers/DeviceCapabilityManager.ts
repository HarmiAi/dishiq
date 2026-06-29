/**
 * Detects device hardware capability, WebXR, camera permissions,
 * and immersive-ar support to decide between Mobile AR or 3D Desktop Inspector.
 */
export class DeviceCapabilityManager {
  static async checkARSupport(): Promise<{
    supported: boolean;
    webxr: boolean;
    reason?: string;
  }> {
    if (typeof window === 'undefined') {
      return { supported: false, webxr: false, reason: 'Server-Side Rendering Context' };
    }

    // 1. Check if navigator.xr is present
    if (!navigator.xr) {
      return {
        supported: false,
        webxr: false,
        reason: 'WebXR Device API is not supported by this browser. Defaulting to 3D Inspection.'
      };
    }

    // 2. Check if immersive-ar session type is supported
    try {
      const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (isSupported) {
        return { supported: true, webxr: true };
      } else {
        return {
          supported: false,
          webxr: false,
          reason: 'Device does not support immersive AR hardware features.'
        };
      }
    } catch (error) {
      return {
        supported: false,
        webxr: false,
        reason: 'Error checking WebXR session profile compatibility.'
      };
    }
  }
}
