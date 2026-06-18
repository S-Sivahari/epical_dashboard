import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/seed', authController.seed);
router.post('/switch-portal', authMiddleware, authController.switchPortal);

// Protected
router.get('/me', authMiddleware, authController.me);
router.patch('/me', authMiddleware, authController.updateProfile);

export const authRoutes = router;
