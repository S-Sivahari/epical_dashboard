import { Types } from 'mongoose';
import { getDB } from '../config/db';
import { CellWorkflowWorkLogModel } from '../models/CellWorkflowWorkLog';
import { EmployeeAttendanceModel } from '../models/EmployeeAttendance';
import { ProjectCellModel } from '../models/ProjectCell';
import { TimesheetModel } from '../models/Timesheet';
import {
  normalizeCellWorkflow,
  type CellWorkflowStage,
  type CellWorkflowStageKey,
} from '../utils/cellWorkflow';
import { buildAssignmentIdentityTokens } from '../utils/assignedTaskSync';
import { WORK_SESSION_REASONS, type WorkSessionReason, isCountableWorkSession } from '../utils/workSessionReason';

type WorkflowActor = {
  userId: string;
  userName: string;
  role?: 'Admin' | 'Employee';
  email?: string;
};

function toObjectId(value: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

function logWorkedMs(checkInTime: Date, checkOutTime: Date): number {
  return Math.max(0, checkOutTime.getTime() - checkInTime.getTime());
}

export function getActiveWorkStage(workflow: CellWorkflowStage[]): CellWorkflowStage | null {
  return workflow.find((stage) => stage.status === 'in_progress') ?? null;
}

export function isCellWaitingForReview(workflow: CellWorkflowStage[]): boolean {
  return workflow.some((stage) => stage.status === 'pending_review');
}

async function getAssigneeIdentityTokens(assignedEmployeeId?: string | null): Promise<string[]> {
  const id = String(assignedEmployeeId ?? '').trim();
  if (!id) return [];

  const db = getDB();
  const employee = await db.collection('employees').findOne(
    {
      $or: [
        { id },
        { employeeId: id },
        { employeeId: id.toUpperCase() },
      ],
    },
    { projection: { id: 1, employeeId: 1, email: 1, firstName: 1, middleName: 1, lastName: 1 } },
  );

  return buildAssignmentIdentityTokens({ id, employeeId: id }, employee as Parameters<typeof buildAssignmentIdentityTokens>[1]);
}

export async function isEmployeeCheckedInToProject(
  identityTokens: string[],
  projectId: string,
): Promise<boolean> {
  if (!identityTokens.length) return false;

  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId) return false;

  const hasOpenAttendance = await EmployeeAttendanceModel.exists({
    employeeId: { $in: identityTokens },
    $or: [{ checkOutTime: { $exists: false } }, { checkOutTime: null }],
    sessionStatus: { $in: ['Active', 'Paused'] },
  });
  if (!hasOpenAttendance) return false;

  const activeTask = await TimesheetModel.exists({
    projectId: projectObjectId,
    taskStatus: 'In Progress',
    $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
    $and: [
      {
        $or: [
          { employeeId: { $in: identityTokens } },
          { employee: { $in: identityTokens } },
        ],
      },
    ],
  });

  return Boolean(activeTask);
}

export async function canAccumulateProductiveTime(
  cell: {
    status?: string;
    onHold?: boolean;
    assignedEmployeeId?: string;
    workflow?: CellWorkflowStage[];
  },
  projectId: string,
): Promise<boolean> {
  if (cell.status !== 'in_progress') return false;
  if (cell.onHold) return false;

  const workflow = normalizeCellWorkflow(cell.workflow ?? []);
  if (!getActiveWorkStage(workflow)) return false;
  if (isCellWaitingForReview(workflow)) return false;

  const tokens = await getAssigneeIdentityTokens(cell.assignedEmployeeId);
  if (!tokens.length) return false;

  return isEmployeeCheckedInToProject(tokens, projectId);
}

async function closeOpenWorkingLogs(
  projectId: string,
  cellId: string,
  at: Date,
  reason: WorkSessionReason,
  actor?: WorkflowActor,
  stageKey?: CellWorkflowStageKey,
) {
  const projectObjectId = toObjectId(projectId);
  const cellObjectId = toObjectId(cellId);
  if (!projectObjectId || !cellObjectId) return;

  const query: Record<string, unknown> = {
    projectId: projectObjectId,
    cellId: cellObjectId,
    checkOutTime: null,
    reason: WORK_SESSION_REASONS.WORKING,
  };
  if (stageKey) query.stageKey = stageKey;

  const openLogs = await CellWorkflowWorkLogModel.find(query);
  await Promise.all(
    openLogs.map(async (log) => {
      log.checkOutTime = at;
      log.latestActivityTime = at;
      log.workedMs = logWorkedMs(log.checkInTime, at);
      if (actor) {
        log.closedById = actor.userId;
        log.closedByName = actor.userName;
      }
      await log.save();
    }),
  );
}

async function openWorkingLog(
  projectId: string,
  cellId: string,
  stageKey: CellWorkflowStageKey,
  at: Date,
  actor?: WorkflowActor,
  employeeId?: string,
) {
  const projectObjectId = toObjectId(projectId);
  const cellObjectId = toObjectId(cellId);
  if (!projectObjectId || !cellObjectId) return;

  const existingOpen = await CellWorkflowWorkLogModel.findOne({
    projectId: projectObjectId,
    cellId: cellObjectId,
    stageKey,
    checkOutTime: null,
    reason: WORK_SESSION_REASONS.WORKING,
  });
  if (existingOpen) {
    existingOpen.latestActivityTime = at;
    await existingOpen.save();
    return;
  }

  await CellWorkflowWorkLogModel.create({
    projectId: projectObjectId,
    cellId: cellObjectId,
    stageKey,
    checkInTime: at,
    checkOutTime: null,
    stageStartTime: at,
    stageCompletionTime: null,
    latestActivityTime: at,
    workedMs: 0,
    reason: WORK_SESSION_REASONS.WORKING,
    employeeId,
    openedById: actor?.userId,
    openedByName: actor?.userName,
  });
}

