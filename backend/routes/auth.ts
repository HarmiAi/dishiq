import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword
} from '../controllers/auth';
import { validateRegister, validateLogin } from '../middlewares/validator';
import { protect } from '../middlewares/auth';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.post('/forgot-password', authLimiter, forgotPassword);

export default router;
