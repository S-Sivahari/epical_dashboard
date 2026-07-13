import { create } from 'zustand'
import * as leaveService from '@services/leaveService'
import { useLeaveStore as useGlobalLeaveStore } from '@store/leaveStore'

export const useLeaveStore = create((set) => ({
  requests: [],
  loading: false,
  fetchRequests: async () => {
    set({ loading: true })
    try {
      const [active, history] = await Promise.all([
        leaveService.getLeaves(),
        leaveService.getLeaveHistory(),
      ])
      const byId = new Map()
      for (const row of [...active, ...history]) {
        byId.set(row.id, row)
      }
      set({ requests: [...byId.values()], loading: false })
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

    const globalFetch = useGlobalLeaveStore.getState().fetchLeaves
    if (typeof globalFetch === 'function') {
      void globalFetch().catch((err) => {
        console.error(err)
      })
    }

    return res
  },
}))
