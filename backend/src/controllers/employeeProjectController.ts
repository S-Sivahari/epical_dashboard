import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { ProjectLibraryModel } from '../models/ProjectLibrary';
import { ProjectCellModel, CELL_STATUSES, type CellStatus } from '../models/ProjectCell';
import { CellReviewModel } from '../models/CellReview';
import { buildAssignmentIdentityTokens } from '../utils/assignedTaskSync';

function normalizeStatus(value: string): CellStatus {
  if (value === 'in_progress' || value === 'drc' || value === 'lvs' || value === 'review') return 'in_progress';
  if (value === 'completed') return 'completed';
  if ((CELL_STATUSES as readonly string[]).includes(value)) return value as CellStatus;
  return 'ready';
}

async function computeDependencyMeta(projectId: Types.ObjectId, cell: any) {
  const allCells = await ProjectCellModel.find({ projectId });
  const completedIds = new Set(
    allCells.filter((c) => c.status === 'completed').map((c) => c._id.toString()),
  );
  const deps = (cell.dependencyCellIds || []).map((id: Types.ObjectId) => id.toString());
  const isBlocked = deps.length > 0 && deps.some((depId: string) => !completedIds.has(depId));
  const status = normalizeStatus(cell.status || 'ready');
  const isReady = !isBlocked && status === 'ready';
  return { isBlocked, isReady };
}
import {
  advanceLayoutStage,
  advanceSimpleViewStatus,
  canAdvanceLayoutStage,
  canRequestReview,
  markReviewPending,
  normalizeViewWorkflow,
  validateStatusStepForward,
  type CellViewWorkflow,
  type ViewProgressStatus,
} from '../utils/cellWorkflow';
import { assertCellChecklistFilled, buildCellChecklistDetail } from '../services/cellTypeChecklistService';
import { sendReviewNotificationsFromCell } from '../services/cellReviewNotificationService';
import { updateCellChecklistItemResponse } from '../services/checklistService';

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function actorFromReq(req: Request) {
  const user = (req as any).user;
  return {
    userId: user?.id || user?._id?.toString() || '',
    userName: user?.name || user?.email || 'Employee',
    email: user?.email || '',
  };
}

async function resolveEmployeeRecord(userId: string) {
  const db = getDB();
  return db.collection('employees').findOne(
    { $or: [{ id: userId }, { employeeId: userId }] },
    { projection: { id: 1, employeeId: 1, firstName: 1, middleName: 1, lastName: 1, email: 1 } },
  );
}

async function getAssignmentTokens(req: Request): Promise<string[]> {
  const actor = actorFromReq(req);
  const employee = await resolveEmployeeRecord(actor.userId);
  return buildAssignmentIdentityTokens(actor, employee as any);
}

function cellAssignedToTokens(cell: { assignedEmployeeId?: string }, tokens: string[]): boolean {
  const assigned = cell.assignedEmployeeId?.trim();
  if (!assigned) return false;
  return tokens.includes(assigned);
}

async function assertProjectAccess(projectId: string, tokens: string[]) {
  if (!Types.ObjectId.isValid(projectId)) return null;
  const project = await ProjectModel.findById(projectId);
  if (!project) return null;

  const hasMembership =
    project.accessType === 'public' ||
    tokens.includes(project.teamLead || '') ||
    (project.allowedUsers || []).some((u: string) => tokens.includes(u));

  if (hasMembership) return project;

  const hasAssignedCells = await ProjectCellModel.exists({
    projectId: project._id,
    assignedEmployeeId: { $in: tokens },
  });

  return hasAssignedCells ? project : null;
}

async function assertAssignedCell(projectId: string, cellId: string, tokens: string[]) {
  if (!Types.ObjectId.isValid(cellId)) return null;
  const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
  if (!cell || !cellAssignedToTokens(cell, tokens)) return null;
  return cell;
}

async function assertProjectCell(projectId: string, cellId: string, tokens: string[]) {
  if (!Types.ObjectId.isValid(cellId)) return null;
  const project = await assertProjectAccess(projectId, tokens);
  if (!project) return null;
  const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
  if (!cell) return null;
  return cell;
}

function toLibrary(doc: any) {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    name: doc.name,
    description: doc.description || '',
  };
}

function toEmployeeCell(
  doc: any,
  tokens: string[],
  dependencyMeta?: { isBlocked: boolean; isReady: boolean },
) {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    libraryId: doc.libraryId.toString(),
    name: doc.name,
    description: doc.description || '',
    cellType: doc.cellType || 'block',
    complexity: doc.complexity,
    estimatedEffort: doc.estimatedEffort ?? 0,
    assignedEmployeeId: doc.assignedEmployeeId || '',
    assignedEmployeeName: doc.assignedEmployeeName || '',
    status: doc.status || 'ready',
    viewWorkflow: normalizeViewWorkflow(doc.viewWorkflow),
    views: doc.views || { layout: '', symbol: '', schematic: '' },
    isAssignedToMe: cellAssignedToTokens(doc, tokens),
    isBlocked: dependencyMeta?.isBlocked ?? false,
    isReady: dependencyMeta?.isReady ?? false,
    activityLog: doc.activityLog || [],
  };
}

