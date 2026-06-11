import api from '@/services/api'
import { downloadWithAuth, openWithAuth } from '@/utils/downloadWithAuth'

/* ================================================================
   Types
   ================================================================ */

export type CellType = 'Block' | 'IO' | 'ESD' | 'TOP'
export type CellStage = 'floor_plan' | 'drc_1' | 'routing' | 'drc_2' | 'lvs'
export type CellStageStatus = 'in_progress' | 'for_review' | 'approved'

export interface CellAssignment {
  employeeId: string
  employeeName: string
}

export interface CellFeedback {
  authorId: string
  authorName: string
  authorRole: 'Admin' | 'Employee'
  message: string
  createdAt: string
}

export type ViewType = 'schematic' | 'symbol' | 'layout'

export interface CellView {
  fileName?: string
  mimeType?: string
  uploadedAt?: string
  uploadedBy?: string
  uploadedByName?: string
  hasFile?: boolean
}

export interface CellViews {
  schematic?: CellView
  symbol?: CellView
  layout?: CellView
}

export interface StageHistoryEntry {
  id: string
  fromStage: CellStage | null
  toStage: CellStage
  changedBy: string
  changedByName: string
  reason: string
  changedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  client: string
  technologyNode: string
  status: string
  description: string
  libraryCount: number
  cellCount?: number
  forReviewCount?: number
  completedCount?: number
  createdAt: string
  updatedAt: string
}

export interface ProjectStats {
  libraryCount: number
  cellCount: number
  inProgress: number
  forReview: number
  completed: number
  byStage: Record<CellStage, number>
  byType: Record<CellType, number>
}

export interface LibraryWithCells extends LibrarySummary {
  cells: CellSummary[]
}

export interface ProjectOverview {
  project: Omit<ProjectSummary, 'libraryCount' | 'cellCount' | 'forReviewCount' | 'completedCount'>
  stats: ProjectStats
  libraries: LibraryWithCells[]
}

export interface CellChecklistItem {
  id: string
  label: string
  required: boolean
  checked: boolean
  checkedBy?: string
  checkedByName?: string
  checkedAt?: string
}

export interface LibrarySummary {
  id: string
  name: string
  description: string
  projectId: string
  cellCount: number
  createdAt: string
  updatedAt: string
}

export interface CellSummary {
  id: string
  name: string
  libraryId: string
  type: CellType
  assignedTo: CellAssignment[]
  currentStage: CellStage
  stageStatus: CellStageStatus
  createdAt: string
  updatedAt: string
}

export interface CellDetail extends CellSummary {
  libraryName: string
  projectId: string
  projectName: string
  views: CellViews
  feedbacks: CellFeedback[]
  checklistItems: CellChecklistItem[]
  history: StageHistoryEntry[]
}

export interface CellForReview extends CellSummary {
  libraryName: string
  projectId: string
  projectName: string
}

/* ================================================================
   API Functions
   ================================================================ */

// Projects
export async function fetchProjects(): Promise<ProjectSummary[]> {
  const { data } = await api.get('/project-mgmt/projects')
  return data
}

export async function fetchProjectOverview(projectId: string): Promise<ProjectOverview> {
  const { data } = await api.get(`/project-mgmt/projects/${projectId}/overview`)
  return data
}

export async function createProject(body: {
  name: string
  client?: string
  technologyNode?: string
  description?: string
}): Promise<ProjectSummary> {
  const { data } = await api.post('/project-mgmt/projects', body)
  return data
}

// Libraries
export async function fetchLibraries(projectId: string): Promise<LibrarySummary[]> {
  const { data } = await api.get(`/project-mgmt/projects/${projectId}/libraries`)
  return data
}

export async function createLibrary(
  projectId: string,
  body: { name: string; description?: string }
): Promise<LibrarySummary> {
  const { data } = await api.post(`/project-mgmt/projects/${projectId}/libraries`, body)
  return data
}

// Cells
export async function fetchCells(libraryId: string): Promise<CellSummary[]> {
  const { data } = await api.get(`/project-mgmt/libraries/${libraryId}/cells`)
  return data
}

export async function createCell(
  libraryId: string,
  body: { name: string; type: CellType }
): Promise<CellSummary> {
  const { data } = await api.post(`/project-mgmt/libraries/${libraryId}/cells`, body)
  return data
}

export async function fetchCellDetail(cellId: string): Promise<CellDetail> {
  const { data } = await api.get(`/project-mgmt/cells/${cellId}`)
  return data
}

export async function updateCell(
  cellId: string,
  body: {
    name?: string
    type?: CellType
    assignedTo?: CellAssignment[]
  }
): Promise<CellSummary> {
  const { data } = await api.put(`/project-mgmt/cells/${cellId}`, body)
  return data
}

