export const CELL_TYPES = ['block', 'IOP', 'ESD', 'TOP'] as const

export const CELL_STATUSES = ['ready', 'in_progress', 'completed'] as const

export const CELL_WORKFLOW_STAGE_KEYS = [
  'floor_plan',
  'drc_review_1',
  'routing',
  'drc',
  'lvs_review_2',
] as const

export const WORKFLOW_STAGE_STATUSES = ['not_started', 'in_progress', 'completed'] as const

export const CELL_WORKFLOW_STAGES = [
  { key: 'floor_plan', label: 'Floor Plan' },
  { key: 'drc_review_1', label: 'DRC' },
  { key: 'routing', label: 'Routing' },
  { key: 'drc', label: 'DRC' },
  { key: 'lvs_review_2', label: 'LVS' },
] as const

export type CellType = (typeof CELL_TYPES)[number]
export type CellStatus = (typeof CELL_STATUSES)[number]
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

export interface ChecklistImportResult {
  imported: number
  updated: number
  failed: number
  errors: { row: number; projectName: string; message: string }[]
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
