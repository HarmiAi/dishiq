import { SceneManager } from './SceneManager';

/**
 * Handles target mesh selections, outline calls, and selection state updates.
 */
export class SelectionManager {
  private sceneManager: SceneManager;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  select(id: string | null): void {
    this.sceneManager.selectObject(id);
  }

  getSelectedId(): string | null {
    const selected = this.sceneManager.getSelectedObject();
    return selected ? selected.id : null;
  }
}
