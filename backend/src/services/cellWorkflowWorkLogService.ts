import { Types } from 'mongoose';
import { CellWorkflowWorkLogModel } from '../models/CellWorkflowWorkLog';
import type { CellActivityEntry } from '../models/ProjectCell';
import {
  CELL_WORKFLOW_STAGES,
  type CellWorkflowStage,
  type CellWorkflowStageKey,
  type WorkflowStageStatus,
} from '../utils/cellWorkflow';
import { formatWorkflowDurationFromMs } from '../utils/durationFormat';
import { WORK_SESSION_REASONS } from '../utils/workSessionReason';
import { isCountableWorkSession } from '../utils/workSessionReason';
import {
  canAccumulateProductiveTime,
  filterCountableLogs,
  syncProductiveSessionsForCell,
  syncProductiveSessionsFromWorkflowChange,
} from './productiveTimeService';
import { normalizeCellWorkflow } from '../utils/cellWorkflow';

export interface CellWorkflowDuration {
  totalMs: number;
  formatted: string;
  isActive: boolean;
  wasEverCompleted: boolean;
  wasReopened: boolean;
}

export interface StageWorkflowTiming {
  stageKey: CellWorkflowStageKey;
  checkInTime: string | null;
  checkOutTime: string | null;
  stageStartTime: string | null;
  stageCompletionTime: string | null;
  latestActivityTime: string | null;
  totalMs: number;
  formattedTotal: string;
  isActive: boolean;
}

export interface CellWorkflowTiming {
  stages: StageWorkflowTiming[];
  latestActivityTime: string | null;
  workflowCompletionTime: string | null;
  workflowDuration: CellWorkflowDuration;
}

type WorkflowActor = {
  userId: string;
  userName: string;
  role?: 'Admin' | 'Employee';
  email?: string;
};

