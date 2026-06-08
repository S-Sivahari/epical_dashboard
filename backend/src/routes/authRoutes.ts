import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/seed', authController.seed);

// Protected
router.get('/me', authMiddleware, authController.me);

export const authRoutes = router;
