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
import { formatSessionDuration } from '@utils/durationFormat'

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

function applyBootstrapAttendanceState(data) {
  const checkedIn = data.attendance?.checkedIn ?? false
  const autoCheckedOut = data.attendance?.autoCheckedOut ?? false
  const activeRes = checkedIn
    ? { active: data.active, pausedTasks: data.pausedTasks ?? [] }
    : { active: null, pausedTasks: [] }

  return {
    checkedIn,
    checkInTime: checkedIn && data.attendance?.checkInTime ? new Date(data.attendance.checkInTime) : null,
    activeTask: checkedIn ? mapActiveTaskFromApi(activeRes) : null,
    pausedTasks: checkedIn
      ? activeRes.pausedTasks.map(mapTaskEntryFromApi).filter(Boolean)
      : [],
    sessionStatus: autoCheckedOut
      ? data.attendance?.sessionStatus ?? 'Auto Checked-Out'
      : data.attendance?.sessionStatus ?? null,
    backendElapsedMs: 0,
    hasBackendElapsedData: false,
    backendElapsedLastFetch: null,
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
    durationLabel: formatSessionDuration(entry),
    date: entry.date || (login ? login.toISOString().split('T')[0] : ''),
    loginTime: entry.loginTime,
    logoutTime: entry.logoutTime,
    totalHours: entry.totalHours,
    totalPausedMs: entry.totalPausedMs || 0,
    autoCheckedOut: entry.autoCheckedOut ?? false,
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
  // NEW: All-time project hours (not filtered by date)
  allTimeProjectWiseHours: [],
  serverTimeSkew: 0,
  sessionsLoading: true,
  // ADDED: Backend-provided elapsed duration for timer accuracy after device shutdown
  backendElapsedMs: 0,
  backendTotalPausedMs: 0,
  hasBackendElapsedData: false,
  backendElapsedLastFetch: null,
  currentRange: { from: getPresetDateRange('This Month').start, to: getPresetDateRange('This Month').end },


  syncing: false,
  fetchingBootstrap: false,

  refreshAttendanceHistory: async ({ from, to } = {}) => {
    try {
      const activeFrom = from || get().currentRange.from
      const activeTo = to || get().currentRange.to
      const range = { from: activeFrom, to: activeTo }
      if (from && to) {
        set({ currentRange: { from, to } })
      }
      const records = await fetchMyAttendanceHistory(range)
      
      // FIXED: Deduplicate by ID and use equality check to prevent flickering from polling
      const deduped = new Map()
      records.forEach(r => {
        if (!deduped.has(r.id)) {
          deduped.set(r.id, r)
        }
      })
      const dedupedRecords = Array.from(deduped.values()).sort((a, b) => new Date(b.date) - new Date(a.date))
      
      set((state) => {
        const isSame = JSON.stringify(state.attendanceHistory) === JSON.stringify(dedupedRecords)
        return isSame ? {} : { attendanceHistory: dedupedRecords }
      })
      return records
    } catch (err) {
      console.error('Failed to load attendance history', err)
      return []
    }
  },

  refreshProjectWiseHours: async ({ from, to } = {}) => {
    try {
      const activeFrom = from || get().currentRange.from
      const activeTo = to || get().currentRange.to
      const range = { from: activeFrom, to: activeTo }
      if (from && to) {
        set({ currentRange: { from, to } })
      }
      const data = await fetchMyProjectWiseHours(range)
      const projects = Array.isArray(data?.projects) ? data.projects : []
      
      // FIXED: Deduplicate projects by name and use equality check to prevent flickering
      const deduped = new Map()
      projects.forEach(p => {
        if (!deduped.has(p.project)) {
          deduped.set(p.project, p)
        }
      })
      const dedupedProjects = Array.from(deduped.values())
      
      set((state) => {
        const isSame = JSON.stringify(state.projectWiseHours) === JSON.stringify(dedupedProjects)
        return isSame ? {} : { projectWiseHours: dedupedProjects }
      })
      return projects
    } catch (err) {
      console.error('Failed to load project-wise hours', err)
      set({ projectWiseHours: [] })
      return []
    }
  },

  // NEW: Fetch all-time project hours (from beginning of employment to today)
  refreshAllTimeProjectWiseHours: async () => {
    try {
      // Fetch from a very early date (2020) to today to get all projects ever worked on
      const allTimeRange = { from: '2020-01-01', to: new Date().toISOString().split('T')[0] }
      const data = await fetchMyProjectWiseHours(allTimeRange)
      const projects = Array.isArray(data?.projects) ? data.projects : []
      
      // FIXED: Deduplicate projects and use equality check to prevent flickering from polling
      const deduped = new Map()
      projects.forEach(p => {
        if (!deduped.has(p.project)) {
          deduped.set(p.project, p)
        }
      })
      const dedupedProjects = Array.from(deduped.values())
      
      set((state) => {
        const isSame = JSON.stringify(state.allTimeProjectWiseHours) === JSON.stringify(dedupedProjects)
        return isSame ? {} : { allTimeProjectWiseHours: dedupedProjects }
      })
      return projects
    } catch (err) {
      console.error('Failed to load all-time project-wise hours', err)
      set({ allTimeProjectWiseHours: [] })
      return []
    }
  },

  refreshSessionsForRange: async ({ from, to, background = false } = {}) => {
    if (!background) set({ sessionsLoading: true })
    try {
      const activeFrom = from || get().currentRange.from
      const activeTo = to || get().currentRange.to
      const range = { from: activeFrom, to: activeTo }
      if (from && to) {
        set({ currentRange: { from, to } })
      }
      const sessions = await fetchMySessions(range)
      // FIXED: Deduplicate by session ID to prevent duplicates from polling
      const deduped = new Map()
      const mapped = Array.isArray(sessions) ? sessions.map(mapSessionFromApi) : []
      mapped.forEach(s => {
        // Only keep the first occurrence of each session ID
        if (!deduped.has(s.id)) {
          deduped.set(s.id, s)
        }
      })
      const dedupedArray = Array.from(deduped.values())
      set({ sessions: dedupedArray, sessionsLoading: false })
      return sessions
    } catch (err) {
      console.error('Failed to load sessions for range', err)
      if (!background) {
        set({ sessions: [], sessionsLoading: false })
      } else {
        set({ sessionsLoading: false })
      }
      return []
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
    if (get().initialized || get().fetchingBootstrap) return
    set({ loading: true, fetchingBootstrap: true })
    try {
      const data = await fetchTimesheetBootstrap()

      const serverTimeSkew = data.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0
      const attendanceState = applyBootstrapAttendanceState(data)

      set({
        serverTimeSkew,
        ...attendanceState,
        attendance: data.attendance ?? null,
        assignedTasks: data.assignedTasks ?? [],
        sessions: (data.sessions ?? []).map(mapSessionFromApi),
        attendanceHistory: Array.isArray(data.attendanceHistory) ? data.attendanceHistory : [],
        projectWiseHours: Array.isArray(data.projectWiseHours) ? data.projectWiseHours : [],
        initialized: true,
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
      
      await get().fetchBackendElapsedData()
      if (!Array.isArray(data.projectWiseHours) || data.projectWiseHours.length === 0) {
        await get().refreshProjectWiseHours()
      }
    } catch (err) {
      console.error('Failed to load timesheet state', err)
      set({ initialized: true, sessionsLoading: false })
    } finally {
      set({ loading: false, fetchingBootstrap: false })
    }
  },

  syncAttendanceWithBackend: async () => {
    if (get().syncing) return
    set({ syncing: true })
    try {
      const data = await fetchTimesheetBootstrap()
      const serverTimeSkew = data.serverTime ? new Date(data.serverTime).getTime() - Date.now() : 0
      const attendanceState = applyBootstrapAttendanceState(data)
      const wasCheckedIn = get().checkedIn
      const autoCheckedOut = data.attendance?.autoCheckedOut ?? false

      set({
        serverTimeSkew,
        ...attendanceState,
        attendance: data.attendance ?? null,
        assignedTasks: data.assignedTasks ?? [],
        autoCheckoutInfo: {
          reminderSent: data.attendance?.reminderSent ?? false,
          autoCheckedOut,
          expectedCheckoutTime: data.attendance?.expectedCheckoutTime ?? null,
          autoCheckoutTime: data.attendance?.autoCheckoutTime ?? null,
          autoCheckoutEnabled: data.attendance?.autoCheckoutEnabled ?? true,
        },
      })

      // Always perform background refreshes of sessions and project hours using the active range filter so they never fluctuate or get overwritten with defaults!
      await Promise.all([
        get().refreshSessionsForRange({ background: true }),
        get().refreshProjectWiseHours(),
        get().fetchBackendElapsedData(),
      ])

      if (wasCheckedIn && !attendanceState.checkedIn) {
        await get().refreshAttendanceHistory()
      }
    } catch (err) {
      console.error('Failed to sync timesheet state with backend', err)
    } finally {
      set({ syncing: false })
    }
  },

  refreshSessions: async () => {
    await get().refreshSessionsForRange({ background: true })
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
    set({
      serverTimeSkew,
      checkedIn: false,
      checkInTime: null,
      activeTask: null,
      pausedTasks: [],
      sessionStatus: 'Completed',
      backendElapsedMs: 0,
      hasBackendElapsedData: false,
      backendElapsedLastFetch: null,
    })
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
