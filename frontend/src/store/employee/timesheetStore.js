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
  pauseActiveTask as apiPauseActiveTask,
  resumeActiveTask as apiResumeActiveTask,
  completeActiveTask as apiCompleteActiveTask,
} from '@services/employeeTimesheetService'

function mapTaskEntryFromApi(entry) {
  if (!entry?.timesheet) return null
  const ts = entry.timesheet
  const assigned = entry.assignedTask
  return {
    timesheetId: ts.id,
    assignedTaskId: assigned?.id,
    project: ts.project,
    taskTitle: assigned?.title || ts.task,
    description: ts.task,
    startedAt: new Date(ts.loginTime),
    paused: ts.isPaused || ts.taskStatus === 'Paused',
    pausedAt: ts.pausedAt ? new Date(ts.pausedAt) : null,
    totalPausedMs: ts.totalPausedMs || 0,
    taskStatus: ts.taskStatus,
    workflowStatus: ts.workflowStatus,
  }
}

function mapActiveTaskFromApi(activeRes) {
  if (!activeRes?.active) return null
  return mapTaskEntryFromApi(activeRes.active)
}

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
    workflowStatus: entry.workflowStatus,
    approvalStatus: entry.approvalStatus,
    status: entry.status,
    requestStatus: entry.requestStatus,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

export const useTimesheetStore = create((set, get) => ({
  checkedIn: false,
  checkInTime: null,
  activeTask: null,
  pausedTasks: [],
  assignedTasks: [],
  sessions: [],
  loading: false,
  initialized: false,
  attendance: null,

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

      activeTask = mapActiveTaskFromApi(activeRes)
      const pausedTasks = (activeRes?.pausedTasks || [])
        .map(mapTaskEntryFromApi)
        .filter(Boolean)

      set({
        checkedIn: attendance.checkedIn,
        checkInTime,
        attendance,
        activeTask,
        pausedTasks,
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

  refreshActiveTask: async () => {
    try {
      const activeRes = await fetchMyActiveTask()
      const activeTask = mapActiveTaskFromApi(activeRes)
      const pausedTasks = (activeRes?.pausedTasks || [])
        .map(mapTaskEntryFromApi)
        .filter(Boolean)
      set({ activeTask, pausedTasks })
    } catch (err) {
      console.error(err)
    }
  },

  checkIn: async () => {
    const data = await apiCheckIn()
    set({
      checkedIn: true,
      checkInTime: data.checkInTime ? new Date(data.checkInTime) : new Date(),
      attendance: {
        checkedIn: true,
        checkInTime: data.checkInTime || new Date().toISOString(),
        checkOutTime: null,
      },
    })
    return data
  },

  checkOut: async () => {
    const data = await apiCheckOut()
    set({ checkedIn: false, checkInTime: null, activeTask: null, pausedTasks: [] })
    if (data?.checkOutTime) {
      set((state) => ({
        attendance: {
          ...(state.attendance || {}),
          checkedIn: false,
          checkOutTime: data.checkOutTime,
        },
      }))
    }
    await get().refreshSessions()
    await get().refreshAssignedTasks()
  },

  startTask: async ({ assignedTaskId, description }) => {
    const data = await apiStartTask(assignedTaskId, description)
    await get().refreshActiveTask()
    await get().refreshAssignedTasks()
    return data
  },

  stopTask: async (timesheetId) => {
    const data = await apiStopActiveTask(timesheetId)
    await get().refreshActiveTask()
    await get().refreshSessions()
    await get().refreshAssignedTasks()
    return data
  },

  pauseTask: async (timesheetId) => {
    const data = await apiPauseActiveTask(timesheetId)
    await get().refreshActiveTask()
    await get().refreshAssignedTasks()
    return data
  },

  resumeTask: async (timesheetId) => {
    const data = await apiResumeActiveTask(timesheetId)
    await get().refreshActiveTask()
    await get().refreshAssignedTasks()
    return data
  },

  completeTask: async (timesheetId) => {
    const data = await apiCompleteActiveTask(timesheetId)
    await get().refreshActiveTask()
    await get().refreshSessions()
    await get().refreshAssignedTasks()
    return data
  },
}))
