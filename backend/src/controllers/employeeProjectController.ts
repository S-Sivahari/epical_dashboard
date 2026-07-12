import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { getDB } from '../config/db';
import { ProjectModel } from '../models/Project';
import { ProjectLibraryModel } from '../models/ProjectLibrary';
import { ProjectCellModel, CELL_STATUSES, type CellStatus } from '../models/ProjectCell';
import { CellReviewModel } from '../models/CellReview';
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth';
import { enrichAssigneeNames } from '../utils/cellAssigneeHelper';
import {
  buildAssignmentIdentityTokens,
  isProjectMemberDisplayName,
  resolveProjectMemberAssignees,
} from '../utils/assignedTaskSync';
import {
  deriveBaseHours,
  normalizeComplexity,
  predictEffort,
  resolveBaseHoursInput,
} from '../services/effortEstimationService';
import {
  ensureWorkLogsInitialized,
  getCellWorkflowTiming,
  syncWorkLogsFromWorkflowChange,
  type CellWorkflowTiming,
} from '../services/cellWorkflowWorkLogService';
import {
  closeProductiveSessionsForCell,
  isEmployeeAttendanceActive,
  syncProductiveSessionsForCell,
  WORK_SESSION_REASONS,
} from '../services/productiveTimeService';

function normalizeStatus(value: string): CellStatus {
  if (value === 'in_progress' || value === 'drc' || value === 'lvs' || value === 'review') return 'in_progress';
  if (value === 'completed') return 'completed';
  if ((CELL_STATUSES as readonly string[]).includes(value)) return value as CellStatus;
  return 'ready';
}

