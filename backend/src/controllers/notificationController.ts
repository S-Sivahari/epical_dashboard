import { Request, Response } from 'express';
import * as notificationService from '../services/notificationService';
import { AuthRequest } from '../middleware/authMiddleware';

export const notificationController = {
  // GET /api/notifications - Get all notifications for current user
  getAll: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const notifications = await notificationService.getNotificationsByRecipient(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  },

  // GET /api/notifications/unread - Get unread notifications
  getUnread: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const notifications = await notificationService.getUnreadNotifications(req.user.id);
      const count = notifications.length;
      res.json({ notifications, count });
    } catch (error) {
      console.error('Get unread notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch unread notifications' });
    }
  },

  // GET /api/notifications/count - Get unread notification count
  getUnreadCount: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const count = await notificationService.getUnreadCount(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  },

  // GET /api/notifications/counts-by-category - Get unread counts by category
  getUnreadCountsByCategory: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const counts = await notificationService.getUnreadCountsByCategory(req.user.id);
      res.json(counts);
    } catch (error) {
      console.error('Get unread counts by category error:', error);
      res.status(500).json({ error: 'Failed to fetch unread counts by category' });
    }
  },

  // PATCH /api/notifications/:id/read - Mark as read
  markAsRead: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { id } = req.params as { id: string };
      const notification = await notificationService.markAsRead(id, req.user.id);
      if (!notification) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }
      res.json(notification);
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  },

  // PATCH /api/notifications/read-all - Mark all as read
  markAllAsRead: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const success = await notificationService.markAllAsRead(req.user.id);
      res.json({ success });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  },

  // DELETE /api/notifications/:id - Delete notification
  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { id } = req.params as { id: string };
      const success = await notificationService.deleteNotification(id, req.user.id);
      if (!success) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  },
};
