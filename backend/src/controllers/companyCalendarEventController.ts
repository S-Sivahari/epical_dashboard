import { Request, Response } from 'express';
import * as companyCalendarEventService from '../services/companyCalendarEventService';

export const companyCalendarEventController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    try {
      const events = await companyCalendarEventService.getAllCompanyCalendarEvents();
      res.json(events);
    } catch {
      res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
  },

  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, date, time, description } = req.body as {
        title?: string;
        date?: string;
        time?: string;
        description?: string;
      };
      if (!title?.trim() || !date?.trim()) {
        res.status(400).json({ error: 'title and date are required' });
        return;
      }
      const event = await companyCalendarEventService.createCompanyCalendarEvent({
        title: title.trim(),
        date: date.trim(),
        time: time?.trim() || undefined,
        description: description?.trim() || undefined,
      });
      res.status(201).json(event);
    } catch {
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const idRaw = req.params.id
      const id = typeof idRaw === 'string' ? idRaw : idRaw?.[0] ?? '';
      if (!id) {
        res.status(400).json({ error: 'Missing event id' });
        return;
      }
      const ok = await companyCalendarEventService.deleteCompanyCalendarEvent(id);
      if (!ok) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'Failed to delete calendar event' });
    }
  },
};