async function computeDependencyMeta(projectId: Types.ObjectId, cell: any, allCells?: any[]) {
  const cells = allCells ?? (await ProjectCellModel.find({ projectId }));
  const completedIds = new Set(
    cells.filter((c) => c.status === 'completed').map((c) => c._id.toString()),
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
  applySchematicWorkflowSync,
  applyReviewApproval,
  applyReviewRejection,
  applyWorkflowStageUpdate,
  canAdvanceLayoutStage,
  canRequestReview,
  CELL_WORKFLOW_STAGES,
  defaultCellWorkflow,
  defaultViewWorkflow,
  isValidStageKey,
  markReviewPending,
  normalizeCellWorkflow,
  resolveStoredCellWorkflow,
  normalizeViewWorkflow,
  normalizeWorkflowStageStatus,
  cellHasWorkflowActivity,
  returnOptionsForReview,
  syncCellWorkflowFromViewWorkflow,
  syncViewsFromViewWorkflow,
  validateStatusStepForward,
  viewWorkflowActionRequiresChecklist,
  type CellViewWorkflow,
  type LayoutStage,
  type ViewProgressStatus,
} from '../utils/cellWorkflow';
import {
  advanceSchematicView,
  applySchematicWorkflowStageUpdate,
  canAdvanceSchematicView,
  defaultSchematicWorkflow,
  isValidSchematicStageKey,
  normalizeSchematicWorkflow,
  schematicHasWorkflowActivity,
  SCHEMATIC_WORKFLOW_STAGES,
  syncSchematicWorkflowFromView,
} from '../utils/schematicWorkflow';
import { assertCellChecklistFilled, buildCellChecklistDetail } from '../services/cellTypeChecklistService';
import { sendReviewNotificationsFromCell } from '../services/cellReviewNotificationService';
import {
  notifyCellCreatedUnassigned,
  notifyEmployeeCellAssigned,
} from '../services/cellAssignmentNotificationService';
import { updateCellChecklistItemResponse, syncChecklistMappingsForCell } from '../services/checklistService';
import { normalizeCellType } from '../services/projectTypeChecklistService';
import {
  evaluateCellCompletionReadiness,
  isFinalCellDetailsComplete,
  markCellTouched,
} from '../services/cellCompletionService';
import { isAdminRole } from '../utils/generateToken';
import type { WorkflowActorRole } from '../utils/cellWorkflow';
import {
  areTypeChecklistItemsFilled,
  commentRequiredForAnswer,
  getCellTypeChecklistDetail,
  getTypeChecklistItems,
  isValidChecklistYesNo,
  isValidTypeChecklistAnswer,
  resolveCellContext,
  updateCellChecklistExtension,
  updateCustomChecklistItemResponse,
} from '../services/projectTypeChecklistService';
import { CellTypeChecklistResponseModel } from '../models/CellTypeChecklistResponse';

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

function isAdminFromReq(req: Request): boolean {
  return isAdminRole((req as any).user?.role || '');
}

function workflowActorRole(req: Request, project: { teamLead?: string }, tokens: string[]): WorkflowActorRole {
  if (isAdminFromReq(req)) return 'Admin';
  if (isTeamLeadOnProject(project, tokens)) return 'TeamLead';
  return 'Employee';
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
  const employee = await resolveEmployeeForAuthUser(actor.userId, actor.email);
  return buildAssignmentIdentityTokens(actor, employee as any);
}

function cellAssignedToTokens(cell: { assignedEmployeeId?: string }, tokens: string[]): boolean {
  const assigned = cell.assignedEmployeeId?.trim();
  if (!assigned) return false;
  const assignedLower = assigned.toLowerCase();
  return tokens.some((token) => token.trim().toLowerCase() === assignedLower);
}

async function assertProjectAccess(projectId: string, tokens: string[], req?: Request) {
  if (!Types.ObjectId.isValid(projectId)) return null;
  if (req && isAdminFromReq(req)) {
    return ProjectModel.findById(projectId);
  }

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

async function assertManageableCell(projectId: string, cellId: string, tokens: string[], req?: Request) {
  if (!Types.ObjectId.isValid(cellId)) return null;
  if (req && isAdminFromReq(req)) {
    const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
    return cell;
  }

  const project = await assertProjectAccess(projectId, tokens, req);
  if (!project) return null;
  const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
  if (!cell) return null;
  if (cellAssignedToTokens(cell, tokens) || isTeamLeadOnProject(project, tokens)) return cell;
  return null;
}

async function assertProjectCell(projectId: string, cellId: string, tokens: string[], req?: Request) {
  if (!Types.ObjectId.isValid(cellId)) return null;
  const project = await assertProjectAccess(projectId, tokens, req);
  if (!project) return null;
  const cell = await ProjectCellModel.findOne({ _id: cellId, projectId });
  if (!cell) return null;
  return cell;
}

function isTeamLeadOnProject(project: { teamLead?: string }, tokens: string[]): boolean {
  const lead = project.teamLead?.trim();
  if (!lead) return false;
  const leadLower = lead.toLowerCase();
  return tokens.some((token) => token.trim().toLowerCase() === leadLower);
}

async function assertTeamLeadAccess(projectId: string, tokens: string[], req?: Request) {
  if (req && isAdminFromReq(req)) {
    return ProjectModel.findById(projectId);
  }

  const project = await assertProjectAccess(projectId, tokens, req);
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
  const name = employeeDisplayName(employee as Parameters<typeof employeeDisplayName>[0]) || actor.userName;
  return {
    assignedEmployeeId: employee?.employeeId || employee?.id || actor.userId,
    assignedEmployeeName: name,
  };
}

async function resolveCellCreateAssignment(
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
  const displayName = employeeDisplayName(employee as Parameters<typeof employeeDisplayName>[0]) || body.assignedEmployeeName?.trim() || '';
  if (!displayName || !isProjectMemberDisplayName(project, displayName)) {
    return { error: 'Assignee must be a member of this project' };
  }

  return {
    assignedEmployeeId: employee?.employeeId || employee?.id || requestedId,
    assignedEmployeeName: displayName,
  };
}

async function resolveCellAssigneeUpdate(
  project: { teamLead?: string; allowedUsers?: string[] },
  body: { assignedEmployeeId?: string; assignedEmployeeName?: string },
): Promise<{ assignedEmployeeId?: string; assignedEmployeeName?: string } | { error: string }> {
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
  const displayName = employeeDisplayName(employee as Parameters<typeof employeeDisplayName>[0]) || body.assignedEmployeeName?.trim() || '';
  if (!displayName || !isProjectMemberDisplayName(project, displayName)) {
    return { error: 'Assignee must be a member of this project' };
  }

  return {
    assignedEmployeeId: employee?.employeeId || employee?.id || requestedId,
    assignedEmployeeName: displayName,
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
  const displayName = employeeDisplayName(employee as Parameters<typeof employeeDisplayName>[0]) || body.assignedEmployeeName?.trim() || '';
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

function actualEffortHoursFromTiming(timing?: CellWorkflowTiming): number {
  const ms = timing?.workflowDuration?.totalMs ?? 0;
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 10) / 10;
}

function toEmployeeCell(
  doc: any,
  tokens: string[],
  dependencyMeta?: { isBlocked: boolean; isReady: boolean },
  workflowTiming?: CellWorkflowTiming,
) {
  const viewWorkflow = normalizeViewWorkflow(doc.viewWorkflow);
  const views = doc.views || { layout: '', symbol: '', schematic: '' };
  syncViewsFromViewWorkflow({ viewWorkflow, views });
  const workflow = resolveStoredCellWorkflow(doc);
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    libraryId: doc.libraryId.toString(),
    name: doc.name,
    description: doc.description || '',
    cellType: doc.cellType || 'block',
    complexity: normalizeComplexity(doc.complexity),
    baseHours: deriveBaseHours(doc.estimatedEffort ?? 0, doc.complexity, doc.baseHours),
    estimatedEffort: doc.estimatedEffort ?? 0,
    smartEstimate: doc.smartEstimate ?? doc.estimatedEffort ?? 0,
    actualEffort: actualEffortHoursFromTiming(workflowTiming),
    estimateConfidence: doc.estimateConfidence === 'High' ? 'High' : 'Low',
    assignedEmployeeId: doc.assignedEmployeeId || '',
    assignedEmployeeName: doc.assignedEmployeeName || '',
    status: doc.status || 'ready',
    onHold: Boolean(doc.onHold),
    holdStartedAt: doc.holdStartedAt ? new Date(doc.holdStartedAt).toISOString() : null,
    holdReason: doc.holdReason || '',
    heldByName: doc.heldByName || '',
    productiveWorkDuration: workflowTiming?.workflowDuration ?? {
      totalMs: 0,
      formatted: '0m',
      isActive: false,
      wasEverCompleted: false,
      wasReopened: false,
    },
    viewWorkflow,
    workflow,
    schematicWorkflow: normalizeSchematicWorkflow(
      doc.schematicWorkflow ?? syncSchematicWorkflowFromView(viewWorkflow.schematic),
    ),
    views,
    workflowDuration: workflowTiming?.workflowDuration ?? {
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
      workflowDuration: {
        totalMs: 0,
        formatted: '0m',
        isActive: false,
        wasEverCompleted: false,
        wasReopened: false,
      },
    },
    isAssignedToMe: cellAssignedToTokens(doc, tokens),
    isBlocked: dependencyMeta?.isBlocked ?? false,
    isReady: dependencyMeta?.isReady ?? false,
    activityLog: doc.activityLog || [],
    updatedAt: doc.updatedAt,
  };
}

async function toEmployeeCellWithTiming(
  doc: any,
  tokens: string[],
  dependencyMeta?: { isBlocked: boolean; isReady: boolean },
) {
  const workflow = resolveStoredCellWorkflow(doc);
  const timing = await getCellWorkflowTiming(
    doc.projectId.toString(),
    doc._id.toString(),
    {
      status: normalizeStatus(doc.status || 'ready'),
      onHold: Boolean(doc.onHold),
      assignedEmployeeId: doc.assignedEmployeeId,
      workflow,
      viewWorkflow: doc.viewWorkflow,
      activityLog: doc.activityLog ?? [],
    },
  );
  return toEmployeeCell(doc, tokens, dependencyMeta, timing);
}

async function buildEmployeeTypeChecklistDetail(projectId: string, cellId: string) {
  const detail = await getCellTypeChecklistDetail(projectId, cellId);
  if (!detail) return null;

  const extension = detail.extension ?? {
    dimensionX: null,
    dimensionY: null,
    area: null,
    highestMetalUsed: '',
    virtualConnection: null,
    overallSubstrateContact: null,
    waivableDrcError: null,
  };

  return {
    ...detail,
    checklistName: detail.fileName || `${detail.cellType} Checklist`,
    isFilled: areTypeChecklistItemsFilled(detail.items),
    isExtensionFilled: isFinalCellDetailsComplete(extension),
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

      await Promise.all(
        cells.map((cell) =>
          ensureWorkLogsInitialized(
            projectId,
            cell._id.toString(),
            {
              status: cell.status,
              onHold: cell.onHold,
              assignedEmployeeId: cell.assignedEmployeeId,
              workflow: syncCellWorkflowFromViewWorkflow(normalizeViewWorkflow(cell.viewWorkflow)),
            },
            cell.activityLog ?? [],
          ),
        ),
      );

      const cellsWithMeta = await enrichAssigneeNames(
        await Promise.all(
          cells.map(async (cell) => {
            const meta = await computeDependencyMeta(projectObjectId, cell, cells);
            return toEmployeeCellWithTiming(cell, tokens, meta);
          }),
        ),
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

      const project = await assertProjectAccess(projectId, tokens, req);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      const cell = await assertProjectCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const library = await ProjectLibraryModel.findById(cell.libraryId);
      const reviews = await CellReviewModel.find({ projectId, cellId }).sort({ createdAt: -1 }).limit(20);
      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      const isAdmin = isAdminFromReq(req);
      const isTeamLead = isTeamLeadOnProject(project, tokens);

      res.json({
        project: {
          id: project._id.toString(),
          name: project.projectName,
        },
        isTeamLead,
        isAdmin,
        permissions: {
          canManageWorkflow: isAdmin || cellAssignedToTokens(cell, tokens) || isTeamLead,
          canReview: isAdmin || isTeamLead,
        },
        library: library ? toLibrary(library) : null,
        cell: await toEmployeeCellWithTiming(cell, tokens, meta),
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

      if (!(await isEmployeeAttendanceActive(tokens))) {
        res.status(403).json({ error: 'Check in to the office before updating cell workflow', requiresCheckIn: true });
        return;
      }

      const cell = await assertManageableCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
        return;
      }

      const workflow = normalizeViewWorkflow(cell.viewWorkflow);
      const prevWorkflow = syncCellWorkflowFromViewWorkflow(workflow);
      const { view, action, status } = req.body as {
        view?: 'style' | 'symbol' | 'layout' | 'schematic';
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

      if (view === 'symbol') {
        if (action === 'set_status') {
          if (!status || !['not_started', 'in_progress', 'completed'].includes(status)) {
            res.status(400).json({ error: 'Invalid status for symbol view' });
            return;
          }
          validateStatusStepForward(workflow.symbol.status, status);
          nextWorkflow = { ...nextWorkflow, symbol: { status } };
        } else if (action === 'advance_stage') {
          const current = workflow.symbol.status;
          const next = advanceSimpleViewStatus(current);
          if (!next) {
            res.status(400).json({ error: 'View is already completed' });
            return;
          }
          nextWorkflow = { ...nextWorkflow, symbol: { status: next } };
        } else {
          res.status(400).json({ error: 'Invalid action for symbol view' });
          return;
        }
      } else if (view === 'schematic' || view === 'style') {
        if (action === 'set_status') {
          if (!status || !['not_started', 'in_progress', 'completed'].includes(status)) {
            res.status(400).json({ error: 'Invalid status for schematic view' });
            return;
          }
          if (workflow.schematic.pendingReview) {
            res.status(400).json({ error: 'Cannot update schematic while review is pending' });
            return;
          }
          validateStatusStepForward(workflow.schematic.status, status);
          nextWorkflow = {
            ...nextWorkflow,
            schematic: { ...workflow.schematic, status },
          };
        } else if (action === 'advance_stage') {
          if (!canAdvanceSchematicView(workflow.schematic)) {
            res.status(400).json({ error: 'Complete the current schematic stage before advancing' });
            return;
          }
          nextWorkflow = {
            ...nextWorkflow,
            schematic: advanceSchematicView(workflow.schematic),
          };
        } else {
          res.status(400).json({ error: 'Invalid action for schematic view' });
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
      applySchematicWorkflowSync(cell, 'viewWorkflow');
      const nextCellWorkflow = syncCellWorkflowFromViewWorkflow(cell.viewWorkflow);
      if (
        (cell.status === 'ready' || cell.status === 'completed')
        && nextCellWorkflow.some((stage) => stage.status === 'in_progress')
      ) {
        cell.status = 'in_progress';
      }
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
          viewWorkflow: cell.viewWorkflow,
        },
      );
      cell.activityLog.push({
        action: 'workflow_update',
        detail: `${view}: ${action}${status ? ` → ${status}` : ''}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(await toEmployeeCellWithTiming(cell, tokens, meta));
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update workflow' });
    }
  },

  updateMyWorkflowStage: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const stageKey = paramId(req.params.stageKey);
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);
      const { status, rejectReturnTo } = req.body as {
        status?: string;
        rejectReturnTo?: 'floor_plan' | 'routing';
      };

      if (!isValidStageKey(stageKey)) {
        res.status(400).json({ error: 'Invalid workflow stage' });
        return;
      }

      if (!(await isEmployeeAttendanceActive(tokens))) {
        res.status(403).json({ error: 'Check in to the office before updating cell workflow stages', requiresCheckIn: true });
        return;
      }

      const project = await assertProjectAccess(projectId, tokens, req);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      const cell = await assertManageableCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
        return;
      }

      const nextStatus = normalizeWorkflowStageStatus(String(status || ''));
      const stageMeta = CELL_WORKFLOW_STAGES.find((s) => s.key === stageKey);
      const prevWorkflow = normalizeCellWorkflow(cell.workflow);
      const prevStatus = prevWorkflow.find((s) => s.stageKey === stageKey)?.status ?? 'not_started';
      const actorRole = workflowActorRole(req, project, tokens);
      const result = applyWorkflowStageUpdate(prevWorkflow, stageKey, nextStatus, actorRole, {
        rejectReturnTo:
          rejectReturnTo === 'floor_plan' || rejectReturnTo === 'routing' ? rejectReturnTo : undefined,
      });
      if (!result.ok) {
        res.status(400).json({ error: result.error });
        return;
      }

      cell.workflow = result.workflow;
      applyCellWorkflowSync(cell, 'workflow');
      if (cellHasWorkflowActivity(result.workflow)) {
        if (cell.status === 'ready') {
          cell.status = 'in_progress';
        }
      } else if (cell.status === 'in_progress') {
        cell.status = 'ready';
      }
      await syncWorkLogsFromWorkflowChange(
        projectId,
        cellId,
        prevWorkflow,
        result.workflow,
        actor,
        {
          status: cell.status,
          onHold: cell.onHold,
          assignedEmployeeId: cell.assignedEmployeeId,
          viewWorkflow: cell.viewWorkflow,
        },
      );
      cell.activityLog.push({
        action: 'workflow_update',
        detail: `${stageMeta?.label || stageKey}: ${prevStatus} → ${nextStatus}`,
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });

      await cell.save();

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(await toEmployeeCellWithTiming(cell, tokens, meta));
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update workflow stage' });
    }
  },

  updateMySchematicWorkflowStage: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const stageKey = paramId(req.params.stageKey);
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);
      const { status, rejectReturnTo } = req.body as {
        status?: string;
        rejectReturnTo?: 'design' | 'simulation' | 'data_collection';
      };

      if (!isValidSchematicStageKey(stageKey)) {
        res.status(400).json({ error: 'Invalid schematic workflow stage' });
        return;
      }

      if (!(await isEmployeeAttendanceActive(tokens))) {
        res.status(403).json({ error: 'Check in to the office before updating cell workflow stages', requiresCheckIn: true });
        return;
      }

      const project = await assertProjectAccess(projectId, tokens, req);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      const cell = await assertManageableCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
        return;
      }

      const nextStatus = normalizeWorkflowStageStatus(String(status || ''));
      const stageMeta = SCHEMATIC_WORKFLOW_STAGES.find((s) => s.key === stageKey);
      const prevWorkflow = normalizeSchematicWorkflow(cell.schematicWorkflow);
      const prevStatus = prevWorkflow.find((s) => s.stageKey === stageKey)?.status ?? 'not_started';
      const actorRole = workflowActorRole(req, project, tokens);
      const result = applySchematicWorkflowStageUpdate(prevWorkflow, stageKey, nextStatus, actorRole, {
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
      const layoutActive = cellHasWorkflowActivity(normalizeCellWorkflow(cell.workflow));
      const schematicActive = schematicHasWorkflowActivity(result.workflow);
      if (layoutActive || schematicActive) {
        if (cell.status === 'ready') {
          cell.status = 'in_progress';
        }
      } else if (cell.status === 'in_progress') {
        cell.status = 'ready';
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
      res.json(await toEmployeeCellWithTiming(cell, tokens, meta));
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update schematic workflow stage' });
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
          const meta = await computeDependencyMeta(projectObjectId, cell, cells);
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

      const cell = await assertManageableCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
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

      const prevWorkflow = syncCellWorkflowFromViewWorkflow(workflow);
      const nextWorkflow = markReviewPending(workflow, reviewPoint);
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
          viewWorkflow: cell.viewWorkflow,
        },
      );

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
      res.status(201).json({
        cell: await toEmployeeCellWithTiming(cell, tokens, meta),
        review: toReview(review),
      });
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

      const cell = await assertProjectCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const detail = await buildEmployeeTypeChecklistDetail(projectId, cellId);
      if (!detail) {
        res.status(404).json({ error: 'Cell not found in this project' });
        return;
      }

      res.json(detail);
    } catch (err) {
      console.error('[employee-projects] cell checklist', err);
      res.status(500).json({ error: 'Failed to fetch cell checklist' });
    }
  },

  updateMyTypeChecklistResponse: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const itemIndex = Number(paramId(req.params.itemIndex));
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);
      const { response, comment } = req.body as { response?: string; comment?: string };

      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        res.status(400).json({ error: 'Invalid item index' });
        return;
      }

      if (!response || !isValidTypeChecklistAnswer(response)) {
        res.status(400).json({ error: 'Response must be yes, no, or not_applicable' });
        return;
      }

      const trimmedComment = String(comment ?? '').trim();
      if (commentRequiredForAnswer(response) && !trimmedComment) {
        res.status(400).json({ error: 'Comment is required for No and Not applicable' });
        return;
      }

      const cell = await assertManageableCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
        return;
      }

      const context = await resolveCellContext(projectId, cellId);
      if (!context) {
        res.status(404).json({ error: 'Cell not found in this project' });
        return;
      }

      const parsedItems = await getTypeChecklistItems(context.projectObjectId, context.cellType);
      const item = parsedItems.find((entry) => entry.itemIndex === itemIndex);
      if (!item) {
        res.status(404).json({ error: 'Checklist item not found for this cell type' });
        return;
      }

      await CellTypeChecklistResponseModel.findOneAndUpdate(
        { cellId: context.cellObjectId, itemIndex },
        {
          projectId: context.projectObjectId,
          cellId: context.cellObjectId,
          cellType: context.cellType,
          itemIndex,
          itemName: item.itemName,
          response,
          comment: commentRequiredForAnswer(response) ? trimmedComment : '',
          answeredById: actor.userId,
          answeredByName: actor.userName,
          answeredAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      await markCellTouched(projectId, cellId);

      const detail = await buildEmployeeTypeChecklistDetail(projectId, cellId);
      res.json(detail);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to save checklist response' });
    }
  },

  updateMyCustomTypeChecklistResponse: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const customItemId = paramId(req.params.customItemId);
      const tokens = await getAssignmentTokens(req);
      const { response, comment } = req.body as { response?: string; comment?: string };

      if (!response || !isValidTypeChecklistAnswer(response)) {
        res.status(400).json({ error: 'Response must be yes, no, or not_applicable' });
        return;
      }

      const trimmedComment = String(comment ?? '').trim();
      if (commentRequiredForAnswer(response) && !trimmedComment) {
        res.status(400).json({ error: 'Comment is required for No and Not applicable' });
        return;
      }

      const cell = await assertManageableCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
        return;
      }

      const item = await updateCustomChecklistItemResponse(
        projectId,
        cellId,
        customItemId,
        {
          response,
          comment: commentRequiredForAnswer(response) ? trimmedComment : '',
        },
        actorFromReq(req),
      );

      if (!item) {
        res.status(404).json({ error: 'Custom checklist question not found' });
        return;
      }

      await markCellTouched(projectId, cellId);

      const detail = await buildEmployeeTypeChecklistDetail(projectId, cellId);
      res.json(detail);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to save checklist response' });
    }
  },

  updateMyTypeChecklistExtension: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);

      const cell = await assertManageableCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
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
        if (raw === null || raw === '') payload.dimensionX = null;
        else {
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
        if (raw === null || raw === '') payload.dimensionY = null;
        else {
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
          if (value === null || value === '') payload[key] = null;
          else if (!isValidChecklistYesNo(String(value))) {
            res.status(400).json({ error: `${key} must be yes or no` });
            return;
          } else {
            payload[key] = value;
          }
        }
      }

      const extension = await updateCellChecklistExtension(projectId, cellId, payload);
      if (!extension) {
        res.status(404).json({ error: 'Cell not found in this project' });
        return;
      }

      await markCellTouched(projectId, cellId);

      const detail = await buildEmployeeTypeChecklistDetail(projectId, cellId);
      res.json(detail);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to save final cell details' });
    }
  },

  updateMyCellChecklistExtension: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);

      const cell = await assertManageableCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
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
      const extension = await updateCellChecklistExtension(projectId, cellId, payload);
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

      const cell = await assertManageableCell(projectId, cellId, tokens);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
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
      const assignment = await resolveCellCreateAssignment(req, project, tokens, {
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
      const resolvedBaseHours = resolveBaseHoursInput(baseHours, estimatedEffort, normalizedComplexity);
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
      const meta = await computeDependencyMeta(project._id, cell);
      const createdByEmployee = !isTeamLeadOnProject(project, tokens);

      if (createdByEmployee && !assignment.assignedEmployeeId) {
        void notifyCellCreatedUnassigned({
          projectId: project._id.toString(),
          cellId: cell._id.toString(),
          projectName: project.projectName || 'Project',
          cellName: cell.name,
          libraryName: library.name,
          createdByName: actor.userName,
          teamLeadName: project.teamLead,
        }).catch((notifyErr) => {
          console.error('[employee-projects] unassigned cell notification failed:', notifyErr);
        });
      } else if (assignment.assignedEmployeeId) {
        void notifyEmployeeCellAssigned({
          projectId: project._id.toString(),
          cellId: cell._id.toString(),
          projectName: project.projectName || 'Project',
          cellName: cell.name,
          assignedEmployeeId: assignment.assignedEmployeeId,
          assignedEmployeeName: assignment.assignedEmployeeName,
          assignedByName: actor.userName,
        }).catch((notifyErr) => {
          console.error('[employee-projects] cell assignment notification failed:', notifyErr);
        });
      }

      res.status(201).json(await toEmployeeCellWithTiming(cell, tokens, meta));
    } catch (err) {
      console.error('[employee-projects] createCell', err);
      res.status(500).json({ error: 'Failed to create cell' });
    }
  },

  assignProjectCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);
      const project = await assertTeamLeadAccess(projectId, tokens);
      if (!project) {
        res.status(403).json({ error: 'Only the project team lead can assign cells' });
        return;
      }

      const cell = await ProjectCellModel.findOne({ _id: cellId, projectId: project._id });
      if (!cell) {
        res.status(404).json({ error: 'Cell not found' });
        return;
      }

      const { assignedEmployeeId, assignedEmployeeName } = req.body as {
        assignedEmployeeId?: string;
        assignedEmployeeName?: string;
      };
      const assignment = await resolveCellAssigneeUpdate(project, {
        assignedEmployeeId,
        assignedEmployeeName,
      });
      if ('error' in assignment) {
        res.status(400).json({ error: assignment.error });
        return;
      }

      const previousAssignee = cell.assignedEmployeeId?.trim() || '';
      const actor = actorFromReq(req);
      cell.assignedEmployeeId = assignment.assignedEmployeeId;
      cell.assignedEmployeeName = assignment.assignedEmployeeName;
      cell.activityLog.push({
        action: 'assigned',
        detail: assignment.assignedEmployeeName
          ? `Assigned to ${assignment.assignedEmployeeName}`
          : 'Unassigned',
        userId: actor.userId,
        userName: actor.userName,
        at: new Date(),
      });
      await cell.save();

      const nextAssignee = assignment.assignedEmployeeId?.trim() || '';
      if (nextAssignee && nextAssignee !== previousAssignee) {
        void notifyEmployeeCellAssigned({
          projectId: project._id.toString(),
          cellId: cell._id.toString(),
          projectName: project.projectName || 'Project',
          cellName: cell.name,
          assignedEmployeeId: nextAssignee,
          assignedEmployeeName: assignment.assignedEmployeeName,
          assignedByName: actor.userName,
        }).catch((notifyErr) => {
          console.error('[employee-projects] cell assignment notification failed:', notifyErr);
        });
      }

      const meta = await computeDependencyMeta(project._id, cell);
      res.json(toEmployeeCell(cell, tokens, meta));
    } catch (err) {
      console.error('[employee-projects] assignProjectCell', err);
      res.status(500).json({ error: 'Failed to assign cell' });
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
      const project = await assertTeamLeadAccess(projectId, tokens, req);
      if (!project) {
        res.status(403).json({ error: 'Only the project team lead or admin can resolve reviews' });
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
      const prevWorkflow = syncCellWorkflowFromViewWorkflow(workflow);
      const nextWorkflow =
        outcome === 'approved'
          ? applyReviewApproval(workflow, reviewPoint)
          : applyReviewRejection(workflow, reviewPoint, returnToStage!);

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
          viewWorkflow: cell.viewWorkflow,
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
          authorRole: 'Employee',
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

      await syncProductiveSessionsForCell(
        projectId,
        cellId,
        {
          status: cell.status,
          onHold: cell.onHold,
          assignedEmployeeId: cell.assignedEmployeeId,
          workflow: normalizeCellWorkflow(cell.workflow ?? []),
          viewWorkflow: cell.viewWorkflow,
        },
        actor,
      );

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
      res.json({
        cell: await toEmployeeCellWithTiming(cell, tokens, meta),
        review: toReview(review),
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to resolve review' });
    }
  },

  completeMyCell: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);

      const cell = await assertManageableCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
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

      cell.status = 'completed';
      const completedAt = new Date();
      cell.activityLog.push({
        action: 'completed',
        detail: `Marked completed by ${actor.userName}`,
        userId: actor.userId,
        userName: actor.userName,
        at: completedAt,
      });
      await closeProductiveSessionsForCell(
        projectId,
        cellId,
        WORK_SESSION_REASONS.INACTIVE,
        actor,
        completedAt,
      );
      await cell.save();

      await syncProjectProgress(new Types.ObjectId(projectId));

      const openReviews = await CellReviewModel.find({ cellId, status: 'open' });
      for (const review of openReviews) {
        review.status = 'resolved';
        await review.save();
      }

      const meta = await computeDependencyMeta(new Types.ObjectId(projectId), cell);
      res.json(await toEmployeeCellWithTiming(cell, tokens, meta));
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to complete cell' });
    }
  },

  setMyCellHold: async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = paramId(req.params.projectId);
      const cellId = paramId(req.params.cellId);
      const tokens = await getAssignmentTokens(req);
      const actor = actorFromReq(req);
      const { hold, reason } = req.body as { hold?: boolean; reason?: string };

      const cell = await assertManageableCell(projectId, cellId, tokens, req);
      if (!cell) {
        res.status(404).json({ error: 'Cell not found or you cannot manage this cell' });
        return;
      }

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
      res.json(await toEmployeeCellWithTiming(cell, tokens, meta));
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to update hold status' });
    }
  },
};