function toReview(doc: any) {
  return {
    id: doc._id.toString(),
    cellId: doc.cellId.toString(),
    stageAtRequest: doc.stageAtRequest,
    reviewPoint: doc.reviewPoint || null,
    outcome: doc.outcome || 'pending',
    returnToStage: doc.returnToStage || null,
    status: doc.status,
    initiatedByName: doc.initiatedByName,
    resolvedByName: doc.resolvedByName || null,
    resolvedAt: doc.resolvedAt || null,
    messages: doc.messages || [],
    createdAt: doc.createdAt,
  };
}

export const employeeProjectController = {
  getMyWorkspace: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const tokens = await getAssignmentTokens(req);
      const project = await assertProjectAccess(projectId, tokens);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      const projectObjectId = new Types.ObjectId(projectId);
      const [libraries, cells] = await Promise.all([
        ProjectLibraryModel.find({ projectId }).sort({ name: 1 }),
        ProjectCellModel.find({ projectId }).sort({ name: 1 }),
      ]);

      const cellsWithMeta = await Promise.all(
        cells.map(async (cell) => {
          const meta = await computeDependencyMeta(projectObjectId, cell);
          return toEmployeeCell(cell, tokens, meta);
        }),
      );

      const assignedCount = cellsWithMeta.filter((c) => c.isAssignedToMe).length;
      const cellCount = cells.length;
      const completedCells = cells.filter((c) => c.status === 'completed').length;
      const completionPercentage = cellCount > 0
        ? Math.round((completedCells / cellCount) * 100)
        : 0;

      res.json({
        project: {
          id: project._id.toString(),
          name: project.projectName,
          client: project.clientName,
          technologyNode: project.technologyNode,
          status: project.status,
          completionPercentage,
        },
        libraries: libraries.map(toLibrary),
        cells: cellsWithMeta,
        stats: {
          libraryCount: libraries.length,
          cellCount,
          assignedToMe: assignedCount,
          completedCells,
          notStartedCells: cells.filter((c) => c.status === 'ready').length,
          inProgressCells: cells.filter((c) => c.status === 'in_progress').length,
          blockedCells: cellsWithMeta.filter((c) => c.isBlocked).length,
          readyCells: cellsWithMeta.filter((c) => c.isReady).length,
          unassignedCells: cells.filter((c) => !c.assignedEmployeeId).length,
        },
      });
    } catch (err) {
      console.error('[employee-projects] workspace', err);
      res.status(500).json({ error: 'Failed to load project workspace' });
    }
  },

  getMyCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);

      const project = await assertProjectAccess(projectId, tokens);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      const cell = await assertProjectCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const library = await ProjectLibraryModel.findById(cell.libraryId);
      const reviews = await CellReviewModel.find({ projectId, cellId }).sort({ createdAt: -1 }).limit(20);
      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);

      res.json({
        project: {
          id: project._id.toString(),
          name: project.projectName,
        },
        library: library ? toLibrary(library) : null,
        cell: toEmployeeCell(cell, tokens, meta),
        reviews: reviews.map(toReview),
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load cell' });
    }
  },

  updateWorkflow: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);

      const cell = await assertAssignedCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or not assigned to you' });
        return;
      }

      const workflow = normalizeViewWorkflow(cell.viewWorkflow);
      const { view, action, status } = req.body as {
        view?: 'style' | 'symbol' | 'layout';
        action?: 'set_status' | 'advance_stage';
        status?: ViewProgressStatus;
      };

      if (!view || !action) {
        res.status(400).json({ error: 'view and action are required' });
        return;
      }

      const completesCurrentStage =
        (action === 'set_status' && status === 'completed') ||
        (action === 'advance_stage' &&
          (view === 'style' || view === 'symbol') &&
          advanceSimpleViewStatus(workflow[view].status) === 'completed');

      if (completesCurrentStage) {
        await assertCellChecklistFilled(projectId, cellId);
      }

      let nextWorkflow: CellViewWorkflow = { ...workflow };

      if (view === 'style' || view === 'symbol') {
        if (action === 'set_status') {
          if (!status || !['not_started', 'in_progress', 'completed'].includes(status)) {
            res.status(400).json({ error: 'Invalid status for style/symbol view' });
            return;
          }
          validateStatusStepForward(workflow[view].status, status);
          nextWorkflow = { ...nextWorkflow, [view]: { status } };
        } else if (action === 'advance_stage') {
          const current = workflow[view].status;
          const next = advanceSimpleViewStatus(current);
          if (!next) {
            res.status(400).json({ error: 'View is already completed' });
            return;
          }
          nextWorkflow = { ...nextWorkflow, [view]: { status: next } };
        } else {
          res.status(400).json({ error: 'Invalid action for style/symbol view' });
          return;
        }
      } else if (view === 'layout') {
        if (action === 'set_status') {
          if (!status || !['not_started', 'in_progress', 'completed'].includes(status)) {
            res.status(400).json({ error: 'Invalid status for layout view' });
            return;
          }
          if (workflow.layout.pendingReview) {
            res.status(400).json({ error: 'Cannot update layout while review is pending' });
            return;
          }
          validateStatusStepForward(workflow.layout.status, status);
          nextWorkflow = {
            ...nextWorkflow,
            layout: { ...workflow.layout, status },
          };
        } else if (action === 'advance_stage') {
          if (!canAdvanceLayoutStage(workflow)) {
            res.status(400).json({ error: 'Complete the current stage before advancing' });
            return;
          }
          nextWorkflow = advanceLayoutStage(workflow);
        } else {
          res.status(400).json({ error: 'Invalid action for layout view' });
          return;
        }
      } else {
        res.status(400).json({ error: 'Invalid view' });
        return;
      }

      cell.viewWorkflow = nextWorkflow;
      cell.activityLog.push({
        action: 'workflow_update',
        detail: `${view}: ${action}${status ? ` → ${status}` : ''}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(toEmployeeCell(cell, tokens, meta));
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update workflow' });
    }
  },

  getMyDependencyGraph: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const tokens = await getAssignmentTokens(req);
      const project = await assertProjectAccess(projectId, tokens);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      const projectObjectId = new Types.ObjectId(projectId);
      const cells = await ProjectCellModel.find({ projectId });
      const nodes = await Promise.all(
        cells.map(async (cell) => {
          const meta = await computeDependencyMeta(projectObjectId, cell);
          return {
            id: cell._id.toString(),
            name: cell.name,
            status: cell.status,
            libraryId: cell.libraryId.toString(),
            assignedEmployeeName: cell.assignedEmployeeName || '',
            isAssignedToMe: cellAssignedToTokens(cell, tokens),
            ...meta,
          };
        }),
      );
      const edges = cells.flatMap((cell) =>
        (cell.dependencyCellIds || []).map((depId) => ({
          from: depId.toString(),
          to: cell._id.toString(),
        })),
      );
      res.json({ nodes, edges });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load dependency graph' });
    }
  },

  requestReview: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);
      const { comment } = req.body;

      const cell = await assertAssignedCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or not assigned to you' });
        return;
      }

      const workflow = normalizeViewWorkflow(cell.viewWorkflow);
      const reviewPoint = canRequestReview(workflow);
      if (!reviewPoint) {
        res.status(400).json({ error: 'No review available at the current layout stage' });
        return;
      }

      await assertCellChecklistFilled(projectId, cellId);

      const openReview = await CellReviewModel.findOne({ cellId, status: 'open', reviewPoint });
      if (openReview) {
        res.status(400).json({ error: 'A review request is already open for this stage' });
        return;
      }

      const nextWorkflow = markReviewPending(workflow, reviewPoint);
      cell.viewWorkflow = nextWorkflow;

      const review = await CellReviewModel.create({
        projectId: new Types.ObjectId(projectId),
        cellId: cell._id,
        stageAtRequest: workflow.layout.stage,
        reviewPoint,
        outcome: 'pending',
        status: 'open',
        initiatedBy: actor.userId,
        initiatedByName: actor.userName,
        assignedEmployeeId: cell.assignedEmployeeId,
        messages: [
          {
            authorId: actor.userId,
            authorName: actor.userName,
            authorRole: 'Employee',
            body: comment?.trim() || `Review requested at ${reviewPoint.toUpperCase()}`,
            at: new Date(),
          },
        ],
      });

      cell.activityLog.push({
        action: 'review_requested',
        detail: `${reviewPoint.toUpperCase()} review requested at ${workflow.layout.stage}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();

      void sendReviewNotificationsFromCell({
        projectId,
        cellId,
        reviewId: review._id.toString(),
        reviewPoint,
        stageAtRequest: workflow.layout.stage,
        mode: 'requested',
        employeeName: actor.userName,
      }).catch((notifyErr) => {
        console.error('[employee-projects] review request notification failed:', notifyErr);
      });

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.status(201).json({ cell: toEmployeeCell(cell, tokens, meta), review: toReview(review) });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to request review' });
    }
  },

  listMyRequestedReviews: async (req: Request, res: Response): Promise<void> => {
    try {
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);

      const myCells = await ProjectCellModel.find({ assignedEmployeeId: { $in: tokens } }).select(
        '_id projectId name',
      );
      if (!myCells.length) {
        res.json([]);
        return;
      }

      const cellIds = myCells.map((cell) => cell._id);
      const cellById = new Map(myCells.map((cell) => [cell._id.toString(), cell]));

      const reviews = await CellReviewModel.find({
        cellId: { $in: cellIds },
        initiatedBy: actor.userId,
      })
        .sort({ createdAt: -1 })
        .limit(100);

      const projectIds = [...new Set(myCells.map((cell) => cell.projectId.toString()))];
      const projects = await ProjectModel.find({ _id: { $in: projectIds } }).select('projectName');
      const projectNameById = new Map(projects.map((p) => [p._id.toString(), p.projectName]));

      res.json(
        reviews.map((review) => {
          const cell = cellById.get(review.cellId.toString());
          const projectId = review.projectId.toString();
          return {
            ...toReview(review),
            projectId,
            projectName: projectNameById.get(projectId) || 'Project',
            cellName: cell?.name || 'Cell',
          };
        }),
      );
    } catch (err) {
      console.error('[employee-projects] list requested reviews', err);
      res.status(500).json({ error: 'Failed to list requested reviews' });
    }
  },

  listMyCellReviews: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);

      const cell = await assertProjectCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const reviews = await CellReviewModel.find({ projectId, cellId }).sort({ createdAt: -1 });
      res.json(reviews.map(toReview));
    } catch (err) {
      res.status(500).json({ error: 'Failed to list reviews' });
    }
  },

  getMyCellChecklist: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);

      const cell = await assertProjectCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const detail = await buildCellChecklistDetail(projectId, cellId);
      res.json(detail);
    } catch (err) {
      console.error('[employee-projects] cell checklist', err);
      res.status(500).json({ error: 'Failed to fetch cell checklist' });
    }
  },

  updateMyCellChecklistExtension: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);

      const cell = await assertAssignedCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or not assigned to you' });
        return;
      }

      const body = req.body as {
        dimensionX?: number | string | null;
        dimensionY?: number | string | null;
        highestMetalUsed?: string;
        virtualConnection?: string | null;
        overallSubstrateContact?: string | null;
        waivableDrcError?: string | null;
      };

      const payload: Record<string, unknown> = {};

      if (body.dimensionX !== undefined) {
        const raw = body.dimensionX;
        if (raw === null || raw === '') {
          payload.dimensionX = null;
        } else {
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) {
            res.status(400).json({ error: 'Dimension X must be a number' });
            return;
          }
          payload.dimensionX = parsed;
        }
      }

      if (body.dimensionY !== undefined) {
        const raw = body.dimensionY;
        if (raw === null || raw === '') {
          payload.dimensionY = null;
        } else {
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) {
            res.status(400).json({ error: 'Dimension Y must be a number' });
            return;
          }
          payload.dimensionY = parsed;
        }
      }

      if (body.highestMetalUsed !== undefined) {
        payload.highestMetalUsed = String(body.highestMetalUsed ?? '');
      }

      for (const key of ['virtualConnection', 'overallSubstrateContact', 'waivableDrcError'] as const) {
        if (body[key] !== undefined) {
          const value = body[key];
          if (value === null || value === '') {
            payload[key] = null;
          } else if (value !== 'yes' && value !== 'no') {
            res.status(400).json({ error: `${key} must be yes or no` });
            return;
          } else {
            payload[key] = value;
          }
        }
      }

      const { updateCellChecklistExtension } = await import('../services/projectTypeChecklistService');
      const extension = await updateCellChecklistExtension(projectId, cellId, payload, {
        requireTypeChecklistComplete: false,
        requireMappingChecklistComplete: true,
      });
      if (!extension) {
        res.status(404).json({ error: 'Cell not found in this project' });
        return;
      }

      const detail = await buildCellChecklistDetail(projectId, cellId);
      res.json(detail);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to save final cell details' });
    }
  },

  updateMyCellChecklistItem: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const mappingId = paramId(req.params.mappingId);
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);

      const cell = await assertAssignedCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or not assigned to you' });
        return;
      }

      const { response, comment } = req.body as { response?: string; comment?: string };
      await updateCellChecklistItemResponse(
        projectId,
        cellId,
        mappingId,
        { response: response as 'yes' | 'no' | 'not_applicable', comment },
        actor.userId,
        actor.userName,
      );

      const detail = await buildCellChecklistDetail(projectId, cellId);
      res.json(detail);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update checklist item' });
    }
  },
};
