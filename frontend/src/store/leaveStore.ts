import { create } from 'zustand'
import type { Holiday, LeaveRequest } from '@/types'
import * as leaveService from '@services/leaveService'

interface LeaveState {
  leaves: LeaveRequest[]
  holidays: Holiday[]
  loading: boolean
  lastFetchLeaves: number
  lastFetchHolidays: number
  fetchLeaves: () => Promise<void>
  fetchLeavesSilent: () => Promise<void>
  fetchHolidays: () => Promise<void>
  fetchHolidaysSilent: () => Promise<void>
  approveLeave: (id: string) => Promise<void>
  rejectLeave: (id: string, reason: string) => Promise<void>
  cancelLeave: (id: string, reason: string) => Promise<void>
  addHoliday: (h: Omit<Holiday, 'id'>) => Promise<void>
  updateHoliday: (id: string, h: Partial<Omit<Holiday, 'id'>>) => Promise<void>
  deleteHoliday: (id: string) => Promise<void>
}

// Cache expiry time in milliseconds (30 seconds)
const CACHE_EXPIRY = 30000

export const useLeaveStore = create<LeaveState>((set, get) => ({
  leaves: [],
  holidays: [],
  loading: false,
  lastFetchLeaves: 0,
  lastFetchHolidays: 0,
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
      const holidays = await leaveService.getHolidays()
      set({ holidays, lastFetchHolidays: Date.now() })
    } catch {
      // silently fail — interceptor handles 401 redirect
    }
  },
  fetchHolidaysSilent: async () => {
    // Only fetch if cache is stale (older than CACHE_EXPIRY)
    const now = Date.now()
    if (now - get().lastFetchHolidays < CACHE_EXPIRY) {
      return
    }
    try {
      const holidays = await leaveService.getHolidays()
      set({ holidays, lastFetchHolidays: now })
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
  cancelLeave: async (id, reason) => {
    await leaveService.cancelLeave(id, reason)
    await get().fetchLeaves()
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
}))
