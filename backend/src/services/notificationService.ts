import { Collection } from 'mongodb';
import { readFileSync } from 'fs';
import { getDB } from '../config/db';
import { Notification, CreateNotificationPayload } from '../models/Notification';
import * as emailService from './emailService';

let notificationCollection: Collection<any> | null = null;
let indexesCreated = false;

function getNotificationCol(): Collection<any> {
  if (!notificationCollection) {
    notificationCollection = getDB().collection('notifications');
    if (!indexesCreated) {
      void createIndexes();
      indexesCreated = true;
    }
  }
  return notificationCollection;
}

async function createIndexes(): Promise<void> {
  try {
    const collection = getDB().collection('notifications');
    
    // Check for duplicate IDs before creating unique index
    const duplicates = await collection.aggregate([
      { $group: { _id: '$id', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (duplicates.length > 0) {
      console.warn(`[Notifications] Found ${duplicates.length} duplicate notification IDs. Cleaning up...`);
      
      // For each duplicate, keep the newest one and remove others
      for (const dup of duplicates) {
        const docs = await collection
          .find({ id: dup._id })
          .sort({ createdAt: -1 })
          .toArray();
        
        // Keep the first (newest), delete the rest
        const toDelete = docs.slice(1).map(d => d._id);
        if (toDelete.length > 0) {
          await collection.deleteMany({ _id: { $in: toDelete } });
          console.log(`[Notifications] Removed ${toDelete.length} duplicate(s) for ID: ${dup._id}`);
        }
      }
    }
    
    // Create indexes one by one to handle conflicts gracefully
    const indexesToCreate: { spec: any; options?: any }[] = [
      { spec: { id: 1 }, options: { unique: true, name: 'id_1' } },
      { spec: { recipientId: 1 }, options: { name: 'recipientId_1' } },
      { spec: { recipientId: 1, isRead: 1 }, options: { name: 'recipientId_1_isRead_1' } },
      { spec: { recipientId: 1, type: 1 }, options: { name: 'recipientId_1_type_1' } },
      { spec: { createdAt: -1 }, options: { name: 'createdAt_-1' } },
      { spec: { recipientId: 1, createdAt: -1 }, options: { name: 'recipientId_1_createdAt_-1' } },
    ];
    
    for (const { spec, options } of indexesToCreate) {
      try {
        await collection.createIndex(spec, options);
      } catch (error: any) {
        // Ignore if index already exists with same spec
        if (error.code !== 85 && error.code !== 86) {
          console.warn(`Failed to create index ${options.name}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Failed to create notifications indexes:', error);
  }
}

/** Create the same in-app notification for every admin user. */
export async function notifyAllAdmins(
  payload: Omit<CreateNotificationPayload, 'recipientId' | 'recipientType'>
): Promise<void> {
  const admins = await getDB().collection('users').find({ role: 'Admin' }).toArray();
  for (const admin of admins) {
    await createNotification({
      ...payload,
      recipientId: String(admin.id),
      recipientType: 'Admin',
    });
  }
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

export async function markAsRead(
  notificationId: string,
  recipientId: string,
): Promise<Notification | null> {
  const col = getNotificationCol();
  const result = await col.findOneAndUpdate(
    { id: notificationId, recipientId },
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

export async function deleteNotification(
  notificationId: string,
  recipientId: string,
): Promise<boolean> {
  const col = getNotificationCol();
  const result = await col.deleteOne({ id: notificationId, recipientId });
  return result.deletedCount > 0;
}

export async function deleteAllNotifications(recipientId: string): Promise<number> {
  const col = getNotificationCol();
  const result = await col.deleteMany({ recipientId });
  return result.deletedCount;
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const col = getNotificationCol();
  return await col.countDocuments({ recipientId, isRead: false });
}

function notificationCategoryForType(type: Notification['type']): 'leaves' | 'documents' | 'other' {
  if (type.startsWith('Leave')) return 'leaves';
  if (type.startsWith('Document') || type.startsWith('Payslip')) return 'documents';
  return 'other';
}

export async function getUnreadCountsByCategory(recipientId: string): Promise<{
  leaves: number;
  documents: number;
  other: number;
  total: number;
}> {
  const col = getNotificationCol();

  const unreadNotifications = await col
    .find({ recipientId, isRead: false })
    .toArray() as Notification[];

  let leaves = 0;
  let documents = 0;
  let other = 0;

  unreadNotifications.forEach((notif) => {
    const category = notificationCategoryForType(notif.type);
    if (category === 'leaves') leaves++;
    else if (category === 'documents') documents++;
    else other++;
  });

  return {
    leaves,
    documents,
    other,
    total: unreadNotifications.length,
  };
}

export async function markAsReadByTypes(
  recipientId: string,
  types: Notification['type'][],
): Promise<number> {
  if (!types.length) return 0;

  const col = getNotificationCol();
  const result = await col.updateMany(
    { recipientId, isRead: false, type: { $in: types } },
    { $set: { isRead: true, updatedAt: new Date() } },
  );
  return result.modifiedCount;
}

async function loadPayslipPdfAttachment(
  batchId: string,
  fileName: string,
  employeeName: string,
  payMonth?: string
): Promise<emailService.EmailAttachment | undefined> {
  try {
    const { ensurePayslipPdfExists } = await import('./payrollBatchService');
    const { formatPayslipDownloadFileName } = await import('./payslipDownloadName');
    const filePath = await ensurePayslipPdfExists(batchId, fileName);
    const content = readFileSync(filePath);
    return {
      filename: formatPayslipDownloadFileName(employeeName, payMonth),
      content,
      contentType: 'application/pdf',
    };
  } catch (error) {
    console.warn('[Notification Service] Could not attach payslip PDF to email:', error);
    return undefined;
  }
}

function resolveNotificationActionUrl(notification: any): string {
  const { type, relatedData: related = {}, recipientType } = notification;

  switch (type) {
    case 'LeaveSubmitted':
      return emailService.frontendUrl('/admin/leaves');
    case 'LeaveApproved':
    case 'LeaveRejected':
    case 'LeaveCancelled':
      return emailService.frontendUrl('/employee/leave');
    case 'PayslipSent':
    case 'PayslipRegenerated':
      return emailService.frontendUrl('/employee/documents?tab=payslips');
    case 'DocumentApproved':
    case 'DocumentRejected':
      return emailService.frontendUrl('/employee/documents?tab=requests');
    case 'TicketStatusUpdated':
    case 'TicketCommentAdded':
      return emailService.frontendUrl('/employee/tickets');
    case 'HolidayAdded':
    case 'HolidayUpdated':
    case 'HolidayDeleted':
    case 'HolidaySkipped':
    case 'CalendarEventAdded':
    case 'CalendarEventUpdated':
    case 'CalendarEventRemoved':
      return emailService.frontendUrl(recipientType === 'Admin' ? '/admin/calendar' : '/employee/calendar');
    case 'CellReviewApproved':
    case 'CellReviewRejected':
    case 'CellAssigned':
    case 'CellCreatedUnassigned':
      if (related.projectId && related.cellId) {
        const prefix = recipientType === 'Admin' ? '/admin' : '/employee';
        return emailService.frontendUrl(`${prefix}/projects/${related.projectId}/cells/${related.cellId}`);
      }
      if (related.projectId) {
        const prefix = recipientType === 'Admin' ? '/admin' : '/employee';
        return emailService.frontendUrl(`${prefix}/projects/${related.projectId}`);
      }
      return emailService.frontendUrl(recipientType === 'Admin' ? '/admin/projects' : '/employee/projects');
    default:
      return emailService.frontendUrl();
  }
}

/**
 * Resolves the recipient's email address and triggers the appropriate email template from emailService.
 * Admins and Managers only receive in-app notifications — emails are skipped for them.
 */
async function triggerEmailNotification(notification: any): Promise<void> {
  try {
    // Admins and Managers get in-app notifications only, not emails
    if (notification.recipientType === 'Admin' || notification.recipientType === 'Manager') {
      return;
    }

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
      const employee = await db.collection('employees').findOne(
        { id: notification.recipientId },
        { projection: { documents: 0, 'photo.data': 0 } }
      );
      if (employee) {
        recipientEmail =
          (employee.email && String(employee.email).trim()) ||
          (employee.personalEmail && String(employee.personalEmail).trim()) ||
          '';
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

    // 3. Use relatedData.employeeEmail as last resort (e.g., from payslip records)
    if (!recipientEmail && notification.relatedData?.employeeEmail) {
      recipientEmail = notification.relatedData.employeeEmail;
      if (!recipientName || recipientName === 'User') {
        recipientName = notification.relatedData.employeeName || 'Employee';
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

    // 4. Dispatch based on notification type
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
      }, emailService.frontendUrl('/admin/leaves'));
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
        type: leaveDetails ? leaveDetails.type : (related.leaveType || 'Leave'),
        from: leaveDetails ? leaveDetails.from : (related.from || 'N/A'),
        to: leaveDetails ? leaveDetails.to : (related.to || 'N/A'),
        days: leaveDetails ? leaveDetails.days : (related.days || 1),
        status: leaveStatus,
        rejectionReason: leaveDetails ? leaveDetails.rejectionReason : undefined,
      }, emailService.frontendUrl('/employee/leave'));
    } else if (notification.type === 'PayslipSent' || notification.type === 'PayslipRegenerated') {
      let pdfAttachment: emailService.EmailAttachment | undefined;
      if (related.batchId && related.fileName) {
        pdfAttachment = await loadPayslipPdfAttachment(
          related.batchId,
          related.fileName,
          related.employeeName || recipientName,
          related.payMonth
        );
      }
      await emailService.sendPayslipEmail(
        {
          recipientEmail,
          recipientName,
          employeeName: related.employeeName || recipientName,
          employeeId: related.employeeId || '',
          payMonth: related.payMonth || 'Payslip',
          fileName: related.fileName || '',
        },
        emailService.frontendUrl('/employee/documents?tab=payslips'),
        pdfAttachment
      );
    } else if (
      notification.type === 'TicketStatusUpdated' ||
      notification.type === 'TicketCommentAdded'
    ) {
      await emailService.sendGenericNotificationEmail(
        recipientEmail,
        recipientName,
        notification.title,
        notification.message,
        related.ticketId ? [{ label: 'Ticket ID', value: related.ticketId }] : [],
        emailService.frontendUrl('/employee/tickets'),
      );
    } else if (
      notification.type === 'CellReviewApproved' ||
      notification.type === 'CellReviewRejected'
    ) {
      const stageLabels: Record<string, string> = {
        floor_plan: 'Floor Plan',
        drc_r1: 'DRC (R1)',
        routing: 'Routing',
        drc: 'DRC',
        lvs_r2: 'LVS (R2)',
      };
      const stageKey = related.stageAtRequest || '';
      const stageLabel =
        stageLabels[stageKey] || String(stageKey).replace(/_/g, ' ') || 'Layout';
      const outcome = notification.type === 'CellReviewApproved' ? 'approved' : 'rejected';

      if (related.projectId && related.cellId) {
        await emailService.sendCellReviewEmail({
          recipientEmail,
          recipientName,
          projectId: related.projectId,
          cellId: related.cellId,
          projectName: related.projectName || 'Project',
          cellName: related.cellName || 'Cell',
          reviewPoint: related.reviewPoint || 'review',
          stageLabel,
          outcome,
          returnToStage: related.returnToStage
            ? stageLabels[related.returnToStage] || String(related.returnToStage).replace(/_/g, ' ')
            : undefined,
          resolvedByName: related.resolvedByName,
        });
      } else {
        const cellUrl =
          related.projectId && related.cellId
            ? emailService.frontendUrl(`/employee/projects/${related.projectId}/cells/${related.cellId}`)
            : related.projectId
              ? emailService.frontendUrl(`/employee/projects/${related.projectId}`)
              : emailService.frontendUrl('/employee/projects');
        await emailService.sendGenericNotificationEmail(
          recipientEmail,
          recipientName,
          notification.title,
          notification.message,
          [
            { label: 'Project', value: related.projectName || '—' },
            { label: 'Cell', value: related.cellName || '—' },
          ],
          cellUrl,
        );
      }
    } else if (
      notification.type === 'HolidayAdded' ||
      notification.type === 'HolidayUpdated' ||
      notification.type === 'HolidayDeleted' ||
      notification.type === 'HolidaySkipped'
    ) {
      const eventTypeMap: Record<string, 'added' | 'updated' | 'deleted' | 'skipped' | 'restored'> = {
        HolidayAdded: 'added',
        HolidayUpdated: 'updated',
        HolidayDeleted: 'deleted',
        HolidaySkipped: 'skipped',
      };
      await emailService.sendHolidayNotificationEmail({
        recipientEmail,
        recipientName,
        holidayTitle: related.holidayTitle || 'Holiday',
        holidayDate: related.holidayDate || '',
        eventType: eventTypeMap[notification.type] || 'updated',
        skippedReason: related.skippedReason,
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
        fields,
        resolveNotificationActionUrl(notification),
      );
    }
  } catch (error) {
    console.error('[Notification Service] Error resolving or sending email notification:', error);
  }
}

