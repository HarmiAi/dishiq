import { Router } from 'express';
import {
  getPlatformStats,
  getRestaurants,
  toggleRestaurantStatus,
  deleteRestaurant
} from '../controllers/superadmin';
import { protect, authorize } from '../middlewares/auth';

const router = Router();

// Secure all routes under superadmin role check
router.use(protect);
router.use(authorize('superadmin'));

router.get('/stats', getPlatformStats);
router.get('/restaurants', getRestaurants);
router.put('/restaurants/:id/suspend', toggleRestaurantStatus);
router.delete('/restaurants/:id', deleteRestaurant);

export default router;
