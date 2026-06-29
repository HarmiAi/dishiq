import { Router } from 'express';
import {
  getCustomers,
  getCustomerDetails,
  toggleCustomerVIP,
  updateCustomerNotes
} from '../controllers/customer';
import { protect, authorize } from '../middlewares/auth';

const router = Router();

// Protect routing
router.use(protect);

router.get('/', authorize('owner', 'manager', 'staff'), getCustomers);
router.get('/:id', authorize('owner', 'manager', 'staff'), getCustomerDetails);
router.put('/:id/vip', authorize('owner', 'manager'), toggleCustomerVIP);
router.put('/:id/notes', authorize('owner', 'manager', 'staff'), updateCustomerNotes);

export default router;
