import { Router } from 'express';
import {
  createOrder,
  getRestaurantOrders,
  updateOrderStatus,
  resendOrderNotification,
  updateOrderPriority,
  getOrderAnalytics
} from '../controllers/order';
import { protect } from '../middlewares/auth';

const router = Router();

// Public: customer checkout places order
router.post('/', createOrder);

// Protected: dashboard operations
router.get('/analytics', protect, getOrderAnalytics);
router.get('/', protect, getRestaurantOrders);
router.put('/:id/status', protect, updateOrderStatus);
router.put('/:id/priority', protect, updateOrderPriority);
router.post('/:id/notify', protect, resendOrderNotification);

export default router;
