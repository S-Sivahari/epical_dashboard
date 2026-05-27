import { create } from 'zustand'
import { getPresetDateRange, getWeekRange } from '@pages/employee/lib/dateFilters'
import {
  fetchTimesheetBootstrap,
  fetchMyAssignedTasks,
  fetchMyAttendance,
  fetchMyAttendanceHistory,
  fetchMyActiveTask,
  fetchMySessions,
  fetchSessionStatus,
  fetchAutoCheckoutSettings,
  updateAutoCheckoutSettings as apiUpdateAutoCheckoutSettings,
  checkIn as apiCheckIn,
  checkOut as apiCheckOut,
  startTask as apiStartTask,
  stopActiveTask as apiStopActiveTask,
  pauseActiveTask as apiPauseActiveTask,
  resumeActiveTask as apiResumeActiveTask,
  completeActiveTask as apiCompleteActiveTask,
} from '@services/employeeTimesheetService'

function defaultMonthRange() {
  return getPresetDateRange('This Month')
}

function defaultWeekRange() {
  return getWeekRange()
}

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
  sessionStatus: null,
  autoCheckoutInfo: null,
  autoCheckoutSettings: null,
  attendanceHistory: [],
  serverTimeSkew: 0,
  sessionsLoading: true,


  refreshAttendanceHistory: async ({ from, to } = {}) => {
    try {
      const range = from && to ? { from, to } : defaultWeekRange()
      const records = await fetchMyAttendanceHistory(range)
      set({ attendanceHistory: records })
      return records
    } catch (err) {
      console.error('Failed to load attendance history', err)
      return []
    }
  },

  refreshSessionsForRange: async ({ from, to } = {}) => {
    set({ sessionsLoading: true })
    try {
      const range = from && to ? { from, to } : defaultMonthRange()
      const sessions = await fetchMySessions(range)
      set({ sessions: sessions.map(mapSessionFromApi) })
      return sessions
    } catch (err) {
      console.error('Failed to load sessions for range', err)
      return []
    } finally {
      set({ sessionsLoading: false })
    }
  },

  hydrate: async () => {
    if (get().initialized) return
    set({ loading: true })
    try {
      const data = await fetchTimesheetBootstrap()

      const serverTimeSkew = data.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0
      const activeRes = { active: data.active, pausedTasks: data.pausedTasks ?? [] }
      const checkInTime = data.attendance?.checkInTime ? new Date(data.attendance.checkInTime) : null
      const activeTask = mapActiveTaskFromApi(activeRes)
      const pausedTasks = activeRes.pausedTasks.map(mapTaskEntryFromApi).filter(Boolean)

      set({
        serverTimeSkew,
        checkedIn: data.attendance?.checkedIn ?? false,
        checkInTime,
        attendance: data.attendance ?? null,
        activeTask,
        pausedTasks,
        assignedTasks: data.assignedTasks ?? [],
        sessions: (data.sessions ?? []).map(mapSessionFromApi),
        attendanceHistory: Array.isArray(data.attendanceHistory) ? data.attendanceHistory : [],
        initialized: true,
        sessionStatus: data.attendance?.sessionStatus ?? null,
        autoCheckoutInfo: {
          reminderSent: data.attendance?.reminderSent ?? false,
          autoCheckedOut: data.attendance?.autoCheckedOut ?? false,
          expectedCheckoutTime: data.attendance?.expectedCheckoutTime ?? null,
          autoCheckoutTime: data.attendance?.autoCheckoutTime ?? null,
          autoCheckoutEnabled: data.attendance?.autoCheckoutEnabled ?? true,
        },
        autoCheckoutSettings: null,
        sessionsLoading: false,
      })
    } catch (err) {
      console.error('Failed to load timesheet state', err)
      set({ initialized: true, sessionsLoading: false })
    } finally {
      set({ loading: false })
    }
  },

  syncAttendanceWithBackend: async () => {
    try {
      const data = await fetchTimesheetBootstrap()
      const serverTimeSkew = data.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0
      const activeRes = { active: data.active, pausedTasks: data.pausedTasks ?? [] }
      const checkInTime = data.attendance?.checkInTime ? new Date(data.attendance.checkInTime) : null
      const activeTask = mapActiveTaskFromApi(activeRes)
      const pausedTasks = activeRes.pausedTasks.map(mapTaskEntryFromApi).filter(Boolean)

      set({
        serverTimeSkew,
        checkedIn: data.attendance?.checkedIn ?? false,
        checkInTime,
        attendance: data.attendance ?? null,
        activeTask,
        pausedTasks,
        assignedTasks: data.assignedTasks ?? [],
        sessions: (data.sessions ?? []).map(mapSessionFromApi),
        attendanceHistory: Array.isArray(data.attendanceHistory) ? data.attendanceHistory : [],
        sessionStatus: data.attendance?.sessionStatus ?? null,
        autoCheckoutInfo: {
          reminderSent: data.attendance?.reminderSent ?? false,
          autoCheckedOut: data.attendance?.autoCheckedOut ?? false,
          expectedCheckoutTime: data.attendance?.expectedCheckoutTime ?? null,
          autoCheckoutTime: data.attendance?.autoCheckoutTime ?? null,
          autoCheckoutEnabled: data.attendance?.autoCheckoutEnabled ?? true,
        }
      })
    } catch (err) {
      console.error('Failed to sync timesheet state with backend', err)
    }
  },

  refreshSessions: async () => {
    await get().refreshSessionsForRange()
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
    const serverTimeSkew = data.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0
    set({
      serverTimeSkew,
      checkedIn: true,
      checkInTime: data.checkInTime ? new Date(data.checkInTime) : new Date(),
      sessionStatus: data.sessionStatus || 'Active',
      attendance: {
        checkedIn: true,
        checkInTime: data.checkInTime || new Date().toISOString(),
        checkOutTime: null,
        sessionStatus: data.sessionStatus || 'Active',
        expectedCheckoutTime: data.expectedCheckoutTime || null,
        autoCheckoutTime: data.autoCheckoutTime || null,
      },
      autoCheckoutInfo: {
        active: true,
        reminderSent: false,
        autoCheckedOut: false,
        expectedCheckoutTime: data.expectedCheckoutTime || null,
        autoCheckoutTime: data.autoCheckoutTime || null,
        autoCheckoutEnabled: true,
      },
    })
    await Promise.all([get().refreshAttendanceHistory(), get().refreshSessionsForRange()])
    return data
  },

  checkOut: async () => {
    const data = await apiCheckOut()
    const serverTimeSkew = data?.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0
    set({ serverTimeSkew, checkedIn: false, checkInTime: null, activeTask: null, pausedTasks: [], sessionStatus: 'Completed' })
    if (data?.checkOutTime) {
      set((state) => ({
        attendance: {
          ...(state.attendance || {}),
          checkedIn: false,
          checkOutTime: data.checkOutTime,
          sessionStatus: 'Completed',
        },
        autoCheckoutInfo: null,
      }))
    }
    await get().refreshAssignedTasks()
    await Promise.all([get().refreshAttendanceHistory(), get().refreshSessionsForRange()])
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

  completeTask: async (timesheetId, description) => {
    const data = await apiCompleteActiveTask(timesheetId, description)
    await get().refreshActiveTask()
    await get().refreshSessions()
    await get().refreshAssignedTasks()
    return data
  },

  refreshSessionStatus: async () => {
    try {
      const status = await fetchSessionStatus()
      set({ autoCheckoutInfo: status, sessionStatus: status?.sessionStatus || null })
    } catch (err) {
      console.error(err)
    }
  },

  updateAutoCheckoutSettings: async (data) => {
    const result = await apiUpdateAutoCheckoutSettings(data)
    set({ autoCheckoutSettings: result })
    return result
  },
}))
