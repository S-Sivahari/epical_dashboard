import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import {
  Ticket,
  CreateTicketPayload,
  TicketStatus,
  AddTicketCommentPayload,
  TicketAttachment,
} from '../models/Ticket';
import { syncProjectStatus } from '../utils/syncProject';

let ticketCollection: Collection<any> | null = null;

function getTicketCol(): Collection<any> {
  if (!ticketCollection) ticketCollection = getDB().collection('tickets');
  return ticketCollection;
}

const STATUS_ORDER: TicketStatus[] = ['Pending', 'In Progress', 'Completed'];

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  Pending: ['In Progress'],
  'In Progress': ['Pending', 'Completed'],
  Completed: ['In Progress'],
};

export function getNextStatus(current: TicketStatus): TicketStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

export function getPrevStatus(current: TicketStatus): TicketStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return STATUS_ORDER[idx - 1];
}

export function isValidStatusTransition(from: TicketStatus, to: TicketStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function getAllTickets(filters?: {
  q?: string;
  priority?: string;
  status?: string;
  employeeId?: string;
  projectId?: string;
}): Promise<Ticket[]> {
  const col = getTicketCol();
  const query: any = {};

  if (filters?.employeeId) query.employeeId = filters.employeeId;
  if (filters?.projectId) query.projectId = filters.projectId;
  if (filters?.priority && filters.priority !== 'all') query.priority = filters.priority;
  if (filters?.status && filters.status !== 'all') query.status = filters.status;
  if (filters?.q) {
    const re = { $regex: filters.q, $options: 'i' };
    query.$or = [{ title: re }, { employeeName: re }, { employeeId: re }];
  }

  const tickets = await col.find(query).sort({ createdAt: -1 }).toArray();
  return tickets as Ticket[];
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  const col = getTicketCol();
  return (await col.findOne({ id })) as Ticket | null;
}

export async function getTicketsByProjectId(projectId: string): Promise<Ticket[]> {
  const col = getTicketCol();
  return (await col.find({ projectId }).toArray()) as Ticket[];
}

export async function createTicket(payload: CreateTicketPayload): Promise<Ticket> {
  const col = getTicketCol();
  const id = `TK-${Date.now()}`;
  const ticket: any = {
    ...payload,
    id,
    status: 'Pending',
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await col.insertOne(ticket);
  return ticket as Ticket;
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
  remark?: string,
  admin?: { id: string; name: string }
): Promise<Ticket | null> {
  const col = getTicketCol();
  const ticket = (await col.findOne({ id })) as Ticket | null;
  if (!ticket) return null;

  if (!isValidStatusTransition(ticket.status, status)) {
    throw new Error(`Invalid status transition from ${ticket.status} to ${status}`);
  }

  const updateFields: any = { status, updatedAt: new Date() };
  const comments = [...(ticket.comments ?? [])];

  if (remark?.trim() && admin) {
    comments.push({
      id: `TC-${Date.now()}`,
      authorId: admin.id,
      authorName: admin.name,
      authorRole: 'Admin',
      text: remark.trim(),
      createdAt: new Date(),
    });
    updateFields.comments = comments;
  }

  const result = await col.findOneAndUpdate(
    { id },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  if (result && ticket.projectName) {
    await syncProjectStatus(ticket.projectName);
  }

  return result as Ticket | null;
}

export async function addTicketComment(
  id: string,
  payload: AddTicketCommentPayload
): Promise<Ticket | null> {
  const col = getTicketCol();
  const comment = {
    id: `TC-${Date.now()}`,
    ...payload,
    createdAt: new Date(),
  };

  const result = await col.findOneAndUpdate(
    { id },
    {
      $push: { comments: comment },
      $set: { updatedAt: new Date() },
    } as any,
    { returnDocument: 'after' }
  );

  return result as Ticket | null;
}

export async function setTicketAttachment(
  id: string,
  attachment: TicketAttachment
): Promise<Ticket | null> {
  const col = getTicketCol();
  const result = await col.findOneAndUpdate(
    { id },
    { $set: { attachment, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result as Ticket | null;
}

export async function deleteTicket(id: string): Promise<boolean> {
  const col = getTicketCol();
  const ticket = await col.findOne({ id });
  const result = await col.deleteOne({ id });

  if (result.deletedCount > 0 && ticket?.projectName) {
    await syncProjectStatus(ticket.projectName);
  }

  return result.deletedCount > 0;
}

export async function seedTickets(): Promise<void> {
  const col = getTicketCol();
  const count = await col.countDocuments();
  if (count > 0) return;

  const tickets = [
    {
      id: 'TK-1',
      employeeId: 'E-1002',
      employeeName: 'Rahul Verma',
      title: 'VPN access issue',
      description: 'Unable to connect to company VPN from home network.',
      priority: 'High',
      status: 'Pending',
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'TK-2',
      employeeId: 'E-1001',
      employeeName: 'Asha Menon',
      title: 'Laptop replacement',
      description: 'Current laptop battery drains within 30 minutes.',
      priority: 'Medium',
      status: 'In Progress',
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'TK-3',
      employeeId: 'E-1003',
      employeeName: 'Meera Iyer',
      title: 'Payslip clarification',
      description: 'Need clarification on tax deduction in February payslip.',
      priority: 'Low',
      status: 'Completed',
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await col.insertMany(tickets);
}