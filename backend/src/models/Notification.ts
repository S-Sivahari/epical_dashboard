import { ObjectId } from 'mongodb';

export type NotificationType =
  | 'LeaveSubmitted'
  | 'LeaveApproved'
  | 'LeaveRejected'
  | 'LeaveCancelled'
  | 'LeaveLop'
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
  | 'TicketCommentAdded'
  | 'CellReviewRequested'
  | 'CellReviewApproved'
  | 'CellReviewRejected';

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
    lopDays?: number;
    ticketId?: string;
    ticketTitle?: string;
    ticketStatus?: string;
    projectId?: string;
    cellId?: string;
    reviewId?: string;
    projectName?: string;
    cellName?: string;
    reviewPoint?: string;
    stageAtRequest?: string;
    reviewOutcome?: string;
    returnToStage?: string;
    resolvedByName?: string;
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
    lopDays?: number;
    ticketId?: string;
    ticketTitle?: string;
    ticketStatus?: string;
    projectId?: string;
    cellId?: string;
    reviewId?: string;
    projectName?: string;
    cellName?: string;
    reviewPoint?: string;
    stageAtRequest?: string;
    reviewOutcome?: string;
    returnToStage?: string;
    resolvedByName?: string;
  };
  relatedId?: string;
}
