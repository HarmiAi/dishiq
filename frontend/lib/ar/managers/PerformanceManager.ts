/**
 * Tracks framerate metrics (FPS), dispatching events and managing thermal/draw calls
 * optimization triggers if FPS falls below 30 consistently to protect battery and hardware.
 */
export class PerformanceManager {
  private lastTime: number = 0;
  private frames: number = 0;
  private fps: number = 60;
  private lowFpsCount: number = 0;
  private onLowPerformanceCallbacks: (() => void)[] = [];

  constructor() {
    this.lastTime = performance.now();
  }

  tick(): void {
    const time = performance.now();
    this.frames += 1;

    if (time >= this.lastTime + 1000) {
      this.fps = Math.round((this.frames * 1000) / (time - this.lastTime));
      this.frames = 0;
      this.lastTime = time;

      // Broadcast FPS metrics to UI stats panel
      const event = new window.CustomEvent('ar-fps-tick', { detail: { fps: this.fps } });
      window.dispatchEvent(event);

      // Throttling triggers for low-end device optimization
      if (this.fps < 30) {
        this.lowFpsCount += 1;
        if (this.lowFpsCount >= 5) {
          this.onLowPerformanceCallbacks.forEach((cb) => cb());
          this.lowFpsCount = 0;
        }
      } else {
        this.lowFpsCount = Math.max(0, this.lowFpsCount - 1);
      }
    }
  }

  getFPS(): number {
    return this.fps;
  }

  onLowPerformance(cb: () => void): void {
    this.onLowPerformanceCallbacks.push(cb);
  }
}
