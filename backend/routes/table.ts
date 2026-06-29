import { Router } from 'express';
import { protect } from '../middlewares/auth';
import {
  getTables,
  createTable,
  updateTable,
  deleteTable
} from '../controllers/table';

const router = Router();

router.route('/')
  .get(protect, getTables)
  .post(protect, createTable);

router.route('/:id')
  .put(protect, updateTable)
  .delete(protect, deleteTable);

export default router;
