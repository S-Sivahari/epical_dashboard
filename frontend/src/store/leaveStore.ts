import { create } from 'zustand'
import type { CompanyCalendarEvent, Holiday, LeaveRequest } from '@/types'
import * as leaveService from '@services/leaveService'
import * as calendarEventService from '@services/calendarEventService'

interface LeaveState {
  leaves: LeaveRequest[]
  holidays: Holiday[]
  companyCalendarEvents: CompanyCalendarEvent[]
  loading: boolean
  lastFetchLeaves: number
  lastFetchHolidays: number
  lastFetchCalendarEvents: number
  fetchLeaves: () => Promise<void>
  fetchLeavesSilent: () => Promise<void>
  fetchHolidays: () => Promise<void>
  fetchHolidaysSilent: () => Promise<void>
  approveLeave: (id: string) => Promise<void>
  rejectLeave: (id: string, reason: string) => Promise<void>
  cancelLeave: (id: string) => Promise<void>
  revokeApprovedLeave: (id: string, reason: string) => Promise<void>
  deleteAllLeaves: () => Promise<number>
  addHoliday: (h: Omit<Holiday, 'id'>) => Promise<void>
  updateHoliday: (id: string, h: Partial<Omit<Holiday, 'id'>>) => Promise<void>
  deleteHoliday: (id: string) => Promise<void>
  skipHoliday: (id: string, reason?: string) => Promise<void>
  addCompanyCalendarEvent: (e: Omit<CompanyCalendarEvent, 'id'>) => Promise<void>
  updateCompanyCalendarEvent: (id: string, e: Partial<Omit<CompanyCalendarEvent, 'id'>>) => Promise<void>
  deleteCompanyCalendarEvent: (id: string) => Promise<void>
}

// Cache expiry time in milliseconds (30 seconds)
const CACHE_EXPIRY = 30000

export const useLeaveStore = create<LeaveState>((set, get) => ({
  leaves: [],
  holidays: [],
  companyCalendarEvents: [],
  loading: false,
  lastFetchLeaves: 0,
  lastFetchHolidays: 0,
  lastFetchCalendarEvents: 0,
  fetchLeaves: async () => {
    set({ loading: true })
    try {
      const leaves = await leaveService.getLeaves()
      set({ leaves, loading: false, lastFetchLeaves: Date.now() })
    } catch {
      set({ loading: false })
    }
  },
  fetchLeavesSilent: async () => {
    // Only fetch if cache is stale (older than CACHE_EXPIRY)
    const now = Date.now()
    if (now - get().lastFetchLeaves < CACHE_EXPIRY) {
      return
    }
    try {
      const leaves = await leaveService.getLeaves()
      set({ leaves, lastFetchLeaves: now })
    } catch {
      // silently fail on background polling
    }
  },
  fetchHolidays: async () => {
    try {
      const settled = await Promise.allSettled([
        leaveService.getHolidays(),
        calendarEventService.getCompanyCalendarEvents(),
      ])
      const holidays =
        settled[0].status === 'fulfilled' ? settled[0].value : get().holidays
      const companyCalendarEvents =
        settled[1].status === 'fulfilled' ? settled[1].value : get().companyCalendarEvents
      const now = Date.now()
      set({
        holidays,
        companyCalendarEvents,
        lastFetchHolidays: now,
        lastFetchCalendarEvents: now,
      })
    } catch {
      // silently fail — interceptor handles 401 redirect
    }
  },
  fetchHolidaysSilent: async () => {
    const now = Date.now()
    if (now - get().lastFetchHolidays < CACHE_EXPIRY) {
      return
    }
    try {
      const settled = await Promise.allSettled([
        leaveService.getHolidays(),
        calendarEventService.getCompanyCalendarEvents(),
      ])
      const holidays =
        settled[0].status === 'fulfilled' ? settled[0].value : get().holidays
      const companyCalendarEvents =
        settled[1].status === 'fulfilled' ? settled[1].value : get().companyCalendarEvents
      const t = Date.now()
      set({
        holidays,
        companyCalendarEvents,
        lastFetchHolidays: t,
        lastFetchCalendarEvents: t,
      })
    } catch {
      // silently fail on background polling
    }
  },
  approveLeave: async (id) => {
    await leaveService.approveLeave(id)
    await get().fetchLeaves()
  },
  rejectLeave: async (id, reason) => {
    await leaveService.rejectLeave(id, reason)
    await get().fetchLeaves()
  },
  cancelLeave: async (id) => {
    await leaveService.cancelLeave(id)
    await get().fetchLeaves()
  },
  revokeApprovedLeave: async (id, reason) => {
    await leaveService.revokeApprovedLeave(id, reason)
    await get().fetchLeaves()
  },
  deleteAllLeaves: async () => {
    const { deletedCount } = await leaveService.deleteAllLeaves()
    set({ leaves: [], lastFetchLeaves: Date.now() })
    return deletedCount
  },
  addHoliday: async (h) => {
    await leaveService.addHoliday(h)
    await get().fetchHolidays()
  },
  updateHoliday: async (id, h) => {
    await leaveService.updateHoliday(id, h)
    await get().fetchHolidays()
  },
  deleteHoliday: async (id) => {
    await leaveService.deleteHoliday(id)
    await get().fetchHolidays()
  },
  skipHoliday: async (id, reason) => {
    await leaveService.skipHoliday(id, reason)
    await get().fetchHolidays()
  },
  addCompanyCalendarEvent: async (payload) => {
    await calendarEventService.createCompanyCalendarEvent(payload)
    await get().fetchHolidays()
  },
  updateCompanyCalendarEvent: async (id, payload) => {
    await calendarEventService.updateCompanyCalendarEvent(id, payload)
    await get().fetchHolidays()
  },
  deleteCompanyCalendarEvent: async (id) => {
    await calendarEventService.deleteCompanyCalendarEvent(id)
    await get().fetchHolidays()
  },
}))
