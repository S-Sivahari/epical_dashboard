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

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function downloadCellImportTemplate(projectId: string) {
  const { data } = await api.get(`/projects/${projectId}/cells/import-template`, {
    responseType: 'blob',
  })
  triggerBlobDownload(data, 'cell-import-template.xlsx')
}

export async function importCellsForLibrary(projectId: string, libraryId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<{ created: number; skipped: number; message: string }>(
    `/projects/${projectId}/libraries/${libraryId}/cells/import`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
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

export async function updateSchematicWorkflowStage(
  projectId: string,
  cellId: string,
  stageKey: import('@/pages/admin/Projects/schematicWorkflowUi').SchematicWorkflowStageKey,
  status: WorkflowStageStatus,
  options?: { rejectReturnTo?: 'design' | 'simulation' | 'data_collection' },
) {
  const { data } = await api.patch<ProjectCell>(
    `/projects/${projectId}/cells/${cellId}/schematic-workflow/${stageKey}`,
    { status, ...options },
  )
  return data
}

export async function setCellHold(
  projectId: string,
  cellId: string,
  payload: { hold: boolean; reason?: string },
) {
  const { data } = await api.patch<ProjectCell>(
    `/projects/${projectId}/cells/${cellId}/hold`,
    payload,
  )
  return data
}

export type CellCompletionSectionKey =
  | 'layoutDetails'
  | 'checklist'
  | 'finalCellDetails'

export type CellCompletionReadiness = {
  canComplete: boolean
  sections: Record<CellCompletionSectionKey, boolean>
  missing: string[]
}

export async function touchCell(projectId: string, cellId: string) {
  const { data } = await api.patch<ProjectCell>(`/projects/${projectId}/cells/${cellId}/touch`)
  return data
}

export async function fetchCellCompletionReadiness(projectId: string, cellId: string) {
  const { data } = await api.get<CellCompletionReadiness>(
    `/projects/${projectId}/cells/${cellId}/completion-readiness`,
  )
  return data
}

export type EffortPrediction = {
  baseHours: number
  complexityFactor: number
  estimatedHours: number
  smartEstimate: number
  avgVariance: number
  similarBlockCount: number
  confidence: 'High' | 'Low'
}

export async function fetchEffortPrediction(
  projectId: string,
  params: {
    cellType: string
    technologyNode: string
    complexity: string
    baseHours: number
    excludeCellId?: string
  },
) {
  const { data } = await api.get<EffortPrediction>(`/projects/${projectId}/effort-prediction`, { params })
  return data
}

export async function completeCell(projectId: string, cellId: string) {
  const { data } = await api.patch<ProjectCell>(`/projects/${projectId}/cells/${cellId}/complete`)
  return data
}

export async function uncompleteCell(projectId: string, cellId: string) {
  const { data } = await api.patch<ProjectCell>(`/projects/${projectId}/cells/${cellId}/uncomplete`)
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
