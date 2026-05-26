import { ObjectId } from 'mongodb';

export type NotificationType =
  | 'LeaveSubmitted'
  | 'LeaveApproved'
  | 'LeaveRejected'
  | 'LeaveCancelled'
  | 'DocumentRequested'
  | 'DocumentApproved'
  | 'DocumentRejected'
  | 'PayslipSent'
  | 'HolidayAdded'
  | 'HolidayUpdated'
  | 'HolidayDeleted'
  | 'HolidaySkipped';

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
    employeeEmail?: string;
    payslipId?: string;
    batchId?: string;
    payMonth?: string;
    fileName?: string;
    holidayId?: string;
    holidayTitle?: string;
    holidayDate?: string;
    skippedReason?: string;
    leaveType?: string;
    from?: string;
    to?: string;
    days?: number;
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
    employeeEmail?: string;
    payslipId?: string;
    batchId?: string;
    payMonth?: string;
    fileName?: string;
    holidayId?: string;
    holidayTitle?: string;
    holidayDate?: string;
    skippedReason?: string;
    leaveType?: string;
    from?: string;
    to?: string;
    days?: number;
  };
  relatedId?: string;
}
