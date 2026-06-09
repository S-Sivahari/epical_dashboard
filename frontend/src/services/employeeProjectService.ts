import api from '@/services/api'
import type {
  CellChecklistDetail,
  CellReview,
  DependencyGraph,
  EmployeeCellDetail,
  EmployeeProjectCell,
  EmployeeProjectWorkspace,
} from '@/types/projectWorkspace'
import type { ViewProgressStatus } from '@/types/projectWorkspace'

export interface AssignedProject {
  id: string
  name: string
  client: string
  technologyNode: string
  status: string
  myHours: number
  assignmentRole: string
}

export async function fetchMyAssignedProjects() {
  const { data } = await api.get<AssignedProject[]>('/projects/assigned/me')
  return data
}

export async function fetchMyProjectWorkspace(projectId: string) {
  const { data } = await api.get<EmployeeProjectWorkspace>(`/projects/${projectId}/mine/workspace`)
  return data
}

export async function fetchMyDependencyGraph(projectId: string) {
  const { data } = await api.get<DependencyGraph & { nodes: DependencyGraph['nodes'] }>(
    `/projects/${projectId}/mine/dependency-graph`,
  )
  return data
}

export async function fetchMyCell(projectId: string, cellId: string) {
  const { data } = await api.get<EmployeeCellDetail>(`/projects/${projectId}/cells/${cellId}/mine`)
  return data
}

export async function updateCellWorkflow(
  projectId: string,
  cellId: string,
  payload: {
    view: 'style' | 'symbol' | 'layout'
    action: 'set_status' | 'advance_stage'
    status?: ViewProgressStatus
  },
) {
  const { data } = await api.patch<EmployeeProjectCell>(`/projects/${projectId}/cells/${cellId}/mine/workflow`, payload)
  return data
}

export async function requestCellReview(projectId: string, cellId: string, comment?: string) {
  const { data } = await api.post<{ cell: EmployeeProjectCell; review: CellReview }>(
    `/projects/${projectId}/cells/${cellId}/mine/reviews`,
    { comment },
  )
  return data
}

export async function fetchMyCellReviews(projectId: string, cellId: string) {
  const { data } = await api.get<CellReview[]>(`/projects/${projectId}/cells/${cellId}/mine/reviews`)
  return data
}

export interface EmployeeRequestedReview extends CellReview {
  projectId: string
  projectName: string
  cellName: string
  createdAt?: string
}

export async function fetchMyRequestedReviews() {
  const { data } = await api.get<EmployeeRequestedReview[]>('/projects/mine/reviews')
  return data
}

export async function fetchMyCellChecklist(projectId: string, cellId: string) {
  const { data } = await api.get<CellChecklistDetail>(
    `/projects/${projectId}/cells/${cellId}/mine/checklist`,
  )
  return data
}

export async function updateMyCellChecklistItem(
  projectId: string,
  cellId: string,
  mappingId: string,
  payload: { response: 'yes' | 'no' | 'not_applicable'; comment?: string },
) {
  const { data } = await api.patch<CellChecklistDetail>(
    `/projects/${projectId}/cells/${cellId}/mine/checklist/${mappingId}`,
    payload,
  )
  return data
}
