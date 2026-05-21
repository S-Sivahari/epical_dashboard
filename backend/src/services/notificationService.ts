import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { Notification, CreateNotificationPayload } from '../models/Notification';

let notificationCollection: Collection<any> | null = null;

function getNotificationCol(): Collection<any> {
  if (!notificationCollection) {
    notificationCollection = getDB().collection('notifications');
  }
  return notificationCollection;
}

export async function createNotification(
  payload: CreateNotificationPayload
): Promise<Notification> {
  const col = getNotificationCol();
  const id = `N-${Date.now()}`;
  const notification: any = {
    ...payload,
    id,
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await col.insertOne(notification);
  return notification as Notification;
}

export async function getNotificationsByRecipient(recipientId: string): Promise<Notification[]> {
  const col = getNotificationCol();
  const notifications = await col
    .find({ recipientId })
    .sort({ createdAt: -1 })
    .toArray();
  return notifications as Notification[];
}

export async function getUnreadNotifications(recipientId: string): Promise<Notification[]> {
  const col = getNotificationCol();
  const notifications = await col
    .find({ recipientId, isRead: false })
    .sort({ createdAt: -1 })
    .toArray();
  return notifications as Notification[];
}

export async function markAsRead(notificationId: string): Promise<Notification | null> {
  const col = getNotificationCol();
  const result = await col.findOneAndUpdate(
    { id: notificationId },
    { $set: { isRead: true, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result as Notification | null;
}

export async function markAllAsRead(recipientId: string): Promise<boolean> {
  const col = getNotificationCol();
  const result = await col.updateMany(
    { recipientId, isRead: false },
    { $set: { isRead: true, updatedAt: new Date() } }
  );
  return result.modifiedCount > 0;
}

export async function deleteNotification(notificationId: string): Promise<boolean> {
  const col = getNotificationCol();
  const result = await col.deleteOne({ id: notificationId });
  return result.deletedCount > 0;
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const col = getNotificationCol();
  return await col.countDocuments({ recipientId, isRead: false });
}
