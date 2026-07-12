import { create } from 'zustand'
import type { CompanyCalendarEvent, Holiday, LeaveAllocationActivity, LeaveRequest } from '@/types'
import * as leaveService from '@services/leaveService'
import * as calendarEventService from '@services/calendarEventService'

interface LeaveState {
  leaves: LeaveRequest[]
  allocationActivities: LeaveAllocationActivity[]
  holidays: Holiday[]
  companyCalendarEvents: CompanyCalendarEvent[]
  loading: boolean
  lastFetchLeaves: number
  lastFetchAllocationActivities: number
  lastFetchHolidays: number
  lastFetchCalendarEvents: number
  fetchLeaves: () => Promise<void>
  fetchLeavesSilent: () => Promise<void>
  fetchAllocationActivities: (from?: string, to?: string) => Promise<void>
  fetchAllocationActivitiesSilent: (from?: string, to?: string) => Promise<void>
  fetchHolidays: () => Promise<void>
  fetchHolidaysSilent: () => Promise<void>
  approveLeave: (id: string) => Promise<void>
  rejectLeave: (id: string, reason: string) => Promise<void>
  cancelLeave: (id: string) => Promise<void>
  revokeApprovedLeave: (id: string, reason: string) => Promise<void>
  deleteLeave: (id: string) => Promise<void>
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
  allocationActivities: [],
  holidays: [],
  companyCalendarEvents: [],
  loading: false,
  lastFetchLeaves: 0,
  lastFetchAllocationActivities: 0,
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
  fetchAllocationActivities: async (from?: string, to?: string) => {
    try {
      const allocationActivities = await leaveService.getLeaveAllocationActivities(from, to)
      set({ allocationActivities, lastFetchAllocationActivities: Date.now() })
    } catch {
      // silently fail
    }
  },
  fetchAllocationActivitiesSilent: async (from?: string, to?: string) => {
    const now = Date.now()
    if (now - get().lastFetchAllocationActivities < CACHE_EXPIRY) {
      return
    }
    try {
      const allocationActivities = await leaveService.getLeaveAllocationActivities(from, to)
      set({ allocationActivities, lastFetchAllocationActivities: now })
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
    const updated = await leaveService.approveLeave(id)
    if (updated?.id) {
      set({
        leaves: get().leaves.map((l) => (l.id === updated.id ? updated : l)),
      })
    }
    void get().fetchLeaves().catch(() => {})
  },
  rejectLeave: async (id, reason) => {
    const updated = await leaveService.rejectLeave(id, reason)
    if (updated?.id) {
      set({
        leaves: get().leaves.map((l) => (l.id === updated.id ? updated : l)),
      })
    }
    void get().fetchLeaves().catch(() => {})
  },
  cancelLeave: async (id) => {
    const updated = await leaveService.cancelLeave(id)
    if (updated?.id) {
      set({
        leaves: get().leaves.map((l) => (l.id === updated.id ? updated : l)),
      })
    }
    void get().fetchLeaves().catch(() => {})
  },
  revokeApprovedLeave: async (id, reason) => {
    const updated = await leaveService.revokeApprovedLeave(id, reason)
    if (updated?.id) {
      set({
        leaves: get().leaves.map((l) => (l.id === updated.id ? updated : l)),
      })
    }
    void get().fetchLeaves().catch(() => {})
  },
  deleteLeave: async (id) => {
    await leaveService.deleteLeave(id)
    set({ leaves: get().leaves.filter((l) => l.id !== id) })
    void get().fetchLeaves().catch(() => {})
  },
  deleteAllLeaves: async () => {
    const { deletedCount } = await leaveService.deleteAllLeaves()
    set({ leaves: [], lastFetchLeaves: Date.now() })
    return deletedCount
  },
  addHoliday: async (h) => {
    const created = await leaveService.addHoliday(h)
    if (created?.id) {
      set({ holidays: [...get().holidays, created] })
    }
    void get().fetchHolidays().catch(() => {})
  },
  updateHoliday: async (id, h) => {
    const updated = await leaveService.updateHoliday(id, h)
    if (updated?.id) {
      set({
        holidays: get().holidays.map((x) => (x.id === updated.id ? updated : x)),
      })
    }
    void get().fetchHolidays().catch(() => {})
  },
  deleteHoliday: async (id) => {
    await leaveService.deleteHoliday(id)
    set({ holidays: get().holidays.filter((x) => x.id !== id) })
    void get().fetchHolidays().catch(() => {})
  },
  skipHoliday: async (id, reason) => {
    const updated = await leaveService.skipHoliday(id, reason)
    if (updated?.id) {
      set({
        holidays: get().holidays.map((x) => (x.id === updated.id ? updated : x)),
      })
    }
    void get().fetchHolidays().catch(() => {})
  },
  addCompanyCalendarEvent: async (payload) => {
    await calendarEventService.createCompanyCalendarEvent(payload)
    void get().fetchHolidays().catch(() => {})
  },
  updateCompanyCalendarEvent: async (id, payload) => {
    await calendarEventService.updateCompanyCalendarEvent(id, payload)
    void get().fetchHolidays().catch(() => {})
  },
  deleteCompanyCalendarEvent: async (id) => {
    await calendarEventService.deleteCompanyCalendarEvent(id)
    void get().fetchHolidays().catch(() => {})
  },
}))
