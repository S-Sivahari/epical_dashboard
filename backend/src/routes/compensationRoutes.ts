import { Router } from 'express';
import * as compensationController from '../controllers/compensationController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

export const compensationRoutes = Router();

compensationRoutes.use(authMiddleware);

compensationRoutes.get('/', compensationController.list);
compensationRoutes.post('/', requireRole('Admin'), compensationController.create);
compensationRoutes.put('/:id', requireRole('Admin'), compensationController.update);
compensationRoutes.post('/:id/cancel', requireRole('Admin'), compensationController.cancel);
compensationRoutes.delete('/:id', requireRole('Admin'), compensationController.remove);
