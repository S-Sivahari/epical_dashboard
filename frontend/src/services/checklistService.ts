import api from '@/services/api'
import type {
  Checklist,
  ChecklistImportResult,
  ChecklistTemplateImportResult,
  ChecklistTemplateRow,
  CellChecklistDetail,
  ProjectChecklistSummary,
  ProjectCellsChecklistResponse,
} from '@/types/projectWorkspace'

export async function fetchChecklists(): Promise<Checklist[]> {
  const { data } = await api.get<Checklist[]>('/checklists')
  return Array.isArray(data) ? data : []
}

export async function createChecklist(payload: {
  name: string
  description: string
  items: { itemName: string }[]
}): Promise<Checklist> {
  const { data } = await api.post<Checklist>('/checklists', payload)
  return data
}

export async function updateChecklist(
  id: string,
  payload: { name: string; description: string; items: { id?: string; itemName: string }[] },
): Promise<Checklist> {
  const { data } = await api.put<Checklist>(`/checklists/${id}`, payload)
  return data
}

export async function deleteChecklist(id: string): Promise<void> {
  await api.delete(`/checklists/${id}`)
}

export async function assignChecklistToProject(
  projectId: string,
  checklistId: string,
  options?: { applyToAll?: boolean; selectedItemIds?: string[] },
): Promise<ProjectChecklistSummary> {
  const { data } = await api.post<ProjectChecklistSummary>('/checklists/assign', {
    projectId,
    checklistId,
    applyToAll: options?.applyToAll ?? false,
    selectedItemIds: options?.selectedItemIds,
  })
  return data
}

export async function fetchProjectCellsChecklist(
  projectId: string,
): Promise<ProjectCellsChecklistResponse> {
  const { data } = await api.get<ProjectCellsChecklistResponse>(
    `/projects/${projectId}/checklist/cells`,
  )
  return data
}

export async function fetchProjectChecklist(projectId: string): Promise<ProjectChecklistSummary | null> {
  const { data } = await api.get<ProjectChecklistSummary | null>(`/projects/${projectId}/checklist`)
  return data
}

export async function applyChecklistToAll(projectId: string): Promise<ProjectChecklistSummary> {
  const { data } = await api.post<{ summary: ProjectChecklistSummary }>(
    `/projects/${projectId}/checklist/apply-all`,
  )
  return data.summary
}

export interface ChecklistExportRow {
  projectName: string
  client: string
  projectType: string
  teamLead: string
  checklistName: string
  checklistStatus: string
  completionPercentage: number
  totalCells: number
  appliedCells: number
  lastUpdated: string
}

export async function fetchChecklistExportRows(): Promise<ChecklistExportRow[]> {
  const { data } = await api.get<ChecklistExportRow[]>('/checklists/export-report')
  return Array.isArray(data) ? data : []
}

export async function fetchChecklistTemplateRows(): Promise<ChecklistTemplateRow[]> {
  const { data } = await api.get<ChecklistTemplateRow[]>('/checklists/export-template')
  return Array.isArray(data) ? data : []
}

export async function importChecklistTemplateRows(
  rows: ChecklistTemplateRow[],
): Promise<ChecklistTemplateImportResult> {
  const { data } = await api.post<ChecklistTemplateImportResult>('/checklists/import-template', {
    rows,
  })
  return data
}

export async function importChecklistTemplateFile(file: File): Promise<ChecklistTemplateImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<ChecklistTemplateImportResult>(
    '/checklists/import-template-file',
    form,
  )
  return data
}

export async function importChecklistRows(
  rows: Record<string, unknown>[],
): Promise<ChecklistImportResult> {
  const { data } = await api.post<ChecklistImportResult>('/checklists/import', { rows })
  return data
}

export async function fetchCellChecklist(projectId: string, cellId: string): Promise<CellChecklistDetail> {
  const { data } = await api.get<CellChecklistDetail>(
    `/projects/${projectId}/cells/${cellId}/checklist`,
  )
  return data
}

export async function updateCellChecklistItem(
  projectId: string,
  cellId: string,
  mappingId: string,
  payload: { response: 'yes' | 'no' | 'not_applicable'; comment?: string },
): Promise<CellChecklistDetail> {
  const { data } = await api.patch<CellChecklistDetail>(
    `/projects/${projectId}/cells/${cellId}/checklist/${mappingId}`,
    payload,
  )
  return data
}

export async function importChecklistFile(file: File): Promise<ChecklistImportResult> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<ChecklistImportResult>('/checklists/import-file', form)
  return data
}
