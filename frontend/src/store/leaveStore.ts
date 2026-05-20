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
  rejectLeave: (id: string, rejectionReason: string) => Promise<void>
  addHoliday: (h: Omit<Holiday, 'id'>) => Promise<void>
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
  rejectLeave: async (id, rejectionReason) => {
    await leaveService.rejectLeave(id, rejectionReason)
    await get().fetchLeaves()
  },
  addHoliday: async (h) => {
    await leaveService.addHoliday(h)
    await get().fetchHolidays()
  },
}))
