import { Request, Response } from 'express';
import type { DailyNoteStatus } from '../models/DailyNoteBlock';
import type { NotesDelegationActor } from '../models/NotesDelegation';
import * as notesService from '../services/notesService';
import * as notesEmailService from '../services/notesEmailService';
import * as notesDelegationService from '../services/notesDelegationService';
import {
  assertEmployeeCanAccessNotesForDate,
  assertEmployeeCanMutateNotesForBlockId,
  assertEmployeeCanMutateNotesForDate,
  assertEmployeeCanCopyLatestNotesForDate,
  assertEmployeeCanReadNotesForDate,
  getNotesAccessPayload,
  isNotesAdmin,
} from '../utils/notesAccessHelper';

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

function actorFromRequest(req: Request): NotesDelegationActor {
  return {
    id: req.user?.id || '',
    name: req.user?.email || 'Admin',
    email: req.user?.email,
  };
}

export const notesController = {
  getAccess: async (req: Request, res: Response): Promise<void> => {
    try {
      const from = paramStr(req.query.from);
      const to = paramStr(req.query.to);
      const payload = await getNotesAccessPayload(req, from || undefined, to || undefined);
      res.json(payload);
    } catch (err) {
      handleError(res, err, 'Failed to resolve notes access');
    }
  },

  listDelegations: async (req: Request, res: Response): Promise<void> => {
    try {
      const from = paramStr(req.query.from);
      const to = paramStr(req.query.to);
      const items = await notesDelegationService.listNotesDelegations(from || undefined, to || undefined);
      res.json(items);
    } catch (err) {
      handleError(res, err, 'Failed to load notes delegations');
    }
  },

  createDelegation: async (req: Request, res: Response): Promise<void> => {
    try {
      const date = paramStr(req.body?.date);
      const to = paramStr(req.body?.to);
      const employeeId = paramStr(req.body?.employeeId);
      if (!date || !employeeId) {
        res.status(400).json({ error: 'date and employeeId are required' });
        return;
      }
      const assignedBy = actorFromRequest(req);
      if (to) {
        const items = await notesDelegationService.createNotesDelegationsForRange({
          from: date,
          to,
          employeeId,
          assignedBy,
        });
        res.status(201).json({ items, count: items.length });
        return;
      }
      const item = await notesDelegationService.createNotesDelegation({
        date,
        employeeId,
        assignedBy,
      });
      res.status(201).json(item);
    } catch (err) {
      handleError(res, err, 'Failed to assign notes delegate');
    }
  },

  removeDelegation: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id);
      const item = await notesDelegationService.deleteNotesDelegation(id);
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to remove notes delegate');
    }
  },

  listProjects: async (req: Request, res: Response): Promise<void> => {
    try {
      const items = await notesService.listActiveProjects();
      res.json(items);
    } catch (err) {
      handleError(res, err, 'Failed to load projects');
    }
  },

  listEmployees: async (req: Request, res: Response): Promise<void> => {
    try {
      const items = await notesService.listActiveEmployeesForNotes();
      res.json(items);
    } catch (err) {
      handleError(res, err, 'Failed to load employees');
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
      if (!isNotesAdmin(req)) {
        res.status(403).json({ error: 'Notes search is not available for employees' });
        return;
      }
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
      if (!isNotesAdmin(req)) {
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (from !== todayKey || to !== todayKey) {
          res.status(403).json({ error: 'You can only view daily notes for today on your assigned day' });
          return;
        }
        await assertEmployeeCanAccessNotesForDate(req, todayKey);
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
      if (!isNotesAdmin(req)) {
        await assertEmployeeCanReadNotesForDate(req, date);
      }
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

  getLatestBefore: async (req: Request, res: Response): Promise<void> => {
    try {
      const beforeDate = paramStr(req.params.date);
      if (!isNotesAdmin(req)) {
        await assertEmployeeCanCopyLatestNotesForDate(req, beforeDate);
      }
      const item = await notesService.getLatestDailyBlockWithNotesBefore(beforeDate);
      if (!item) {
        res.status(404).json({ error: 'No earlier daily notes found to copy' });
        return;
      }
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to load latest daily notes');
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
      if (!isNotesAdmin(req)) {
        await assertEmployeeCanReadNotesForDate(req, String(item.date));
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
      await assertEmployeeCanMutateNotesForDate(req, date);
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
      await assertEmployeeCanMutateNotesForBlockId(req, id);
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
      if (!isNotesAdmin(req)) {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        return;
      }
      const item = await notesService.deleteDailyBlock(id);
      res.json(item);
    } catch (err) {
      handleError(res, err, 'Failed to delete daily block');
    }
  },

  createChild: async (req: Request, res: Response): Promise<void> => {
    try {
      const dailyBlockId = paramStr(req.params.id);
      await assertEmployeeCanMutateNotesForBlockId(req, dailyBlockId);
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
      await assertEmployeeCanMutateNotesForBlockId(req, dailyBlockId);
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
      await assertEmployeeCanMutateNotesForBlockId(req, dailyBlockId);
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
      await assertEmployeeCanMutateNotesForBlockId(req, id);
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
      await assertEmployeeCanMutateNotesForBlockId(req, dailyBlockId);
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