// Stage workflow
export async function advanceCellStage(cellId: string): Promise<{ id: string; currentStage: CellStage; stageStatus: CellStageStatus }> {
  const { data } = await api.patch(`/project-mgmt/cells/${cellId}/advance`)
  return data
}

export async function submitCellForReview(cellId: string): Promise<{ id: string; currentStage: CellStage; stageStatus: CellStageStatus }> {
  const { data } = await api.patch(`/project-mgmt/cells/${cellId}/submit-review`)
  return data
}

export async function reviewCell(
  cellId: string,
  body: {
    action: 'approve' | 'reject'
    rejectTo?: 'floor_plan' | 'routing'
    feedback?: string
  }
): Promise<{ id: string; currentStage: CellStage; stageStatus: CellStageStatus; message: string }> {
  const { data } = await api.patch(`/project-mgmt/cells/${cellId}/review`, body)
  return data
}

export async function fetchCellsForReview(): Promise<CellForReview[]> {
  const { data } = await api.get('/project-mgmt/cells/for-review')
  return data
}

export async function fetchReviewCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/project-mgmt/cells/for-review/count')
  return data.count
}

// Feedback
export async function addCellFeedback(
  cellId: string,
  message: string
): Promise<{ cellId: string; feedbacks: CellFeedback[] }> {
  const { data } = await api.post(`/project-mgmt/cells/${cellId}/feedback`, { message })
  return data
}

export async function fetchCellFeedbacks(cellId: string): Promise<CellFeedback[]> {
  const { data } = await api.get(`/project-mgmt/cells/${cellId}/feedbacks`)
  return data
}

/* ================================================================
   Employee: My Assigned Cells
   ================================================================ */

export interface MyCellSummary {
  id: string
  name: string
  libraryId: string
  libraryName: string
  projectId: string
  projectName: string
  type: CellType
  assignedTo: CellAssignment[]
  currentStage: CellStage
  stageStatus: CellStageStatus
  feedbacks: CellFeedback[]
  createdAt: string
  updatedAt: string
}

export async function fetchMyAssignedCells(): Promise<MyCellSummary[]> {
  const { data } = await api.get('/project-mgmt/cells/my-cells')
  return data
}

/* ================================================================
   Checklist
   ================================================================ */

export interface TypeChecklistItem {
  id: string
  label: string
}

export interface ChecklistInfo {
  cellType: CellType
  items: TypeChecklistItem[]
  fileName?: string
  hasFile?: boolean
  uploadedBy: string
  uploadedByName: string
  updatedAt: string
}

export interface TypeChecklistData {
  cellType: CellType
  items: TypeChecklistItem[]
  fileName?: string
  hasFile?: boolean
}

export async function fetchChecklists(): Promise<ChecklistInfo[]> {
  const { data } = await api.get('/project-mgmt/checklist')
  return data
}

export async function uploadChecklist(cellType: CellType, file: File): Promise<{ cellType: string; fileName: string; message: string }> {
  const formData = new FormData()
  formData.append('cellType', cellType)
  formData.append('file', file)
  const { data } = await api.post('/project-mgmt/checklist/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export function getChecklistDownloadUrl(cellType: string): string {
  return `/project-mgmt/checklist/${cellType}`
}

export async function downloadChecklist(cellType: CellType): Promise<void> {
  await openWithAuth(getChecklistDownloadUrl(cellType))
}

export async function fetchTypeChecklistItems(cellType: CellType): Promise<TypeChecklistData> {
  const { data } = await api.get(`/project-mgmt/checklist/${cellType}/items`)
  return data
}

export async function setTypeChecklistItems(
  cellType: CellType,
  items: { label: string }[]
): Promise<TypeChecklistData> {
  const { data } = await api.put(`/project-mgmt/checklist/${cellType}/items`, { items })
  return data
}

// Cell view files
export async function uploadCellView(
  cellId: string,
  viewType: ViewType,
  file: File
): Promise<{ cellId: string; viewType: ViewType; message: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post(`/project-mgmt/cells/${cellId}/views/${viewType}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function downloadCellView(
  cellId: string,
  viewType: ViewType,
  fileName?: string
): Promise<void> {
  await downloadWithAuth(`/project-mgmt/cells/${cellId}/views/${viewType}`, fileName)
}

// Per-cell custom checklist
export async function setCellChecklistItems(
  cellId: string,
  items: { label: string; required?: boolean }[]
): Promise<{ checklistItems: CellChecklistItem[] }> {
  const { data } = await api.put(`/project-mgmt/cells/${cellId}/checklist-items`, { items })
  return data
}

export async function toggleCellChecklistItem(
  cellId: string,
  itemId: string,
  checked: boolean
): Promise<{ checklistItems: CellChecklistItem[] }> {
  const { data } = await api.patch(`/project-mgmt/cells/${cellId}/checklist-items/${itemId}`, { checked })
  return data
}
