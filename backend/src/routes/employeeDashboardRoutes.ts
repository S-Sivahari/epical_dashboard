import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { employeeDashboardController } from '../controllers/employeeDashboardController';

export const employeeDashboardRoutes = Router();

employeeDashboardRoutes.get('/employee', authMiddleware, employeeDashboardController.getMine);
