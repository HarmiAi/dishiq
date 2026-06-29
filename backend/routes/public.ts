import { Router } from 'express';
import {
  getPublicMenu,
  getPublicCart,
  updatePublicCart,
  getPublicOrderDetails,
  trackARSession
} from '../controllers/public';

const router = Router();

router.get('/restaurant/:slug', getPublicMenu);
router.get('/cart/:sessionToken', getPublicCart);
router.post('/cart', updatePublicCart);
router.get('/order/:id', getPublicOrderDetails);
router.post('/analytics/ar', trackARSession);

export default router;
