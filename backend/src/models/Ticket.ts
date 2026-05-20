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
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTicketPayload {
  employeeId: string;
  employeeName: string;
  title: string;
  description?: string;
  priority: TicketPriority;
}
