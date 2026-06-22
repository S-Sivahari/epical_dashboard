import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ProjectModel } from '../models/Project';
import { ProjectLibraryModel } from '../models/ProjectLibrary';
import { ProjectCellModel, CELL_STATUSES, CELL_TYPES, type CellStatus } from '../models/ProjectCell';
import { CellReviewModel } from '../models/CellReview';
import {
  applyReviewApproval,
  applyReviewRejection,
  applyWorkflowStageUpdate,
  applyCellWorkflowSync,
  syncViewWorkflowSimpleViewsFromCellViews,
  CELL_WORKFLOW_STAGES,
  currentWorkflowStageLabel,
  defaultCellWorkflow,
  defaultViewWorkflow,
  applySchematicWorkflowSync,
  normalizeViewWorkflow,
  isReviewStageKey,
  isValidStageKey,
  normalizeCellWorkflow,
  resolveStoredCellWorkflow,
  normalizeWorkflowStageStatus,
  returnOptionsForReview,
  syncCellWorkflowFromViewWorkflow,
  syncViewsFromViewWorkflow,
  workflowCompletedCount,
  type LayoutStage,
  type ReviewPoint,
  type WorkflowStageStatus,
} from '../utils/cellWorkflow';
import {
  syncChecklistMappingsForCell,
  removeChecklistMappingsForCell,
} from '../services/checklistService';
import {
  evaluateCellCompletionReadiness,
  markCellTouched,
} from '../services/cellCompletionService';
import { sendReviewNotificationsFromCell } from '../services/cellReviewNotificationService';
import { notifyEmployeeCellAssigned } from '../services/cellAssignmentNotificationService';
import { clearResponsesForCell, normalizeCellType } from '../services/projectTypeChecklistService';
import {
  calculateEstimatedHours,
  deriveBaseHours,
  normalizeComplexity,
  predictEffort,
  resolveBaseHoursInput,
} from '../services/effortEstimationService';
import { isAdminRole } from '../utils/generateToken';
import { assertProjectForRequest } from '../utils/projectAccessHelper';
import { resolveCellAssignee, enrichAssigneeNames } from '../utils/cellAssigneeHelper';
import {
  buildCellImportTemplateBuffer,
  importCellsForLibrary,
  parseCellImportWorkbook,
} from '../services/cellImportService';
import {
  closeProductiveSessionsForCell,
  syncProductiveSessionsForCell,
  WORK_SESSION_REASONS,
} from '../services/productiveTimeService';
import {
  buildWorkflowDurationMap,
  ensureWorkLogsInitialized,
  getCellWorkflowDuration,
  getCellWorkflowTiming,
  syncWorkLogsFromWorkflowChange,
  type CellWorkflowDuration,
  type CellWorkflowTiming,
} from '../services/cellWorkflowWorkLogService';
import {
  applySchematicWorkflowStageUpdate,
  defaultSchematicWorkflow,
  isValidSchematicStageKey,
  normalizeSchematicWorkflow,
  SCHEMATIC_WORKFLOW_STAGES,
  syncSchematicWorkflowFromView,
} from '../utils/schematicWorkflow';

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function actorFromReq(req: Request): { userId: string; userName: string; role: 'Admin' | 'Employee' } {
  const user = (req as any).user;
  return {
    userId: user?.id || user?._id?.toString() || 'admin',
    userName: user?.name || user?.email || 'Admin',
    role: isAdminRole(user?.role || '') ? 'Admin' : 'Employee',
  };
}

async function assertProject(req: Request, projectId: string) {
  return assertProjectForRequest(req, projectId);
}

function normalizeStatus(value: string): CellStatus {
  if (value === 'in_progress' || value === 'drc' || value === 'lvs' || value === 'review') return 'in_progress';
  if (value === 'completed') return 'completed';
  if ((CELL_STATUSES as readonly string[]).includes(value)) return value as CellStatus;
  return 'ready';
}

