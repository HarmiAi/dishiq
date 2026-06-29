import { Server, Socket } from 'socket.io';
import http from 'http';

let ioInstance: Server | null = null;

export class SocketService {
  /**
   * Initialize Socket.IO server on top of HTTP server
   */
  static init(server: http.Server): Server {
    ioInstance = new Server(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? (process.env.FRONTEND_URL || '') 
          : [process.env.FRONTEND_URL || '', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    ioInstance.on('connection', (socket: Socket) => {
      console.log(`Socket Client connected: ${socket.id}`);

      // 1. Dashboard / KDS clients subscribe to live updates for their restaurant ID
      socket.on('join_restaurant_room', (restaurantId: string) => {
        if (restaurantId) {
          socket.join(`restaurant_${restaurantId}`);
          console.log(`Client ${socket.id} joined restaurant room: restaurant_${restaurantId}`);
        }
      });

      // 2. Customer tracking clients subscribe to updates for their order ID
      socket.on('join_order_room', (orderId: string) => {
        if (orderId) {
          socket.join(`order_${orderId}`);
          console.log(`Client ${socket.id} joined order room: order_${orderId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`Socket Client disconnected: ${socket.id}`);
      });
    });

    return ioInstance;
  }

  /**
   * Retrieve active Socket.IO server instance
   */
  static getIO(): Server {
    if (!ioInstance) {
      throw new Error('Socket.IO server has not been initialized');
    }
    return ioInstance;
  }

  /**
   * Broadcast new order details to the restaurant dashboard room
   */
  static emitNewOrder(restaurantId: string, order: any): void {
    if (ioInstance) {
      ioInstance.to(`restaurant_${restaurantId}`).emit('new_order', order);
      console.log(`[Socket] Broadcast new_order to restaurant_${restaurantId} (Order: ${order.orderNumber})`);
    }
  }

  /**
   * Broadcast order status / priority modifications to restaurant dashboards and customer tracking screens
   */
  static emitOrderUpdated(restaurantId: string, orderId: string, order: any): void {
    if (ioInstance) {
      // Sync restaurant dashboard + kitchen display
      ioInstance.to(`restaurant_${restaurantId}`).emit('order_updated', order);
      // Sync customer live timeline progress screen
      ioInstance.to(`order_${orderId}`).emit('order_updated', order);
      
      console.log(`[Socket] Broadcast order_updated to restaurant_${restaurantId} & order_${orderId}`);
    }
  }
}
