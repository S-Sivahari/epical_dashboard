export type CompensationStatus = 'Active' | 'Cancelled';

export interface CompensationEntry {
  _id?: any;
  id: string;
  employeeId: string;
  employeeName: string;
  days: number;
  reason: string;
  appliedDate: string;
  createdBy: string;
  status: CompensationStatus;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
