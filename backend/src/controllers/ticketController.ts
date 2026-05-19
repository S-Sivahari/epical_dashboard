import { Request, Response } from 'express';
import * as ticketService from '../services/ticketService';
import { TicketStatus } from '../models/Ticket';

export const ticketController = {
  // GET /api/tickets
  getAll: async (req: Request, res: Response): Promise<void> => {
    try {
      const { q, priority, status, employeeId } = req.query;
      const tickets = await ticketService.getAllTickets({
        q: q as string,
        priority: priority as string,
        status: status as string,
        employeeId: employeeId as string,
      });
      res.json(tickets);
    } catch {
      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  },

  // GET /api/tickets/:id
  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const ticket = await ticketService.getTicketById(req.params.id);
      if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
      res.json(ticket);
    } catch {
      res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  },

  // POST /api/tickets
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, employeeName, title, description, priority } = req.body;
      if (!employeeId || !title || !priority) {
        res.status(400).json({ error: 'employeeId, title, and priority are required' });
        return;
      }
      const ticket = await ticketService.createTicket({
        employeeId,
        employeeName: employeeName || 'Unknown',
        title,
        description,
        priority,
      });
      res.status(201).json(ticket);
    } catch {
      res.status(500).json({ error: 'Failed to create ticket' });
    }
  },

  // PATCH /api/tickets/:id/status
  updateStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.body;
      const validStatuses: TicketStatus[] = ['Pending', 'In Progress', 'Completed'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: 'Invalid status value' });
        return;
      }
      const ticket = await ticketService.updateTicketStatus(req.params.id, status);
      if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
      res.json(ticket);
    } catch {
      res.status(500).json({ error: 'Failed to update ticket status' });
    }
  },

  // DELETE /api/tickets/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    try {
      const ok = await ticketService.deleteTicket(req.params.id);
      if (!ok) { res.status(404).json({ error: 'Ticket not found' }); return; }
      res.json({ message: 'Deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to delete ticket' });
    }
  },
};
