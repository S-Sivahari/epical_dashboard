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
  | 'PayslipRegenerated'
  | 'HolidayAdded'
  | 'HolidayUpdated'
  | 'HolidayDeleted'
  | 'HolidaySkipped'
  | 'CalendarEventAdded'
  | 'CalendarEventUpdated'
  | 'CalendarEventRemoved'
  | 'TicketSubmitted'
  | 'TicketStatusUpdated'
  | 'TicketCommentAdded';

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
    calendarEventId?: string;
    calendarEventTitle?: string;
    calendarEventDate?: string;
    skippedReason?: string;
    leaveType?: string;
    from?: string;
    to?: string;
    days?: number;
    ticketId?: string;
    ticketTitle?: string;
    ticketStatus?: string;
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
    calendarEventId?: string;
    calendarEventTitle?: string;
    calendarEventDate?: string;
    skippedReason?: string;
    leaveType?: string;
    from?: string;
    to?: string;
    days?: number;
    ticketId?: string;
    ticketTitle?: string;
    ticketStatus?: string;
  };
  relatedId?: string;
}
