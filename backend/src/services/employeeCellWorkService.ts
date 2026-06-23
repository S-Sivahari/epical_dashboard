import { Types } from 'mongoose';
import { ProjectCellModel } from '../models/ProjectCell';
import {
  applyCellWorkflowSync,
  applyWorkflowStageUpdate,
  CELL_WORKFLOW_STAGES,
  isReviewStageKey,
  normalizeCellWorkflow,
  normalizeViewWorkflow,
  type CellWorkflowStage,
} from '../utils/cellWorkflow';
import {
  canAccumulateProductiveTime,
  getActiveWorkStage,
  isCellWaitingForReview,
  isEmployeeCheckedInToProject,
  syncProductiveSessionsForCell,
} from './productiveTimeService';

type WorkflowActor = {
  userId: string;
  userName: string;
  role?: 'Admin' | 'Employee';
};

export type StartableCellSummary = {
  id: string;
  name: string;
  libraryId: string;
  status: string;
  onHold: boolean;
};

function toObjectId(value: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

function cellAssignedToTokens(cell: { assignedEmployeeId?: string | null }, tokens: string[]): boolean {
  const assignee = String(cell.assignedEmployeeId ?? '').trim();
  if (!assignee) return false;
  return tokens.some((token) => token === assignee);
}

function workflowStageStatus(workflow: CellWorkflowStage[], key: string): string {
  return workflow.find((stage) => stage.stageKey === key)?.status ?? 'not_started';
}

function ensureCellReadyForWork(cell: InstanceType<typeof ProjectCellModel>): string | null {
  if (cell.status === 'completed') {
    return 'This cell is already completed';
  }
  if (cell.onHold) {
    return 'Release the cell from hold before starting work';
  }

  const workflow = normalizeCellWorkflow(cell.workflow ?? []);
  if (isCellWaitingForReview(workflow)) {
    return 'Cell work cannot start while a review is pending';
  }

  if (cell.status === 'ready') {
    cell.status = 'in_progress';
  }

  const viewWorkflow = normalizeViewWorkflow(cell.viewWorkflow);
  if (viewWorkflow.layout.pendingReview) {
    return 'Cell work cannot start while a review is pending';
  }
  if (viewWorkflow.layout.status === 'not_started') {
    cell.viewWorkflow = {
      ...viewWorkflow,
      layout: { ...viewWorkflow.layout, status: 'in_progress' },
    };
    applyCellWorkflowSync(cell, 'viewWorkflow');
  }

  let nextWorkflow = normalizeCellWorkflow(cell.workflow ?? []);
  if (!getActiveWorkStage(nextWorkflow)) {
    for (const { key } of CELL_WORKFLOW_STAGES) {
      if (isReviewStageKey(key)) continue;
      const status = workflowStageStatus(nextWorkflow, key);
      if (status !== 'not_started' && status !== 'rejected') continue;
      const result = applyWorkflowStageUpdate(nextWorkflow, key, 'in_progress', 'Employee');
      if (!result.ok) continue;
      nextWorkflow = result.workflow;
      cell.workflow = nextWorkflow;
      applyCellWorkflowSync(cell, 'workflow');
      break;
    }
  }

  if (!getActiveWorkStage(normalizeCellWorkflow(cell.workflow ?? []))) {
    return 'No workflow stage is available to start on this cell';
  }

  return null;
}

export async function listStartableCellsForProject(
  projectId: string,
  identityTokens: string[],
): Promise<StartableCellSummary[]> {
  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId || !identityTokens.length) return [];

  const cells = await ProjectCellModel.find({
    projectId: projectObjectId,
    assignedEmployeeId: { $in: identityTokens },
    status: { $in: ['ready', 'in_progress'] },
    onHold: { $ne: true },
  })
    .select({ name: 1, libraryId: 1, status: 1, onHold: 1, workflow: 1, viewWorkflow: 1 })
    .sort({ name: 1 })
    .lean();

  return cells
    .filter((cell) => {
      const workflow = normalizeCellWorkflow(cell.workflow ?? []);
      const viewWorkflow = normalizeViewWorkflow(cell.viewWorkflow);
      return !isCellWaitingForReview(workflow) && !viewWorkflow.layout.pendingReview;
    })
    .map((cell) => ({
      id: String(cell._id),
      name: cell.name,
      libraryId: String(cell.libraryId),
      status: cell.status || 'ready',
      onHold: Boolean(cell.onHold),
    }));
}

export async function beginCellWorkForEmployee(
  projectId: string,
  cellId: string,
  identityTokens: string[],
  actor: WorkflowActor,
): Promise<{ cell: InstanceType<typeof ProjectCellModel> }> {
  const projectObjectId = toObjectId(projectId);
  const cellObjectId = toObjectId(cellId);
  if (!projectObjectId || !cellObjectId) {
    throw new Error('Invalid project or cell');
  }
  if (!identityTokens.length) {
    throw new Error('Unauthorized');
  }

  const checkedIn = await isEmployeeCheckedInToProject(identityTokens, projectId);
  if (!checkedIn) {
    throw new Error('Check in to this project before starting cell work');
  }

  const cell = await ProjectCellModel.findOne({ _id: cellObjectId, projectId: projectObjectId });
  if (!cell) {
    throw new Error('Cell not found');
  }
  if (!cellAssignedToTokens(cell, identityTokens)) {
    throw new Error('You are not assigned to this cell');
  }

  const prepError = ensureCellReadyForWork(cell);
  if (prepError) {
    throw new Error(prepError);
  }

  const now = new Date();
  cell.activityLog.push({
    action: 'workflow_update',
    detail: 'Cell work started from timesheet',
    userId: actor.userId,
    userName: actor.userName,
    at: now,
  });
  await cell.save();

  await syncProductiveSessionsForCell(
    projectId,
    cellId,
    {
      status: cell.status,
      onHold: cell.onHold,
      assignedEmployeeId: cell.assignedEmployeeId,
      workflow: normalizeCellWorkflow(cell.workflow ?? []),
    },
    actor,
    now,
  );

  const canWork = await canAccumulateProductiveTime(
    {
      status: cell.status,
      onHold: cell.onHold,
      assignedEmployeeId: cell.assignedEmployeeId,
      workflow: normalizeCellWorkflow(cell.workflow ?? []),
    },
    projectId,
  );
  if (!canWork) {
    throw new Error('Cell work could not be started — check project check-in and workflow status');
  }

  return { cell };
}
