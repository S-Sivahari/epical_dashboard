import api from '@services/api'
import type {
  AnalysisSummary,
  DashboardProject,
  MetalEntry,
  MetalRoutingRoute,
  PdkModule,
  ProjectRoutingContext,
  RoutingFilter,
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
  if (!err || typeof err !== 'object' || !('response' in err)) return fallback
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

export async function downloadRouteExcel(id: string, filename: string): Promise<void> {
  const response = await api.get(`${BASE}/routes/${id}/export`, { responseType: 'blob' })
  const blob = new Blob([response.data], {
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
