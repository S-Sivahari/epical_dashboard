import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/authMiddleware';

export const notificationRoutes = Router();

// All routes require authentication
notificationRoutes.use(authMiddleware);

// Get all notifications
notificationRoutes.get('/', notificationController.getAll);

// Get unread notifications
notificationRoutes.get('/unread', notificationController.getUnread);

// Get unread count
notificationRoutes.get('/count/unread', notificationController.getUnreadCount);

// Mark as read
notificationRoutes.patch('/:id/read', notificationController.markAsRead);

// Mark all as read
notificationRoutes.patch('/read-all', notificationController.markAllAsRead);

// Delete notification
notificationRoutes.delete('/:id', notificationController.delete);
