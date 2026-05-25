import { ObjectId } from 'mongodb';

export type TicketStatus = 'Pending' | 'In Progress' | 'Completed';
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'Admin' | 'Employee';
  text: string;
  createdAt: Date;
}

export interface TicketAttachment {
  filename: string;
  contentType: string;
  data: string;
  uploadedAt: Date;
}

export interface Ticket {
  _id?: ObjectId;
  id: string;
  employeeId: string;
  employeeName: string;
  title: string;
  description?: string;
  priority: TicketPriority;
  status: TicketStatus;
  projectId?: string;
  projectName?: string;
  comments?: TicketComment[];
  attachment?: TicketAttachment;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTicketPayload {
  employeeId: string;
  employeeName: string;
  title: string;
  description?: string;
  priority: TicketPriority;
  projectId?: string;
  projectName?: string;
}

export interface AddTicketCommentPayload {
  authorId: string;
  authorName: string;
  authorRole: 'Admin' | 'Employee';
  text: string;
}