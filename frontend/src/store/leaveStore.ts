import { create } from 'zustand'
import type { Holiday, LeaveRequest } from '@/types'
import * as leaveService from '@services/leaveService'

interface LeaveState {
  leaves: LeaveRequest[]
  holidays: Holiday[]
  loading: boolean
  fetchLeaves: () => Promise<void>
  fetchHolidays: () => Promise<void>
  approveLeave: (id: string) => Promise<void>
  rejectLeave: (id: string, reason: string) => Promise<void>
  cancelLeave: (id: string) => Promise<void>
  addHoliday: (h: Omit<Holiday, 'id'>) => Promise<void>
  updateHoliday: (id: string, h: Partial<Omit<Holiday, 'id'>>) => Promise<void>
  deleteHoliday: (id: string) => Promise<void>
}

export const useLeaveStore = create<LeaveState>((set, get) => ({
  leaves: [],
  holidays: [],
  loading: false,
  fetchLeaves: async () => {
    set({ loading: true })
    try {
      const leaves = await leaveService.getLeaves()
      set({ leaves, loading: false })
    } catch {
      set({ loading: false })
    }
  },
  fetchHolidays: async () => {
    try {
      const holidays = await leaveService.getHolidays()
      set({ holidays })
    } catch {
      // silently fail — interceptor handles 401 redirect
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
