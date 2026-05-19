import { create } from 'zustand'
import { workSessions as initialSessions } from '@pages/employee/data/mockData'

export const useTimesheetStore = create((set, get) => ({
  checkedIn: false,
  checkInTime: null,
  activeTask: null,
  sessions: initialSessions,
  checkIn: () => set({ checkedIn: true, checkInTime: new Date() }),
  checkOut: () => set({ checkedIn: false, checkInTime: null, activeTask: null }),
  startTask: (task) => set({ activeTask: { ...task, startedAt: new Date() } }),
  stopTask: () => {
    const { activeTask, sessions } = get()
    if (!activeTask) return
    const newSession = {
      id: Date.now(),
      project: activeTask.project,
      task: activeTask.description,
      start: activeTask.startedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      end: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      hours: 1,
      date: new Date().toISOString().split('T')[0],
    }
    set({ sessions: [newSession, ...sessions], activeTask: null })
  },
}))
