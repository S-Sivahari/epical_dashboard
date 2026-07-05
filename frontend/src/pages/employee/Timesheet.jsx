import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, LogOut, Loader2, AlertTriangle, Coffee, BarChart3, History } from 'lucide-react'
import { ProjectAnalysisLaunchButton } from '@components/admin/ProjectAnalysisLaunchButton'
import { Button } from '@components/employee/ui/button'
import { Textarea } from '@components/employee/ui/textarea'
import { DataTable } from '@components/employee/shared/DataTable'
import { DateRangePicker } from '@components/employee/shared/DateRangePicker'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { formatSessionDuration, formatWorkedDuration, formatDurationFromMs } from '@utils/durationFormat'
import { useToast } from '@components/employee/shared/ToastProvider'
import { getPresetDateRange, getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'
import {
  buildWeeklyHoursChartData,
  todayMsFromChart,
} from '@utils/attendanceWeeklyHours'
import { TimesheetCheckInDialog } from '@pages/employee/TimesheetCheckInDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/employee/ui/dialog'
import {
  WORK_BREAK_OPTIONS,
  formatBreakCountdown,
} from '@utils/workBreaks'
import { EmployeePageLoading } from '@components/employee/layout/EmployeePageLoading'
import { CheckoutWorkDaySelector } from '@components/employee/shared/CheckoutWorkDaySelector'
import { EmployeeBreakTimeToday } from '@components/employee/shared/EmployeeBreakTimeToday'

const TimesheetWeeklyChart = lazy(() =>
  import('@pages/employee/TimesheetWeeklyChart').then((m) => ({ default: m.TimesheetWeeklyChart })),
)

const TimesheetProjectWiseChart = lazy(() =>
  import('@pages/employee/TimesheetProjectWiseChart').then((m) => ({
    default: m.TimesheetProjectWiseChart,
  })),
)

function stripTaskLabelPrefix(taskText, { taskTitle, projectName } = {}) {
  let s = String(taskText || '').trim()
  if (!s) return ''
  const prefixes = [
    taskTitle ? `${taskTitle} — ` : '',
    projectName ? `${projectName} — ` : '',
    projectName ? `Work on ${projectName} — ` : '',
  ].filter(Boolean)
  for (const prefix of prefixes) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length).trim()
      break
    }
  }
  if (/^Work on .+? — /i.test(s)) {
    return s.replace(/^Work on .+? — /i, '').trim()
  }
  return s
}

const taskSchema = z.object({
  assignedTaskId: z.string().min(1, 'Select an assigned project'),
  cellId: z.string().optional().default(''),
  description: z.string().optional().default(''),
})

const historyColumns = [
  { key: 'date', label: 'Date' },
  { key: 'project', label: 'Project' },
  { key: 'checkIn', label: 'Check in' },
  { key: 'checkOut', label: 'Check out' },
  { key: 'break', label: 'Break' },
  { key: 'duration', label: 'Worked' },
  { key: 'dayType', label: 'Day' },
]

const CHART_HEIGHT = 260
const HISTORY_VISIBLE_ROW_LIMIT = 10

