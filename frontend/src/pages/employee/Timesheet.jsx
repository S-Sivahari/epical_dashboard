import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, LogOut, Loader2, AlertTriangle } from 'lucide-react'
import { ProjectAnalysisLaunchButton } from '@components/admin/ProjectAnalysisLaunchButton'
import { Button } from '@components/employee/ui/button'
import { Textarea } from '@components/employee/ui/textarea'
import { DataTable } from '@components/employee/shared/DataTable'
import { DateRangePicker } from '@components/employee/shared/DateRangePicker'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { formatSessionDuration, formatDurationFromMs } from '@utils/durationFormat'
import { useToast } from '@components/employee/shared/ToastProvider'
import { formatDateKey, getPresetDateRange, getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'
import { TimesheetLiveSessionPanel } from '@pages/employee/TimesheetLiveSessionPanel'
import { TimesheetCheckInDialog } from '@pages/employee/TimesheetCheckInDialog'

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
  description: z.string().optional().default(''),
})

const historyColumns = [
  { key: 'date', label: 'Date' },
  { key: 'project', label: 'Project' },
  { key: 'description', label: 'Description' },
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'duration', label: 'Duration' },
]

const CHART_HEIGHT = 220

function hoursFromMs(ms) {
  return Math.round((ms / 3600000) * 10) / 10
}

function getDayKey(date) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
}

