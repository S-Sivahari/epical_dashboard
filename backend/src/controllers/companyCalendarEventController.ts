import { Request, Response } from 'express';
import * as companyCalendarEventService from '../services/companyCalendarEventService';
import { notifyAllAdmins } from '../services/notificationService';

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
      await notifyAllAdmins({
        type: 'CalendarEventAdded',
        title: 'Calendar event added',
        message: `"${event.title}" was added for ${event.date}.`,
        relatedId: event.id,
        relatedData: {
          calendarEventId: event.id,
          calendarEventTitle: event.title,
          calendarEventDate: event.date,
        },
      });
      res.status(201).json(event);
    } catch {
      res.status(500).json({ error: 'Failed to create calendar event' });
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const idRaw = req.params.id;
      const id = typeof idRaw === 'string' ? idRaw : idRaw?.[0] ?? '';
      if (!id) {
        res.status(400).json({ error: 'Missing event id' });
        return;
      }
      const { title, date, time, description } = req.body as {
        title?: string;
        date?: string;
        time?: string;
        description?: string;
      };
      const existing = await companyCalendarEventService.getCompanyCalendarEventById(id);
      if (!existing) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      if (title !== undefined && !title.trim()) {
        res.status(400).json({ error: 'title cannot be empty' });
        return;
      }
      if (date !== undefined && !date.trim()) {
        res.status(400).json({ error: 'date cannot be empty' });
        return;
      }
      const event = await companyCalendarEventService.updateCompanyCalendarEvent(id, {
        title: title?.trim(),
        date: date?.trim(),
        time: time?.trim(),
        description: description?.trim(),
      });
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      await notifyAllAdmins({
        type: 'CalendarEventUpdated',
        title: 'Calendar event updated',
        message: `"${event.title}" was updated for ${event.date}.`,
        relatedId: event.id,
        relatedData: {
          calendarEventId: event.id,
          calendarEventTitle: event.title,
          calendarEventDate: event.date,
        },
      });
      res.json(event);
    } catch {
      res.status(500).json({ error: 'Failed to update calendar event' });
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
      const existing = await companyCalendarEventService.getCompanyCalendarEventById(id);
      const ok = await companyCalendarEventService.deleteCompanyCalendarEvent(id);
      if (!ok) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      if (existing) {
        await notifyAllAdmins({
          type: 'CalendarEventRemoved',
          title: 'Calendar event removed',
          message: `"${existing.title}" was removed from ${existing.date}.`,
          relatedId: existing.id,
          relatedData: {
            calendarEventId: existing.id,
            calendarEventTitle: existing.title,
            calendarEventDate: existing.date,
          },
        });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'Failed to delete calendar event' });
    }
  },
};
