import { Request, Response } from 'express';
import * as timesheetService from '../services/timesheetService';

export const timesheetController = {
  // GET /api/timesheets
  getAll: async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, project, from, to } = req.query;
      const entries = await timesheetService.getAllTimesheets({
        employeeId: employeeId as string,
        project: project as string,
        from: from as string,
        to: to as string,
      });
      res.json(entries);
    } catch {
      res.status(500).json({ error: 'Failed to fetch timesheets' });
    }
  },

  // GET /api/timesheets/:id
  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const entry = await timesheetService.getTimesheetById(req.params.id);
      if (!entry) { res.status(404).json({ error: 'Timesheet entry not found' }); return; }
      res.json(entry);
    } catch {
      res.status(500).json({ error: 'Failed to fetch timesheet' });
    }
  },

  // POST /api/timesheets
  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { employeeId, employeeName, project, client, date, hours, task } = req.body;
      if (!employeeId || !project || !date || !hours || !task) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      const entry = await timesheetService.createTimesheetEntry({
        employeeId,
        employeeName: employeeName || 'Unknown',
        project,
        client,
        date,
        hours: Number(hours),
        task,
      });
      res.status(201).json(entry);
    } catch {
      res.status(500).json({ error: 'Failed to create timesheet entry' });
    }
  },

  // PUT /api/timesheets/:id
  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const entry = await timesheetService.updateTimesheetEntry(req.params.id, req.body);
      if (!entry) { res.status(404).json({ error: 'Timesheet entry not found' }); return; }
      res.json(entry);
    } catch {
      res.status(500).json({ error: 'Failed to update timesheet entry' });
    }
  },

  // DELETE /api/timesheets/:id
  delete: async (req: Request, res: Response): Promise<void> => {
    try {
      const ok = await timesheetService.deleteTimesheetEntry(req.params.id);
      if (!ok) { res.status(404).json({ error: 'Timesheet entry not found' }); return; }
      res.json({ message: 'Deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Failed to delete timesheet entry' });
    }
  },
};
