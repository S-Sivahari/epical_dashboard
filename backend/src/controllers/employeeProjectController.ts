import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { ProjectLibraryModel } from '../models/ProjectLibrary';
import { ProjectCellModel, CELL_STATUSES, type CellStatus } from '../models/ProjectCell';
import { CellReviewModel } from '../models/CellReview';
import { buildAssignmentIdentityTokens, isProjectMemberDisplayName, resolveProjectMemberAssignees } from '../utils/assignedTaskSync';
import { deriveBaseHours } from '../services/effortEstimationService';

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
  applyCellWorkflowSync,
  applyReviewApproval,
  applyReviewRejection,
  canAdvanceLayoutStage,
  canRequestReview,
  defaultCellWorkflow,
  defaultViewWorkflow,
  markReviewPending,
  normalizeViewWorkflow,
  returnOptionsForReview,
  syncCellWorkflowFromViewWorkflow,
  syncViewsFromViewWorkflow,
  validateStatusStepForward,
  viewWorkflowActionRequiresChecklist,
  type CellViewWorkflow,
  type LayoutStage,
  type ViewProgressStatus,
} from '../utils/cellWorkflow';
import { assertCellChecklistFilled, buildCellChecklistDetail } from '../services/cellTypeChecklistService';
import { sendReviewNotificationsFromCell } from '../services/cellReviewNotificationService';
import { updateCellChecklistItemResponse, syncChecklistMappingsForCell } from '../services/checklistService';
import { normalizeCellType } from '../services/projectTypeChecklistService';
import {
  deriveBaseHours,
  normalizeComplexity,
  predictEffort,
} from '../services/effortEstimationService';

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

function isTeamLeadOnProject(project: { teamLead?: string }, tokens: string[]): boolean {
  const lead = project.teamLead?.trim();
  return Boolean(lead && tokens.includes(lead));
}

async function assertTeamLeadAccess(projectId: string, tokens: string[]) {
  const project = await assertProjectAccess(projectId, tokens);
  if (!project || !isTeamLeadOnProject(project, tokens)) return null;
  return project;
}

function employeeDisplayName(employee: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
} | null | undefined): string {
  return [employee?.firstName, employee?.middleName, employee?.lastName].filter(Boolean).join(' ').trim();
}

async function resolveSelfAssignment(req: Request): Promise<{ assignedEmployeeId: string; assignedEmployeeName: string }> {
  const actor = actorFromReq(req);
  const employee = await resolveEmployeeRecord(actor.userId);
  const name = employeeDisplayName(employee) || actor.userName;
  return {
    assignedEmployeeId: employee?.employeeId || employee?.id || actor.userId,
    assignedEmployeeName: name,
  };
}

async function resolveCreateAssignment(
  req: Request,
  project: { teamLead?: string; allowedUsers?: string[] },
  tokens: string[],
  body: { assignedEmployeeId?: string; assignedEmployeeName?: string },
): Promise<{ assignedEmployeeId?: string; assignedEmployeeName?: string } | { error: string }> {
  if (!isTeamLeadOnProject(project, tokens)) {
    return resolveSelfAssignment(req);
  }

  const requestedId = body.assignedEmployeeId?.trim();
  if (!requestedId) {
    return { assignedEmployeeId: undefined, assignedEmployeeName: undefined };
  }

  const projectMembers = await resolveProjectMemberAssignees(project);
  const matchedMember = projectMembers.find((member) => member.id === requestedId);
  if (matchedMember) {
    return {
      assignedEmployeeId: matchedMember.id,
      assignedEmployeeName: body.assignedEmployeeName?.trim() || matchedMember.name,
    };
  }

  const db = getDB();
  const employee = await db.collection('employees').findOne(
    { $or: [{ id: requestedId }, { employeeId: requestedId }] },
    { projection: { id: 1, employeeId: 1, firstName: 1, middleName: 1, lastName: 1 } },
  );
  const displayName = employeeDisplayName(employee) || body.assignedEmployeeName?.trim() || '';
  if (!displayName || !isProjectMemberDisplayName(project, displayName)) {
    return { error: 'Assignee must be a member of this project' };
  }

  return {
    assignedEmployeeId: employee?.employeeId || employee?.id || requestedId,
    assignedEmployeeName: displayName,
  };
}

