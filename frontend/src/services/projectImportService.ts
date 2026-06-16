import api from '@services/api'

export interface ProjectImportResult {
  message: string
  archivedCount: number
  createdCount: number
  assignmentRows: number
  skippedRows: number
  timesheetEntries: number
  importFormat: 'assignments' | 'timesheet_matrix'
  warnings: string[]
  projects: Array<{
    id: string
    name: string
    client: string
    technologyNode: string
    memberCount: number
    teamLead?: string
  }>
}

export async function downloadProjectImportTemplate(): Promise<void> {
  const response = await api.get('/projects/import/template', { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'project_assignments_template.xlsx')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function importProjectsReset(file: File): Promise<ProjectImportResult> {
  const formData = new FormData()
  formData.append('projects', file)
  const response = await api.post<ProjectImportResult>('/projects/import/reset', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })
  return response.data
}
