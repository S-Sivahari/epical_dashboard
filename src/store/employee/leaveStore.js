import { create } from 'zustand'
import { leaveHistory as initial } from '@pages/employee/data/mockData'

export const useLeaveStore = create((set) => ({
  requests: initial,
  addRequest: (request) =>
    set((s) => ({
      requests: [
        { ...request, id: Date.now(), status: 'Pending' },
        ...s.requests,
      ],
    })),
}))
