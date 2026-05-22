import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { Ticket, CreateTicketPayload, TicketStatus } from '../models/Ticket';
import { updateProjectCompletionStatus } from '../utils/syncProject';

let ticketCollection: Collection<any> | null = null;

function getTicketCol(): Collection<any> {
  if (!ticketCollection) ticketCollection = getDB().collection('tickets');
  return ticketCollection;
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
    query.$or = [{ title: re }, { employeeName: re }];
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await col.insertOne(ticket);
  return ticket as Ticket;
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus
): Promise<Ticket | null> {
  const col = getTicketCol();
  const ticket = await col.findOne({ id });
  
  const result = await col.findOneAndUpdate(
    { id },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  
  // Recalculate project completion only when a real project reference exists.
  if (result && ticket?.projectId) {
    await updateProjectCompletionStatus(ticket.projectId);
  }
  
  return result as Ticket | null;
}

export async function deleteTicket(id: string): Promise<boolean> {
  const col = getTicketCol();
  const ticket = await col.findOne({ id });
  const result = await col.deleteOne({ id });
  
  // Recalculate project completion only when a real project reference exists.
  if (result.deletedCount > 0 && ticket?.projectId) {
    await updateProjectCompletionStatus(ticket.projectId);
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
      priority: 'High',
      status: 'Pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'TK-2',
      employeeId: 'E-1001',
      employeeName: 'Asha Menon',
      title: 'Laptop replacement',
      priority: 'Medium',
      status: 'In Progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'TK-3',
      employeeId: 'E-1003',
      employeeName: 'Meera Iyer',
      title: 'Payslip clarification',
      priority: 'Low',
      status: 'Completed',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  await col.insertMany(tickets);
}
