import api from '@/lib/api';

/**
 * Tracks and logs AR usage parameters: session durations, total items placed,
 * interact counts, and click-through cart additions, posting values to SaaS analytics endpoints.
 */
export class AnalyticsManager {
  private restaurantId: string;
  private startTime: number = 0;
  private itemsPlaced: number = 0;
  private itemsInteracted: Set<string> = new Set();

  constructor(restaurantId: string) {
    this.restaurantId = restaurantId;
    this.startTime = Date.now();
  }

  trackPlacement(itemId: string): void {
    this.itemsPlaced += 1;
    this.itemsInteracted.add(itemId);
  }

  trackInteraction(itemId: string): void {
    this.itemsInteracted.add(itemId);
  }

  async trackExit(addedToCart: boolean = false): Promise<void> {
    const durationSec = Math.round((Date.now() - this.startTime) / 1000);
    try {
      // Send tracking session parameters to backend endpoint
      await api.post('/analytics/ar', {
        restaurantId: this.restaurantId,
        duration: durationSec,
        itemsCount: this.itemsPlaced,
        uniqueItemIds: Array.from(this.itemsInteracted),
        converted: addedToCart
      });
      console.log('[AR Analytics] Synced session details successfully.');
    } catch (error) {
      console.warn('[AR Analytics] Failed to sync session tracking:', error);
    }
  }
}
