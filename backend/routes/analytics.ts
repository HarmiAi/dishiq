import { Router } from 'express';
import { getRestaurantAnalytics } from '../controllers/analytics';
import { protect, authorize } from '../middlewares/auth';

const router = Router();

// Protect routing for manager/owner level queries
router.get('/', protect, authorize('owner', 'manager'), getRestaurantAnalytics);

export default router;