export async function syncProductiveSessionsForCell(
  projectId: string,
  cellId: string,
  cell: {
    status?: string;
    onHold?: boolean;
    assignedEmployeeId?: string;
    workflow?: CellWorkflowStage[];
  },
  actor?: WorkflowActor,
  at = new Date(),
): Promise<void> {
  const workflow = normalizeCellWorkflow(cell.workflow ?? []);
  const activeStage = getActiveWorkStage(workflow);
  const canWork = await canAccumulateProductiveTime(cell, projectId);

  if (!canWork || !activeStage) {
    const reason = cell.onHold
      ? WORK_SESSION_REASONS.HOLD
      : isCellWaitingForReview(workflow)
        ? WORK_SESSION_REASONS.PENDING_REVIEW
        : cell.status === 'completed' || cell.status === 'ready'
          ? WORK_SESSION_REASONS.INACTIVE
          : WORK_SESSION_REASONS.INACTIVE;
    await closeOpenWorkingLogs(projectId, cellId, at, reason, actor);
    return;
  }

  for (const stage of workflow) {
    if (stage.stageKey !== activeStage.stageKey) {
      await closeOpenWorkingLogs(projectId, cellId, at, WORK_SESSION_REASONS.INACTIVE, actor, stage.stageKey);
    }
  }

  await openWorkingLog(
    projectId,
    cellId,
    activeStage.stageKey,
    at,
    actor,
    cell.assignedEmployeeId,
  );
}

export async function closeProductiveSessionsForCell(
  projectId: string,
  cellId: string,
  reason: WorkSessionReason,
  actor?: WorkflowActor,
  at = new Date(),
): Promise<void> {
  await closeOpenWorkingLogs(projectId, cellId, at, reason, actor);
}

export async function closeProductiveSessionsForProjectEmployee(
  projectId: string,
  identityTokens: string[],
  reason: WorkSessionReason,
  at = new Date(),
): Promise<void> {
  if (!identityTokens.length) return;
  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId) return;

  const cells = await ProjectCellModel.find({
    projectId: projectObjectId,
    assignedEmployeeId: { $in: identityTokens },
    status: 'in_progress',
  }).select('_id');

  await Promise.all(
    cells.map((cell) => closeOpenWorkingLogs(projectId, cell._id.toString(), at, reason)),
  );
}

export async function resumeProductiveSessionsForProjectEmployee(
  projectId: string,
  identityTokens: string[],
  actor?: WorkflowActor,
  at = new Date(),
): Promise<void> {
  if (!identityTokens.length) return;
  const checkedIn = await isEmployeeCheckedInToProject(identityTokens, projectId);
  if (!checkedIn) return;

  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId) return;

  const cells = await ProjectCellModel.find({
    projectId: projectObjectId,
    assignedEmployeeId: { $in: identityTokens },
    status: 'in_progress',
    onHold: { $ne: true },
  });

  await Promise.all(
    cells.map((cell) =>
      syncProductiveSessionsForCell(projectId, cell._id.toString(), cell, actor, at),
    ),
  );
}

export async function closeProductiveSessionsForEmployee(
  identityTokens: string[],
  reason: WorkSessionReason,
  at = new Date(),
): Promise<void> {
  if (!identityTokens.length) return;

  const openTasks = await TimesheetModel.find({
    taskStatus: { $in: ['In Progress', 'Paused', 'Session Incomplete'] },
    $or: [{ logoutTime: { $exists: false } }, { logoutTime: null }],
    $and: [
      {
        $or: [
          { employeeId: { $in: identityTokens } },
          { employee: { $in: identityTokens } },
        ],
      },
    ],
  }).select('projectId');

  const projectIds = [...new Set(openTasks.map((task) => task.projectId.toString()))];
  await Promise.all(
    projectIds.map((projectId) =>
      closeProductiveSessionsForProjectEmployee(projectId, identityTokens, reason, at),
    ),
  );
}

export async function syncProductiveSessionsFromWorkflowChange(
  projectId: string,
  cellId: string,
  prevWorkflow: CellWorkflowStage[],
  nextWorkflow: CellWorkflowStage[],
  cell: {
    status?: string;
    onHold?: boolean;
    assignedEmployeeId?: string;
    workflow?: CellWorkflowStage[];
  },
  actor?: WorkflowActor,
  at = new Date(),
): Promise<void> {
  for (const stage of nextWorkflow) {
    const prevStatus = prevWorkflow.find((item) => item.stageKey === stage.stageKey)?.status ?? 'not_started';
    if (prevStatus === stage.status) continue;

    if (prevStatus === 'in_progress' && stage.status !== 'in_progress') {
      let reason: WorkSessionReason = WORK_SESSION_REASONS.INACTIVE;
      if (stage.status === 'pending_review') reason = WORK_SESSION_REASONS.PENDING_REVIEW;
      if (stage.status === 'approved') reason = WORK_SESSION_REASONS.PENDING_APPROVAL;
      if (stage.status === 'rejected') reason = WORK_SESSION_REASONS.REJECTED_WAITING;
      await closeOpenWorkingLogs(projectId, cellId, at, reason, actor, stage.stageKey);
    }
  }

  await syncProductiveSessionsForCell(projectId, cellId, { ...cell, workflow: nextWorkflow }, actor, at);
}

export function filterCountableLogs<T extends { reason?: string | null }>(logs: T[]): T[] {
  return logs.filter((log) => isCountableWorkSession(log.reason));
}

export { WORK_SESSION_REASONS };
