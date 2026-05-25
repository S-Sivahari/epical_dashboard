import { Response } from 'express';
import * as ticketService from '../services/ticketService';
import { TicketStatus, TicketPriority } from '../models/Ticket';
import { AuthRequest } from '../middleware/authMiddleware';

const VALID_STATUSES: TicketStatus[] = ['Pending', 'In Progress', 'Completed'];
const VALID_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];

function getAdminFromRequest(req: AuthRequest) {
  return {
    id: req.user?.id ?? 'admin',
    name: (req.user as any)?.name || req.user?.email || 'Admin',
  };
}

function canAccessTicket(req: AuthRequest, ticket: { employeeId: string }): boolean {
  if (!req.user) return false;
  if (req.user.role === 'Admin') return true;
  return req.user.role === 'Employee' && req.user.id === ticket.employeeId;
}

function sanitizeTicketForList(ticket: any) {
  if (!ticket.attachment) return { ...ticket, hasAttachment: false };
  const { data, ...attachmentMeta } = ticket.attachment;
  return { ...ticket, attachment: attachmentMeta, hasAttachment: true };
}

function sanitizeTicketDetail(ticket: any) {
  return sanitizeTicketForList(ticket);
}

export const ticketController = {
  getAll: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { q, priority, status, employeeId, projectId } = req.query;
      const filters: Parameters<typeof ticketService.getAllTickets>[0] = {
        q: q as string,
        priority: priority as string,
        status: status as string,
        projectId: projectId as string,
      };

      if (req.user?.role === 'Employee') {
        filters.employeeId = req.user.id;
      } else if (employeeId) {
        filters.employeeId = employeeId as string;
      }

      const tickets = await ticketService.getAllTickets(filters);
      res.json(tickets.map(sanitizeTicketForList));
    } catch {
      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  },

  getById: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const ticket = await ticketService.getTicketById(id);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      if (!canAccessTicket(req, ticket)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      res.json(sanitizeTicketDetail(ticket));
    } catch {
      res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  },

  getByProjectId: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'Admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const { projectId } = req.params as { projectId: string };
      const tickets = await ticketService.getTicketsByProjectId(projectId);
      res.json(tickets);
    } catch {
      res.status(500).json({ error: 'Failed to fetch project tickets' });
    }
  },

  create: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { employeeId, employeeName, title, description, priority, projectId, projectName } =
        req.body;

      if (!employeeId || !title || !priority) {
        res.status(400).json({ error: 'employeeId, title, and priority are required' });
        return;
      }

      if (!VALID_PRIORITIES.includes(priority)) {
        res.status(400).json({ error: 'Invalid priority value' });
        return;
      }

      if (req.user?.role === 'Employee' && req.user.id !== employeeId) {
        res.status(403).json({ error: 'Employees can only create tickets for themselves' });
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

  updateStatus: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { status, remark } = req.body;
      if (!VALID_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Invalid status value' });
        return;
      }

      const { id } = req.params as { id: string };
      const ticket = await ticketService.updateTicketStatus(
        id,
        status,
        remark,
        getAdminFromRequest(req)
      );

      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.json(sanitizeTicketDetail(ticket));
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update ticket status' });
    }
  },

  addComment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { text } = req.body;
      if (!text?.trim()) {
        res.status(400).json({ error: 'Comment text is required' });
        return;
      }

      const { id } = req.params as { id: string };
      const existing = await ticketService.getTicketById(id);
      if (!existing) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }

      const ticket = await ticketService.addTicketComment(id, {
        authorId: getAdminFromRequest(req).id,
        authorName: getAdminFromRequest(req).name,
        authorRole: 'Admin',
        text: text.trim(),
      });

      res.json(sanitizeTicketDetail(ticket));
    } catch {
      res.status(500).json({ error: 'Failed to add comment' });
    }
  },

  uploadAttachment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const file = (req as any).file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const ticket = await ticketService.getTicketById(id);
      if (!ticket) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }

      if (!canAccessTicket(req, ticket)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      if (req.user?.role === 'Employee' && ticket.status !== 'Pending') {
        res.status(400).json({ error: 'Attachments can only be added to pending tickets' });
        return;
      }

      const updated = await ticketService.setTicketAttachment(id, {
        filename: file.originalname,
        contentType: file.mimetype,
        data: file.buffer.toString('base64'),
        uploadedAt: new Date(),
      });

      res.json(sanitizeTicketDetail(updated));
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Failed to upload attachment' });
    }
  },

  getAttachment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const ticket = await ticketService.getTicketById(id);
      if (!ticket?.attachment) {
        res.status(404).json({ error: 'Attachment not found' });
        return;
      }
      if (!canAccessTicket(req, ticket)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const buffer = Buffer.from(ticket.attachment.data, 'base64');
      res.setHeader('Content-Type', ticket.attachment.contentType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${ticket.attachment.filename}"`
      );
      res.send(buffer);
    } catch {
      res.status(500).json({ error: 'Failed to fetch attachment' });
    }
  },

  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const ok = await ticketService.deleteTicket(id);
      if (!ok) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.json({ message: 'Deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to delete ticket' });
    }
  },
};