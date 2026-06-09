import api from '@/services/api'
import type {
  CellReview,
  CellWorkflowStageKey,
  DependencyGraph,
  LayoutStage,
  ProjectCell,
  ProjectLibrary,
  WorkflowStageStatus,
  WorkspaceSummary,
} from '@/types/projectWorkspace'

export async function fetchWorkspaceSummary(projectId: string) {
  const { data } = await api.get<WorkspaceSummary>(`/projects/${projectId}/workspace`)
  return data
}

export async function fetchDependencyGraph(projectId: string) {
  const { data } = await api.get<DependencyGraph>(`/projects/${projectId}/dependency-graph`)
  return data
}

export async function createLibrary(projectId: string, payload: { name: string; description?: string }) {
  const { data } = await api.post<ProjectLibrary>(`/projects/${projectId}/libraries`, payload)
  return data
}

export async function updateLibrary(projectId: string, libraryId: string, payload: { name?: string; description?: string }) {
  const { data } = await api.put<ProjectLibrary>(`/projects/${projectId}/libraries/${libraryId}`, payload)
  return data
}

export async function deleteLibrary(projectId: string, libraryId: string) {
  await api.delete(`/projects/${projectId}/libraries/${libraryId}`)
}

export async function createCell(
  projectId: string,
  libraryId: string,
  payload: Partial<ProjectCell> & { name: string },
) {
  const { data } = await api.post<ProjectCell>(`/projects/${projectId}/libraries/${libraryId}/cells`, payload)
  return data
}

export async function updateCell(projectId: string, cellId: string, payload: Partial<ProjectCell>) {
  const { data } = await api.put<ProjectCell>(`/projects/${projectId}/cells/${cellId}`, payload)
  return data
}

export async function deleteCell(projectId: string, cellId: string) {
  await api.delete(`/projects/${projectId}/cells/${cellId}`)
}

export async function updateCellStatus(projectId: string, cellId: string, status: string) {
  const { data } = await api.patch<ProjectCell>(`/projects/${projectId}/cells/${cellId}/status`, { status })
  return data
}

export async function updateWorkflowStage(
  projectId: string,
  cellId: string,
  stageKey: CellWorkflowStageKey,
  status: WorkflowStageStatus,
  options?: { rejectReturnTo?: 'floor_plan' | 'routing' },
) {
  const { data } = await api.patch<ProjectCell>(
    `/projects/${projectId}/cells/${cellId}/workflow/${stageKey}`,
    { status, ...options },
  )
  return data
}

export async function completeCell(projectId: string, cellId: string) {
  const { data } = await api.patch<ProjectCell>(`/projects/${projectId}/cells/${cellId}/complete`)
  return data
}

export async function fetchCellReviews(projectId: string, cellId: string) {
  const { data } = await api.get<CellReview[]>(`/projects/${projectId}/cells/${cellId}/reviews`)
  return data
}

export async function createCellReview(projectId: string, cellId: string, comment: string) {
  const { data } = await api.post<CellReview>(`/projects/${projectId}/cells/${cellId}/reviews`, { comment })
  return data
}

export async function addReviewMessage(projectId: string, cellId: string, reviewId: string, body: string) {
  const { data } = await api.post<CellReview>(
    `/projects/${projectId}/cells/${cellId}/reviews/${reviewId}/messages`,
    { body },
  )
  return data
}

export async function resolveCellReview(
  projectId: string,
  cellId: string,
  reviewId: string,
  payload: { outcome: 'approved' | 'rejected'; returnToStage?: LayoutStage; comment?: string },
) {
  const { data } = await api.patch<{ cell: ProjectCell; review: CellReview }>(
    `/projects/${projectId}/cells/${cellId}/reviews/${reviewId}/resolve`,
    payload,
  )
  return data
}
