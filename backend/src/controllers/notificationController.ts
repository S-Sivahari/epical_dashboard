import { Request, Response } from 'express';
import * as notificationService from '../services/notificationService';
import { AuthRequest } from '../middleware/authMiddleware';

function sessionUser(req: AuthRequest) {
  return {
    userId: req.user?.id ?? '',
    userEmail: req.user?.email,
    activeRole: req.user?.role ?? 'employee',
  };
}

export const notificationController = {
  // GET /api/notifications/history - Last 30 days (older rows purged)
  getHistory: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const history = await notificationService.getNotificationHistoryForSession(
        userId,
        userEmail,
        activeRole,
      );
      res.json(history);
    } catch (error) {
      console.error('Get notification history error:', error);
      res.status(500).json({ error: 'Failed to fetch notification history' });
    }
  },

  // GET /api/notifications - Get all notifications for current user
  getAll: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const notifications = await notificationService.getNotificationsForSession(
        userId,
        userEmail,
        activeRole,
      );
      res.json(notifications);
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  },

  // GET /api/notifications/unread - Get unread notifications
  getUnread: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const notifications = await notificationService.getNotificationsForSession(
        userId,
        userEmail,
        activeRole,
      );
      const unread = notifications.filter((n) => !n.isRead);
      res.json({ notifications: unread, count: unread.length });
    } catch (error) {
      console.error('Get unread notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch unread notifications' });
    }
  },

  // GET /api/notifications/count - Get unread notification count
  getUnreadCount: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const count = await notificationService.getUnreadCountForSession(
        userId,
        userEmail,
        activeRole,
      );
      res.json({ count });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  },

  // GET /api/notifications/counts-by-category - Get unread counts by category
  getUnreadCountsByCategory: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const counts = await notificationService.getUnreadCountsByCategoryForSession(
        userId,
        userEmail,
        activeRole,
      );
      res.json(counts);
    } catch (error) {
      console.error('Get unread counts by category error:', error);
      res.status(500).json({ error: 'Failed to fetch unread counts by category' });
    }
  },

  // PATCH /api/notifications/:id/read - Mark as read
  markAsRead: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { id } = req.params as { id: string };
      const notification = await notificationService.markAsReadForSession(
        id,
        userId,
        userEmail,
        activeRole,
      );
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

  // PATCH /api/notifications/read-by-types - Mark unread notifications of given types as read
  markAsReadByTypes: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { types } = req.body as { types?: string[] };
      if (!Array.isArray(types) || types.length === 0) {
        res.json({ modifiedCount: 0 });
        return;
      }
      const modifiedCount = await notificationService.markAsReadByTypesForSession(
        userId,
        userEmail,
        activeRole,
        types,
      );
      res.json({ modifiedCount });
    } catch (error) {
      console.error('Mark as read by types error:', error);
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  },

  // PATCH /api/notifications/read-all - Mark all as read
  markAllAsRead: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const success = await notificationService.markAllAsReadForSession(
        userId,
        userEmail,
        activeRole,
      );
      res.json({ success });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  },

  // DELETE /api/notifications/all - Delete all notifications for current user
  deleteAll: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const deletedCount = await notificationService.deleteAllNotificationsForSession(
        userId,
        userEmail,
        activeRole,
      );
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error('Delete all notifications error:', error);
      res.status(500).json({ error: 'Failed to delete all notifications' });
    }
  },

  // DELETE /api/notifications/:id - Delete notification
  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId, userEmail, activeRole } = sessionUser(req);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { id } = req.params as { id: string };
      const success = await notificationService.deleteNotificationForSession(
        id,
        userId,
        userEmail,
        activeRole,
      );
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
