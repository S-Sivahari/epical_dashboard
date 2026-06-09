import api from '@/services/api'
import type {
  CellType,
  CellTypeChecklistDetail,
  CellTypeChecklistItem,
  ProjectTypeChecklistMeta,
  TypeChecklistAnswer,
} from '@/types/projectWorkspace'

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function fetchProjectTypeChecklists(projectId: string) {
  const { data } = await api.get<ProjectTypeChecklistMeta[]>(`/projects/${projectId}/type-checklists`)
  return data
}

export async function fetchCellTypeChecklist(projectId: string, cellId: string) {
  const { data } = await api.get<ProjectTypeChecklistMeta>(
    `/projects/${projectId}/cells/${cellId}/type-checklist`,
  )
  return data
}

export async function downloadChecklistTemplate(projectId: string) {
  const { data } = await api.get<Blob>(`/projects/${projectId}/type-checklists/template`, {
    responseType: 'blob',
  })
  triggerBlobDownload(data, 'checklist-template.xlsx')
}

export async function downloadTypeChecklistFile(projectId: string, cellType: CellType, fileName: string) {
  const { data } = await api.get<Blob>(
    `/projects/${projectId}/type-checklists/${cellType}/download`,
    { responseType: 'blob' },
  )
  triggerBlobDownload(data, fileName || `${cellType}-checklist.xlsx`)
}

export async function uploadTypeChecklist(projectId: string, cellType: CellType, file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<ProjectTypeChecklistMeta>(
    `/projects/${projectId}/type-checklists/${cellType}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function deleteTypeChecklist(projectId: string, cellType: CellType) {
  await api.delete(`/projects/${projectId}/type-checklists/${cellType}`)
}

export async function fetchCellTypeChecklistResponses(projectId: string, cellId: string) {
  const { data } = await api.get<CellTypeChecklistDetail>(
    `/projects/${projectId}/cells/${cellId}/type-checklist/responses`,
  )
  return data
}

export async function updateCellTypeChecklistResponse(
  projectId: string,
  cellId: string,
  itemIndex: number,
  payload: { response: TypeChecklistAnswer; comment?: string },
) {
  const { data } = await api.patch<CellTypeChecklistItem>(
    `/projects/${projectId}/cells/${cellId}/type-checklist/responses/${itemIndex}`,
    payload,
  )
  return data
}

export async function addCellCustomChecklistItem(
  projectId: string,
  cellId: string,
  itemName: string,
) {
  const { data } = await api.post<CellTypeChecklistItem>(
    `/projects/${projectId}/cells/${cellId}/type-checklist/custom-items`,
    { itemName },
  )
  return data
}

export async function deleteCellChecklistItem(
  projectId: string,
  cellId: string,
  itemKey: string,
) {
  await api.delete(
    `/projects/${projectId}/cells/${cellId}/type-checklist/items/${encodeURIComponent(itemKey)}`,
  )
}

export async function updateCellCustomChecklistResponse(
  projectId: string,
  cellId: string,
  customItemId: string,
  payload: { response: TypeChecklistAnswer; comment?: string },
) {
  const { data } = await api.patch<CellTypeChecklistItem>(
    `/projects/${projectId}/cells/${cellId}/type-checklist/custom-items/${customItemId}`,
    payload,
  )
  return data
}

export async function downloadCellChecklistExport(projectId: string, cellId: string, fileName: string) {
  const { data } = await api.get<Blob>(
    `/projects/${projectId}/cells/${cellId}/type-checklist/download`,
    { responseType: 'blob' },
  )
  triggerBlobDownload(data, fileName)
}
