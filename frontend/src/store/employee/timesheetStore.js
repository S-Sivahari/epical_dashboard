import { create } from 'zustand'
import { getPresetDateRange, getWeekRange } from '@pages/employee/lib/dateFilters'
import {
  fetchTimesheetBootstrap,
  fetchMyAssignedTasks,
  fetchMyAttendance,
  fetchMyAttendanceHistory,
  fetchMyActiveTask,
  fetchMySessions,
  fetchMyProjectWiseHours,
  fetchSessionStatus,
  fetchCurrentElapsed,
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
  projectWiseHours: [],
  serverTimeSkew: 0,
  sessionsLoading: true,
  // ADDED: Backend-provided elapsed duration for timer accuracy after device shutdown
  backendElapsedMs: 0,
  backendTotalPausedMs: 0,
  hasBackendElapsedData: false,
  backendElapsedLastFetch: null,


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

  refreshProjectWiseHours: async ({ from, to } = {}) => {
    try {
      const range = from && to ? { from, to } : defaultWeekRange()
      const data = await fetchMyProjectWiseHours(range)
      set({ projectWiseHours: Array.isArray(data?.projects) ? data.projects : [] })
      return data?.projects ?? []
    } catch (err) {
      console.error('Failed to load project-wise hours', err)
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

  fetchBackendElapsedData: async () => {
    try {
      const data = await fetchCurrentElapsed()
      if (data.hasActiveSession) {
        set({
          backendElapsedMs: data.elapsedMs,
          backendTotalPausedMs: data.totalPausedMs,
          hasBackendElapsedData: true,
          backendElapsedLastFetch: new Date(),
        })
        return data
      } else {
        set({ hasBackendElapsedData: false, backendElapsedMs: 0 })
        return null
      }
    } catch (err) {
      console.error('Failed to fetch backend elapsed data', err)
      return null
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
        projectWiseHours: Array.isArray(data.projectWiseHours) ? data.projectWiseHours : [],
        initialized: true,
        sessionsLoading: false,
        sessionStatus: data.attendance?.sessionStatus ?? null,
        autoCheckoutInfo: {
          reminderSent: data.attendance?.reminderSent ?? false,
          autoCheckedOut: data.attendance?.autoCheckedOut ?? false,
          expectedCheckoutTime: data.attendance?.expectedCheckoutTime ?? null,
          autoCheckoutTime: data.attendance?.autoCheckoutTime ?? null,
          autoCheckoutEnabled: data.attendance?.autoCheckoutEnabled ?? true,
        },
        autoCheckoutSettings: null,
      })
      
      await get().fetchBackendElapsedData()
      if (!Array.isArray(data.projectWiseHours) || data.projectWiseHours.length === 0) {
        await get().refreshProjectWiseHours()
      }
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
        projectWiseHours: Array.isArray(data.projectWiseHours) ? data.projectWiseHours : [],
        sessionStatus: data.attendance?.sessionStatus ?? null,
        autoCheckoutInfo: {
          reminderSent: data.attendance?.reminderSent ?? false,
          autoCheckedOut: data.attendance?.autoCheckedOut ?? false,
          expectedCheckoutTime: data.attendance?.expectedCheckoutTime ?? null,
          autoCheckoutTime: data.attendance?.autoCheckoutTime ?? null,
          autoCheckoutEnabled: data.attendance?.autoCheckoutEnabled ?? true,
        },
        sessionsLoading: false,
      })
      
      await get().fetchBackendElapsedData()
      await get().refreshProjectWiseHours()
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
    await Promise.all([
      get().refreshAttendanceHistory(),
      get().refreshSessionsForRange(),
      get().refreshProjectWiseHours(),
    ])
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
    await Promise.all([
      get().refreshAttendanceHistory(),
      get().refreshSessionsForRange(),
      get().refreshProjectWiseHours(),
    ])
  },

  startTask: async ({ assignedTaskId, description }) => {
    const data = await apiStartTask(assignedTaskId, description)
    if (data?.timesheet) {
      const activeTask = mapTaskEntryFromApi({
        timesheet: data.timesheet,
        assignedTask: data.assignedTask,
      })
      set((state) => {
        const nextAssigned = state.assignedTasks.map((t) =>
          t.id === data.assignedTask?.id ? data.assignedTask : t
        )
        return {
          activeTask,
          assignedTasks: nextAssigned,
        }
      })
    } else {
      await get().refreshActiveTask()
      await get().refreshAssignedTasks()
    }
    return data
  },

  stopTask: async (timesheetId) => {
    const data = await apiStopActiveTask(timesheetId)
    if (data?.timesheet) {
      set((state) => {
        const mappedSession = mapSessionFromApi(data.timesheet)
        const nextSessions = [
          mappedSession,
          ...state.sessions.filter((s) => s.id !== mappedSession.id),
        ]
        return {
          activeTask: null,
          sessions: nextSessions,
        }
      })
      await get().refreshAssignedTasks()
      await get().refreshProjectWiseHours()
    } else {
      await get().refreshActiveTask()
      await get().refreshSessions()
      await get().refreshAssignedTasks()
      await get().refreshProjectWiseHours()
    }
    return data
  },

  pauseTask: async (timesheetId) => {
    const data = await apiPauseActiveTask(timesheetId)
    if (data?.timesheet) {
      const mapped = mapTaskEntryFromApi({ timesheet: data.timesheet })
      set((state) => {
        const nextPaused = [
          mapped,
          ...state.pausedTasks.filter((t) => t.timesheetId !== mapped.timesheetId),
        ]
        return {
          activeTask: null,
          pausedTasks: nextPaused,
        }
      })
      await get().refreshAssignedTasks()
    } else {
      await get().refreshActiveTask()
      await get().refreshAssignedTasks()
    }
    return data
  },

  resumeTask: async (timesheetId) => {
    const data = await apiResumeActiveTask(timesheetId)
    if (data?.timesheet) {
      const mapped = mapTaskEntryFromApi({ timesheet: data.timesheet })
      set((state) => {
        const nextPaused = state.pausedTasks.filter((t) => t.timesheetId !== mapped.timesheetId)
        return {
          activeTask: mapped,
          pausedTasks: nextPaused,
        }
      })
      await get().refreshAssignedTasks()
    } else {
      await get().refreshActiveTask()
      await get().refreshAssignedTasks()
    }
    return data
  },

  completeTask: async (timesheetId, description) => {
    const data = await apiCompleteActiveTask(timesheetId, description)
    if (data?.timesheet) {
      set((state) => {
        const mappedSession = mapSessionFromApi(data.timesheet)
        const nextSessions = [
          mappedSession,
          ...state.sessions.filter((s) => s.id !== mappedSession.id),
        ]
        return {
          activeTask: null,
          sessions: nextSessions,
        }
      })
      await get().refreshAssignedTasks()
      await get().refreshProjectWiseHours()
    } else {
      await get().refreshActiveTask()
      await get().refreshSessions()
      await get().refreshAssignedTasks()
      await get().refreshProjectWiseHours()
    }
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