function formatTimeLabel(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatWorkDayTypeLabel(workDayType, autoCheckedOut) {
  if (workDayType === 'half_day') return 'Half day'
  if (workDayType === 'full_day') return autoCheckedOut ? 'Full day (auto)' : 'Full day'
  if (autoCheckedOut) return 'Full day (auto)'
  return '—'
}

function formatBreakMsLabel(breakMs) {
  if (!breakMs || breakMs <= 0) return '—'
  return formatDurationFromMs(breakMs)
}

function isSessionApprovedByAdmin(session) {
  const approval = session.approvalStatus || session.status || 'Pending'
  return session.taskStatus === 'Completed' && approval === 'Approved'
}

export default function Timesheet() {
  const {
    checkedIn,
    checkInTime,
    attendance,
    activeTask,
    pausedTasks,
    assignedTasks,
    sessions,
    initialized,
    hydrate,
    checkIn,
    checkOut,
    startTask,
    completeTask,
    startBreak,
    endBreak,
    attendanceHistory,
    serverTimeSkew,
    sessionsLoading,
    projectWiseHours,
    allTimeProjectWiseHours,
    timesheetEligible,
  } = useTimesheetStore()
  const { toast } = useToast()
  const defaultHistoryRange = getPresetDateRange('This Month')
  const [historyStart, setHistoryStart] = useState(defaultHistoryRange.start)
  const [historyEnd, setHistoryEnd] = useState(defaultHistoryRange.end)
  const [historyPreset, setHistoryPreset] = useState('This Month')
  const [submitting, setSubmitting] = useState(false)
  const [liveNow, setLiveNow] = useState(() => Date.now() + (serverTimeSkew || 0))
  const [checkoutReview, setCheckoutReview] = useState(false)
  const [checkoutWorkDayType, setCheckoutWorkDayType] = useState('full_day')
  const [checkoutError, setCheckoutError] = useState('')
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false)
  const [breakWaitDialogOpen, setBreakWaitDialogOpen] = useState(false)

  const [isInitialLoading, setIsInitialLoading] = useState(true)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (initialized) {
      void useTimesheetStore.getState().refreshAllTimeProjectWiseHours()
    }
  }, [initialized])

  useEffect(() => {
    let active = true
    if (initialized) {
      setIsInitialLoading(true)
      void Promise.all([
        useTimesheetStore.getState().refreshAttendanceHistory({ from: historyStart, to: historyEnd }),
        useTimesheetStore.getState().refreshProjectWiseHours({ from: historyStart, to: historyEnd }),
      ]).finally(() => {
        if (active) setIsInitialLoading(false)
      })
    }
    return () => {
      active = false
    }
  }, [initialized, historyStart, historyEnd])

  useEffect(() => {
    const onFocus = () => {
      const { refreshAssignedTasks, refreshSessions, refreshActiveTask } = useTimesheetStore.getState()
      void refreshAssignedTasks()
      void refreshSessions()
      void refreshActiveTask()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const hasAwaitingApproval = useMemo(
    () =>
      sessions.some((s) => s.taskStatus === 'Completed' && !isSessionApprovedByAdmin(s)) ||
      assignedTasks.some((t) => t.status === 'pending_review'),
    [sessions, assignedTasks],
  )

  useEffect(() => {
    if (!initialized || !hasAwaitingApproval) return undefined
    const refresh = () => {
      const { refreshAssignedTasks, refreshSessions, refreshActiveTask } = useTimesheetStore.getState()
      void refreshAssignedTasks()
      void refreshSessions()
      void refreshActiveTask()
    }
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [initialized, hasAwaitingApproval])

  useEffect(() => {
    if (!initialized || !checkedIn) return undefined
    const sync = () => void useTimesheetStore.getState().syncAttendanceWithBackend()
    const refreshElapsed = () => void useTimesheetStore.getState().fetchBackendElapsedData()
    refreshElapsed()
    const syncId = setInterval(sync, 30000)
    const elapsedId = setInterval(refreshElapsed, 15000)
    return () => {
      clearInterval(syncId)
      clearInterval(elapsedId)
    }
  }, [initialized, checkedIn])

  useEffect(() => {
    if (!checkedIn) return undefined
    const tick = () => setLiveNow(Date.now() + (serverTimeSkew || 0))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [checkedIn, serverTimeSkew])

  const { register, setValue, watch, reset, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { assignedTaskId: '', cellId: '', description: '' },
  })

  const selectedTaskId = watch('assignedTaskId')
  const selectedCellId = watch('cellId')
  const workDescription = watch('description')
  const startableTasks = useMemo(
    () => assignedTasks.filter((t) => t.status !== 'completed'),
    [assignedTasks],
  )

  const taskStatusCounts = useMemo(() => {
    const uniqueProjectIds = new Set(
      assignedTasks.map((t) => t.projectId || t.projectName).filter(Boolean),
    )
    const total = uniqueProjectIds.size
    const inProgress = assignedTasks.filter(
      (t) =>
        t.status === 'in_progress' ||
        t.status === 'pending_review' ||
        t.status === 'Active' ||
        !t.status,
    ).length
    const completed = assignedTasks.filter(
      (t) => t.status === 'completed' || t.status === 'Completed',
    ).length
    const cancelled = assignedTasks.filter(
      (t) => t.status === 'cancelled' || t.status === 'Cancelled',
    ).length

    return { total, inProgress, completed, cancelled }
  }, [assignedTasks])

  const workNoteFromTask = (work) =>
    stripTaskLabelPrefix(work?.description, {
      taskTitle: work?.taskTitle,
      projectName: work?.project,
    })

  const selectedTask = startableTasks.find((t) => t.id === selectedTaskId)
  const currentWorkTask = activeTask || pausedTasks[0] || null
  const activeWorkDescription = workNoteFromTask(currentWorkTask)
  const breakState = attendance?.breaks
  const activeBreak = breakState?.activeBreak ?? null
  const activeBreakRemainingMs = activeBreak?.endsAt
    ? Math.max(0, new Date(activeBreak.endsAt).getTime() - liveNow)
    : 0
  const activeBreakMinRemainingMs = activeBreak?.minEndsAt
    ? Math.max(0, new Date(activeBreak.minEndsAt).getTime() - liveNow)
    : 0
  const canEndBreak = activeBreak?.canEnd ?? activeBreakMinRemainingMs <= 0
  const onBreak = Boolean(activeBreak)

  useEffect(() => {
    if (checkedIn && currentWorkTask) {
      if (currentWorkTask.assignedTaskId) {
        setValue('assignedTaskId', currentWorkTask.assignedTaskId, { shouldValidate: true })
      }
      setValue(
        'description',
        stripTaskLabelPrefix(currentWorkTask.description, {
          taskTitle: currentWorkTask.taskTitle,
          projectName: currentWorkTask.project,
        }),
        { shouldValidate: true },
      )
    }
  }, [
    checkedIn,
    currentWorkTask?.timesheetId,
    currentWorkTask?.description,
    currentWorkTask?.assignedTaskId,
    currentWorkTask?.taskTitle,
    currentWorkTask?.project,
    setValue,
  ])

  const onCheckIn = async () => {
    const valid = await trigger(['assignedTaskId'])
    if (!valid) return

    const cellId = selectedCellId && selectedCellId !== '__none__' ? selectedCellId : undefined

    try {
      setSubmitting(true)
      setCheckoutReview(false)
      setCheckoutError('')
      await checkIn()
      try {
        const result = await startTask({
          assignedTaskId: selectedTaskId,
          description: String(workDescription || '').trim(),
          cellId,
        })
        setCheckInDialogOpen(false)
        const projectLabel = selectedTask?.projectName || selectedTask?.title || 'your project'
        if (result?.cellWorkStarted) {
          toast({
            title: 'Checked in',
            description: `Project timer started for ${projectLabel}. Cell work started on ${result.cellWorkStarted.cellName}.`,
          })
        } else {
          toast({
            title: 'Checked in',
            description: `Timer started for ${projectLabel}.`,
          })
        }
        if (result?.cellWorkError) {
          toast({
            title: 'Cell work not started',
            description: result.cellWorkError,
            variant: 'destructive',
          })
        }
      } catch (startErr) {
        try {
          await checkOut()
        } catch {
          /* revert */
        }
        throw startErr
      }
    } catch (err) {
      toast({
        title: 'Check in failed',
        description: err.response?.data?.error || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openCheckInDialog = () => {
    setCheckoutReview(false)
    setCheckoutError('')
    setCheckInDialogOpen(true)
  }

  const beginCheckOut = () => {
    setCheckoutReview(true)
    setCheckoutError('')
    if (currentWorkTask?.description) {
      setValue('description', workNoteFromTask(currentWorkTask), { shouldValidate: true })
    }
    document.getElementById('work-session')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const cancelCheckOut = () => {
    setCheckoutReview(false)
    setCheckoutError('')
    if (currentWorkTask?.description) {
      setValue('description', workNoteFromTask(currentWorkTask), { shouldValidate: true })
    }
  }

  const onConfirmCheckOut = async () => {
    const summary = String(workDescription || '').trim()

    try {
      setSubmitting(true)
      setCheckoutError('')
      if (currentWorkTask?.timesheetId) {
        await completeTask(currentWorkTask.timesheetId, summary)
      }
      await checkOut(checkoutWorkDayType)
      setCheckoutReview(false)
      setCheckoutWorkDayType('full_day')
      reset({ assignedTaskId: '', description: '' })
      toast({
        title: 'Checked out',
        description: 'Your work was submitted for admin approval.',
      })
    } catch (err) {
      const code = err.response?.data?.code
      const message = err.response?.data?.error || 'Please try again.'
      if (code === 'USE_HALF_DAY_CHECKOUT') {
        setCheckoutWorkDayType('half_day')
      }
      setCheckoutError(message)
      toast({
        title: 'Check out failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onStartBreak = async (breakType) => {
    try {
      setSubmitting(true)
      await startBreak(breakType)
      const option = WORK_BREAK_OPTIONS.find((item) => item.type === breakType)
      toast({
        title: `${option?.label || 'Break'} started`,
        description: `${option?.durationMinutes || 0} minute break in progress.`,
      })
    } catch (err) {
      toast({
        title: 'Could not start break',
        description: err.response?.data?.error || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onEndBreak = async () => {
    if (!canEndBreak) {
      setBreakWaitDialogOpen(true)
      return
    }
    try {
      setSubmitting(true)
      await endBreak()
      toast({ title: 'Break ended', description: 'You can resume your task.' })
    } catch (err) {
      if (err.response?.data?.code === 'BREAK_MIN_NOT_REACHED') {
        setBreakWaitDialogOpen(true)
        return
      }
      toast({
        title: 'Could not end break',
        description: err.response?.data?.error || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const historyRange = useMemo(
    () => ({ start: historyStart, end: historyEnd }),
    [historyStart, historyEnd],
  )

  const weekRange = useMemo(() => getWeekRange(), [liveNow])

  const weeklyHours = useMemo(
    () =>
      buildWeeklyHoursChartData(sessions, {
        weekRange,
        attendanceHistory,
        checkedIn,
        liveNow,
        activeTask,
        pausedTasks,
      }),
    [sessions, weekRange, attendanceHistory, checkedIn, liveNow, activeTask, pausedTasks],
  )

  const todayMs = todayMsFromChart(weeklyHours)

  const projectBreakdown = useMemo(() => {
    const hoursByProjectId = new Map()
    const hoursByProjectName = new Map()
    ;(allTimeProjectWiseHours ?? []).forEach((row) => {
      if (row.projectId) hoursByProjectId.set(String(row.projectId), row)
      if (row.project) hoursByProjectName.set(String(row.project).trim(), row)
    })

    const seen = new Set()
    const rows = []
    for (const task of startableTasks) {
      const projectId = task.projectId ? String(task.projectId) : ''
      const projectName = String(task.projectName || '').trim()
      const key = projectId || projectName
      if (!key || seen.has(key)) continue
      seen.add(key)

      const hoursRow =
        (projectId && hoursByProjectId.get(projectId)) ||
        (projectName && hoursByProjectName.get(projectName)) ||
        null

      rows.push({
        projectId: projectId || hoursRow?.projectId || '',
        project: projectName || hoursRow?.project || 'Unknown',
        hours: hoursRow?.hours ?? 0,
        sessions: hoursRow?.sessions ?? 0,
      })
    }

    return rows.sort((a, b) => b.hours - a.hours || a.project.localeCompare(b.project))
  }, [startableTasks, allTimeProjectWiseHours])

  const projectWiseTotal = useMemo(
    () => projectBreakdown.reduce((sum, project) => sum + (project.hours || 0), 0),
    [projectBreakdown],
  )

  const unifiedHistory = useMemo(() => {
    return (attendanceHistory ?? [])
      .filter((seg) => isDateInRange(seg.date, historyRange.start, historyRange.end))
      .filter((seg) => seg.checkOutTime)
      .map((seg) => {
        const loginMs = seg.checkInTime ? new Date(seg.checkInTime).getTime() : 0
        const workedMs =
          typeof seg.displayWorkedMs === 'number'
            ? seg.displayWorkedMs
            : typeof seg.sessionWorkedMs === 'number'
              ? seg.sessionWorkedMs
              : 0
        return {
          id: seg.id,
          sortAt: loginMs,
          date: seg.date,
          project:
            seg.project && seg.project !== '—'
              ? seg.project
              : Array.isArray(seg.projects) && seg.projects.length === 1
                ? seg.projects[0]
                : Array.isArray(seg.projects) && seg.projects.length > 1
                  ? 'Multiple'
                  : '—',
          checkIn: formatTimeLabel(seg.checkInTime),
          checkOut: formatTimeLabel(seg.checkOutTime),
          break: formatBreakMsLabel(seg.breakMs),
          duration: workedMs > 0 || seg.checkOutTime ? formatDurationFromMs(workedMs) : '—',
          dayType: formatWorkDayTypeLabel(seg.workDayType, seg.autoCheckedOut),
          statusNote: seg.autoCheckedOut ? 'Auto Checked-Out' : null,
        }
      })
      .sort((a, b) => b.sortAt - a.sortAt)
  }, [attendanceHistory, historyRange])

  if (!initialized) {
    return (
      <div className="emp-timesheet-page dashboard-surface flex min-h-0 flex-1 flex-col" data-employee-timesheet>
        <EmployeePageLoading />
      </div>
    )
  }

  return (
    <div className="emp-timesheet-page dashboard-surface emp-page-content-in flex min-h-0 flex-1 flex-col" data-employee-timesheet>
      <div className="emp-timesheet-shell">
      <div className="emp-timesheet-hero">
        <div className="emp-timesheet-hero-intro">
          <h1 className="emp-timesheet-hero-title">Projects & Timesheets</h1>
        </div>
        <div className="emp-timesheet-hero-stats">
          <ProjectAnalysisLaunchButton
            audience="employee"
            className="projects-hero-tab-btn projects-hero-tab-btn--secondary"
          />
          <div className="emp-timesheet-hero-metrics" aria-label="Assigned project counts">
          <div className="emp-timesheet-hero-stat">
            <span className="emp-timesheet-hero-stat-label">Projects</span>
            <span className="emp-timesheet-hero-stat-value">{taskStatusCounts.total}</span>
          </div>
          <div className="emp-timesheet-hero-stat emp-timesheet-hero-stat--blue">
            <span className="emp-timesheet-hero-stat-dot" aria-hidden />
            <span className="emp-timesheet-hero-stat-label">In Progress</span>
            <span className="emp-timesheet-hero-stat-value">{taskStatusCounts.inProgress}</span>
          </div>
          <div className="emp-timesheet-hero-stat emp-timesheet-hero-stat--green">
            <span className="emp-timesheet-hero-stat-dot" aria-hidden />
            <span className="emp-timesheet-hero-stat-label">Completed</span>
            <span className="emp-timesheet-hero-stat-value">{taskStatusCounts.completed}</span>
          </div>
          <div className="emp-timesheet-hero-stat emp-timesheet-hero-stat--red">
            <span className="emp-timesheet-hero-stat-dot" aria-hidden />
            <span className="emp-timesheet-hero-stat-label">Cancelled</span>
            <span className="emp-timesheet-hero-stat-value">{taskStatusCounts.cancelled}</span>
          </div>
          </div>
        </div>
      </div>

      <div className="emp-timesheet-top-grid">
        <section className="emp-timesheet-card emp-timesheet-session-compact emp-timesheet-top-panel" id="work-session">
          <div className="emp-timesheet-section-head emp-timesheet-section-head--split">
            <div className="emp-timesheet-section-head__title">
              <span className="emp-timesheet-section-icon" aria-hidden>
                <LogIn className="h-4 w-4" />
              </span>
              <h3 className="emp-timesheet-card-title">Work Session</h3>
            </div>
            {timesheetEligible && checkedIn && !checkoutReview ? (
              <EmployeeBreakTimeToday
                breaks={attendance?.breaks}
                serverTimeSkew={serverTimeSkew}
                compact
                className="emp-timesheet-session-break-today"
              />
            ) : null}
          </div>
          <div className="emp-timesheet-card-body emp-timesheet-session-compact-body">
            {!timesheetEligible ? (
              <div className="emp-timesheet-session-main emp-timesheet-session-stack px-2 py-4 text-center">
                <p className="text-sm font-semibold text-slate-800">Timesheet unavailable</p>
                <p className="mt-1 text-xs text-slate-600">
                  Private employee records are not included in project check-in or timesheets.
                </p>
              </div>
            ) : null}

            {timesheetEligible && !checkedIn && attendance?.autoCheckedOut ? (
              <div className="mx-2.5 mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Auto checked out
                </div>
              </div>
            ) : null}

            {timesheetEligible && checkoutReview ? (
              <div className="emp-timesheet-session-main emp-timesheet-checkout-panel">
                <p className="emp-timesheet-session-note emp-timesheet-session-note--checkout text-amber-800">
                  Update summary before checking out.
                </p>
                <CheckoutWorkDaySelector
                  value={checkoutWorkDayType}
                  onChange={setCheckoutWorkDayType}
                  disabled={submitting}
                  className="mb-3"
                />
                <Textarea
                  className="emp-timesheet-session-desc emp-timesheet-session-desc--checkout"
                  {...register('description')}
                  placeholder="Update your work summary before checking out…"
                />
                {checkoutError ? (
                  <p className="emp-timesheet-session-note emp-timesheet-session-note--error text-danger">
                    {checkoutError}
                  </p>
                ) : null}
              </div>
            ) : timesheetEligible && checkedIn ? (
              <div className="emp-timesheet-session-main emp-timesheet-session-stack emp-timesheet-session-stack--checked-in">
                <div className="emp-timesheet-session-desc-panel">
                  <p className="emp-timesheet-session-desc-label">Work description</p>
                  <div className="emp-timesheet-session-desc emp-timesheet-session-desc--active timesheet-panel-scroll">
                    {activeWorkDescription || (
                      <span className="emp-timesheet-session-desc-placeholder">No work description</span>
                    )}
                  </div>
                </div>
              </div>
            ) : timesheetEligible ? (
              <div className="emp-timesheet-session-main emp-timesheet-session-stack">
                <button
                  type="button"
                  className="emp-timesheet-session-desc emp-timesheet-session-desc--idle"
                  onClick={openCheckInDialog}
                  disabled={submitting || startableTasks.length === 0}
                >
                  <span className="emp-timesheet-session-desc-placeholder">
                    Describe what you&apos;re working on…
                  </span>
                </button>
                <Button
                  type="button"
                  onClick={openCheckInDialog}
                  disabled={submitting || startableTasks.length === 0}
                  className="emp-ts-btn-primary emp-timesheet-session-action h-10 w-full gap-2 text-sm"
                >
                  <LogIn className="h-4 w-4 shrink-0" />
                  Check In
                </Button>
              </div>
            ) : null}

            {timesheetEligible && checkedIn && !checkoutReview ? (
              <div className="emp-timesheet-breaks">
                <div className="emp-timesheet-breaks-header">
                  <div className="flex items-center gap-1.5">
                    <Coffee className="h-3.5 w-3.5 text-primary" aria-hidden />
                    <p className="emp-timesheet-breaks-title">Daily breaks</p>
                  </div>
                </div>

                {onBreak ? (
                  <div className="emp-timesheet-break-active">
                    <div className="min-w-0">
                      <p className="emp-timesheet-break-active-label">
                        {WORK_BREAK_OPTIONS.find((item) => item.type === activeBreak?.type)?.label || 'Break'} in
                        progress
                      </p>
                      <p className="emp-timesheet-break-active-time">
                        {formatBreakCountdown(activeBreakRemainingMs)} remaining
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void onEndBreak()}
                      disabled={submitting}
                      className="emp-ts-btn-end-break shrink-0"
                    >
                      End break
                    </Button>
                  </div>
                ) : (
                  <div className="emp-timesheet-breaks-grid">
                    {WORK_BREAK_OPTIONS.map((option) => {
                      const used = Boolean(breakState?.[option.type]?.used)
                      return (
                        <button
                          key={option.type}
                          type="button"
                          className={`emp-timesheet-break-btn${used ? ' is-used' : ''}`}
                          onClick={() => void onStartBreak(option.type)}
                          disabled={submitting || used || onBreak}
                        >
                          <span className="emp-timesheet-break-btn-label">{option.label}</span>
                          <span className="emp-timesheet-break-btn-duration">{option.durationMinutes} min</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {timesheetEligible && checkoutReview ? (
              <div className="emp-timesheet-session-footer">
                <Button
                  type="button"
                  onClick={onConfirmCheckOut}
                  disabled={submitting}
                  className="emp-ts-btn-checkout emp-timesheet-session-action h-10 w-full gap-2 text-sm"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Check Out
                </Button>
              </div>
            ) : timesheetEligible && checkedIn ? (
              <div className="emp-timesheet-session-footer">
                <Button
                  type="button"
                  onClick={beginCheckOut}
                  disabled={submitting}
                  className="emp-ts-btn-checkout emp-timesheet-session-action h-10 w-full gap-2 text-sm"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Check Out
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="emp-timesheet-card emp-timesheet-chart-panel emp-timesheet-top-panel">
          <div className="emp-timesheet-section-head emp-timesheet-section-head--split">
            <div className="emp-timesheet-section-head__title">
              <span className="emp-timesheet-section-icon" aria-hidden>
                <BarChart3 className="h-4 w-4" />
              </span>
              <h3 className="emp-timesheet-card-title">Hours this week</h3>
            </div>
            <div className="emp-timesheet-chart-header-stats">
              <div className="emp-timesheet-chart-stat">
                <span className="emp-timesheet-chart-stat-label">Today</span>
                <span className="emp-timesheet-chart-stat-value">
                  {formatWorkedDuration(todayMs)}
                </span>
              </div>
            </div>
          </div>
          <div className="emp-timesheet-card-body emp-timesheet-chart-body emp-timesheet-panel-surface">
            <Suspense
              fallback={
                <div className="flex h-full min-h-[12rem] items-center justify-center text-xs text-muted">
                  Loading chart…
                </div>
              }
            >
              <TimesheetWeeklyChart data={weeklyHours} height={CHART_HEIGHT} />
            </Suspense>
          </div>
        </section>
      </div>

      <section className="emp-timesheet-card emp-timesheet-chart-panel emp-timesheet-chart-panel--breakdown">
        <div className="emp-timesheet-section-head emp-timesheet-section-head--split">
          <div className="emp-timesheet-section-head__title">
            <span className="emp-timesheet-section-icon" aria-hidden>
              <BarChart3 className="h-4 w-4" />
            </span>
            <h3 className="emp-timesheet-card-title">Project breakdown</h3>
          </div>
          <span className="emp-timesheet-chart-meta">
            {formatWorkedDuration(projectWiseTotal * 3600000)} total
          </span>
        </div>
        <div className="emp-timesheet-card-body emp-timesheet-breakdown-body">
          <Suspense
            fallback={
              <div className="flex min-h-[12rem] items-center justify-center text-xs text-muted">
                Loading chart…
              </div>
            }
          >
            <TimesheetProjectWiseChart
              data={projectBreakdown}
              emptyHint={
                startableTasks.length === 0
                  ? 'No projects assigned yet — contact your admin.'
                  : 'Hours appear after you log time on assigned projects.'
              }
            />
          </Suspense>
        </div>
      </section>

      <section className="emp-timesheet-card emp-timesheet-history-panel">
        <div className="emp-timesheet-section-head emp-timesheet-section-head--split emp-timesheet-history-header">
          <div className="emp-timesheet-section-head__title">
            <span className="emp-timesheet-section-icon" aria-hidden>
              <History className="h-4 w-4" />
            </span>
            <h3 className="emp-timesheet-card-title">Work History</h3>
          </div>
          <div className="relative z-20 shrink-0">
            <DateRangePicker
              startDate={historyStart}
              endDate={historyEnd}
              preset={historyPreset}
              onChange={(start, end, preset) => {
                setHistoryStart(start)
                setHistoryEnd(end)
                setHistoryPreset(preset)
                void Promise.all([
                  useTimesheetStore.getState().refreshAttendanceHistory({ from: start, to: end }),
                  useTimesheetStore.getState().refreshProjectWiseHours({ from: start, to: end }),
                ])
              }}
            />
          </div>
        </div>

        <div className="emp-timesheet-card-body emp-timesheet-history-body">
          {(isInitialLoading || sessionsLoading) && unifiedHistory.length === 0 ? (
            <div className="space-y-2 p-3">
              <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/80" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/60" />
              <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/60" />
            </div>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col">
              {(isInitialLoading || sessionsLoading) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
              <div className="emp-timesheet-history-scroll timesheet-panel-scroll emp-timesheet-history-scroll--bounded">
                <DataTable
                  columns={historyColumns}
                  data={unifiedHistory}
                  compact
                  embedded
                  stickyHeader={unifiedHistory.length > 0}
                  emptyMessage="No work logs for this date range."
                />
                {unifiedHistory.length > HISTORY_VISIBLE_ROW_LIMIT ? (
                  <div className="emp-timesheet-history-fade" aria-hidden />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>
      </div>

      <TimesheetCheckInDialog
        open={checkInDialogOpen}
        onOpenChange={setCheckInDialogOpen}
        selectedTaskId={selectedTaskId}
        onTaskChange={(v) => {
          setValue('assignedTaskId', v, { shouldValidate: true })
          setValue('cellId', '', { shouldValidate: false })
        }}
        selectedCellId={selectedCellId}
        onCellChange={(v) => setValue('cellId', v, { shouldValidate: false })}
        description={workDescription}
        onDescriptionChange={(v) => setValue('description', v, { shouldValidate: true })}
        taskError={errors.assignedTaskId?.message}
        startableTasks={startableTasks}
        selectedTask={selectedTask}
        submitting={submitting}
        onCheckIn={onCheckIn}
      />

      <Dialog open={breakWaitDialogOpen} onOpenChange={setBreakWaitDialogOpen}>
        <DialogContent className="max-w-md gap-4">
          <DialogHeader className="text-left">
            <DialogTitle>Please wait</DialogTitle>
            <DialogDescription className="text-sm">
              You cannot end your break yet. Please wait until the minimum break time has passed
              {activeBreakMinRemainingMs > 0 ? (
                <> ({formatBreakCountdown(activeBreakMinRemainingMs)} remaining)</>
              ) : null}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setBreakWaitDialogOpen(false)}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
