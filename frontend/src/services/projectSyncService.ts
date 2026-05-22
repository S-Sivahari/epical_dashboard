import api from './api';

export interface ProjectSyncPayload {
  id: string;
  name: string;
  status: 'Active' | 'Completed' | 'Rejected';
  completedTasks?: number;
  totalTasks?: number;
  completionPercentage?: number;
}

export interface TaskWorkflowResponse {
  timesheet: Record<string, unknown>;
  project: ProjectSyncPayload | null;
}

export async function syncProjectStatus(projectId: string): Promise<ProjectSyncPayload> {
  const response = await api.patch(`/projects/${projectId}/sync-status`);
  return response.data;
}

export async function approveProjectTask(
  projectId: string,
  timesheetId: string,
  options?: { applyCorrection?: boolean }
): Promise<TaskWorkflowResponse> {
  const response = await api.patch(`/projects/${projectId}/task-approve`, {
    timesheetId,
    applyCorrection: options?.applyCorrection,
  });
  return response.data;
}

export async function completeProjectTask(
  projectId: string,
  timesheetId: string,
  options?: { applyCorrection?: boolean }
): Promise<TaskWorkflowResponse> {
  const response = await api.patch(`/projects/${projectId}/task-complete`, {
    timesheetId,
    applyCorrection: options?.applyCorrection,
  });
  return response.data;
}

export async function overrideTimesheetLog(
  timesheetId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await api.patch(`/timesheets/${timesheetId}/override`, payload);
  return response.data;
}

export async function fetchProjectTimesheets(
  projectId: string
): Promise<Record<string, unknown>[]> {
  const response = await api.get('/timesheets', {
    params: { projectId },
  });
  return response.data || [];
}
