import { Request, Response } from 'express';
import type { DailyNoteStatus } from '../models/DailyNoteBlock';
import * as notesService from '../services/notesService';
import * as notesEmailService from '../services/notesEmailService';

function paramStr(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function handleError(res: Response, err: unknown, fallback: string): void {
  const message = err instanceof Error ? err.message : fallback;
  const status = typeof (err as { status?: number })?.status === 'number'
    ? (err as { status: number }).status
    : 500;
  res.status(status).json({ error: message });
}

export const notesController = {
  listProjects: async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await notesService.listActiveProjects();
      res.json(items);
    } catch (err) {
      handleError(res, err, 'Failed to load projects');
    }
  },

  listProjectEmployees: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramStr(req.params.projectId);
      const items = await notesService.listProjectAssignedEmployees(projectId);
      res.json(items);
    } catch (err) {
      handleError(res, err, 'Failed to load project employees');
    }
  },

  search: async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await notesService.searchNotes({
        q: paramStr(req.query.q),
        from: paramStr(req.query.from),
        to: paramStr(req.query.to),
        week: paramStr(req.query.week),
        projectId: paramStr(req.query.projectId),
        employeeId: paramStr(req.query.employeeId),
        status: paramStr(req.query.status) as DailyNoteStatus,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
      });
      res.json(result);
    } catch (err) {
      handleError(res, err, 'Failed to search notes');
    }
  },

  searchOptions: async (_req: Request, res: Response): Promise<void> => {
    try {
      const options = await notesService.listSearchFilterOptions();
      res.json(options);
    } catch (err) {
      handleError(res, err, 'Failed to load search filter options');
    }
  },

  listInRange: async (req: Request, res: Response): Promise<void> => {
    try {
      const from = paramStr(req.query.from);
      const to = paramStr(req.query.to);
      if (!from || !to) {
        res.status(400).json({ error: 'from and to query parameters are required (yyyy-MM-dd).' });
        return;
      }
      const items = await notesService.listDailyBlocksInRange(from, to);
      res.json(items);
    } catch (err) {
      handleError(res, err, 'Failed to load daily blocks');
    }
  },

  getByDate: async (req: Request, res: Response): Promise<void> => {
    try {
      const date = paramStr(req.params.date);
      const item = await notesService.getDailyBlockByDate(date);
      if (!item) {
        res.status(404).json({ error: 'Daily block not found' });
        return;
      }
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to load daily block');
    }
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id);
      const item = await notesService.getDailyBlockById(id);
      if (!item) {
        res.status(404).json({ error: 'Daily block not found' });
        return;
      }
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to load daily block');
    }
  },

  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const date = paramStr(req.body?.date);
      const status = req.body?.status as DailyNoteStatus | undefined;
      const userId = req.user?.id || '';
      const email = req.user?.email;
      const item = await notesService.createDailyBlock(date, userId, email, status);
      res.status(201).json(item);
    } catch (err) {
      handleError(res, err, 'Failed to create daily block');
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id);
      const userId = req.user?.id || '';
      const email = req.user?.email;
      const patch: { status?: DailyNoteStatus; archived?: boolean } = {};
      if (req.body?.status !== undefined) patch.status = req.body.status;
      if (req.body?.archived !== undefined) patch.archived = Boolean(req.body.archived);
      const item = await notesService.updateDailyBlock(id, userId, email, patch);
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to update daily block');
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id);
      const item = await notesService.deleteDailyBlock(id);
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to delete daily block');
    }
  },

  createChild: async (req: Request, res: Response): Promise<void> => {
    try {
      const dailyBlockId = paramStr(req.params.id);
      const userId = req.user?.id || '';
      const email = req.user?.email;
      const item = await notesService.createChildBlock(dailyBlockId, userId, email, {
        title: String(req.body?.title ?? ''),
        projectId: req.body?.projectId,
        employeeIds: Array.isArray(req.body?.employeeIds)
          ? req.body.employeeIds.map((id: unknown) => String(id))
          : undefined,
        description: req.body?.description,
        includeInEmail: req.body?.includeInEmail,
      });
      res.status(201).json(item);
    } catch (err) {
      handleError(res, err, 'Failed to create work description');
    }
  },

  updateChild: async (req: Request, res: Response): Promise<void> => {
    try {
      const dailyBlockId = paramStr(req.params.id);
      const childBlockId = paramStr(req.params.childId);
      const userId = req.user?.id || '';
      const email = req.user?.email;
      const item = await notesService.updateChildBlock(dailyBlockId, childBlockId, userId, email, {
        title: req.body?.title,
        projectId: req.body?.projectId,
        employeeIds: Array.isArray(req.body?.employeeIds)
          ? req.body.employeeIds.map((id: unknown) => String(id))
          : req.body?.employeeIds,
        description: req.body?.description,
        includeInEmail: req.body?.includeInEmail,
        archived: req.body?.archived,
      });
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to update work description');
    }
  },

  removeChild: async (req: Request, res: Response): Promise<void> => {
    try {
      const dailyBlockId = paramStr(req.params.id);
      const childBlockId = paramStr(req.params.childId);
      const userId = req.user?.id || '';
      const email = req.user?.email;
      const item = await notesService.deleteChildBlock(dailyBlockId, childBlockId, userId, email);
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to delete work description');
    }
  },

  previewEmail: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id);
      const recipientEmployeeIds = Array.isArray(req.query.recipientEmployeeIds)
        ? req.query.recipientEmployeeIds.map((value) => String(value))
        : typeof req.query.recipientEmployeeIds === 'string'
          ? req.query.recipientEmployeeIds.split(',').map((value) => value.trim()).filter(Boolean)
          : undefined;
      const preview = await notesEmailService.buildDailyNotesEmailPreview(id, {
        recipientEmployeeIds,
      });
      res.json(preview);
    } catch (err) {
      handleError(res, err, 'Failed to build email preview');
    }
  },

  sendEmail: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id);
      const userId = req.user?.id || '';
      const email = req.user?.email;
      const recipientEmployeeIds = Array.isArray(req.body?.recipientEmployeeIds)
        ? req.body.recipientEmployeeIds.map((value: unknown) => String(value))
        : undefined;
      const result = await notesEmailService.sendDailyNotesEmail(id, userId, email, {
        recipientEmployeeIds,
      });
      res.json(result);
    } catch (err) {
      handleError(res, err, 'Failed to send daily notes email');
    }
  },

  reorderChildren: async (req: Request, res: Response): Promise<void> => {
    try {
      const dailyBlockId = paramStr(req.params.id);
      const childBlockIds = Array.isArray(req.body?.childBlockIds)
        ? req.body.childBlockIds.map((id: unknown) => String(id))
        : [];
      const userId = req.user?.id || '';
      const email = req.user?.email;
      const item = await notesService.reorderChildBlocks(dailyBlockId, childBlockIds, userId, email);
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to reorder work descriptions');
    }
  },
};
