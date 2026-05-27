import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Play, LogIn, LogOut, Loader2, Pause, AlertTriangle } from 'lucide-react'
import { Button } from '@components/employee/ui/button'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { DataTable } from '@components/employee/shared/DataTable'
import { DateRangePicker } from '@components/employee/shared/DateRangePicker'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { useToast } from '@components/employee/shared/ToastProvider'
import { formatDateKey, getPresetDateRange, getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'

const TimesheetWeeklyChart = lazy(() =>
  import('@pages/employee/TimesheetWeeklyChart').then((m) => ({ default: m.TimesheetWeeklyChart })),
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

function displayTaskTitle(title, projectName) {
  if (!title) return projectName || ''
  if (/^Work on /i.test(title.trim())) return projectName || title.replace(/^Work on /i, '').trim()
  return title
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

function formatDuration(startedAt, pausedAt = null, totalPausedMs = 0, serverTimeSkew = 0) {
  if (!startedAt) return '0h 0m'
  const end = pausedAt ? new Date(pausedAt).getTime() : Date.now() + serverTimeSkew
  const ms = Math.max(0, end - new Date(startedAt).getTime() - (totalPausedMs || 0))
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${mins}m`
}

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
  } = useTimesheetStore()
  const { toast } = useToast()
  const defaultHistoryRange = getPresetDateRange('This Month')
  const [historyStart, setHistoryStart] = useState(defaultHistoryRange.start)
  const [historyEnd, setHistoryEnd] = useState(defaultHistoryRange.end)
  const [historyPreset, setHistoryPreset] = useState('This Month')
  const [elapsed, setElapsed] = useState('0h 0m')
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
    const id = setInterval(refresh, 12000)
    return () => clearInterval(id)
  }, [initialized, hasAwaitingApproval])

  useEffect(() => {
    if (!initialized || !checkedIn) return undefined
    const sync = () => {
      void useTimesheetStore.getState().syncAttendanceWithBackend()
    }
    const id = setInterval(sync, 10000) // Poll every 10 seconds when checked in to capture auto-checkouts in real-time
    return () => clearInterval(id)
  }, [initialized, checkedIn])

  useEffect(() => {
    if (!activeTask?.startedAt) return undefined
    const tick = () =>
      setElapsed(
        formatDuration(activeTask.startedAt, activeTask.pausedAt, activeTask.totalPausedMs, serverTimeSkew)
      )
    tick()
    const id = setInterval(tick, activeTask.paused ? 60000 : 30000)
    return () => clearInterval(id)
  }, [activeTask?.startedAt, activeTask?.pausedAt, activeTask?.totalPausedMs, activeTask?.paused, serverTimeSkew])

  useEffect(() => {
    if (!checkedIn) return undefined
    const tick = () => setLiveNow(Date.now() + (serverTimeSkew || 0))
    tick()
    const id = setInterval(tick, 1000)
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

  const checkInElapsed = useMemo(() => {
    if (!checkedIn || !checkInTime) return null
    const totalMs = Math.max(0, liveNow - checkInTime.getTime() - currentTaskPausedMs)
    const totalSeconds = Math.floor(totalMs / 1000)
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [checkedIn, checkInTime, liveNow, currentTaskPausedMs])

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
        const logoutMs = s.logoutTime ? new Date(s.logoutTime).getTime() : (s.taskStatus === 'In Progress' ? liveNow : 0)
        
        let durationStr = '—'
        if (loginMs && logoutMs) {
          const diffMs = logoutMs - loginMs
          if (diffMs > 0) {
            const totalMinutes = Math.round(diffMs / 60000)
            const hrs = Math.floor(totalMinutes / 60)
            const mins = totalMinutes % 60
            if (hrs === 0) {
              durationStr = `${mins}min`
            } else if (mins === 0) {
              durationStr = `${hrs}hr`
            } else {
              durationStr = `${hrs}hr ${mins}min`
            }
          } else {
            durationStr = '0min'
          }
        }

        entries.push({
          id: `task-${s.id}`,
          sortAt: loginMs,
          date: s.date,
          project: s.project || '—',
          description:
            stripTaskLabelPrefix(s.task, { projectName: s.project }) || '—',
          start: s.start,
          end: s.end,
          duration: durationStr,
        })
      })

    return entries.sort((a, b) => b.sortAt - a.sortAt)
  }, [sessions, historyRange, checkedIn, liveNow])

  if (!initialized) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-muted">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        Loading timesheet…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <KPIStatCard title="Daily Hours Today" value={formatMsToHMS(todayHoursMs)} />
        <KPIStatCard title="Weekly Hours" value={`${totalWeekly.toFixed(1)}h`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-1">
          <h3 className="font-heading text-lg font-semibold">Check In / Out</h3>

          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label>Assigned Project</Label>
              <Select
                value={selectedTaskId}
                onValueChange={(v) => setValue('assignedTaskId', v, { shouldValidate: true })}
                disabled={checkedIn || checkoutReview || startableTasks.length === 0}
              >
                <SelectTrigger className="h-10">
                  <SelectValue
                    placeholder={
                      startableTasks.length === 0
                        ? 'No projects assigned — contact admin'
                        : 'Select assigned project'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-[160px] overflow-y-auto">
                  {startableTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTask?.description && !checkedIn && (
                <p className="mt-1.5 line-clamp-3 break-words text-xs text-muted">
                  {selectedTask.description}
                </p>
              )}
              {errors.assignedTaskId && !checkedIn && (
                <p className="mt-1 text-xs text-danger">{errors.assignedTaskId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Work Description</Label>
              <Textarea
                className="min-h-[88px] resize-none"
                {...register('description')}
                placeholder="What are you working on?"
                disabled={checkedIn && !checkoutReview}
              />
              {checkoutReview && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Update your work summary, then confirm check out.
                </p>
              )}
              {(errors.description || checkoutError) && (
                <p className="mt-1 text-xs text-danger">
                  {checkoutError || errors.description?.message}
                </p>
              )}
            </div>
          </div>

          {checkedIn && checkInTime && checkInElapsed && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {activeTask ? 'Timer running' : pausedTasks[0] ? 'Timer paused' : 'Checked in'}
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-primary">{checkInElapsed}</p>
              <p className="mt-1 text-xs text-muted">
                Since {checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}

          {!checkedIn && attendance?.autoCheckedOut && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Auto Checked-Out
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Your previous session was automatically closed by the system.
              </p>
            </div>
          )}

          {checkedIn && currentWorkTask && !checkoutReview && (
            <div className="rounded-lg border border-border bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Current project</p>
              <p className="mt-1 font-heading text-sm font-semibold text-foreground">{currentWorkTask.project}</p>
              <p className="line-clamp-3 break-words text-xs text-muted">
                {stripTaskLabelPrefix(currentWorkTask.description, {
                  taskTitle: currentWorkTask.taskTitle,
                  projectName: currentWorkTask.project,
                }) || displayTaskTitle(currentWorkTask.taskTitle, currentWorkTask.project)}
              </p>
              {activeTask && (
                <p className="mt-1 text-xs text-primary">Task elapsed {elapsed}</p>
              )}
              {pausedTasks[0] && !activeTask && (
                <p className="mt-1 text-xs text-amber-700 font-medium">
                  Paused ·{' '}
                  {formatDuration(
                    pausedTasks[0].startedAt,
                    pausedTasks[0].pausedAt,
                    pausedTasks[0].totalPausedMs
                  )}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {activeTask ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onPauseTask(activeTask.timesheetId)}
                    disabled={submitting}
                    className="w-full gap-2"
                  >
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => onResumeTask(pausedTasks[0].timesheetId)}
                    disabled={submitting}
                    className="w-full gap-2"
                  >
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            {checkoutReview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelCheckOut}
                  disabled={submitting}
                  className="h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={onConfirmCheckOut}
                  disabled={submitting || !canStartSession}
                  className="h-10 gap-2"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="truncate">Confirm Check Out</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={onCheckIn}
                  disabled={checkedIn || submitting || !canStartSession || startableTasks.length === 0}
                  className="h-10 gap-2"
                >
                  <LogIn className="h-4 w-4 shrink-0" /> Check In
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={beginCheckOut}
                  disabled={!checkedIn || submitting}
                  className="h-10 gap-2"
                >
                  <LogOut className="h-4 w-4 shrink-0" /> Check Out
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <h4 className="mb-4 font-heading text-lg font-semibold">Weekly Hours</h4>
          <div className="w-full" style={{ height: WEEKLY_CHART_HEIGHT }}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  Loading chart…
                </div>
              }
            >
              <TimesheetWeeklyChart data={weeklyHours} height={WEEKLY_CHART_HEIGHT} />
            </Suspense>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col items-start gap-3">
          <h3 className="font-heading text-lg font-semibold">Work History</h3>
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
          <div className="space-y-3">
            <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100/80" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200/50" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200/50" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200/50" />
          </div>
        ) : (
          <div className="relative">
            {(isInitialLoading || sessionsLoading) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <DataTable columns={historyColumns} data={unifiedHistory} />
          </div>
        )}
      </div>

    </div>
  )
}
