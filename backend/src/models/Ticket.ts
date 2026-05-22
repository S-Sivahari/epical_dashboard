import { ObjectId } from 'mongodb';

export type TicketStatus = 'Pending' | 'In Progress' | 'Completed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Ticket {
  _id?: ObjectId;
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description?: string;
  priority: TicketPriority;
  status: TicketStatus;
  projectId?: string; // Project this ticket is assigned to
  projectName?: string; // Project name for reference
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTicketPayload {
  employeeId: string;
  employeeName: string;
  title: string;
  description?: string;
  priority: TicketPriority;
  projectId?: string; // Project this ticket belongs to
  projectName?: string; // Project name for reference
}
