import { Router } from 'express';
import { protect } from '../middlewares/auth';
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} from '../controllers/menu';

const router = Router();

router.route('/')
  .get(protect, getMenuItems)
  .post(protect, createMenuItem);

router.route('/:id')
  .put(protect, updateMenuItem)
  .delete(protect, deleteMenuItem);

export default router;
