import { Router } from 'express';
import {
  getDashboardStats,
  updateRestaurant,
  toggleRestaurantStatus
} from '../controllers/restaurant';
import { protect } from '../middlewares/auth';

const router = Router();

router.get('/dashboard/stats', protect, getDashboardStats);
router.put('/', protect, updateRestaurant);
router.put('/status', protect, toggleRestaurantStatus);

export default router;