function toObjectId(value: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

function isActiveStageStatus(status: WorkflowStageStatus): boolean {
  return status === 'in_progress';
}

function isCompleteStageStatus(status: WorkflowStageStatus): boolean {
  return status === 'completed' || status === 'approved';
}

function logWorkedMs(checkInTime: Date, checkOutTime: Date): number {
  return Math.max(0, checkOutTime.getTime() - checkInTime.getTime());
}

function toIso(value?: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function wasCellEverCompleted(
  cellStatus: string,
  activityLog: CellActivityEntry[],
): boolean {
  if (cellStatus === 'completed') return true;
  return (activityLog ?? []).some((entry) => entry.action === 'completed');
}

function computeDurationFromLogs(
  logs: Array<{
    checkInTime: Date;
    checkOutTime?: Date | null;
    workedMs?: number;
    reason?: string | null;
  }>,
  cellStatus: string,
  activityLog: CellActivityEntry[],
  now = new Date(),
  onHold = false,
  canAccumulateLive = false,
): CellWorkflowDuration {
  let totalMs = 0;
  let hasOpen = false;
  const countableLogs = filterCountableLogs(logs);

  for (const log of countableLogs) {
    if (log.checkOutTime) {
      totalMs += log.workedMs && log.workedMs > 0
        ? log.workedMs
        : logWorkedMs(log.checkInTime, log.checkOutTime);
    } else if (isCountableWorkSession(log.reason)) {
      hasOpen = true;
      if (canAccumulateLive) {
        totalMs += logWorkedMs(log.checkInTime, now);
      }
    }
  }

  const wasEverCompleted = wasCellEverCompleted(cellStatus, activityLog);
  const isActive = cellStatus === 'in_progress'
    && !onHold
    && canAccumulateLive
    && hasOpen;

  return {
    totalMs,
    formatted: formatWorkflowDurationFromMs(totalMs),
    isActive,
    wasEverCompleted,
    wasReopened: wasEverCompleted && cellStatus !== 'completed',
  };
}

function buildStageTiming(
  stageKey: CellWorkflowStageKey,
  logs: Array<{
    stageKey: string;
    checkInTime: Date;
    checkOutTime?: Date | null;
    stageStartTime: Date;
    stageCompletionTime?: Date | null;
    latestActivityTime: Date;
    workedMs?: number;
    reason?: string | null;
  }>,
  stageStatus: WorkflowStageStatus,
  now = new Date(),
  canAccumulateLive = false,
): StageWorkflowTiming {
  const stageLogs = filterCountableLogs(logs.filter((log) => log.stageKey === stageKey));
  let totalMs = 0;
  let openLog: (typeof stageLogs)[number] | null = null;

  for (const log of stageLogs) {
    if (!log.checkOutTime) {
      openLog = log;
      if (canAccumulateLive) {
        totalMs += logWorkedMs(log.checkInTime, now);
      }
      continue;
    }
    totalMs += log.workedMs && log.workedMs > 0
      ? log.workedMs
      : logWorkedMs(log.checkInTime, log.checkOutTime);
  }

  const firstLog = stageLogs[0] ?? null;
  const latestLog = stageLogs.reduce<(typeof stageLogs)[number] | null>((latest, log) => {
    if (!latest) return log;
    return log.latestActivityTime > latest.latestActivityTime ? log : latest;
  }, null);

  const completionLog = stageLogs.find((log) => log.stageCompletionTime) ?? null;

  return {
    stageKey,
    checkInTime: toIso(openLog?.checkInTime ?? (isActiveStageStatus(stageStatus) ? latestLog?.checkInTime : null)),
    checkOutTime: toIso(
      !openLog && isCompleteStageStatus(stageStatus)
        ? completionLog?.checkOutTime ?? latestLog?.checkOutTime ?? null
        : null,
    ),
    stageStartTime: toIso(firstLog?.stageStartTime ?? null),
    stageCompletionTime: toIso(completionLog?.stageCompletionTime ?? null),
    latestActivityTime: toIso(latestLog?.latestActivityTime ?? null),
    totalMs,
    formattedTotal: formatWorkflowDurationFromMs(totalMs),
    isActive: Boolean(openLog) && canAccumulateLive,
  };
}

function buildCellWorkflowTiming(
  workflow: CellWorkflowStage[],
  logs: Array<{
    stageKey: string;
    checkInTime: Date;
    checkOutTime?: Date | null;
    stageStartTime: Date;
    stageCompletionTime?: Date | null;
    latestActivityTime: Date;
    workedMs?: number;
  }>,
  duration: CellWorkflowDuration,
  cellStatus: string,
  activityLog: CellActivityEntry[],
  now = new Date(),
  canAccumulateLive = false,
): CellWorkflowTiming {
  const stages = CELL_WORKFLOW_STAGES.map(({ key }) => {
    const stage = workflow.find((item) => item.stageKey === key);
    return buildStageTiming(key, logs, stage?.status ?? 'not_started', now, canAccumulateLive);
  });

  const latestActivityTime = stages
    .map((stage) => stage.latestActivityTime)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] ?? null;

  const workflowCompletionTime = cellStatus === 'completed'
    ? (activityLog ?? [])
      .filter((entry) => entry.action === 'completed')
      .map((entry) => entry.at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : null;

  return {
    stages,
    latestActivityTime,
    workflowCompletionTime: workflowCompletionTime ? new Date(workflowCompletionTime).toISOString() : null,
    workflowDuration: duration,
  };
}

async function fetchLogsForCell(projectId: string, cellId: string) {
  const projectObjectId = toObjectId(projectId);
  const cellObjectId = toObjectId(cellId);
  if (!projectObjectId || !cellObjectId) return [];

  return CellWorkflowWorkLogModel.find({
    projectId: projectObjectId,
    cellId: cellObjectId,
  }).sort({ checkInTime: 1 });
}

export async function ensureWorkLogsInitialized(
  projectId: string,
  cellId: string,
  cell: {
    status?: string;
    onHold?: boolean;
    assignedEmployeeId?: string;
    workflow?: CellWorkflowStage[];
  },
  _activityLog: CellActivityEntry[] = [],
): Promise<void> {
  await syncProductiveSessionsForCell(projectId, cellId, cell);
}

export async function closeAllOpenWorkLogs(
  projectId: string,
  cellId: string,
  completedAt: Date,
): Promise<void> {
  const projectObjectId = toObjectId(projectId);
  const cellObjectId = toObjectId(cellId);
  if (!projectObjectId || !cellObjectId) return;

  const openLogs = await CellWorkflowWorkLogModel.find({
    projectId: projectObjectId,
    cellId: cellObjectId,
    checkOutTime: null,
    reason: WORK_SESSION_REASONS.WORKING,
  });

  await Promise.all(
    openLogs.map(async (log) => {
      log.checkOutTime = completedAt;
      log.latestActivityTime = completedAt;
      log.workedMs = logWorkedMs(log.checkInTime, completedAt);
      await log.save();
    }),
  );
}

export async function syncWorkLogsFromWorkflowChange(
  projectId: string,
  cellId: string,
  prevWorkflow: CellWorkflowStage[],
  nextWorkflow: CellWorkflowStage[],
  actor: WorkflowActor,
  cell?: {
    status?: string;
    onHold?: boolean;
    assignedEmployeeId?: string;
    workflow?: CellWorkflowStage[];
  },
): Promise<void> {
  await syncProductiveSessionsFromWorkflowChange(
    projectId,
    cellId,
    prevWorkflow,
    nextWorkflow,
    { ...cell, workflow: nextWorkflow },
    actor,
  );
}

type CellDurationContext = {
  status?: string;
  onHold?: boolean;
  assignedEmployeeId?: string;
  workflow?: CellWorkflowStage[];
  activityLog?: CellActivityEntry[];
};

async function resolveCanAccumulateLive(
  projectId: string,
  cell: CellDurationContext,
): Promise<boolean> {
  return canAccumulateProductiveTime(
    {
      status: cell.status,
      onHold: cell.onHold,
      assignedEmployeeId: cell.assignedEmployeeId,
      workflow: normalizeCellWorkflow(cell.workflow ?? []),
    },
    projectId,
  );
}

export async function getCellWorkflowDuration(
  projectId: string,
  cellId: string,
  cell: CellDurationContext,
): Promise<CellWorkflowDuration> {
  const logs = await fetchLogsForCell(projectId, cellId);
  const cellStatus = cell.status || 'ready';
  const canAccumulateLive = await resolveCanAccumulateLive(projectId, cell);
  return computeDurationFromLogs(
    logs,
    cellStatus,
    cell.activityLog ?? [],
    new Date(),
    Boolean(cell.onHold),
    canAccumulateLive,
  );
}

export async function getCellWorkflowTiming(
  projectId: string,
  cellId: string,
  cell: CellDurationContext,
): Promise<CellWorkflowTiming> {
  const logs = await fetchLogsForCell(projectId, cellId);
  const workflow = normalizeCellWorkflow(cell.workflow ?? []);
  const cellStatus = cell.status || 'ready';
  const canAccumulateLive = await resolveCanAccumulateLive(projectId, cell);
  const duration = computeDurationFromLogs(
    logs,
    cellStatus,
    cell.activityLog ?? [],
    new Date(),
    Boolean(cell.onHold),
    canAccumulateLive,
  );
  return buildCellWorkflowTiming(
    workflow,
    logs,
    duration,
    cellStatus,
    cell.activityLog ?? [],
    new Date(),
    canAccumulateLive,
  );
}

export async function buildWorkflowDurationMap(
  projectId: string,
  cells: Array<{
    _id: Types.ObjectId | string;
    status?: string;
    activityLog?: CellActivityEntry[];
    onHold?: boolean;
    assignedEmployeeId?: string;
    workflow?: CellWorkflowStage[];
  }>,
): Promise<Map<string, CellWorkflowDuration>> {
  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId || cells.length === 0) return new Map();

  const cellIds = cells
    .map((cell) => toObjectId(String(cell._id)))
    .filter((id): id is Types.ObjectId => Boolean(id));

  const logs = await CellWorkflowWorkLogModel.find({
    projectId: projectObjectId,
    cellId: { $in: cellIds },
  }).sort({ checkInTime: 1 });

  const logsByCell = new Map<string, typeof logs>();
  for (const log of logs) {
    const key = log.cellId.toString();
    const bucket = logsByCell.get(key) ?? [];
    bucket.push(log);
    logsByCell.set(key, bucket);
  }

  const durationMap = new Map<string, CellWorkflowDuration>();
  for (const cell of cells) {
    const cellId = String(cell._id);
    const cellLogs = logsByCell.get(cellId) ?? [];
    const canAccumulateLive = await resolveCanAccumulateLive(projectId, cell);
    durationMap.set(
      cellId,
      computeDurationFromLogs(
        cellLogs,
        cell.status || 'ready',
        cell.activityLog ?? [],
        new Date(),
        Boolean(cell.onHold),
        canAccumulateLive,
      ),
    );
  }

  return durationMap;
}
