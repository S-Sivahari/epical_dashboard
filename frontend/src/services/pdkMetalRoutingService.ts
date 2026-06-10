import api from '@services/api'
import type {
  AnalysisSummary,
  DashboardProject,
  MetalEntry,
  MetalRoutingDashboardMetrics,
  MetalRoutingRoute,
  PdkModule,
  ProjectRoutingContext,
  RoutingFilter,
  SavedRouteSummary,
} from '@/types/pdkMetalRouting'

const BASE = '/metal-routing'

export async function fetchDashboardProjects(): Promise<DashboardProject[]> {
  const { data } = await api.get<{ projects: DashboardProject[] }>(`${BASE}/dashboard/projects`)
  return data.projects
}

export async function fetchDashboardMetrics(
  projectId?: string | null,
): Promise<MetalRoutingDashboardMetrics> {
  const { data } = await api.get<{ metrics: MetalRoutingDashboardMetrics }>(`${BASE}/dashboard/metrics`, {
    params: projectId ? { projectId } : undefined,
  })
  return data.metrics
}

export async function assignPdkToProject(projectId: string, pdkModuleId: string | null): Promise<void> {
  await api.patch(`${BASE}/projects/${projectId}/pdk`, { pdkModuleId })
}

export async function fetchProjectContext(projectId: string): Promise<ProjectRoutingContext> {
  const { data } = await api.get<ProjectRoutingContext>(`${BASE}/projects/${projectId}/context`)
  return data
}

export async function lookupRoute(filter: RoutingFilter): Promise<MetalRoutingRoute | null> {
  const { data } = await api.get<{ route: MetalRoutingRoute | null }>(`${BASE}/route`, { params: filter })
  return data.route
}

export async function resolveRoute(filter: RoutingFilter): Promise<MetalRoutingRoute> {
  const { data } = await api.post<{ route: MetalRoutingRoute }>(`${BASE}/route/resolve`, filter)
  return data.route
}

export async function fetchPdkModules(): Promise<PdkModule[]> {
  const { data } = await api.get<{ modules: PdkModule[] }>(`${BASE}/pdk-modules`)
  return data.modules
}

export async function fetchPdkModule(id: string): Promise<PdkModule> {
  const { data } = await api.get<{ module: PdkModule }>(`${BASE}/pdk-modules/${id}`)
  return data.module
}

export async function createPdkModule(
  payload: Pick<PdkModule, 'name' | 'technologyNode' | 'notes' | 'metals'>,
): Promise<PdkModule> {
  try {
    const { data } = await api.post<{ module: PdkModule }>(`${BASE}/pdk-modules`, payload)
    return data.module
  } catch (err: unknown) {
    const message = await readApiErrorMessage(err, 'Failed to create PDK module')
    throw new Error(message)
  }
}

async function readApiErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { data?: unknown } }).response
    const data = response?.data
    if (typeof data === 'object' && data && 'error' in data && typeof data.error === 'string') {
      return data.error
    }
    if (data instanceof Blob) {
      try {
        const text = await data.text()
        const parsed = JSON.parse(text) as { error?: string }
        if (parsed.error) return parsed.error
      } catch {
        // ignore parse failures
      }
    }
  }
  if (err instanceof Error && err.message && !err.message.startsWith('Request failed with status code')) {
    return err.message
  }
  return fallback
}

export async function downloadPdkTemplate(): Promise<void> {
  const response = await api.get(`${BASE}/pdk-modules/template/download`, { responseType: 'blob' })
  const contentType = String(response.headers['content-type'] ?? '')
  if (!contentType.includes('spreadsheetml') && !contentType.includes('octet-stream')) {
    const message = await readApiErrorMessage(
      { response: { data: response.data } },
      'Failed to download PDK template',
    )
    throw new Error(message)
  }
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'PDK_Import_Template.xlsx'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function importPdkModuleFromExcel(
  file: File,
  options: { name: string; technologyNode?: string; notes?: string },
): Promise<PdkModule> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', options.name.trim())
  if (options.technologyNode?.trim()) {
    formData.append('technologyNode', options.technologyNode.trim())
  }
  if (options.notes?.trim()) {
    formData.append('notes', options.notes.trim())
  }
  try {
    const { data } = await api.post<{ module: PdkModule }>(`${BASE}/pdk-modules/import`, formData)
    return data.module
  } catch (err: unknown) {
    const message = await readApiErrorMessage(err, 'Failed to import PDK module')
    throw new Error(message)
  }
}

