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
  role: 'Admin' | 'Employee';
};

function toObjectId(value: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

function isActiveStageStatus(status: WorkflowStageStatus): boolean {
  return status === 'in_progress' || status === 'pending_review';
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
  }>,
  cellStatus: string,
  activityLog: CellActivityEntry[],
  now = new Date(),
): CellWorkflowDuration {
  let totalMs = 0;
  let hasOpen = false;

  for (const log of logs) {
    if (log.checkOutTime) {
      totalMs += log.workedMs && log.workedMs > 0
        ? log.workedMs
        : logWorkedMs(log.checkInTime, log.checkOutTime);
    } else {
      hasOpen = true;
      totalMs += logWorkedMs(log.checkInTime, now);
    }
  }

  const wasEverCompleted = wasCellEverCompleted(cellStatus, activityLog);
  const isActive = cellStatus !== 'completed' && hasOpen;

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
  }>,
  stageStatus: WorkflowStageStatus,
  now = new Date(),
): StageWorkflowTiming {
  const stageLogs = logs.filter((log) => log.stageKey === stageKey);
  let totalMs = 0;
  let openLog: (typeof stageLogs)[number] | null = null;

  for (const log of stageLogs) {
    if (!log.checkOutTime) {
      openLog = log;
      totalMs += logWorkedMs(log.checkInTime, now);
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
  const isActive = Boolean(openLog) || (isActiveStageStatus(stageStatus) && totalMs > 0 && !completionLog);

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
    isActive: Boolean(openLog) || isActiveStageStatus(stageStatus),
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
): CellWorkflowTiming {
  const stages = CELL_WORKFLOW_STAGES.map(({ key }) => {
    const stage = workflow.find((item) => item.stageKey === key);
    return buildStageTiming(key, logs, stage?.status ?? 'not_started', now);
  });

  const latestActivityTime = stages
    .map((stage) => stage.latestActivityTime)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

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

async function openWorkLog(
  projectId: string,
  cellId: string,
  stageKey: CellWorkflowStageKey,
  at: Date,
  actor?: WorkflowActor,
) {
  const projectObjectId = toObjectId(projectId);
  const cellObjectId = toObjectId(cellId);
  if (!projectObjectId || !cellObjectId) return;

  const existingOpen = await CellWorkflowWorkLogModel.findOne({
    projectId: projectObjectId,
    cellId: cellObjectId,
    stageKey,
    checkOutTime: null,
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
    openedById: actor?.userId,
    openedByName: actor?.userName,
  });
}

async function closeWorkLog(
  projectId: string,
  cellId: string,
  stageKey: CellWorkflowStageKey,
  at: Date,
  options?: {
    actor?: WorkflowActor;
    markComplete?: boolean;
  },
) {
  const projectObjectId = toObjectId(projectId);
  const cellObjectId = toObjectId(cellId);
  if (!projectObjectId || !cellObjectId) return;

  const openLog = await CellWorkflowWorkLogModel.findOne({
    projectId: projectObjectId,
    cellId: cellObjectId,
    stageKey,
    checkOutTime: null,
  });
  if (!openLog) return;

  openLog.checkOutTime = at;
  openLog.latestActivityTime = at;
  openLog.workedMs = logWorkedMs(openLog.checkInTime, at);
  if (options?.markComplete) {
    openLog.stageCompletionTime = at;
  }
  if (options?.actor) {
    openLog.closedById = options.actor.userId;
    openLog.closedByName = options.actor.userName;
  }
  await openLog.save();
}

async function syncWorkflowStageLogs(
  projectId: string,
  cellId: string,
  workflow: CellWorkflowStage[],
  actor?: WorkflowActor,
  at = new Date(),
) {
  for (const stage of workflow) {
    if (isActiveStageStatus(stage.status)) {
      await openWorkLog(projectId, cellId, stage.stageKey, at, actor);
      continue;
    }

    if (isCompleteStageStatus(stage.status) || stage.status === 'rejected' || stage.status === 'not_started') {
      await closeWorkLog(projectId, cellId, stage.stageKey, at, {
        actor,
        markComplete: isCompleteStageStatus(stage.status),
      });
    }
  }
}

export async function ensureWorkLogsInitialized(
  projectId: string,
  cellId: string,
  workflow: CellWorkflowStage[],
  _activityLog: CellActivityEntry[] = [],
): Promise<void> {
  await syncWorkflowStageLogs(projectId, cellId, workflow);
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
): Promise<void> {
  const now = new Date();

  for (const stage of nextWorkflow) {
    const prevStatus = prevWorkflow.find((item) => item.stageKey === stage.stageKey)?.status ?? 'not_started';
    if (prevStatus === stage.status) continue;

    if (isActiveStageStatus(stage.status)) {
      await openWorkLog(projectId, cellId, stage.stageKey, now, actor);
      continue;
    }

    if (isCompleteStageStatus(stage.status) || stage.status === 'rejected' || stage.status === 'not_started') {
      await closeWorkLog(projectId, cellId, stage.stageKey, now, {
        actor,
        markComplete: isCompleteStageStatus(stage.status),
      });
    }
  }
}

export async function getCellWorkflowDuration(
  projectId: string,
  cellId: string,
  cellStatus: string,
  activityLog: CellActivityEntry[] = [],
  _workflow: CellWorkflowStage[] = [],
): Promise<CellWorkflowDuration> {
  const logs = await fetchLogsForCell(projectId, cellId);
  return computeDurationFromLogs(logs, cellStatus, activityLog);
}

export async function getCellWorkflowTiming(
  projectId: string,
  cellId: string,
  cellStatus: string,
  activityLog: CellActivityEntry[] = [],
  workflow: CellWorkflowStage[] = [],
): Promise<CellWorkflowTiming> {
  const logs = await fetchLogsForCell(projectId, cellId);
  const duration = computeDurationFromLogs(logs, cellStatus, activityLog);
  return buildCellWorkflowTiming(workflow, logs, duration, cellStatus, activityLog);
}

export async function buildWorkflowDurationMap(
  projectId: string,
  cells: Array<{ _id: Types.ObjectId | string; status?: string; activityLog?: CellActivityEntry[] }>,
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
    durationMap.set(
      cellId,
      computeDurationFromLogs(cellLogs, cell.status || 'ready', cell.activityLog ?? []),
    );
  }

  return durationMap;
}
