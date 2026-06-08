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

// Get unread counts by category
notificationRoutes.get('/counts-by-category', notificationController.getUnreadCountsByCategory);

// Mark all as read (before /:id/read so "read-all" is not captured as an id)
notificationRoutes.patch('/read-all', notificationController.markAllAsRead);

// Mark as read
notificationRoutes.patch('/:id/read', notificationController.markAsRead);

// Delete all notifications (before /:id)
notificationRoutes.delete('/all', notificationController.deleteAll);

// Delete notification
notificationRoutes.delete('/:id', notificationController.delete);
