import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, LogOut, Loader2, AlertTriangle, Clock, CalendarDays } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { DataTable } from '@components/employee/shared/DataTable'
import { DateRangePicker } from '@components/employee/shared/DateRangePicker'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { formatSessionDuration } from '@utils/durationFormat'
import { useToast } from '@components/employee/shared/ToastProvider'
import { formatDateKey, getPresetDateRange, getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'
import { TimesheetLiveSessionPanel } from '@pages/employee/TimesheetLiveSessionPanel'
import { TimesheetProjectWiseSummary } from '@pages/employee/TimesheetProjectWiseSummary'

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
  description: z.string().min(3, 'Description required'),
})

const historyColumns = [
  { key: 'date', label: 'Date' },
  { key: 'project', label: 'Project' },
  { key: 'description', label: 'Description' },
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'duration', label: 'Duration' },
]

const WEEKLY_CHART_HEIGHT = 280

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
    loading,
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
    backendElapsedMs,
    hasBackendElapsedData,
    backendElapsedLastFetch,
    projectWiseHours,
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
    let active = true
    if (initialized) {
      setIsInitialLoading(true)
      void useTimesheetStore.getState().refreshSessionsForRange({ from: historyStart, to: historyEnd })
        .finally(() => {
          if (active) {
            setIsInitialLoading(false)
          }
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
      sessions.some(
        (s) => s.taskStatus === 'Completed' && !isSessionApprovedByAdmin(s)
      ) || assignedTasks.some((t) => t.status === 'pending_review'),
    [sessions, assignedTasks]
  )

  useEffect(() => {
    if (!initialized || !hasAwaitingApproval) return undefined
    const refresh = () => {
      const { refreshAssignedTasks, refreshSessions, refreshActiveTask } = useTimesheetStore.getState()
      void refreshAssignedTasks()
      void refreshSessions()
      void refreshActiveTask()
    }
    const id = setInterval(refresh, 30000) // Poll every 30 seconds instead of 12 seconds when awaiting approval
    return () => clearInterval(id)
  }, [initialized, hasAwaitingApproval])

  useEffect(() => {
    if (!initialized || !checkedIn) return undefined
    const sync = () => {
      void useTimesheetStore.getState().syncAttendanceWithBackend()
    }
    const id = setInterval(sync, 30000) // Poll every 30 seconds when checked in to capture auto-checkouts in real-time
    return () => clearInterval(id)
  }, [initialized, checkedIn])

  useEffect(() => {
    if (!checkedIn) return undefined
    const tick = () => setLiveNow(Date.now() + (serverTimeSkew || 0))
    tick()
    const id = setInterval(tick, 15000) // Check-in analytics only needs updates every 15s instead of 1s
    return () => clearInterval(id)
  }, [checkedIn, serverTimeSkew])

  const { register, setValue, watch, reset, trigger, formState: { errors } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { assignedTaskId: '', description: '' },
  })

  const selectedTaskId = watch('assignedTaskId')
  const workDescription = watch('description')
  const canStartSession =
    !!selectedTaskId && String(workDescription || '').trim().length >= 3
  const startableTasks = useMemo(
    () => assignedTasks.filter((t) => t.status !== 'completed'),
    [assignedTasks]
  )
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
        { shouldValidate: true }
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
    const valid = await trigger()
    if (!valid) return

    try {
      setSubmitting(true)
      setCheckoutReview(false)
      setCheckoutError('')
      await checkIn()
      try {
        await startTask({
          assignedTaskId: selectedTaskId,
          description: workDescription.trim(),
        })
      } catch (startErr) {
        try {
          await checkOut()
        } catch {
          /* revert attendance if start failed */
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
    const valid = await trigger('description')
    if (!valid) return

    const summary = String(workDescription || '').trim()
    if (summary.length < 3) {
      setCheckoutError('Enter at least 3 characters describing what you completed.')
      return
    }

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
      toast({ title: 'Task paused', description: 'Timer paused. Status updated on the admin dashboard.' })
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
    [historyStart, historyEnd]
  )

  const weekRange = useMemo(() => getWeekRange(), [liveNow])

  const currentTaskPausedMs = useMemo(() => {
    if (!checkedIn) return 0
    let pausedMs = 0
    if (activeTask) {
      pausedMs += activeTask.totalPausedMs || 0
    } else if (pausedTasks && pausedTasks[0]) {
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
        const isOpen = !seg.checkOutTime
        const endMs = seg.checkOutTime ? new Date(seg.checkOutTime).getTime() : isOpen ? liveNow : startMs
        totalMs += Math.max(0, endMs - startMs)
      }
    })
    return Math.max(0, totalMs - currentTaskPausedMs)
  }, [attendanceHistory, checkedIn, liveNow, todayKey, currentTaskPausedMs])

  const formatMsToHMS = (ms) => {
    if (ms < 0) return '0h 0m 0s'
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${hours}h ${minutes}m ${seconds}s`
  }

  const unifiedHistory = useMemo(() => {
    const entries = []

    sessions
      .filter((s) => isDateInRange(s.date, historyRange.start, historyRange.end))
      .forEach((s) => {
        const loginMs = s.loginTime ? new Date(s.loginTime).getTime() : 0
        const durationStr =
          s.durationLabel ||
          formatSessionDuration({
            loginTime: s.loginTime,
            logoutTime: s.logoutTime,
            totalHours: s.totalHours,
            totalPausedMs: s.totalPausedMs,
            taskStatus: s.taskStatus,
          })

        entries.push({
          id: `task-${s.id}`,
          sortAt: loginMs,
          date: s.date,
          project: s.project || '—',
          description:
            stripTaskLabelPrefix(s.task, { projectName: s.project }) || '—',
          start: s.start,
          end: s.end || (s.autoCheckedOut ? formatTimeLabel(s.logoutTime) : s.end),
          duration: durationStr,
          statusNote: s.autoCheckedOut ? 'Auto Checked-Out' : null,
        })
      })

    return entries.sort((a, b) => b.sortAt - a.sortAt)
  }, [sessions, historyRange, checkedIn, liveNow])

  const projectWiseTotal = useMemo(
    () => (projectWiseHours ?? []).reduce((sum, p) => sum + (p.hours || 0), 0),
    [projectWiseHours]
  )

  if (!initialized) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-muted">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        Loading timesheet…
      </div>
    )
  }

  return (
    <div className="dashboard-surface space-y-4">
      {/* Top analytics summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-stretch">
        <KPIStatCard
          title="Daily Hours Today"
          value={formatMsToHMS(todayHoursMs)}
          icon={Clock}
          className="h-full min-h-[5.5rem] p-4"
        />
        <KPIStatCard
          title="Weekly Hours"
          value={`${totalWeekly.toFixed(1)}h`}
          icon={CalendarDays}
          className="h-full min-h-[5.5rem] p-4"
        />
        <TimesheetProjectWiseSummary
          totalHours={projectWiseTotal}
          projectCount={(projectWiseHours ?? []).length}
        />
      </div>

      {/* Hybrid workspace: form 55% | live session 45% */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border/60 bg-slate-50/50 px-4 py-3 sm:px-5">
          <h3 className="type-section-title">Work session</h3>
          <p className="type-body-sm mt-0.5">
            Check in to track time on your assigned project. Update your description before checking out.
          </p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,55%)_minmax(0,45%)] lg:divide-x lg:divide-border/60">
          {/* Left — work session form */}
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:min-h-[360px]">
            {!checkedIn && attendance?.autoCheckedOut && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Auto Checked-Out
                </div>
                <p className="mt-1 text-xs text-amber-600">
                  Your previous session was automatically closed by the system.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Assigned Project</Label>
              <Select
                value={selectedTaskId}
                onValueChange={(v) => setValue('assignedTaskId', v, { shouldValidate: true })}
                disabled={checkedIn || checkoutReview || startableTasks.length === 0}
              >
                <SelectTrigger className="h-11">
                  <SelectValue
                    placeholder={
                      startableTasks.length === 0
                        ? 'No projects assigned — contact admin'
                        : 'Select assigned project'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-[220px] overflow-y-auto">
                  {startableTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTask?.description && !checkedIn && (
                <p className="line-clamp-2 break-words text-xs text-muted">{selectedTask.description}</p>
              )}
              {errors.assignedTaskId && !checkedIn && (
                <p className="text-xs text-danger">{errors.assignedTaskId.message}</p>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
              <Label className="text-sm font-semibold">Work Description</Label>
              <Textarea
                className="min-h-[7.5rem] max-h-[min(20rem,40vh)] resize-y overflow-y-auto text-sm leading-relaxed"
                rows={5}
                {...register('description')}
                placeholder="Describe what you are working on — notes can be as detailed as you need."
                disabled={checkedIn && !checkoutReview}
              />
              {checkoutReview && (
                <p className="text-xs font-medium text-amber-700">
                  Update your work summary, then confirm check out.
                </p>
              )}
              {(errors.description || checkoutError) && (
                <p className="text-xs text-danger">{checkoutError || errors.description?.message}</p>
              )}
            </div>

            <div className="mt-auto grid grid-cols-2 gap-3 pt-1">
              {checkoutReview ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelCheckOut}
                    disabled={submitting}
                    className="h-11"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={onConfirmCheckOut}
                    disabled={submitting || !canStartSession}
                    className="h-11 gap-2"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Confirm Check Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={onCheckIn}
                    disabled={checkedIn || submitting || !canStartSession || startableTasks.length === 0}
                    className="h-11 gap-2"
                  >
                    <LogIn className="h-4 w-4 shrink-0" /> Check In
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={beginCheckOut}
                    disabled={!checkedIn || submitting}
                    className="h-11 gap-2"
                  >
                    <LogOut className="h-4 w-4 shrink-0" /> Check Out
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Right — live active session */}
          <div className="bg-slate-50/30 p-4 sm:p-5 lg:min-h-[360px]">
            <TimesheetLiveSessionPanel
              checkedIn={checkedIn}
              checkInTime={checkInTime}
              activeTask={activeTask}
              pausedTasks={pausedTasks}
              currentWorkTask={currentWorkTask}
              serverTimeSkew={serverTimeSkew}
              backendElapsedMs={backendElapsedMs}
              hasBackendElapsedData={hasBackendElapsedData}
              backendElapsedLastFetch={backendElapsedLastFetch}
              checkoutReview={checkoutReview}
              submitting={submitting}
              onPause={() => activeTask && onPauseTask(activeTask.timesheetId)}
              onResume={() => pausedTasks[0] && onResumeTask(pausedTasks[0].timesheetId)}
            />
          </div>
        </div>
      </section>

      {/* Charts: weekly + project breakdown */}
      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        <div className="flex min-h-[320px] flex-col rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <h4 className="type-card-title">Weekly Hours</h4>
            <span className="text-xs font-semibold tabular-nums text-muted">This week</span>
          </div>
          <div className="min-h-0 flex-1 w-full" style={{ height: WEEKLY_CHART_HEIGHT }}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted">Loading chart…</div>
              }
            >
              <TimesheetWeeklyChart data={weeklyHours} height={WEEKLY_CHART_HEIGHT} />
            </Suspense>
          </div>
        </div>

        <div className="flex min-h-[320px] flex-col rounded-xl border border-teal-200/60 bg-gradient-to-b from-teal-50/30 to-card p-4 shadow-card sm:p-5">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-teal-100 pb-2.5">
            <h4 className="type-card-title text-teal-600 font-extrabold">Project breakdown</h4>
            <span className="type-metric text-xs text-teal-600 font-bold">
              {projectWiseTotal.toFixed(1)}h
            </span>
          </div>
          <div className="min-h-0 flex-1" style={{ minHeight: WEEKLY_CHART_HEIGHT }}>
            <Suspense
              fallback={
                <div
                  className="flex h-full items-center justify-center text-sm text-muted"
                  style={{ height: WEEKLY_CHART_HEIGHT }}
                >
                  Loading…
                </div>
              }
            >
              <TimesheetProjectWiseChart data={projectWiseHours ?? []} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Work history */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="type-section-title">Work History</h3>
          <DateRangePicker
            startDate={historyStart}
            endDate={historyEnd}
            preset={historyPreset}
            onChange={(start, end, preset) => {
              setHistoryStart(start)
              setHistoryEnd(end)
              setHistoryPreset(preset)
              void useTimesheetStore.getState().refreshSessionsForRange({ from: start, to: end })
            }}
          />
        </div>

        {(isInitialLoading || sessionsLoading) && unifiedHistory.length === 0 ? (
          <div className="space-y-2">
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100/80" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-slate-100/60" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-slate-100/60" />
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-lg border border-border/60">
            {(isInitialLoading || sessionsLoading) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/60 backdrop-blur-[1px]">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <div className="timesheet-panel-scroll max-h-[min(28rem,55vh)] overflow-auto">
              <DataTable columns={historyColumns} data={unifiedHistory} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
