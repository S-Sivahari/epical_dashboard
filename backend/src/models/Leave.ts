import { ObjectId } from 'mongodb';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveRequest {
  _id?: ObjectId;
  id: string;
  employeeId: string;
  employeeName: string;
  managerId?: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
  approvalDate?: Date;
}

export interface CreateLeavePayload {
  employeeId: string;
  employeeName: string;
  managerId?: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
}
