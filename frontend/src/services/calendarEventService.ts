import type { CompanyCalendarEvent } from '@/types'
import api from '@services/api'

export async function getCompanyCalendarEvents() {
  const response = await api.get('/calendar-events')
  return response.data as CompanyCalendarEvent[]
}

export async function createCompanyCalendarEvent(payload: Omit<CompanyCalendarEvent, 'id'>) {
  const response = await api.post('/calendar-events', payload)
  return response.data as CompanyCalendarEvent
}

export async function updateCompanyCalendarEvent(
  id: string,
  payload: Partial<Omit<CompanyCalendarEvent, 'id'>>,
) {
  const response = await api.put(`/calendar-events/${id}`, payload)
  return response.data as CompanyCalendarEvent
}

export async function deleteCompanyCalendarEvent(id: string) {
  await api.delete(`/calendar-events/${id}`)
}