async function syncProjectProgress(projectId: Types.ObjectId) {
  const cells = await ProjectCellModel.find({ projectId });
  const total = cells.length;
  const completed = cells.filter((c) => c.status === 'completed').length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  await ProjectModel.findByIdAndUpdate(projectId, {
    totalTasks: total,
    completedTasks: completed,
    completionPercentage: pct,
  });
  return { total, completed, pct };
}

function toLibrary(doc: any) {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    name: doc.name,
    description: doc.description || '',
    assignedEmployeeId: doc.assignedEmployeeId || '',
    assignedEmployeeName: doc.assignedEmployeeName || '',
  };
}

function toEmployeeCell(
  doc: any,
  tokens: string[],
  dependencyMeta?: { isBlocked: boolean; isReady: boolean },
) {
  const viewWorkflow = normalizeViewWorkflow(doc.viewWorkflow);
  const views = doc.views || { layout: '', symbol: '', schematic: '' };
  syncViewsFromViewWorkflow({ viewWorkflow, views });
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    libraryId: doc.libraryId.toString(),
    name: doc.name,
    description: doc.description || '',
    cellType: doc.cellType || 'block',
    complexity: doc.complexity,
    baseHours: deriveBaseHours(doc.estimatedEffort ?? 0, doc.complexity, doc.baseHours),
    estimatedEffort: doc.estimatedEffort ?? 0,
    smartEstimate: doc.smartEstimate ?? doc.estimatedEffort ?? 0,
    actualEffort: doc.actualEffort ?? 0,
    estimateConfidence: doc.estimateConfidence === 'High' ? 'High' : 'Low',
    assignedEmployeeId: doc.assignedEmployeeId || '',
    assignedEmployeeName: doc.assignedEmployeeName || '',
    status: doc.status || 'ready',
    viewWorkflow,
    workflow: syncCellWorkflowFromViewWorkflow(viewWorkflow),
    views,
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
      const teamLead = isTeamLeadOnProject(project, tokens);
      const pendingReviewCount = teamLead
        ? await CellReviewModel.countDocuments({ projectId, status: 'open' })
        : 0;
      const assignees = teamLead ? await resolveProjectMemberAssignees(project) : [];

      res.json({
        project: {
          id: project._id.toString(),
          name: project.projectName,
          client: project.clientName,
          technologyNode: project.technologyNode,
          status: project.status,
          completionPercentage: project.completionPercentage ?? 0,
        },
        isTeamLead: teamLead,
        assignees,
        permissions: {
          canCreateLibraries: true,
          canCreateCells: true,
          canReview: teamLead,
        },
        pendingReviewCount,
        libraries: libraries.map(toLibrary),
        cells: cellsWithMeta,
        stats: {
          libraryCount: libraries.length,
          cellCount: cells.length,
          assignedToMe: assignedCount,
          completedCells: cells.filter((c) => c.status === 'completed').length,
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
        isTeamLead: isTeamLeadOnProject(project, tokens),
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

      if (viewWorkflowActionRequiresChecklist(workflow, { view, action, status })) {
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
      applyCellWorkflowSync(cell, 'viewWorkflow');
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

      if (viewWorkflowActionRequiresChecklist(workflow, { reviewRequest: true })) {
        await assertCellChecklistFilled(projectId, cellId);
      }

      const openReview = await CellReviewModel.findOne({ cellId, status: 'open', reviewPoint });
      if (openReview) {
        res.status(400).json({ error: 'A review request is already open for this stage' });
        return;
      }

      const nextWorkflow = markReviewPending(workflow, reviewPoint);
      cell.viewWorkflow = nextWorkflow;
      applyCellWorkflowSync(cell, 'viewWorkflow');

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

  createLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const tokens = await getAssignmentTokens(req);
      const project = await assertProjectAccess(projectId, tokens);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      const { name, description, assignedEmployeeId, assignedEmployeeName } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ error: 'Library name is required' });
        return;
      }

      const actor = actorFromReq(req);
      const assignment = await resolveCreateAssignment(req, project, tokens, {
        assignedEmployeeId,
        assignedEmployeeName,
      });
      if ('error' in assignment) {
        res.status(400).json({ error: assignment.error });
        return;
      }

      const library = await ProjectLibraryModel.create({
        projectId: project._id,
        name: name.trim(),
        description: description?.trim() || '',
        assignedEmployeeId: assignment.assignedEmployeeId,
        assignedEmployeeName: assignment.assignedEmployeeName,
        createdBy: actor.userId,
      });
      res.status(201).json(toLibrary(library));
    } catch (err) {
      res.status(500).json({ error: 'Failed to create library' });
    }
  },

  createCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      const tokens = await getAssignmentTokens(req);
      const project = await assertProjectAccess(projectId, tokens);
      const library = await ProjectLibraryModel.findOne({ _id: libraryId, projectId });
      if (!project || !library) {
        res.status(404).json({ error: 'Project or library not found' });
        return;
      }

      const {
        name,
        description,
        cellType,
        technologyNode,
        complexity,
        baseHours,
        estimatedEffort,
        assignedEmployeeId,
        assignedEmployeeName,
        dependencyCellIds,
        views,
      } = req.body;

      if (!name?.trim()) {
        res.status(400).json({ error: 'Cell name is required' });
        return;
      }

      const actor = actorFromReq(req);
      const assignment = await resolveCreateAssignment(req, project, tokens, {
        assignedEmployeeId,
        assignedEmployeeName,
      });
      if ('error' in assignment) {
        res.status(400).json({ error: assignment.error });
        return;
      }

      const deps = Array.isArray(dependencyCellIds)
        ? dependencyCellIds.filter((id: string) => Types.ObjectId.isValid(id)).map((id: string) => new Types.ObjectId(id))
        : [];

      const normalizedComplexity = normalizeComplexity(complexity);
      const resolvedTechNode = technologyNode?.trim() || project.technologyNode || '';
      const resolvedBaseHours = baseHours != null
        ? Math.max(0, Number(baseHours) || 0)
        : deriveBaseHours(Number(estimatedEffort) || 0, normalizedComplexity);
      const prediction = await predictEffort({
        cellType: normalizeCellType(cellType),
        technologyNode: resolvedTechNode,
        complexity: normalizedComplexity,
        baseHours: resolvedBaseHours,
      });

      const cell = await ProjectCellModel.create({
        projectId: project._id,
        libraryId: library._id,
        name: name.trim(),
        description: description?.trim() || '',
        cellType: normalizeCellType(cellType),
        technologyNode: resolvedTechNode,
        complexity: normalizedComplexity,
        baseHours: prediction.baseHours,
        estimatedEffort: prediction.estimatedHours,
        smartEstimate: prediction.smartEstimate,
        estimateConfidence: prediction.confidence,
        actualEffort: 0,
        assignedEmployeeId: assignment.assignedEmployeeId,
        assignedEmployeeName: assignment.assignedEmployeeName,
        dependencyCellIds: deps,
        status: 'ready',
        workflow: defaultCellWorkflow(),
        views: views || { layout: '', symbol: '', schematic: '' },
        viewWorkflow: defaultViewWorkflow(),
        activityLog: [
          {
            action: 'created',
            detail: `Cell "${name.trim()}" created`,
            userId: actor.userId,
            userName: actor.userName,
            at: new Date(),
          },
        ],
        createdBy: actor.userId,
      });

      await syncProjectProgress(project._id);
      await syncChecklistMappingsForCell(project._id, cell._id);
      const meta = await computeDependencyMeta(project._id, cell);
      res.status(201).json(toEmployeeCell(cell, tokens, meta));
    } catch (err) {
      console.error('[employee-projects] createCell', err);
      res.status(500).json({ error: 'Failed to create cell' });
    }
  },

  getEffortPrediction: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const tokens = await getAssignmentTokens(req);
      const project = await assertProjectAccess(projectId, tokens);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      const cellType = normalizeCellType(String(req.query.cellType || 'block'));
      const technologyNode = String(req.query.technologyNode || project.technologyNode || '').trim();
      const complexity = normalizeComplexity(String(req.query.complexity || 'Medium'));
      const baseHours = Math.max(0, Number(req.query.baseHours) || 0);
      const excludeCellId = req.query.excludeCellId ? paramId(String(req.query.excludeCellId)) : undefined;

      const prediction = await predictEffort({
        cellType,
        technologyNode,
        complexity,
        baseHours,
        excludeCellId,
      });

      res.json(prediction);
    } catch (err) {
      res.status(500).json({ error: 'Failed to predict effort' });
    }
  },

  listProjectPendingReviews: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const tokens = await getAssignmentTokens(req);
      const project = await assertTeamLeadAccess(projectId, tokens);
      if (!project) {
        res.status(403).json({ error: 'Only the project team lead can view pending reviews' });
        return;
      }

      const reviews = await CellReviewModel.find({ projectId, status: 'open' }).sort({ createdAt: -1 });
      const cellIds = [...new Set(reviews.map((r) => r.cellId.toString()))];
      const cells = await ProjectCellModel.find({ _id: { $in: cellIds } }).select('name libraryId assignedEmployeeName');
      const cellById = new Map(cells.map((c) => [c._id.toString(), c]));

      res.json(
        reviews.map((review) => {
          const cell = cellById.get(review.cellId.toString());
          return {
            ...toReview(review),
            projectId,
            projectName: project.projectName,
            cellName: cell?.name || 'Cell',
            assignedEmployeeName: cell?.assignedEmployeeName || '',
          };
        }),
      );
    } catch (err) {
      res.status(500).json({ error: 'Failed to list pending reviews' });
    }
  },

  resolveCellReview: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const reviewId = paramId(req.params.reviewId);
      const tokens = await getAssignmentTokens(req);
      const project = await assertTeamLeadAccess(projectId, tokens);
      if (!project) {
        res.status(403).json({ error: 'Only the project team lead can resolve reviews' });
        return;
      }

      const { outcome, returnToStage, comment } = req.body as {
        outcome?: 'approved' | 'rejected';
        returnToStage?: LayoutStage;
        comment?: string;
      };

      if (outcome !== 'approved' && outcome !== 'rejected') {
        res.status(400).json({ error: 'outcome must be approved or rejected' });
        return;
      }

      const review = await CellReviewModel.findOne({ _id: reviewId, projectId, cellId, status: 'open' });
      if (!review) {
        res.status(404).json({ error: 'Open review not found' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const reviewPoint = review.reviewPoint;
      if (reviewPoint !== 'r1' && reviewPoint !== 'r2') {
        res.status(400).json({ error: 'Review point is required to resolve this review' });
        return;
      }

      if (outcome === 'rejected') {
        const options = returnOptionsForReview(reviewPoint);
        if (!returnToStage || !options.includes(returnToStage)) {
          res.status(400).json({
            error: `returnToStage is required. Allowed: ${options.join(', ')}`,
            allowedReturnStages: options,
          });
          return;
        }
      }

      const actor = actorFromReq(req);
      const workflow = normalizeViewWorkflow(cell.viewWorkflow);
      const nextWorkflow =
        outcome === 'approved'
          ? applyReviewApproval(workflow, reviewPoint)
          : applyReviewRejection(workflow, reviewPoint, returnToStage!);

      cell.viewWorkflow = nextWorkflow;
      applyCellWorkflowSync(cell, 'viewWorkflow');
      review.status = 'resolved';
      review.outcome = outcome;
      review.returnToStage = outcome === 'rejected' ? returnToStage : undefined;
      review.resolvedBy = actor.userId;
      review.resolvedByName = actor.userName;
      review.resolvedAt = new Date();

      if (comment?.trim()) {
        review.messages.push({
          authorId: actor.userId,
          authorName: actor.userName,
          authorRole: 'Team Lead',
          body: comment.trim(),
          at: new Date(),
        });
      }

      cell.activityLog.push({
        action: 'review_resolved',
        detail: `${reviewPoint.toUpperCase()} ${outcome}${outcome === 'rejected' ? ` → ${returnToStage}` : ''}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });

      if (cell.status === 'completed' || cell.status === 'ready') {
        cell.status = 'in_progress';
      }

      await Promise.all([cell.save(), review.save()]);

      void sendReviewNotificationsFromCell({
        projectId,
        cellId,
        reviewId: review._id.toString(),
        reviewPoint,
        stageAtRequest: review.stageAtRequest || workflow.layout.stage,
        mode: 'resolved',
        outcome,
        returnToStage: outcome === 'rejected' ? returnToStage : undefined,
        resolvedByName: actor.userName,
      }).catch((notifyErr) => {
        console.error('[employee-projects] review resolve notification failed:', notifyErr);
      });

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json({ cell: toEmployeeCell(cell, tokens, meta), review: toReview(review) });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to resolve review' });
    }
  },
};
