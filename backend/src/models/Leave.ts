import { ObjectId } from 'mongodb';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveRequest {
  _id?: ObjectId;
  id: string;
  employeeId: string;
  employeeName: string;
  managerId?: string;
  type: string;
  leaveDuration: 'Full Day' | 'Half Day';
  halfDaySession?: 'First Half' | 'Second Half';
  from: string;
  to: string;
  days: number;
  /** Days counted as Loss of Pay (casual leave beyond monthly balance). */
  lopDays?: number;
  reason: string;
  status: LeaveStatus;
  rejectionReason?: string;
  // Audit trail
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
  cancelledAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  approvalDate?: Date;
}

export interface CreateLeavePayload {
  employeeId: string;
  employeeName: string;
  managerId?: string;
  type: string;
  leaveDuration: 'Full Day' | 'Half Day';
  halfDaySession?: 'First Half' | 'Second Half';
  from: string;
  to: string;
  days: number;
  reason: string;
}
