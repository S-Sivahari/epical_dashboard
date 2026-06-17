import api from './api'

export type PortalGuideSection = {
  key: string
  title: string
  summary: string
  linkTo: string
  linkLabel: string
  steps: string[]
  notes?: string[]
}

export async function fetchAdminPortalGuide(): Promise<PortalGuideSection[]> {
  const { data } = await api.get<{ sections: PortalGuideSection[] }>('/portal-guide/admin')
  return data.sections
}

export async function fetchEmployeePortalGuide(): Promise<PortalGuideSection[]> {
  const { data } = await api.get<{ sections: PortalGuideSection[] }>('/portal-guide/employee')
  return data.sections
}
