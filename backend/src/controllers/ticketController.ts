import { Request, Response } from 'express';
import * as ticketService from '../services/ticketService';
import { TicketStatus } from '../models/Ticket';

export const ticketController = {
  // GET /api/tickets
  getAll: async (req: Request, res: Response): Promise<void> => {
    try {
      const { q, priority, status, employeeId, projectId } = req.query;
      const tickets = await ticketService.getAllTickets({
        q: q as string,
        priority: priority as string,
        status: status as string,
        employeeId: employeeId as string,
        projectId: projectId as string,
      });
      res.json(tickets);
    } catch {
      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  },

  // GET /api/tickets/:id
  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const ticket = await ticketService.getTicketById(id);
      if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
      res.json(ticket);
    } catch {
      res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  },

  // GET /api/tickets/project/:projectId
  getByProjectId: async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params as { projectId: string };
      const tickets = await ticketService.getTicketsByProjectId(projectId);
      res.json(tickets);
    } catch {
      res.status(500).json({ error: 'Failed to fetch project tickets' });
    }
  },

  // POST /api/tickets
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, employeeName, title, description, priority, projectId, projectName } = req.body;
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
        projectId,
        projectName,
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
      const { id } = req.params as { id: string };
      const ticket = await ticketService.updateTicketStatus(id, status);
      if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
      res.json(ticket);
    } catch {
      res.status(500).json({ error: 'Failed to update ticket status' });
    }
  },

  // DELETE /api/tickets/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const ok = await ticketService.deleteTicket(id);
      if (!ok) { res.status(404).json({ error: 'Ticket not found' }); return; }
      res.json({ message: 'Deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to delete ticket' });
    }
  },
};