function toLibrary(doc: any) {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    name: doc.name,
    description: doc.description || '',
    assignedEmployeeId: doc.assignedEmployeeId || '',
    assignedEmployeeName: doc.assignedEmployeeName || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toCell(
  doc: any,
  dependencyMeta?: { isBlocked: boolean; isReady: boolean },
  workflowDuration?: CellWorkflowDuration,
  workflowTiming?: CellWorkflowTiming,
) {
  const viewWorkflow = normalizeViewWorkflow(doc.viewWorkflow);
  const workflow = resolveStoredCellWorkflow(doc);
  const views = doc.views || { layout: '', symbol: '', schematic: '' };
  syncViewsFromViewWorkflow({ viewWorkflow, views });
  const workflowCompletedStages = workflowCompletedCount(workflow);
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    libraryId: doc.libraryId.toString(),
    name: doc.name,
    description: doc.description || '',
    cellType: normalizeCellType(doc.cellType || 'block'),
    technologyNode: doc.technologyNode || '',
    complexity: normalizeComplexity(doc.complexity),
    baseHours: deriveBaseHours(doc.estimatedEffort ?? 0, doc.complexity, doc.baseHours),
    estimatedEffort: doc.estimatedEffort ?? 0,
    smartEstimate: doc.smartEstimate ?? doc.estimatedEffort ?? 0,
    actualEffort: doc.actualEffort ?? 0,
    estimateConfidence: doc.estimateConfidence === 'High' ? 'High' : 'Low',
    assignedEmployeeId: doc.assignedEmployeeId || '',
    assignedEmployeeName: doc.assignedEmployeeName || '',
    dependencyCellIds: (doc.dependencyCellIds || []).map((id: Types.ObjectId) => id.toString()),
    status: normalizeStatus(doc.status || 'ready'),
    onHold: Boolean(doc.onHold),
    holdStartedAt: doc.holdStartedAt ? new Date(doc.holdStartedAt).toISOString() : null,
    holdReason: doc.holdReason || '',
    heldByName: doc.heldByName || '',
    workflow,
    schematicWorkflow: normalizeSchematicWorkflow(
      doc.schematicWorkflow ?? syncSchematicWorkflowFromView(viewWorkflow.schematic),
    ),
    workflowCompletedStages,
    workflowTotalStages: workflow.length,
    currentWorkflowStage: currentWorkflowStageLabel(workflow),
    workflowDuration: workflowDuration ?? workflowTiming?.workflowDuration ?? {
      totalMs: 0,
      formatted: '0m',
      isActive: false,
      wasEverCompleted: false,
      wasReopened: false,
    },
    productiveWorkDuration: workflowDuration ?? workflowTiming?.workflowDuration ?? {
      totalMs: 0,
      formatted: '0m',
      isActive: false,
      wasEverCompleted: false,
      wasReopened: false,
    },
    workflowTiming: workflowTiming ?? {
      stages: [],
      latestActivityTime: null,
      workflowCompletionTime: null,
      workflowDuration: workflowDuration ?? {
        totalMs: 0,
        formatted: '0m',
        isActive: false,
        wasEverCompleted: false,
        wasReopened: false,
      },
    },
    views,
    viewWorkflow,
    activityLog: doc.activityLog || [],
    isBlocked: dependencyMeta?.isBlocked ?? false,
    isReady: dependencyMeta?.isReady ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function toCellWithDuration(
  doc: any,
  dependencyMeta?: { isBlocked: boolean; isReady: boolean },
) {
  const workflow = resolveStoredCellWorkflow(doc);
  const cellId = doc._id.toString();
  const projectId = doc.projectId.toString();
  const cellContext = {
    status: normalizeStatus(doc.status || 'ready'),
    onHold: Boolean(doc.onHold),
    assignedEmployeeId: doc.assignedEmployeeId,
    workflow,
    activityLog: doc.activityLog ?? [],
  };
  const [duration, timing] = await Promise.all([
    getCellWorkflowDuration(projectId, cellId, cellContext),
    getCellWorkflowTiming(projectId, cellId, cellContext),
  ]);
  return toCell(doc, dependencyMeta, duration, timing);
}

function cellProductiveTimePayload(doc: any) {
  const workflow = resolveStoredCellWorkflow(doc);
  return {
    status: normalizeStatus(doc.status || 'ready'),
    onHold: Boolean(doc.onHold),
    assignedEmployeeId: doc.assignedEmployeeId,
    workflow,
  };
}

async function reconcileCellProductiveTime(
  projectId: string,
  cellId: string,
  doc: any,
  actor?: ReturnType<typeof actorFromReq>,
) {
  await syncProductiveSessionsForCell(projectId, cellId, cellProductiveTimePayload(doc), actor);
}

function toReview(doc: any) {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    cellId: doc.cellId.toString(),
    stageAtRequest: doc.stageAtRequest,
    reviewPoint: doc.reviewPoint || null,
    outcome: doc.outcome || 'pending',
    returnToStage: doc.returnToStage || null,
    status: doc.status,
    resolvedByName: doc.resolvedByName || null,
    resolvedAt: doc.resolvedAt || null,
    initiatedBy: doc.initiatedBy,
    initiatedByName: doc.initiatedByName,
    assignedEmployeeId: doc.assignedEmployeeId || '',
    messages: doc.messages || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
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

async function refreshBlockedStatuses(_projectId: Types.ObjectId) {
  /* Dependency blocking is derived at read time via computeDependencyMeta */
}

export const projectWorkspaceController = {
  getWorkspaceSummary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const project = await assertProject(req, projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const [libraries, cells, reviews] = await Promise.all([
        ProjectLibraryModel.find({ projectId }).sort({ name: 1 }),
        ProjectCellModel.find({ projectId }),
        CellReviewModel.find({ projectId, status: 'open' }),
      ]);

      await Promise.all(
        cells.map((cell) =>
          ensureWorkLogsInitialized(
            projectId,
            cell._id.toString(),
            {
              status: cell.status,
              onHold: cell.onHold,
              assignedEmployeeId: cell.assignedEmployeeId,
              workflow: normalizeCellWorkflow(cell.workflow),
            },
            cell.activityLog ?? [],
          ),
        ),
      );
      const durationMap = await buildWorkflowDurationMap(projectId, cells);
      const cellsWithMeta = await enrichAssigneeNames(
        await Promise.all(
          cells.map(async (cell) => {
            const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
            return toCell(cell, meta, durationMap.get(cell._id.toString()));
          }),
        ),
      );

      const cellCount = cells.length;
      const completedCells = cells.filter((c) => c.status === 'completed').length;
      const completionPercentage = cellCount > 0
        ? Math.round((completedCells / cellCount) * 100)
        : 0;

      if ((project.completionPercentage ?? 0) !== completionPercentage
        || (project.completedTasks ?? 0) !== completedCells
        || (project.totalTasks ?? 0) !== cellCount) {
        await ProjectModel.findByIdAndUpdate(project._id, {
          totalTasks: cellCount,
          completedTasks: completedCells,
          completionPercentage,
        });
      }

      res.json({
        project: {
          id: project._id.toString(),
          name: project.projectName,
          client: project.clientName,
          accessType: project.accessType,
          teamLead: project.teamLead || '',
          technologyNode: project.technologyNode,
          description: project.description,
          status: project.status,
          completionPercentage,
        },
        libraries: libraries.map(toLibrary),
        cells: cellsWithMeta,
        stats: {
          libraryCount: libraries.length,
          cellCount,
          completedCells,
          notStartedCells: cells.filter((c) => c.status === 'ready').length,
          inProgressCells: cells.filter((c) => c.status === 'in_progress').length,
          blockedCells: cellsWithMeta.filter((c) => c.isBlocked).length,
          readyCells: cellsWithMeta.filter((c) => c.isReady).length,
          unassignedCells: cells.filter((c) => !c.assignedEmployeeId).length,
          openReviews: reviews.length,
        },
      });
    } catch (err) {
      console.error('[workspace] summary', err);
      res.status(500).json({ error: 'Failed to load workspace' });
    }
  },

  listLibraries: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      if (!(await assertProject(req, projectId))) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      const libraries = await ProjectLibraryModel.find({ projectId }).sort({ name: 1 });
      res.json(libraries.map(toLibrary));
    } catch (err) {
      res.status(500).json({ error: 'Failed to list libraries' });
    }
  },

  createLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const project = await assertProject(req, projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      const { name, description } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ error: 'Library name is required' });
        return;
      }
      const actor = actorFromReq(req);
      const library = await ProjectLibraryModel.create({
        projectId: project._id,
        name: name.trim(),
        description: description?.trim() || '',
        createdBy: actor.userId,
      });
      res.status(201).json(toLibrary(library));
    } catch (err) {
      res.status(500).json({ error: 'Failed to create library' });
    }
  },

  updateLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      if (!Types.ObjectId.isValid(libraryId)) {
        res.status(400).json({ error: 'Invalid library id' });
        return;
      }
      const library = await ProjectLibraryModel.findOne({ _id: libraryId, projectId });
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }
      const { name, description } = req.body;
      if (name !== undefined) library.name = String(name).trim();
      if (description !== undefined) library.description = String(description).trim();
      await library.save();
      res.json(toLibrary(library));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update library' });
    }
  },

  deleteLibrary: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      const library = await ProjectLibraryModel.findOneAndDelete({ _id: libraryId, projectId });
      if (!library) {
        res.status(404).json({ error: 'Library not found' });
        return;
      }
      const cellIds = await ProjectCellModel.find({ libraryId }).distinct('_id');
      await CellReviewModel.deleteMany({ cellId: { $in: cellIds } });
      await ProjectCellModel.deleteMany({ libraryId });
      await syncProjectProgress(new Types.ObjectId(projectId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete library' });
    }
  },

  listCells: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      const cells = await ProjectCellModel.find({ projectId, libraryId }).sort({ name: 1 });
      const result = await Promise.all(
        cells.map(async (cell) => toCell(cell, await computeDependencyMeta(new Types.ObjectId(projectId), cell))),
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list cells' });
    }
  },

  createCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      const project = await assertProject(req, projectId);
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
      const deps = Array.isArray(dependencyCellIds)
        ? dependencyCellIds.filter((id: string) => Types.ObjectId.isValid(id)).map((id: string) => new Types.ObjectId(id))
        : [];

      const normalizedComplexity = normalizeComplexity(complexity);
      const resolvedTechNode = technologyNode?.trim() || project.technologyNode || '';
      const resolvedBaseHours = resolveBaseHoursInput(baseHours, estimatedEffort, normalizedComplexity);
      const prediction = await predictEffort({
        cellType: normalizeCellType(cellType),
        technologyNode: resolvedTechNode,
        complexity: normalizedComplexity,
        baseHours: resolvedBaseHours,
      });

      const assignment = assignedEmployeeId?.trim()
        ? await resolveCellAssignee(assignedEmployeeId, assignedEmployeeName)
        : { assignedEmployeeId: undefined, assignedEmployeeName: undefined };

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
        schematicWorkflow: defaultSchematicWorkflow(),
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
      await ensureWorkLogsInitialized(
        project._id.toString(),
        cell._id.toString(),
        {
          status: cell.status,
          onHold: cell.onHold,
          assignedEmployeeId: cell.assignedEmployeeId,
          workflow: normalizeCellWorkflow(cell.workflow),
        },
        cell.activityLog ?? [],
      );
      const meta = await computeDependencyMeta(project._id, cell);

      if (assignment.assignedEmployeeId?.trim()) {
        void notifyEmployeeCellAssigned({
          projectId: project._id.toString(),
          cellId: cell._id.toString(),
          projectName: project.projectName || 'Project',
          cellName: cell.name,
          assignedEmployeeId: String(assignment.assignedEmployeeId).trim(),
          assignedEmployeeName: assignment.assignedEmployeeName || undefined,
          assignedByName: actor.userName,
        }).catch((notifyErr) => {
          console.error('[workspace] cell assignment notification failed:', notifyErr);
        });
      }

      res.status(201).json(await toCellWithDuration(cell, meta));
    } catch (err) {
      console.error('[workspace] createCell', err);
      res.status(500).json({ error: 'Failed to create cell' });
    }
  },

  updateCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const actor = actorFromReq(req);
      const previousCellType = cell.cellType;
      const previousAssignee = cell.assignedEmployeeId?.trim() || '';
      const fields = [
        'name', 'description', 'cellType', 'technologyNode', 'complexity',
        'baseHours', 'estimatedEffort', 'actualEffort', 'views',
      ] as const;

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          (cell as any)[field] = field === 'cellType'
            ? normalizeCellType(String(req.body[field]))
            : req.body[field];
        }
      }

      if (req.body.assignedEmployeeId !== undefined) {
        const assignment = await resolveCellAssignee(
          req.body.assignedEmployeeId,
          req.body.assignedEmployeeName,
        );
        cell.assignedEmployeeId = assignment.assignedEmployeeId;
        cell.assignedEmployeeName = assignment.assignedEmployeeName;
      }

      if (req.body.complexity !== undefined) {
        cell.complexity = normalizeComplexity(req.body.complexity);
      }

      if (req.body.baseHours !== undefined || req.body.complexity !== undefined) {
        const base = Math.max(0, Number(cell.baseHours) || 0);
        cell.estimatedEffort = calculateEstimatedHours(base, cell.complexity);
      } else if (req.body.estimatedEffort !== undefined && req.body.baseHours === undefined) {
        cell.baseHours = deriveBaseHours(Number(cell.estimatedEffort) || 0, cell.complexity, cell.baseHours);
      }

      if (Array.isArray(req.body.dependencyCellIds)) {
        cell.dependencyCellIds = req.body.dependencyCellIds
          .filter((id: string) => Types.ObjectId.isValid(id) && id !== cellId)
          .map((id: string) => new Types.ObjectId(id));
      }

      if (req.body.views !== undefined) {
        syncViewWorkflowSimpleViewsFromCellViews(cell);
        syncViewsFromViewWorkflow(cell);
      }

      if (req.body.libraryId !== undefined) {
        if (!Types.ObjectId.isValid(req.body.libraryId)) {
          res.status(400).json({ error: 'Invalid library id' });
          return;
        }
        const library = await ProjectLibraryModel.findOne({ _id: req.body.libraryId, projectId });
        if (!library) {
          res.status(400).json({ error: 'Library not found in this project' });
          return;
        }
        cell.libraryId = library._id;
      }

      cell.activityLog.push({
        action: 'updated',
        detail: 'Cell details updated',
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });

      if (cell.status === 'completed' || cell.status === 'ready') {
        cell.status = 'in_progress';
      }

      await cell.save();

      const nextAssignee = cell.assignedEmployeeId?.trim() || '';
      if (
        req.body.assignedEmployeeId !== undefined
        && nextAssignee !== previousAssignee
      ) {
        await closeProductiveSessionsForCell(
          projectId,
          cellId,
          WORK_SESSION_REASONS.INACTIVE,
          actor,
        );
      }
      await reconcileCellProductiveTime(projectId, cellId, cell, actor);

      if (
        req.body.assignedEmployeeId !== undefined
        && nextAssignee
        && nextAssignee !== previousAssignee
      ) {
        const project = await ProjectModel.findById(projectId).lean();
        void notifyEmployeeCellAssigned({
          projectId,
          cellId,
          projectName: project?.projectName || 'Project',
          cellName: cell.name,
          assignedEmployeeId: nextAssignee,
          assignedEmployeeName: cell.assignedEmployeeName || undefined,
          assignedByName: actor.userName,
        }).catch((notifyErr) => {
          console.error('[workspace] cell assignment notification failed:', notifyErr);
        });
      }

      if (req.body.cellType !== undefined && cell.cellType !== previousCellType) {
        await syncChecklistMappingsForCell(new Types.ObjectId(projectId), cell._id);
      }

      await refreshBlockedStatuses(new Types.ObjectId(projectId));
      const refreshed = await ProjectCellModel.findById(cellId);
      const meta = refreshed ? await computeDependencyMeta(new Types.ObjectId(projectId), refreshed) : { isBlocked: false, isReady: false };
      res.json(toCell(refreshed, meta));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update cell' });
    }
  },

  updateCellStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const { status } = req.body;
      const nextStatus = normalizeStatus(status);
      if (!CELL_STATUSES.includes(nextStatus) || nextStatus === 'completed') {
        res.status(400).json({ error: 'Invalid status. Use complete endpoint for completed.' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      if (meta.isBlocked && nextStatus === 'in_progress') {
        res.status(400).json({ error: 'Cell is blocked by incomplete dependencies' });
        return;
      }

      const actor = actorFromReq(req);
      const prev = normalizeStatus(cell.status);
      cell.status = nextStatus;
      cell.activityLog.push({
        action: 'status_change',
        detail: `${prev} → ${nextStatus}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();
      await reconcileCellProductiveTime(projectId, cellId, cell, actor);
      res.json(toCell(cell, await computeDependencyMeta(new Types.ObjectId(projectId), cell)));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update status' });
    }
  },

  completeCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const actor = actorFromReq(req);
      if (actor.role !== 'Admin') {
        res.status(403).json({ error: 'Only admins can mark cells as completed' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const readiness = await evaluateCellCompletionReadiness(projectId, cellId);
      if (!readiness?.canComplete) {
        res.status(400).json({
          error: 'Cell cannot be completed until all required sections are finished',
          missing: readiness?.missing ?? [],
        });
        return;
      }

      const prev = cell.status;
      cell.status = 'completed';
      const completedAt = new Date();
      cell.activityLog.push({
        action: 'completed',
        detail: `Marked completed by ${actor.userName}`,
        userId: actor.userId,
        userName: actor.userName,
        at: completedAt,
      });
      await cell.save();
      await closeProductiveSessionsForCell(
        projectId,
        cellId,
        WORK_SESSION_REASONS.INACTIVE,
        actor,
        completedAt,
      );

      await refreshBlockedStatuses(new Types.ObjectId(projectId));
      await syncProjectProgress(new Types.ObjectId(projectId));

      const openReviews = await CellReviewModel.find({ cellId, status: 'open' });
      for (const review of openReviews) {
        review.status = 'resolved';
        await review.save();
      }

      res.json(await toCellWithDuration(cell, { isBlocked: false, isReady: false }));
    } catch (err) {
      res.status(500).json({ error: 'Failed to complete cell' });
    }
  },

  uncompleteCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const actor = actorFromReq(req);
      if (actor.role !== 'Admin') {
        res.status(403).json({ error: 'Only admins can uncomplete cells' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      if (cell.status !== 'completed') {
        res.status(400).json({ error: 'Cell is not completed' });
        return;
      }

      cell.status = 'in_progress';
      cell.activityLog.push({
        action: 'uncompleted',
        detail: `Marked incomplete by ${actor.userName}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();
      await reconcileCellProductiveTime(projectId, cellId, cell, actor);

      await refreshBlockedStatuses(new Types.ObjectId(projectId));
      await syncProjectProgress(new Types.ObjectId(projectId));

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(await toCellWithDuration(cell, meta));
    } catch (err) {
      res.status(500).json({ error: 'Failed to uncomplete cell' });
    }
  },

  touchCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const becameInProgress = cell.status === 'ready';
      if (becameInProgress) {
        cell.status = 'in_progress';
        await cell.save();
        await reconcileCellProductiveTime(projectId, cellId, cell);
      }

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(await toCellWithDuration(cell, meta));
    } catch (err) {
      res.status(500).json({ error: 'Failed to update cell activity' });
    }
  },

  getCellCompletionReadiness: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const readiness = await evaluateCellCompletionReadiness(projectId, cellId);
      if (!readiness) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }
      res.json(readiness);
    } catch (err) {
      res.status(500).json({ error: 'Failed to evaluate cell completion readiness' });
    }
  },

  getEffortPrediction: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const project = await assertProject(req, projectId);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const cellType = normalizeCellType(String(req.query.cellType || 'block'));
      const technologyNode = String(req.query.technologyNode || project.technologyNode || '').trim();
      const complexity = normalizeComplexity(req.query.complexity);
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

  getDependencyGraph: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cells = await ProjectCellModel.find({ projectId });
      const nodes = await Promise.all(
        cells.map(async (cell) => {
          const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
          return {
            id: cell._id.toString(),
            name: cell.name,
            status: cell.status,
            libraryId: cell.libraryId.toString(),
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

  listCellReviews: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const reviews = await CellReviewModel.find({ projectId, cellId }).sort({ createdAt: -1 });
      res.json(reviews.map(toReview));
    } catch (err) {
      res.status(500).json({ error: 'Failed to list reviews' });
    }
  },

  createCellReview: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const { comment } = req.body;
      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const actor = actorFromReq(req);
      const workflow = normalizeViewWorkflow(cell.viewWorkflow);
      const review = await CellReviewModel.create({
        projectId: new Types.ObjectId(projectId),
        cellId: cell._id,
        stageAtRequest: workflow.layout.stage,
        reviewPoint: workflow.layout.pendingReview || undefined,
        outcome: 'pending',
        initiatedBy: actor.userId,
        initiatedByName: actor.userName,
        assignedEmployeeId: cell.assignedEmployeeId,
        messages: [
          {
            authorId: actor.userId,
            authorName: actor.userName,
            authorRole: actor.role,
            body: comment?.trim() || 'Review requested',
            at: new Date(),
          },
        ],
      });

      cell.activityLog.push({
        action: 'review_requested',
        detail: `Review requested at layout stage ${workflow.layout.stage}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();

      res.status(201).json(toReview(review));
    } catch (err) {
      res.status(500).json({ error: 'Failed to create review' });
    }
  },

  deleteCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      if (!Types.ObjectId.isValid(cellId)) {
        res.status(400).json({ error: 'Invalid cell id' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const cellObjectId = new Types.ObjectId(cellId);
      const projectObjectId = new Types.ObjectId(projectId);

      await ProjectCellModel.updateMany(
        { projectId: projectObjectId, dependencyCellIds: cellObjectId },
        { $pull: { dependencyCellIds: cellObjectId } },
      );
      await CellReviewModel.deleteMany({ cellId: cellObjectId });
      await removeChecklistMappingsForCell(cellObjectId);
      await clearResponsesForCell(cellObjectId);
      await ProjectCellModel.findByIdAndDelete(cellObjectId);

      await refreshBlockedStatuses(projectObjectId);
      await syncProjectProgress(projectObjectId);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete cell' });
    }
  },

  resolveCellReview: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const reviewId = paramId(req.params.reviewId);
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
      const prevWorkflow = syncCellWorkflowFromViewWorkflow(workflow);
      let nextWorkflow = workflow;

      if (outcome === 'approved') {
        nextWorkflow = applyReviewApproval(workflow, reviewPoint);
      } else {
        nextWorkflow = applyReviewRejection(workflow, reviewPoint, returnToStage!);
      }

      cell.viewWorkflow = nextWorkflow;
      applyCellWorkflowSync(cell, 'viewWorkflow');
      const nextCellWorkflow = syncCellWorkflowFromViewWorkflow(cell.viewWorkflow);
      await syncWorkLogsFromWorkflowChange(
        projectId,
        cellId,
        prevWorkflow,
        nextCellWorkflow,
        actor,
        {
          status: cell.status,
          onHold: cell.onHold,
          assignedEmployeeId: cell.assignedEmployeeId,
        },
      );
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
          authorRole: actor.role,
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
        console.error('[workspace] review resolve notification failed:', notifyErr);
      });

      res.json({ cell: toCell(cell), review: toReview(review) });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to resolve review' });
    }
  },

  updateWorkflowStage: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const stageKey = paramId(req.params.stageKey);
      const { status, rejectReturnTo } = req.body as {
        status?: string;
        rejectReturnTo?: 'floor_plan' | 'routing';
      };

      if (!isValidStageKey(stageKey)) {
        res.status(400).json({ error: 'Invalid workflow stage' });
        return;
      }

      const nextStatus = normalizeWorkflowStageStatus(String(status || ''));
      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const actor = actorFromReq(req);
      const stageMeta = CELL_WORKFLOW_STAGES.find((s) => s.key === stageKey);
      const prevWorkflow = normalizeCellWorkflow(cell.workflow);
      const prevStatus = prevWorkflow.find((s) => s.stageKey === stageKey)?.status ?? 'not_started';
      const result = applyWorkflowStageUpdate(cell.workflow, stageKey, nextStatus, actor.role, {
        rejectReturnTo:
          rejectReturnTo === 'floor_plan' || rejectReturnTo === 'routing' ? rejectReturnTo : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      const nextWorkflow = result.workflow;
      if (cell.status === 'completed' || cell.status === 'ready') {
        cell.status = 'in_progress';
      }
      await syncWorkLogsFromWorkflowChange(
        projectId,
        cellId,
        prevWorkflow,
        nextWorkflow,
        actor,
        {
          status: cell.status,
          onHold: cell.onHold,
          assignedEmployeeId: cell.assignedEmployeeId,
        },
      );

      cell.workflow = nextWorkflow;
      applyCellWorkflowSync(cell, 'workflow');
      cell.activityLog.push({
        action: 'workflow_update',
        detail: `${stageMeta?.label || stageKey}: ${prevStatus} → ${nextStatus}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });

      await cell.save();

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(await toCellWithDuration(cell, meta));
    } catch (err) {
      console.error('[workspace] updateWorkflowStage', err);
      res.status(500).json({ error: 'Failed to update workflow stage' });
    }
  },

  updateSchematicWorkflowStage: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const stageKey = paramId(req.params.stageKey);
      const { status, rejectReturnTo } = req.body as {
        status?: string;
        rejectReturnTo?: 'design' | 'simulation' | 'data_collection';
      };

      if (!isValidSchematicStageKey(stageKey)) {
        res.status(400).json({ error: 'Invalid schematic workflow stage' });
        return;
      }

      const nextStatus = normalizeWorkflowStageStatus(String(status || ''));
      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const actor = actorFromReq(req);
      const stageMeta = SCHEMATIC_WORKFLOW_STAGES.find((s) => s.key === stageKey);
      const prevWorkflow = normalizeSchematicWorkflow(cell.schematicWorkflow);
      const prevStatus = prevWorkflow.find((s) => s.stageKey === stageKey)?.status ?? 'not_started';
      const result = applySchematicWorkflowStageUpdate(cell.schematicWorkflow, stageKey, nextStatus, actor.role, {
        rejectReturnTo:
          rejectReturnTo === 'design' || rejectReturnTo === 'simulation' || rejectReturnTo === 'data_collection'
            ? rejectReturnTo
            : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      cell.schematicWorkflow = result.workflow;
      applySchematicWorkflowSync(cell, 'schematicWorkflow');
      if (cell.status === 'completed' || cell.status === 'ready') {
        cell.status = 'in_progress';
      }
      cell.activityLog.push({
        action: 'schematic_workflow_update',
        detail: `${stageMeta?.label || stageKey}: ${prevStatus} → ${nextStatus}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });

      await cell.save();

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(await toCellWithDuration(cell, meta));
    } catch (err) {
      console.error('[workspace] updateSchematicWorkflowStage', err);
      res.status(500).json({ error: 'Failed to update schematic workflow stage' });
    }
  },

  addReviewMessage: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const reviewId = paramId(req.params.reviewId);
      const { body } = req.body;
      if (!body?.trim()) {
        res.status(400).json({ error: 'Message body is required' });
        return;
      }

      const review = await CellReviewModel.findOne({ _id: reviewId, projectId, cellId });
      if (!review) {
        res.status(404).json({ error: 'Review not found' });
        return;
      }

      const actor = actorFromReq(req);
      review.messages.push({
        authorId: actor.userId,
        authorName: actor.userName,
        authorRole: actor.role,
        body: body.trim(),
        at: new Date(),
      });
      await review.save();
      res.json(toReview(review));
    } catch (err) {
      res.status(500).json({ error: 'Failed to add message' });
    }
  },

  downloadCellImportTemplate: async (_req: Request, res: Response): Promise<void> => {
    try {
      const buffer = await buildCellImportTemplateBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="cell-import-template.xlsx"');
      res.send(buffer);
    } catch (err) {
      console.error('[workspace] downloadCellImportTemplate', err);
      res.status(500).json({ error: 'Failed to generate cell template' });
    }
  },

  importCells: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const libraryId = paramId(req.params.libraryId);
      const project = await assertProject(req, projectId);
      const library = await ProjectLibraryModel.findOne({ _id: libraryId, projectId });
      if (!project || !library) {
        res.status(404).json({ error: 'Project or library not found' });
        return;
      }

      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: 'Upload an Excel file (.xlsx)' });
        return;
      }

      const rows = await parseCellImportWorkbook(file.buffer);
      const actor = actorFromReq(req);
      const result = await importCellsForLibrary({
        projectId: project._id,
        libraryId: library._id,
        rows,
        actor: { userId: actor.userId, userName: actor.userName },
      });

      await syncProjectProgress(project._id);
      await refreshBlockedStatuses(project._id);

      res.json({
        message: `Imported ${result.created} cell${result.created === 1 ? '' : 's'}`,
        ...result,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import cells';
      console.error('[workspace] importCells', err);
      res.status(400).json({ error: message });
    }
  },

  setCellHold: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const { hold, reason } = req.body as { hold?: boolean; reason?: string };

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const actor = actorFromReq(req);
      const now = new Date();
      const shouldHold = hold !== false && hold !== undefined ? Boolean(hold) : !cell.onHold;

      if (shouldHold) {
        cell.onHold = true;
        cell.holdStartedAt = now;
        cell.holdReason = reason?.trim() || '';
        cell.heldById = actor.userId;
        cell.heldByName = actor.userName;
        await closeProductiveSessionsForCell(
          projectId,
          cellId,
          WORK_SESSION_REASONS.HOLD,
          actor,
          now,
        );
        cell.activityLog.push({
          action: 'hold',
          detail: cell.holdReason || 'Cell placed on hold',
          userId: actor.userId,
          userName: actor.userName,
          at: now,
        });
      } else {
        cell.onHold = false;
        cell.holdStartedAt = undefined;
        cell.holdReason = '';
        cell.heldById = undefined;
        cell.heldByName = undefined;
        cell.activityLog.push({
          action: 'hold_released',
          detail: 'Hold removed',
          userId: actor.userId,
          userName: actor.userName,
          at: now,
        });
        await syncProductiveSessionsForCell(projectId, cellId, cell, actor, now);
      }

      await cell.save();
      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(await toCellWithDuration(cell, meta));
    } catch (err) {
      console.error('[workspace] setCellHold', err);
      res.status(500).json({ error: 'Failed to update hold status' });
    }
  },
};
