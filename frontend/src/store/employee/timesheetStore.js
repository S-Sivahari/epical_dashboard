import { create } from 'zustand'
import {
  fetchMyAssignedTasks,
  fetchMyAttendance,
  fetchMyActiveTask,
  fetchMySessions,
  checkIn as apiCheckIn,
  checkOut as apiCheckOut,
  startTask as apiStartTask,
  stopActiveTask as apiStopActiveTask,
} from '@services/employeeTimesheetService'

function mapSessionFromApi(entry) {
  const login = entry.loginTime ? new Date(entry.loginTime) : null
  const logout = entry.logoutTime ? new Date(entry.logoutTime) : null
  const fmt = (d) =>
    d
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '—'

  return {
    id: entry.id,
    project: entry.project,
    task: entry.task,
    start: fmt(login),
    end: fmt(logout),
    hours: entry.totalHours ?? (logout && login ? Math.round(((logout - login) / 3600000) * 10) / 10 : '—'),
    date: entry.date || (login ? login.toISOString().split('T')[0] : ''),
    loginTime: entry.loginTime,
    logoutTime: entry.logoutTime,
    taskStatus: entry.taskStatus,
  }
}

export const useTimesheetStore = create((set, get) => ({
  checkedIn: false,
  checkInTime: null,
  activeTask: null,
  assignedTasks: [],
  sessions: [],
  loading: false,
  initialized: false,

  hydrate: async () => {
    set({ loading: true })
    try {
      const [attendance, activeRes, tasks, sessions] = await Promise.all([
        fetchMyAttendance(),
        fetchMyActiveTask(),
        fetchMyAssignedTasks(),
        fetchMySessions(),
      ])

      const checkInTime = attendance.checkInTime ? new Date(attendance.checkInTime) : null
      let activeTask = null

      if (activeRes?.active?.timesheet) {
        const ts = activeRes.active.timesheet
        const assigned = activeRes.active.assignedTask
        activeTask = {
          timesheetId: ts.id,
          assignedTaskId: assigned?.id,
          project: ts.project,
          taskTitle: assigned?.title || ts.task,
          description: ts.task,
          startedAt: new Date(ts.loginTime),
        }
      }

      set({
        checkedIn: attendance.checkedIn,
        checkInTime,
        activeTask,
        assignedTasks: tasks,
        sessions: sessions.map(mapSessionFromApi),
        initialized: true,
      })
    } catch (err) {
      console.error('Failed to load timesheet state', err)
      set({ initialized: true })
    } finally {
      set({ loading: false })
    }
  },

  refreshSessions: async () => {
    try {
      const sessions = await fetchMySessions()
      set({ sessions: sessions.map(mapSessionFromApi) })
    } catch (err) {
      console.error(err)
    }
  },

  refreshAssignedTasks: async () => {
    try {
      const tasks = await fetchMyAssignedTasks()
      set({ assignedTasks: tasks })
    } catch (err) {
      console.error(err)
    }
  },

  checkIn: async () => {
    const data = await apiCheckIn()
    set({
      checkedIn: true,
      checkInTime: data.checkInTime ? new Date(data.checkInTime) : new Date(),
    })
    return data
  },

  checkOut: async () => {
    await apiCheckOut()
    set({ checkedIn: false, checkInTime: null, activeTask: null })
    await get().refreshSessions()
    await get().refreshAssignedTasks()
  },

  startTask: async ({ assignedTaskId, description }) => {
    const data = await apiStartTask(assignedTaskId, description)
    const assigned = data.assignedTask
    const ts = data.timesheet
    set({
      activeTask: {
        timesheetId: ts.id,
        assignedTaskId: assigned?.id,
        project: ts.project,
        taskTitle: assigned?.title || ts.task,
        description: ts.task,
        startedAt: new Date(data.startedAt || ts.loginTime),
      },
    })
    await get().refreshAssignedTasks()
    return data
  },

  stopTask: async () => {
    await apiStopActiveTask()
    set({ activeTask: null })
    await get().refreshSessions()
    await get().refreshAssignedTasks()
  },
}))