function formatTimeLabel(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function segmentHours(seg, checkedIn, liveNow) {
  const isOpen = checkedIn && !seg.checkOutTime
  const startMs = new Date(seg.checkInTime).getTime()
  const endMs = seg.checkOutTime ? new Date(seg.checkOutTime).getTime() : isOpen ? liveNow : startMs
  return hoursFromMs(Math.max(0, endMs - startMs))
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
    pauseTask,
    resumeTask,
    completeTask,
    attendanceHistory,
    serverTimeSkew,
    sessionsLoading,
    projectWiseHours,
    allTimeProjectWiseHours,
  } = useTimesheetStore()
  const { toast } = useToast()
  const defaultHistoryRange = getPresetDateRange('This Month')
  const [historyStart, setHistoryStart] = useState(defaultHistoryRange.start)
  const [historyEnd, setHistoryEnd] = useState(defaultHistoryRange.end)
  const [historyPreset, setHistoryPreset] = useState('This Month')
  const [submitting, setSubmitting] = useState(false)
  const [liveNow, setLiveNow] = useState(() => Date.now() + (serverTimeSkew || 0))
  const [checkoutReview, setCheckoutReview] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false)

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
        useTimesheetStore.getState().refreshSessionsForRange({ from: historyStart, to: historyEnd }),
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
    const id = setInterval(sync, 30000)
    return () => clearInterval(id)
  }, [initialized, checkedIn])

  useEffect(() => {
    if (!checkedIn) return undefined
    const tick = () => setLiveNow(Date.now() + (serverTimeSkew || 0))
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [checkedIn, serverTimeSkew])

  const { register, setValue, watch, reset, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { assignedTaskId: '', description: '' },
  })

  const selectedTaskId = watch('assignedTaskId')
  const workDescription = watch('description')
  const startableTasks = useMemo(
    () => assignedTasks.filter((t) => t.status !== 'completed'),
    [assignedTasks],
  )

  const taskStatusCounts = useMemo(() => {
    const total = assignedTasks.length
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
  const selectedTask = startableTasks.find((t) => t.id === selectedTaskId)
  const currentWorkTask = activeTask || pausedTasks[0] || null

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
    const valid = await trigger('assignedTaskId')
    if (!valid) return

    try {
      setSubmitting(true)
      setCheckoutReview(false)
      setCheckoutError('')
      await checkIn()
      try {
        await startTask({
          assignedTaskId: selectedTaskId,
          description: String(workDescription || '').trim(),
        })
      } catch (startErr) {
        try {
          await checkOut()
        } catch {
          /* revert */
        }
        throw startErr
      }
      setCheckInDialogOpen(false)
      toast({
        title: 'Checked in',
        description: `Timer started for ${selectedTask?.projectName || selectedTask?.title || 'your project'}.`,
      })
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

  const workNoteFromTask = (work) =>
    stripTaskLabelPrefix(work?.description, {
      taskTitle: work?.taskTitle,
      projectName: work?.project,
    })

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
      await checkOut()
      setCheckoutReview(false)
      reset({ assignedTaskId: '', description: '' })
      toast({
        title: 'Checked out',
        description: 'Your work was submitted for admin approval.',
      })
    } catch (err) {
      const message = err.response?.data?.error || 'Please try again.'
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

  const onPauseTask = async (timesheetId) => {
    try {
      setSubmitting(true)
      await pauseTask(timesheetId)
      toast({ title: 'Task paused', description: 'Timer paused.' })
    } catch (err) {
      toast({
        title: 'Could not pause task',
        description: err.response?.data?.error || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onResumeTask = async (timesheetId) => {
    try {
      setSubmitting(true)
      await resumeTask(timesheetId)
      toast({ title: 'Task resumed', description: 'Timer running again.' })
    } catch (err) {
      toast({
        title: 'Could not resume task',
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

  const currentTaskPausedMs = useMemo(() => {
    if (!checkedIn) return 0
    let pausedMs = 0
    if (activeTask) {
      pausedMs += activeTask.totalPausedMs || 0
    } else if (pausedTasks?.[0]) {
      const task = pausedTasks[0]
      pausedMs += task.totalPausedMs || 0
      if (task.pausedAt) {
        pausedMs += Math.max(0, liveNow - new Date(task.pausedAt).getTime())
      }
    }
    return pausedMs
  }, [checkedIn, activeTask, pausedTasks, liveNow])

  const weeklyHours = useMemo(() => {
    const byDay = {}
    const chartDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    attendanceHistory.forEach((seg) => {
      if (!isDateInRange(seg.date, weekRange.start, weekRange.end)) return
      const key = getDayKey(new Date(`${seg.date}T12:00:00`))
      byDay[key] = (byDay[key] || 0) + segmentHours(seg, checkedIn, liveNow)
    })

    return chartDays.map((day) => ({
      day,
      hours: Math.round((byDay[day] || 0) * 10) / 10,
      target: 8,
    }))
  }, [attendanceHistory, checkedIn, liveNow, weekRange])

  const totalWeekly = weeklyHours.reduce((a, b) => a + b.hours, 0)
  const todayKey = formatDateKey(new Date())

  const todayHoursMs = useMemo(() => {
    let totalMs = 0
    attendanceHistory.forEach((seg) => {
      if (seg.date === todayKey) {
        const startMs = new Date(seg.checkInTime).getTime()
        const isOpen = checkedIn && !seg.checkOutTime
        const endMs = seg.checkOutTime ? new Date(seg.checkOutTime).getTime() : isOpen ? liveNow : startMs
        totalMs += Math.max(0, endMs - startMs)
      }
    })
    return Math.max(0, totalMs - (checkedIn ? currentTaskPausedMs : 0))
  }, [attendanceHistory, checkedIn, liveNow, todayKey, currentTaskPausedMs])

  const unifiedHistory = useMemo(() => {
    const deduped = new Map()

    sessions
      .filter((s) => isDateInRange(s.date, historyRange.start, historyRange.end))
      .forEach((s) => {
        if (!deduped.has(s.id)) {
          const loginMs = s.loginTime ? new Date(s.loginTime).getTime() : 0
          deduped.set(s.id, {
            id: `task-${s.id}`,
            sortAt: loginMs,
            date: s.date,
            project: s.project || '—',
            description: stripTaskLabelPrefix(s.task, { projectName: s.project }) || '—',
            start: s.start,
            end: s.logoutTime ? formatTimeLabel(s.logoutTime) : s.end && s.end !== '—' ? s.end : '—',
            duration: formatSessionDuration({
              loginTime: s.loginTime,
              logoutTime: s.logoutTime,
              totalHours: s.totalHours,
              totalPausedMs: s.totalPausedMs,
              taskStatus: s.taskStatus,
              autoCheckedOut: s.autoCheckedOut,
            }),
            statusNote: s.autoCheckedOut ? 'Auto Checked-Out' : null,
            hours: s.totalHours ?? 0,
          })
        }
      })

    return Array.from(deduped.values()).sort((a, b) => b.sortAt - a.sortAt)
  }, [sessions, historyRange])

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
    () => projectBreakdown.reduce((sum, p) => sum + (p.hours || 0), 0),
    [projectBreakdown],
  )

  if (!initialized) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-muted">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        Loading timesheet…
      </div>
    )
  }

  return (
    <div className="emp-timesheet-page dashboard-surface" data-employee-timesheet>
      <div className="emp-timesheet-hero">
        <h1 className="emp-timesheet-hero-title">Projects & Timesheets</h1>
        <div className="emp-timesheet-hero-stats">
          <ProjectAnalysisLaunchButton
            audience="employee"
            className="project-analysis-launch-btn--hero emp-timesheet-hero-stat emp-timesheet-hero-stat--launch"
          />
          <div className="emp-timesheet-hero-stat emp-timesheet-hero-stat--plain">
            <span className="emp-timesheet-hero-stat-label">Total</span>
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
          <div className="emp-timesheet-hero-stat emp-timesheet-hero-stat--plain">
            <span className="emp-timesheet-hero-stat-label">Cancelled</span>
            <span className="emp-timesheet-hero-stat-value">{taskStatusCounts.cancelled}</span>
          </div>
        </div>
      </div>

      <div className="emp-timesheet-top-grid">
        <section className="emp-timesheet-card emp-timesheet-session-compact emp-timesheet-top-panel" id="work-session">
          <div className="emp-timesheet-card-header emp-timesheet-card-header--compact">
            <h3 className="emp-timesheet-card-title">Work Session</h3>
            {projectBreakdown.length > 0 ? (
              <span className="emp-timesheet-session-projects-total">{projectWiseTotal.toFixed(1)}h</span>
            ) : null}
          </div>
          <div className="emp-timesheet-card-body emp-timesheet-session-compact-body">
            {!checkedIn && attendance?.autoCheckedOut ? (
              <div className="mx-2.5 mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Auto checked out
                </div>
              </div>
            ) : null}

            {!checkoutReview ? (
              <div className="emp-timesheet-session-top emp-timesheet-session-projects">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center py-2 text-[10px] text-muted">
                      Loading…
                    </div>
                  }
                >
                  <TimesheetProjectWiseChart
                    embedded
                    data={projectBreakdown}
                    emptyHint={
                      startableTasks.length === 0
                        ? 'No projects assigned yet.'
                        : 'Hours appear after you log time.'
                    }
                  />
                </Suspense>
              </div>
            ) : null}

            {!checkoutReview && checkedIn && checkInTime ? (
              <div className="emp-timesheet-session-active">
                <TimesheetLiveSessionPanel
                  checkedIn={checkedIn}
                  checkInTime={checkInTime}
                  activeTask={activeTask}
                  pausedTasks={pausedTasks}
                  currentWorkTask={currentWorkTask}
                  serverTimeSkew={serverTimeSkew}
                  checkoutReview={checkoutReview}
                  submitting={submitting}
                  slim
                  onPause={() => activeTask && onPauseTask(activeTask.timesheetId)}
                  onResume={() => pausedTasks[0] && onResumeTask(pausedTasks[0].timesheetId)}
                />
              </div>
            ) : null}

            {checkoutReview ? (
              <div className="emp-timesheet-session-main emp-timesheet-checkout-panel">
                <p className="emp-timesheet-session-note emp-timesheet-session-note--checkout text-amber-800">
                  Update summary before checking out.
                </p>
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
            ) : !checkedIn ? (
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

            {checkoutReview ? (
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
            ) : checkedIn ? (
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
          <div className="emp-timesheet-card-header">
            <h3 className="emp-timesheet-card-title">Weekly Hours</h3>
            <div className="emp-timesheet-chart-header-stats">
              <div className="emp-timesheet-chart-stat">
                <span className="emp-timesheet-chart-stat-label">Today</span>
                <span className="emp-timesheet-chart-stat-value">{formatDurationFromMs(todayHoursMs)}</span>
              </div>
              <div className="emp-timesheet-chart-stat">
                <span className="emp-timesheet-chart-stat-label">Week</span>
                <span className="emp-timesheet-chart-stat-value">{totalWeekly.toFixed(1)}h</span>
              </div>
            </div>
          </div>
          <div className="emp-timesheet-card-body" style={{ height: CHART_HEIGHT }}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  Loading chart…
                </div>
              }
            >
              <TimesheetWeeklyChart data={weeklyHours} height={CHART_HEIGHT} />
            </Suspense>
          </div>
        </section>
      </div>

      <section className="emp-timesheet-card emp-timesheet-history-panel">
        <div className="emp-timesheet-history-header flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
          <h3 className="emp-timesheet-card-title">Work History</h3>
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
                  useTimesheetStore.getState().refreshSessionsForRange({ from: start, to: end }),
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
              <div className="emp-timesheet-history-scroll timesheet-panel-scroll">
                <DataTable
                  columns={historyColumns}
                  data={unifiedHistory}
                  compact
                  stickyHeader={true}
                  emptyMessage="No work logs for this date range."
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <TimesheetCheckInDialog
        open={checkInDialogOpen}
        onOpenChange={setCheckInDialogOpen}
        selectedTaskId={selectedTaskId}
        onTaskChange={(v) => setValue('assignedTaskId', v, { shouldValidate: true })}
        description={workDescription}
        onDescriptionChange={(v) => setValue('description', v, { shouldValidate: true })}
        taskError={errors.assignedTaskId?.message}
        startableTasks={startableTasks}
        selectedTask={selectedTask}
        submitting={submitting}
        onCheckIn={onCheckIn}
      />
    </div>
  )
}
