import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, LogOut, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { DataTable } from '@components/employee/shared/DataTable'
import { DateRangePicker } from '@components/employee/shared/DateRangePicker'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { formatSessionDuration, formatDurationFromMs } from '@utils/durationFormat'
import { useToast } from '@components/employee/shared/ToastProvider'
import { formatDateKey, getPresetDateRange, getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'
import { TimesheetLiveSessionPanel } from '@pages/employee/TimesheetLiveSessionPanel'

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
  const canStartSession = !!selectedTaskId
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
    <div className="emp-timesheet-page dashboard-surface" data-page-scrollable>
      <div className="emp-timesheet-hero">
        <h1 className="emp-timesheet-hero-title">Projects & Timesheets</h1>
        <div className="emp-timesheet-hero-stats">
          <div className="emp-timesheet-hero-stat">
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
          <div className="emp-timesheet-hero-stat emp-timesheet-hero-stat--red">
            <span className="emp-timesheet-hero-stat-dot" aria-hidden />
            <span className="emp-timesheet-hero-stat-label">Cancelled</span>
            <span className="emp-timesheet-hero-stat-value">{taskStatusCounts.cancelled}</span>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid Layout */}
      <div className="mb-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        
        {/* LEFT COLUMN — Work Session + Work History */}
        <div className="flex flex-col gap-3">
          {/* Work Session — form, live timer when checked in, and actions */}
          <section className="emp-timesheet-card flex flex-col">
            <div className="emp-timesheet-card-header">
              <h3 className="emp-timesheet-card-title">Work Session</h3>
            </div>
            <div className="emp-timesheet-card-body flex flex-col gap-2.5">
              {!checkedIn && attendance?.autoCheckedOut && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    Auto Checked-Out
                  </div>
                  <p className="mt-0.5 text-[10px] text-amber-700">
                    Your previous session was closed by the system.
                  </p>
                </div>
              )}

              {checkedIn && checkInTime ? (
                <TimesheetLiveSessionPanel
                  checkedIn={checkedIn}
                  checkInTime={checkInTime}
                  activeTask={activeTask}
                  pausedTasks={pausedTasks}
                  currentWorkTask={currentWorkTask}
                  serverTimeSkew={serverTimeSkew}
                  checkoutReview={checkoutReview}
                  submitting={submitting}
                  onPause={() => activeTask && onPauseTask(activeTask.timesheetId)}
                  onResume={() => pausedTasks[0] && onResumeTask(pausedTasks[0].timesheetId)}
                />
              ) : null}

              {!checkedIn || checkoutReview ? (
                <>
                  {!checkedIn ? (
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold text-slate-800">Assigned Project *</Label>
                      <Select
                        value={selectedTaskId}
                        onValueChange={(v) => setValue('assignedTaskId', v, { shouldValidate: true })}
                        disabled={checkoutReview || startableTasks.length === 0}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue
                            placeholder={
                              startableTasks.length === 0
                                ? 'No projects assigned — contact admin'
                                : 'Select assigned project'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px] overflow-y-auto">
                          {startableTasks.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.projectName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTask?.description && !checkoutReview && (
                        <p className="line-clamp-2 text-[9px] text-muted mt-1">{selectedTask.description}</p>
                      )}
                      {errors.assignedTaskId && (
                        <p className="text-[9px] text-danger mt-1">{errors.assignedTaskId.message}</p>
                      )}
                    </div>
                  ) : null}

                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-800">
                      {checkoutReview ? 'Work Summary *' : 'Work Description *'}
                    </Label>
                    <Textarea
                      className="min-h-[3.5rem] max-h-[10rem] resize-y text-xs leading-relaxed"
                      rows={2}
                      {...register('description')}
                      placeholder={
                        checkoutReview
                          ? 'Update your work summary before checking out…'
                          : "Describe what you're working on..."
                      }
                      disabled={checkedIn && !checkoutReview}
                    />
                    {checkoutReview && (
                      <p className="text-[9px] font-medium text-amber-700 mt-1">
                        Update your work summary before checking out.
                      </p>
                    )}
                    {checkoutError && <p className="text-[9px] text-danger mt-1">{checkoutError}</p>}
                  </div>
                </>
              ) : null}

              <div className="flex gap-2 border-t border-slate-200/80 pt-2.5">
                {checkoutReview ? (
                  <>
                    <Button type="button" variant="outline" onClick={cancelCheckOut} disabled={submitting} className="h-8 flex-1 text-xs">
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={onConfirmCheckOut}
                      disabled={submitting}
                      className="emp-ts-btn-primary h-8 gap-1.5 flex-1 text-xs"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" />
                      Confirm Check Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={onCheckIn}
                      disabled={checkedIn || submitting || !canStartSession || startableTasks.length === 0}
                      className="emp-ts-btn-primary h-8 gap-1.5 flex-1 text-xs"
                    >
                      <LogIn className="h-3.5 w-3.5 shrink-0" /> Check In
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={beginCheckOut}
                      disabled={!checkedIn || submitting}
                      className="h-8 gap-1.5 flex-1 text-xs"
                    >
                      <LogOut className="h-3.5 w-3.5 shrink-0" /> Check Out
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Work History */}
          <section className="emp-timesheet-card emp-timesheet-history-panel flex flex-col overflow-visible">
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

            <div className="emp-timesheet-card-body flex flex-col p-3">
              {(isInitialLoading || sessionsLoading) && unifiedHistory.length === 0 ? (
                <div className="space-y-2">
                  <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/80" />
                  <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/60" />
                  <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/60" />
                </div>
              ) : (
                <div className="relative flex flex-col">
                  {(isInitialLoading || sessionsLoading) && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-[1px]">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                  <div className="emp-timesheet-history-scroll timesheet-panel-scroll min-h-[12rem] overflow-auto rounded-lg border border-slate-200/80">
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
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Weekly Hours Chart - Primary Visual */}
          <section className="emp-timesheet-card">
            <div className="emp-timesheet-card-header">
              <h3 className="emp-timesheet-card-title">Weekly Hours</h3>
              <div className="emp-timesheet-chart-header-stats">
                <div className="emp-timesheet-chart-stat">
                  <span className="emp-timesheet-chart-stat-label">Today</span>
                  <span className="emp-timesheet-chart-stat-value">{formatDurationFromMs(todayHoursMs)}</span>
                </div>
                <div className="emp-timesheet-chart-stat">
                  <span className="emp-timesheet-chart-stat-label">This week</span>
                  <span className="emp-timesheet-chart-stat-value">{totalWeekly.toFixed(1)}h</span>
                </div>
              </div>
            </div>
            <div className="emp-timesheet-card-body" style={{ height: 280 }}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    Loading chart…
                  </div>
                }
              >
                <TimesheetWeeklyChart data={weeklyHours} height={280} />
              </Suspense>
            </div>
          </section>

          {/* Project Breakdown Chart */}
          <section className="emp-timesheet-card">
            <div className="emp-timesheet-card-header">
              <h3 className="emp-timesheet-card-title">Project Breakdown</h3>
              <span className="emp-timesheet-chart-meta">{projectWiseTotal.toFixed(1)}h total</span>
            </div>
            <div className="emp-timesheet-card-body">
              <Suspense
                fallback={
                  <div className="flex min-h-[200px] items-center justify-center text-xs text-muted">
                    Loading…
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
        </div>
      </div>
    </div>
  )
}
