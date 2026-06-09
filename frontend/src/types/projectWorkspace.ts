export const CELL_TYPES = ['block', 'IOP', 'ESD', 'TOP'] as const

export const CELL_STATUSES = ['ready', 'in_progress', 'completed'] as const

export const CELL_WORKFLOW_STAGE_KEYS = [
  'floor_plan',
  'drc_first',
  'review_1',
  'routing',
  'drc_final',
  'lvs',
  'review_2',
] as const

export const REVIEW_STAGE_KEYS = ['review_1', 'review_2'] as const

export const WORK_STAGE_STATUSES = ['not_started', 'in_progress', 'completed'] as const
export const REVIEW_STAGE_STATUSES = ['not_started', 'pending_review', 'approved', 'rejected'] as const
export const WORKFLOW_STAGE_STATUSES = [
  ...WORK_STAGE_STATUSES,
  ...REVIEW_STAGE_STATUSES,
] as const

export const CELL_WORKFLOW_STAGES = [
  { key: 'floor_plan', label: 'Floor Plan' },
  { key: 'drc_first', label: 'DRC' },
  { key: 'review_1', label: 'Review 1' },
  { key: 'routing', label: 'Routing' },
  { key: 'drc_final', label: 'DRC' },
  { key: 'lvs', label: 'LVS' },
  { key: 'review_2', label: 'Review 2' },
] as const

export type CellType = (typeof CELL_TYPES)[number]
export type CellStatus = (typeof CELL_STATUSES)[number]

export interface ProjectTypeChecklistMeta {
  cellType: CellType
  fileName: string
  contentType: string
  uploadedAt: string | null
  uploadedByName: string
  hasFile: boolean
}

export type TypeChecklistAnswer = 'yes' | 'no' | 'not_applicable'

export type ChecklistItemSource = 'template' | 'custom'

export interface CellTypeChecklistItem {
  source: ChecklistItemSource
  itemKey: string
  itemIndex: number | null
  customItemId?: string | null
  itemName: string
  response: TypeChecklistAnswer | null
  comment: string
  answeredAt?: string | null
  answeredByName?: string
}

export interface CellTypeChecklistDetail {
  cellId?: string
  cellName?: string
  libraryId?: string
  libraryName?: string
  cellType: CellType
  fileName: string
  hasFile: boolean
  uploadedAt?: string | null
  items: CellTypeChecklistItem[]
}
export type CellWorkflowStageKey = (typeof CELL_WORKFLOW_STAGE_KEYS)[number]
export type WorkflowStageStatus = (typeof WORKFLOW_STAGE_STATUSES)[number]

export interface CellWorkflowStage {
  stageKey: CellWorkflowStageKey
  stageLabel: string
  status: WorkflowStageStatus
  updatedAt?: string
}

export interface AdminProjectRow {
  id: string
  name: string
  client: string
  technologyNode: string
  accessType: 'public' | 'private'
  status: string
  teamLead?: string
  completionPercentage?: number
  checklistName?: string
  checklistStatus?: 'Applied' | 'Partial' | 'Not Applied'
  checklistCompletionPercentage?: number
  checklistLastUpdated?: string
  checklistTotalCells?: number
  checklistAppliedCells?: number
}

export type ProjectChecklistStatus = 'Applied' | 'Partial' | 'Not Applied'
export type CellChecklistStatus = 'Applied' | 'Pending' | 'Not Assigned'

export interface ChecklistItem {
  id: string
  itemName: string
  order: number
}

export interface Checklist {
  id: string
  name: string
  description: string
  items: ChecklistItem[]
  createdAt?: string
  updatedAt?: string
}

export interface ProjectChecklistSummary {
  checklistId: string
  checklistName: string
  checklistDescription: string
  status: ProjectChecklistStatus
  completionPercentage: number
  totalCells: number
  appliedCells: number
  lastUpdated?: string
  itemCount: number
  selectedItemIds: string[]
  selectedItems: { id: string; itemName: string }[]
}

export type CellChecklistItemResponse = 'yes' | 'no' | 'not_applicable'

export interface CellChecklistItem {
  id: string
  checklistItemId: string
  itemName: string
  status: string
  response: CellChecklistItemResponse | null
  comment: string
  appliedBy: string
  appliedDate?: string
}

export interface CellChecklistDetail {
  checklistId: string | null
  checklistName: string
  cellStatus: CellChecklistStatus
  items: CellChecklistItem[]
}

export interface CellChecklistRowSummary {
  cellId: string
  checklistName: string
  cellStatus: CellChecklistStatus
  appliedCount: number
  answeredCount: number
  totalCount: number
  items: CellChecklistItem[]
}

export interface ProjectCellsChecklistResponse {
  checklistId: string | null
  checklistName: string
  cells: CellChecklistRowSummary[]
}

export interface ChecklistImportResult {
  imported: number
  updated: number
  failed: number
  errors: { row: number; projectName: string; message: string }[]
}

export interface ChecklistTemplateImportResult {
  imported: number
  created: number
  updated: number
  failed: number
  errors: { row: number; checklistName: string; message: string }[]
}

export interface ChecklistTemplateRow {
  checklistName: string
  description: string
  itemName: string
  itemOrder: number
}

export interface ProjectLibrary {
  id: string
  projectId: string
  name: string
  description: string
}

export interface CellViews {
  layout: string
  symbol: string
  schematic: string
}

export interface ProjectCell {
  id: string
  projectId: string
  libraryId: string
  name: string
  description: string
  cellType: CellType
  technologyNode: string
  complexity: 'Low' | 'Medium' | 'High'
  estimatedEffort: number
  assignedEmployeeId: string
  assignedEmployeeName: string
  dependencyCellIds: string[]
  status: CellStatus
  workflow: CellWorkflowStage[]
  workflowCompletedStages: number
  workflowTotalStages: number
  currentWorkflowStage: string
  views: CellViews
  isBlocked: boolean
  isReady: boolean
  activityLog: { action: string; detail?: string; userName?: string; at: string }[]
}

export interface WorkspaceSummary {
  project: {
    id: string
    name: string
    client: string
    accessType: 'public' | 'private'
    teamLead: string
    technologyNode: string
    description: string
    status: string
    completionPercentage: number
  }
  libraries: ProjectLibrary[]
  cells: ProjectCell[]
  stats: {
    libraryCount: number
    cellCount: number
    completedCells: number
    blockedCells: number
    readyCells: number
    unassignedCells: number
    openReviews: number
  }
}

export interface DependencyGraph {
  nodes: { id: string; name: string; status: CellStatus; libraryId: string; isBlocked: boolean; isReady: boolean }[]
  edges: { from: string; to: string }[]
}

export interface CellReview {
  id: string
  cellId: string
  stageAtRequest: string
  status: 'open' | 'resolved'
  initiatedByName: string
  messages: { authorName: string; authorRole: string; body: string; at: string }[]
}