export async function updatePdkModule(id: string, payload: Partial<PdkModule>): Promise<PdkModule> {
  const { data } = await api.put<{ module: PdkModule }>(`${BASE}/pdk-modules/${id}`, payload)
  return data.module
}

export async function deletePdkModule(id: string): Promise<void> {
  await api.delete(`${BASE}/pdk-modules/${id}`)
}

export async function previewMetal(
  projectId: string,
  metal: { metalType: string; width: number; length: number },
): Promise<MetalEntry> {
  const { data } = await api.post<{ metal: MetalEntry }>(`${BASE}/route/metals/preview`, {
    projectId,
    ...metal,
  })
  return data.metal
}

export async function addMetalToRoute(
  filter: RoutingFilter,
  metal: { metalType: string; width: number; length: number },
): Promise<{ route: MetalRoutingRoute; summary: AnalysisSummary }> {
  const { data } = await api.post(`${BASE}/route/metals`, { ...filter, ...metal })
  return data
}

export async function removeMetalFromRoute(filter: RoutingFilter, metalId: string): Promise<MetalRoutingRoute> {
  const { data } = await api.delete<{ route: MetalRoutingRoute }>(`${BASE}/route/metals/${metalId}`, {
    data: filter,
  })
  return data.route
}

async function downloadExcelBlob(responseData: Blob, filename: string, contentTypeHeader?: string): Promise<void> {
  const contentType = String(contentTypeHeader ?? '')
  if (!contentType.includes('spreadsheetml') && !contentType.includes('octet-stream')) {
    const message = await readApiErrorMessage({ response: { data: responseData } }, 'Failed to download Excel file')
    throw new Error(message)
  }
  const blob = new Blob([responseData], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadRouteExcel(id: string, filename: string): Promise<void> {
  const response = await api.get(`${BASE}/routes/${id}/export`, { responseType: 'blob' })
  await downloadExcelBlob(response.data, filename, String(response.headers['content-type'] ?? ''))
}

export async function downloadMetalRoutingTemplate(projectId?: string): Promise<void> {
  const response = projectId
    ? await api.get(`${BASE}/projects/${projectId}/routes/template/download`, { responseType: 'blob' })
    : await api.get(`${BASE}/routes/template/download`, { responseType: 'blob' })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? 'Metal_Routing_Import_Template.xlsx'
  await downloadExcelBlob(response.data, filename, String(response.headers['content-type'] ?? ''))
}

export async function downloadProjectRoutesExcel(
  projectId: string,
  options?: { routeId?: string; filename?: string },
): Promise<void> {
  const response = await api.get(`${BASE}/projects/${projectId}/routes/export`, {
    responseType: 'blob',
    params: options?.routeId ? { routeId: options.routeId } : undefined,
  })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = options?.filename ?? match?.[1] ?? 'metal-routing.xlsx'
  await downloadExcelBlob(response.data, filename, String(response.headers['content-type'] ?? ''))
}

export interface MetalRoutingImportFailure {
  routeLabel: string
  fromCell: string
  toCell: string
  fromSignal: string
  toSignal: string
  metalRows: number
  reason: string
}

export interface MetalRoutingImportResult {
  success: boolean
  projectId: string
  projectName: string
  routesParsed: number
  routesImported: number
  metalsImported: number
  routesFailed: number
  failures: MetalRoutingImportFailure[]
  routes: MetalRoutingRoute[]
  savedRoutes: SavedRouteSummary[]
  parseDiagnostics: {
    worksheetName: string
    headerRow: number
    mergeRangeCount: number
    dataRowsScanned: number
    totalMetalRows: number
  }
}

export async function importProjectRoutesExcel(
  projectId: string,
  file: File,
): Promise<MetalRoutingImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const { data } = await api.post<MetalRoutingImportResult>(
      `${BASE}/projects/${projectId}/routes/import`,
      formData,
    )
    return data
  } catch (err: unknown) {
    const message = await readApiErrorMessage(err, 'Failed to import routes from Excel')
    throw new Error(message)
  }
}
