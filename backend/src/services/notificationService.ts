import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { Notification, CreateNotificationPayload } from '../models/Notification';
import * as emailService from './emailService';

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

  // Trigger email notification asynchronously in the background so it doesn't block the API
  triggerEmailNotification(notification).catch((err) => {
    console.error('[Notification Service] Background email notification failed:', err);
  });

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

/**
 * Resolves the recipient's email address and triggers the appropriate email template from emailService.
 */
async function triggerEmailNotification(notification: any): Promise<void> {
  try {
    const db = getDB();
    let recipientEmail = '';
    let recipientName = 'User';

    // 1. Resolve recipient email and name based on recipientType
    if (notification.recipientType === 'Admin' || notification.recipientType === 'Manager') {
      const user = await db.collection('users').findOne({ id: notification.recipientId });
      if (user) {
        recipientEmail = user.email;
        recipientName = user.name || 'Admin';
      }
    } else if (notification.recipientType === 'Employee') {
      const employee = await db.collection('employees').findOne({ id: notification.recipientId });
      if (employee) {
        recipientEmail = employee.email;
        recipientName = `${employee.firstName} ${employee.lastName}`;
      } else {
        // Fallback: Check users collection if not found in employees
        const user = await db.collection('users').findOne({ id: notification.recipientId });
        if (user) {
          recipientEmail = user.email;
          recipientName = user.name;
        }
      }
    }

    // 2. Final fallback check in users collection if email still not found
    if (!recipientEmail) {
      const user = await db.collection('users').findOne({ id: notification.recipientId });
      if (user) {
        recipientEmail = user.email;
        recipientName = user.name;
      }
    }

    if (!recipientEmail) {
      console.warn(`[Notification Service] Could not resolve email address for recipient ID: ${notification.recipientId}`);
      return;
    }

    const related = notification.relatedData || {};
    let leaveDetails: any = null;

    // If there is a leave request associated with this notification, fetch its detailed fields
    if (related.leaveId) {
      leaveDetails = await db.collection('leaves').findOne({ id: related.leaveId });
    }

    // 3. Dispatch based on notification type
    if (notification.type === 'LeaveSubmitted') {
      await emailService.sendLeaveSubmittedEmail({
        recipientEmail,
        recipientName,
        employeeName: leaveDetails ? leaveDetails.employeeName : (related.employeeName || 'An employee'),
        type: leaveDetails ? leaveDetails.type : 'Leave',
        from: leaveDetails ? leaveDetails.from : 'N/A',
        to: leaveDetails ? leaveDetails.to : 'N/A',
        days: leaveDetails ? leaveDetails.days : 1,
        reason: leaveDetails ? leaveDetails.reason : undefined,
      });
    } else if (
      notification.type === 'LeaveApproved' ||
      notification.type === 'LeaveRejected' ||
      notification.type === 'LeaveCancelled'
    ) {
      let leaveStatus = 'Processed';
      if (notification.type === 'LeaveApproved') leaveStatus = 'Approved';
      if (notification.type === 'LeaveRejected') leaveStatus = 'Rejected';
      if (notification.type === 'LeaveCancelled') leaveStatus = 'Cancelled';

      await emailService.sendLeaveStatusEmail({
        recipientEmail,
        recipientName,
        employeeName: recipientName,
        type: leaveDetails ? leaveDetails.type : 'Leave',
        from: leaveDetails ? leaveDetails.from : 'N/A',
        to: leaveDetails ? leaveDetails.to : 'N/A',
        days: leaveDetails ? leaveDetails.days : 1,
        status: leaveStatus,
        rejectionReason: leaveDetails ? leaveDetails.rejectionReason : undefined,
      });
    } else {
      // Fallback generic notification email
      const fields: { label: string; value: string }[] = [];
      if (related.employeeName) {
        fields.push({ label: 'Employee Name', value: related.employeeName });
      }
      if (related.leaveId) {
        fields.push({ label: 'Reference ID', value: related.leaveId });
      }

      await emailService.sendGenericNotificationEmail(
        recipientEmail,
        recipientName,
        notification.title,
        notification.message,
        fields
      );
    }
  } catch (error) {
    console.error('[Notification Service] Error resolving or sending email notification:', error);
  }
}

