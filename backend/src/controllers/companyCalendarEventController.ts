import { Request, Response } from 'express';
import * as companyCalendarEventService from '../services/companyCalendarEventService';
import { notifyAllAdmins, notifyAllEmployees } from '../services/notificationService';

function calendarEventChanged(
  existing: { title: string; date: string; time?: string },
  updates: { title?: string; date?: string; time?: string },
): boolean {
  const nextTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
  const nextDate = updates.date !== undefined ? updates.date.trim() : existing.date;
  const nextTime = updates.time !== undefined ? updates.time.trim() || undefined : existing.time;
  return (
    nextTitle !== existing.title ||
    nextDate !== existing.date ||
    nextTime !== existing.time
  );
}

async function notifyEmployeesCalendarEvent(params: {
  type: 'CalendarEventAdded' | 'CalendarEventUpdated' | 'CalendarEventRemoved';
  title: string;
  message: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime?: string;
}): Promise<void> {
  await notifyAllEmployees({
    type: params.type,
    title: params.title,
    message: params.message,
    relatedData: {
      calendarEventId: params.eventId,
      calendarEventTitle: params.eventTitle,
      calendarEventDate: params.eventDate,
      calendarEventTime: params.eventTime,
    },
  });
}

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
        description: typeof description === 'string' ? description.trim() || undefined : undefined,
      });

      const adminPayload = {
        type: 'CalendarEventAdded' as const,
        title: 'Calendar event added',
        message: `"${event.title}" was added for ${event.date}.`,
        relatedId: event.id,
        relatedData: {
          calendarEventId: event.id,
          calendarEventTitle: event.title,
          calendarEventDate: event.date,
          calendarEventTime: event.time,
        },
      };
      await notifyAllAdmins(adminPayload);
      void notifyEmployeesCalendarEvent({
        type: 'CalendarEventAdded',
        title: 'New Company Event',
        message: `"${event.title}" was added to the company calendar for ${event.date}.`,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
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

      const updatePayload = {
        title: title?.trim(),
        date: date?.trim(),
        time: time?.trim(),
        description: typeof description === 'string' ? description.trim() : undefined,
      };
      const changed = calendarEventChanged(existing, updatePayload);
      const event = await companyCalendarEventService.updateCompanyCalendarEvent(id, updatePayload);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      if (changed) {
        await notifyAllAdmins({
          type: 'CalendarEventUpdated',
          title: 'Calendar event updated',
          message: `"${event.title}" was updated for ${event.date}.`,
          relatedId: event.id,
          relatedData: {
            calendarEventId: event.id,
            calendarEventTitle: event.title,
            calendarEventDate: event.date,
            calendarEventTime: event.time,
          },
        });
        void notifyEmployeesCalendarEvent({
          type: 'CalendarEventUpdated',
          title: 'Company Event Updated',
          message: `"${event.title}" on ${event.date} has been updated in the company calendar.`,
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.date,
          eventTime: event.time,
        });
      }

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
            calendarEventTime: existing.time,
          },
        });
        void notifyEmployeesCalendarEvent({
          type: 'CalendarEventRemoved',
          title: 'Company Event Removed',
          message: `"${existing.title}" on ${existing.date} has been removed from the company calendar.`,
          eventId: existing.id,
          eventTitle: existing.title,
          eventDate: existing.date,
          eventTime: existing.time,
        });
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'Failed to delete calendar event' });
    }
  },
};
