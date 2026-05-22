import { ObjectId } from 'mongodb';

export type NotificationType = 'LeaveSubmitted' | 'LeaveApproved' | 'LeaveRejected' | 'LeaveCancelled' | 'payslip';

export interface Notification {
  _id?: ObjectId;
  id: string;
  recipientId: string;
  recipientType?: 'Employee' | 'Manager' | 'Admin';
  type: NotificationType;
  title: string;
  message: string;
  relatedData?: {
    leaveId?: string;
    employeeId?: string;
    employeeName?: string;
  };
  relatedId?: string;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateNotificationPayload {
  recipientId: string;
  recipientType?: 'Employee' | 'Manager' | 'Admin';
  type: NotificationType;
  title: string;
  message: string;
  relatedData?: {
    leaveId?: string;
    employeeId?: string;
    employeeName?: string;
  };
  relatedId?: string;
}
