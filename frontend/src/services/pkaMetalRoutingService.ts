import api from '@services/api'
import type {
  AnalysisSummary,
  MetalEntry,
  MetalRoutingContext,
  MetalRoutingRoute,
  PkaModule,
  RoutingFilter,
} from '@/types/pkaMetalRouting'

const BASE = '/metal-routing'

export async function fetchMetalRoutingContext(): Promise<MetalRoutingContext> {
  const { data } = await api.get<MetalRoutingContext>(`${BASE}/context`)
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

export async function fetchPkaModules(): Promise<PkaModule[]> {
  const { data } = await api.get<{ modules: PkaModule[] }>(`${BASE}/pka-modules`)
  return data.modules
}

export async function fetchPkaModule(id: string): Promise<PkaModule> {
  const { data } = await api.get<{ module: PkaModule }>(`${BASE}/pka-modules/${id}`)
  return data.module
}

export async function createPkaModule(
  payload: Pick<PkaModule, 'name' | 'technologyNode' | 'notes' | 'metals'>,
): Promise<PkaModule> {
  const { data } = await api.post<{ module: PkaModule }>(`${BASE}/pka-modules`, payload)
  return data.module
}

export async function updatePkaModule(id: string, payload: Partial<PkaModule>): Promise<PkaModule> {
  const { data } = await api.put<{ module: PkaModule }>(`${BASE}/pka-modules/${id}`, payload)
  return data.module
}

export async function deletePkaModule(id: string): Promise<void> {
  await api.delete(`${BASE}/pka-modules/${id}`)
}

export async function previewMetal(
  filter: RoutingFilter,
  metal: { metalType: string; width: number; length: number; pkaModuleId: string },
): Promise<MetalEntry> {
  const { data } = await api.post<{ metal: MetalEntry }>(`${BASE}/route/metals/preview`, metal)
  return data.metal
}

export async function addMetalToRoute(
  filter: RoutingFilter,
  metal: { metalType: string; width: number; length: number; pkaModuleId: string },
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

export async function fetchRoutes(): Promise<MetalRoutingRoute[]> {
  const { data } = await api.get<{ routes: MetalRoutingRoute[] }>(`${BASE}/routes`)
  return data.routes
}

export async function deleteRoute(id: string): Promise<void> {
  await api.delete(`${BASE}/routes/${id}`)
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
