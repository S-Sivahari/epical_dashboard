import api from '@services/api'
import type {
  AnalysisSummary,
  DashboardProject,
  MetalEntry,
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

export async function updateRouteIdentity(
  routeId: string,
  payload: { signal: string; fromCell: string; toCell: string; schematicCurrentDensity?: number },
): Promise<MetalRoutingRoute> {
  const { data } = await api.patch<{ route: MetalRoutingRoute }>(`${BASE}/routes/${routeId}`, payload)
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
  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? 'PDK_Import_Template.xlsx'
  await downloadExcelBlob(response.data, filename, String(response.headers['content-type'] ?? ''))
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
  metal: {
    metalType: string
    width: number
    length: number
    schematicCurrentDensity?: number
    connectionType?: 'series' | 'parallel'
  },
): Promise<MetalEntry> {
  const { data } = await api.post<{ metal: MetalEntry }>(`${BASE}/route/metals/preview`, {
    projectId,
    ...metal,
  })
  return data.metal
}

export async function addMetalToRoute(
  filter: RoutingFilter,
  metal: {
    metalType: string
    width: number
    length: number
    schematicCurrentDensity?: number
    connectionType?: 'series' | 'parallel'
  },
): Promise<{ route: MetalRoutingRoute; summary: AnalysisSummary }> {
  const { data } = await api.post(`${BASE}/route/metals`, { ...filter, ...metal })
  return data
}

export async function updateMetalInRoute(
  filter: RoutingFilter,
  metalId: string,
  metal: {
    metalType: string
    width: number
    length: number
    schematicCurrentDensity?: number
    connectionType?: 'series' | 'parallel'
  },
): Promise<MetalRoutingRoute> {
  const { data } = await api.put<{ route: MetalRoutingRoute }>(`${BASE}/route/metals/${metalId}`, {
    ...filter,
    ...metal,
  })
  return data.route
}

export async function removeMetalFromRoute(filter: RoutingFilter, metalId: string): Promise<MetalRoutingRoute> {
  const { data } = await api.delete<{ route: MetalRoutingRoute }>(`${BASE}/route/metals/${metalId}`, {
    data: filter,
  })
  return data.route
}

async function isXlsxBlob(data: Blob): Promise<boolean> {
  const header = await data.slice(0, 4).arrayBuffer()
  const bytes = new Uint8Array(header)
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

async function downloadExcelBlob(responseData: Blob, filename: string, contentTypeHeader?: string): Promise<void> {
  const contentType = String(contentTypeHeader ?? '')
  const looksLikeExcel =
    contentType.includes('spreadsheetml')
    || contentType.includes('octet-stream')
    || contentType.includes('excel')
    || (await isXlsxBlob(responseData))

  if (!looksLikeExcel) {
    const message = await readApiErrorMessage({ response: { data: responseData } }, 'Failed to download Excel file')
    throw new Error(message)
  }

  const normalizedFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`
  const blob = new Blob([responseData], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = normalizedFilename
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

async function readMetalRoutingImportError(err: unknown, fallback: string): Promise<string> {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (typeof data === 'object' && data) {
      const body = data as {
        error?: string
        failures?: Array<{ routeLabel: string; reason: string }>
      }
      if (body.failures?.length) {
        const detail = body.failures.map((f) => `${f.routeLabel}: ${f.reason}`).join(' | ')
        return body.error ? `${body.error} ${detail}` : detail
      }
      if (body.error) return body.error
    }
  }
  return readApiErrorMessage(err, fallback)
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
    const message = await readMetalRoutingImportError(err, 'Failed to import routes from Excel')
    throw new Error(message)
  }
}

export async function downloadRouteMetalTemplate(routeId: string): Promise<void> {
  const response = await api.get(`${BASE}/routes/${routeId}/template/download`, { responseType: 'blob' })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? 'Signal_Metal_Template.xlsx'
  await downloadExcelBlob(response.data, filename, String(response.headers['content-type'] ?? ''))
}

export interface RouteMetalImportResult {
  success: boolean
  routeId: string
  metalsImported: number
  totalMetals: number
  route: MetalRoutingRoute
  parseDiagnostics: {
    worksheetName: string
    headerRow: number
    mergeRangeCount: number
    dataRowsScanned: number
    totalMetalRows: number
  }
}

export async function importRouteMetalsExcel(
  routeId: string,
  file: File,
): Promise<RouteMetalImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const { data } = await api.post<RouteMetalImportResult>(
      `${BASE}/routes/${routeId}/import`,
      formData,
    )
    return data
  } catch (err: unknown) {
    const message = await readMetalRoutingImportError(err, 'Failed to import metals for this signal')
    throw new Error(message)
  }
}
