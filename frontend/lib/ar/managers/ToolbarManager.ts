/**
 * Bridges the DOM floating toolbar buttons with manager classes.
 */
export class ToolbarManager {
  private onActionCallbacks: Map<string, Array<() => void>> = new Map();

  registerAction(action: string, cb: () => void): void {
    if (!this.onActionCallbacks.has(action)) {
      this.onActionCallbacks.set(action, []);
    }
    this.onActionCallbacks.get(action)!.push(cb);
  }

  triggerAction(action: string): void {
    const callbacks = this.onActionCallbacks.get(action);
    if (callbacks) {
      callbacks.forEach((cb) => cb());
    }
  }
}
