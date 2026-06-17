import { Types } from 'mongoose';
import { ProjectCellModel, type CellActivityEntry } from '../models/ProjectCell';
import { CellWorkflowWorkLogModel } from '../models/CellWorkflowWorkLog';
import {
  normalizeCellWorkflow,
  normalizeViewWorkflow,
  type CellViewWorkflow,
  type CellWorkflowStage,
} from '../utils/cellWorkflow';

export type ProjectAnalysisStatus = 'Not Started' | 'In Progress' | 'Completed';

export type ProjectAnalysisStatusKey = 'not_started' | 'in_progress' | 'completed';

const IGNORED_ACTIVITY_ACTIONS = new Set(['created']);

type CellSnapshot = {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  status?: string;
  workflow?: CellWorkflowStage[];
  viewWorkflow?: CellViewWorkflow;
  activityLog?: CellActivityEntry[];
};

type WorkLogSnapshot = {
  cellId: Types.ObjectId;
  openedById?: string;
  openedByName?: string;
  closedById?: string;
  closedByName?: string;
  checkOutTime?: Date | null;
  workedMs?: number;
};

function toStatusKey(status: ProjectAnalysisStatus): ProjectAnalysisStatusKey {
  if (status === 'Completed') return 'completed';
  if (status === 'In Progress') return 'in_progress';
  return 'not_started';
}

function hasMeaningfulActivity(activityLog: CellActivityEntry[] = []): boolean {
  return activityLog.some((entry) => !IGNORED_ACTIVITY_ACTIONS.has(entry.action));
}

function hasRealWorkLogActivity(logs: WorkLogSnapshot[]): boolean {
  return logs.some(
    (log) =>
      Boolean(log.openedById || log.openedByName || log.closedById || log.closedByName) ||
      Boolean(log.checkOutTime) ||
      (log.workedMs ?? 0) > 0,
  );
}

function hasWorkflowProgress(workflow: CellWorkflowStage[], cellStatus: string): boolean {
  if (cellStatus !== 'ready') return true;

  const normalized = normalizeCellWorkflow(workflow);
  const progressedStage = normalized.some((stage) => {
    if (stage.stageKey === 'floor_plan') {
      return (
        Boolean(stage.updatedAt) ||
        stage.status === 'completed' ||
        stage.status === 'pending_review' ||
        stage.status === 'approved'
      );
    }
    return (
      stage.status === 'in_progress' ||
      stage.status === 'completed' ||
      stage.status === 'pending_review' ||
      stage.status === 'approved'
    );
  });

  return progressedStage;
}

function hasViewWorkflowProgress(viewWorkflow: CellViewWorkflow | undefined): boolean {
  const normalized = normalizeViewWorkflow(viewWorkflow);
  if (normalized.style.status !== 'not_started') return true;
  if (normalized.symbol.status !== 'not_started') return true;
  if (normalized.layout.status !== 'not_started') return true;
  if (normalized.layout.pendingReview) return true;
  return normalized.layout.stage !== 'floor_plan';
}

export function deriveCellAnalysisStatus(
  cell: CellSnapshot,
  workLogs: WorkLogSnapshot[] = [],
): ProjectAnalysisStatus {
  const cellStatus = cell.status || 'ready';

  if (cellStatus === 'completed') {
    return 'Completed';
  }

  if (
    cellStatus === 'in_progress' ||
    hasRealWorkLogActivity(workLogs) ||
    hasMeaningfulActivity(cell.activityLog ?? []) ||
    hasWorkflowProgress(cell.workflow ?? [], cellStatus) ||
    hasViewWorkflowProgress(cell.viewWorkflow)
  ) {
    return 'In Progress';
  }

  return 'Not Started';
}

export function deriveProjectAnalysisStatus(
  cellStatuses: ProjectAnalysisStatus[],
): ProjectAnalysisStatus {
  if (cellStatuses.length === 0) return 'Not Started';
  if (cellStatuses.every((status) => status === 'Completed')) return 'Completed';
  if (cellStatuses.some((status) => status !== 'Not Started')) return 'In Progress';
  return 'Not Started';
}

export async function buildProjectAnalysisStatusMap(
  projectIds: string[],
): Promise<Map<string, ProjectAnalysisStatus>> {
  const statusMap = new Map<string, ProjectAnalysisStatus>();
  if (projectIds.length === 0) return statusMap;

  const objectIds = projectIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (objectIds.length === 0) return statusMap;

  const cells = await ProjectCellModel.find({ projectId: { $in: objectIds } })
    .select('projectId status workflow viewWorkflow activityLog')
    .lean<CellSnapshot[]>();

  const cellIds = cells.map((cell) => cell._id);
  const logsByCellId = new Map<string, WorkLogSnapshot[]>();

  if (cellIds.length > 0) {
    const logs = await CellWorkflowWorkLogModel.find({ cellId: { $in: cellIds } })
      .select('cellId openedById openedByName closedById closedByName checkOutTime workedMs')
      .lean<WorkLogSnapshot[]>();

    for (const log of logs) {
      const key = log.cellId.toString();
      const bucket = logsByCellId.get(key) ?? [];
      bucket.push(log);
      logsByCellId.set(key, bucket);
    }
  }

  const cellStatusesByProject = new Map<string, ProjectAnalysisStatus[]>();

  for (const cell of cells) {
    const projectId = cell.projectId.toString();
    const cellId = cell._id.toString();
    const cellStatus = deriveCellAnalysisStatus(cell, logsByCellId.get(cellId) ?? []);
    const bucket = cellStatusesByProject.get(projectId) ?? [];
    bucket.push(cellStatus);
    cellStatusesByProject.set(projectId, bucket);
  }

  for (const projectId of projectIds) {
    const cellStatuses = cellStatusesByProject.get(projectId) ?? [];
    statusMap.set(projectId, deriveProjectAnalysisStatus(cellStatuses));
  }

  return statusMap;
}

export async function enrichProjectsWithAnalysisStatus<T extends { id: string }>(
  projects: T[],
): Promise<Array<T & { analysisStatus: ProjectAnalysisStatus; analysisStatusKey: ProjectAnalysisStatusKey }>> {
  if (projects.length === 0) return [];

  const statusMap = await buildProjectAnalysisStatusMap(projects.map((project) => project.id));

  return projects.map((project) => {
    const analysisStatus = statusMap.get(project.id) ?? 'Not Started';
    return {
      ...project,
      analysisStatus,
      analysisStatusKey: toStatusKey(analysisStatus),
    };
  });
}
