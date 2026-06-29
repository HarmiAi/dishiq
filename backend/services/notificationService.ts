import { IOrder } from '../models/Order';
import { IRestaurant } from '../models/Restaurant';
import { WhatsappProviderFactory } from './providers/notificationProvider';

export class NotificationService {
  /**
   * Send WhatsApp notification when a new order is received
   * @param order Mongoose Order document
   * @param restaurant Mongoose Restaurant document
   * @returns boolean indicating send success
   */
  static async sendNewOrderAlert(
    order: IOrder,
    restaurant: IRestaurant
  ): Promise<boolean> {
    try {
      const settings = restaurant.whatsappSettings;
      
      // If notification is globally disabled for this restaurant, skip sending
      if (!settings || !settings.notificationsEnabled || !settings.whatsappNumber) {
        console.log(`WhatsApp notifications disabled or number missing for restaurant: ${restaurant.name}`);
        return false;
      }

      // Format timezone and time
      const orderTimeStr = this.formatTimeZoneTime(order.createdAt, settings.timezone);

      // Build out items text block
      let itemsText = '';
      for (const item of order.items) {
        // Populate names if populated by controller, otherwise show MenuItem
        const itemName = (item.menuItemId as any).name || 'Menu Item';
        itemsText += `• ${itemName} x${item.quantity}\n  ₹${item.price.toFixed(2)} (Sub: ₹${item.subtotal.toFixed(2)})\n`;
      }

      // Generate order placard message matching the requested layout template
      const message = `🍽 *New Order Received*\n\n` +
        `*Order ID:* ${order.orderNumber}\n` +
        `*Restaurant:* ${settings.businessName || restaurant.name}\n` +
        `*Table:* ${order.tableId ? (order.tableId as any).tableNumber || 'Dynamic Table' : 'N/A'}\n\n` +
        `*Customer:* ${order.customerName}\n` +
        `*Phone:* ${order.customerPhone}\n\n` +
        `*Items:*\n${itemsText}\n` +
        `*Total:* ₹${order.grandTotal.toFixed(2)}\n\n` +
        `*Notes:* ${order.notes || 'None'}\n` +
        `*Order Time:* ${orderTimeStr}\n` +
        `*Status:* Pending ⚡`;

      const provider = WhatsappProviderFactory.getProvider();
      const destination = settings.whatsappNumber;

      const success = await provider.sendMessage(destination, message);
      if (success) {
        console.log(`WhatsApp notification dispatched successfully to ${destination} for ${order.orderNumber}`);
      } else {
        console.error(`WhatsApp notification dispatch failed to ${destination} for ${order.orderNumber}`);
      }

      return success;
    } catch (error) {
      console.error('Notification Service Error:', error);
      return false;
    }
  }

  /**
   * Helper to format Date into timezone specific AM/PM time format
   */
  private static formatTimeZoneTime(date: Date, timeZone: string): string {
    try {
      return date.toLocaleTimeString('en-US', {
        timeZone: timeZone || 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      // Fallback
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
  }
}
