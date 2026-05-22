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

function mapActiveTaskFromApi(activeRes) {
  if (!activeRes?.active?.timesheet) return null
  const ts = activeRes.active.timesheet
  const assigned = activeRes.active.assignedTask
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

      set({
        checkedIn: attendance.checkedIn,
        checkInTime,
        attendance,
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
    set({ checkedIn: false, checkInTime: null, activeTask: null })
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
        paused: false,
        pausedAt: null,
        totalPausedMs: 0,
        taskStatus: ts.taskStatus || 'In Progress',
        workflowStatus: ts.workflowStatus || 'In Progress',
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

  pauseTask: async () => {
    const data = await apiPauseActiveTask()
    const ts = data.timesheet
    set((state) => ({
      activeTask: state.activeTask
        ? {
            ...state.activeTask,
            paused: true,
            pausedAt: new Date(data.pausedAt || ts.pausedAt || Date.now()),
            taskStatus: 'Paused',
            workflowStatus: ts.workflowStatus || 'Paused',
          }
        : null,
    }))
    await get().refreshAssignedTasks()
    return data
  },

  resumeTask: async () => {
    const data = await apiResumeActiveTask()
    const ts = data.timesheet
    set((state) => ({
      activeTask: state.activeTask
        ? {
            ...state.activeTask,
            paused: false,
            pausedAt: null,
            totalPausedMs: ts.totalPausedMs || 0,
            taskStatus: 'In Progress',
            workflowStatus: ts.workflowStatus || 'In Progress',
          }
        : null,
    }))
    await get().refreshAssignedTasks()
    return data
  },

  completeTask: async () => {
    await apiCompleteActiveTask()
    set({ activeTask: null })
    await get().refreshSessions()
    await get().refreshAssignedTasks()
  },
}))
