export const CELL_TYPES = ['block', 'IOP', 'ESD', 'TOP'] as const

export const CELL_STATUSES = ['ready', 'in_progress', 'completed'] as const

export type CellType = (typeof CELL_TYPES)[number]
export type CellStatus = (typeof CELL_STATUSES)[number]

export interface AdminProjectRow {
  id: string
  name: string
  client: string
  technologyNode: string
  accessType: 'public' | 'private'
  status: string
  teamLead?: string
  completionPercentage?: number
}

export interface ProjectLibrary {
  id: string
  projectId: string
  name: string
  description: string
}

export const VIEW_PROGRESS_STATUSES = ['not_started', 'in_progress', 'completed'] as const
export const LAYOUT_STAGES = ['floor_plan', 'drc_r1', 'routing', 'drc', 'lvs_r2'] as const
export const REVIEW_POINTS = ['r1', 'r2'] as const

export type ViewProgressStatus = (typeof VIEW_PROGRESS_STATUSES)[number]
export type LayoutStage = (typeof LAYOUT_STAGES)[number]
export type ReviewPoint = (typeof REVIEW_POINTS)[number]

export interface CellViews {
  layout: string
  symbol: string
  schematic: string
}

export interface SimpleViewState {
  status: ViewProgressStatus
}

export interface LayoutViewState {
  stage: LayoutStage
  status: ViewProgressStatus
  pendingReview: ReviewPoint | null
}

export interface CellViewWorkflow {
  style: SimpleViewState
  symbol: SimpleViewState
  layout: LayoutViewState
}

export const LAYOUT_STAGE_LABELS: Record<LayoutStage, string> = {
  floor_plan: 'Floor Plan',
  drc_r1: 'DRC (R1)',
  routing: 'Routing',
  drc: 'DRC',
  lvs_r2: 'LVS (R2)',
}

export const VIEW_PROGRESS_LABELS: Record<ViewProgressStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
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
  views: CellViews
  viewWorkflow: CellViewWorkflow
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
  reviewPoint?: ReviewPoint | null
  outcome?: 'pending' | 'approved' | 'rejected'
  returnToStage?: LayoutStage | null
  status: 'open' | 'resolved'
  initiatedByName: string
  resolvedByName?: string | null
  resolvedAt?: string | null
  messages: { authorName: string; authorRole: string; body: string; at: string }[]
}

export interface EmployeeProjectCell extends ProjectCell {
  isAssignedToMe: boolean
  assignedEmployeeId: string
  assignedEmployeeName: string
}

export interface EmployeeProjectWorkspace {
  project: {
    id: string
    name: string
    client: string
    technologyNode: string
    status: string
    completionPercentage: number
  }
  libraries: ProjectLibrary[]
  cells: EmployeeProjectCell[]
  stats: {
    libraryCount: number
    cellCount: number
    assignedToMe: number
    completedCells: number
    blockedCells: number
    readyCells: number
    unassignedCells: number
  }
}

export interface EmployeeCellDetail {
  project: { id: string; name: string }
  library: ProjectLibrary | null
  cell: ProjectCell
  reviews: CellReview[]
}
