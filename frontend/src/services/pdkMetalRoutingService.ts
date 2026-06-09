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
  const { data } = await api.post<{ module: PdkModule }>(`${BASE}/pdk-modules`, payload)
  return data.module
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
