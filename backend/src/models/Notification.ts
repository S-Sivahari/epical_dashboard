import { ObjectId } from 'mongodb';

export type NotificationType =
  | 'LeaveSubmitted'
  | 'LeaveApproved'
  | 'LeaveRejected'
  | 'LeaveCancelled'
  | 'PayslipSent';

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
    payslipId?: string;
    batchId?: string;
    payMonth?: string;
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
    payslipId?: string;
    batchId?: string;
    payMonth?: string;
  };
  relatedId?: string;
}
