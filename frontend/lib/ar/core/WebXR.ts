export interface WebXRCapability {
  supported: boolean;
  reason?: string;
  device: string;
  browser: string;
}

/**
 * Checks platform characteristics, secure context protocols, and 
 * WebXR immersive-ar hardware support.
 */
export class WebXRDetector {
  static async checkARSupport(): Promise<WebXRCapability> {
    if (typeof window === 'undefined') {
      return {
        supported: false,
        reason: 'Server-Side Rendering Context',
        device: 'Server',
        browser: 'None'
      };
    }

    const userAgent = navigator.userAgent || '';
    
    // Parse device details
    let device = 'Desktop PC';
    if (/android/i.test(userAgent)) {
      device = 'Android Phone';
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      device = 'iOS Device';
    } else if (/macintosh/i.test(userAgent)) {
      device = 'Macintosh';
    }

    // Parse browser details
    let browser = 'Unknown Browser';
    if (/chrome|crios/i.test(userAgent) && !/edge|edg/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/safari/i.test(userAgent) && !/chrome|crios|edge|edg/i.test(userAgent)) {
      browser = 'Safari';
    } else if (/firefox|fxios/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/edge|edg/i.test(userAgent)) {
      browser = 'Edge';
    }

    // 1. Verify navigator.xr exists
    if (!navigator.xr) {
      let reason = 'WebXR Device API is not available on this browser. ';
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        reason += 'Note that WebXR requires an HTTPS secure connection context.';
      }
      return { supported: false, reason, device, browser };
    }

    // 2. Verify immersive-ar session capability
    try {
      const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (isSupported) {
        return { supported: true, device, browser };
      } else {
        return {
          supported: false,
          reason: 'Browser supports WebXR, but immersive AR session mode is unsupported by this hardware.',
          device,
          browser
        };
      }
    } catch (error: any) {
      return {
        supported: false,
        reason: error?.message || 'Error checking immersive-ar capabilities.',
        device,
        browser
      };
    }
  }
}
