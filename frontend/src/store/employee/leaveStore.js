import { create } from 'zustand'
import * as leaveService from '@services/leaveService'

export const useLeaveStore = create((set) => ({
  requests: [],
  loading: false,
  fetchRequests: async () => {
    set({ loading: true })
    try {
      const data = await leaveService.getLeaves()
      set({ requests: data, loading: false })
    } catch (err) {
      console.error(err)
      set({ loading: false })
    }
  },
  addRequest: async (request) => {
    const res = await leaveService.createLeave(request)
    set((s) => ({
      requests: [res, ...s.requests],
    }))
  },
}))
