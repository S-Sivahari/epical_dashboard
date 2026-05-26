import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Play, LogIn, LogOut, Loader2, Pause, CheckCircle2, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@components/employee/ui/button'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/employee/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { DataTable } from '@components/employee/shared/DataTable'
import { DateRangePicker } from '@components/employee/shared/DateRangePicker'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { useToast } from '@components/employee/shared/ToastProvider'
import { formatDateKey, getPresetDateRange, getWeekRange, isDateInRange } from '@pages/employee/lib/dateFilters'

const taskSchema = z.object({
  assignedTaskId: z.string().min(1, 'Select an assigned project'),
  description: z.string().min(3, 'Description required'),
})

const historyColumns = [
  { key: 'date', label: 'Date' },
  { key: 'project', label: 'Project' },
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'hours', label: 'Hours' },
  { key: 'status', label: 'Status' },
]

function formatDuration(startedAt, pausedAt = null, totalPausedMs = 0) {
  if (!startedAt) return '0h 0m'
  const end = pausedAt ? new Date(pausedAt).getTime() : Date.now()
  const ms = Math.max(0, end - new Date(startedAt).getTime() - (totalPausedMs || 0))
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${mins}m`
}

function hoursFromMs(ms) {
  return Math.round((ms / 3600000) * 10) / 10
}

/** Elapsed time since check-in as HH:MM:SS; ticks every second from 00:00:00. */
function formatCheckInElapsed(checkInTime, nowMs) {
  const totalSeconds = Math.max(0, Math.floor((nowMs - checkInTime.getTime()) / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
  } = useTimesheetStore()
  const { toast } = useToast()
  const defaultHistoryRange = getPresetDateRange('This Month')
  const [historyStart, setHistoryStart] = useState(defaultHistoryRange.start)
  const [historyEnd, setHistoryEnd] = useState(defaultHistoryRange.end)
  const [historyPreset, setHistoryPreset] = useState('This Month')
  const [elapsed, setElapsed] = useState('0h 0m')
  const [submitting, setSubmitting] = useState(false)
  const [liveNow, setLiveNow] = useState(() => Date.now())
  const checkInPanelRef = useRef(null)
  const [chartHeight, setChartHeight] = useState(280)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [completeTarget, setCompleteTarget] = useState(null)
  const [completionSummary, setCompletionSummary] = useState('')
  const [completionError, setCompletionError] = useState('')

  useEffect(() => {
    hydrate()
  }, [hydrate])

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
    if (!activeTask?.startedAt) return undefined
    const tick = () =>
      setElapsed(
        formatDuration(activeTask.startedAt, activeTask.pausedAt, activeTask.totalPausedMs)
      )
    tick()
    const id = setInterval(tick, activeTask.paused ? 60000 : 30000)
    return () => clearInterval(id)
  }, [activeTask?.startedAt, activeTask?.pausedAt, activeTask?.totalPausedMs, activeTask?.paused])

  useEffect(() => {
    if (!checkedIn) return undefined
    const tick = () => setLiveNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [checkedIn])

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { assignedTaskId: '', description: '' },
  })

  const selectedTaskId = watch('assignedTaskId')
  const startableTasks = useMemo(
    () => assignedTasks.filter((t) => t.status === 'assigned'),
    [assignedTasks]
  )
  const selectedTask = startableTasks.find((t) => t.id === selectedTaskId)
  const currentWorkTask = activeTask || pausedTasks[0] || null
  const hasOpenWorkTask = !!currentWorkTask

  useEffect(() => {
    const node = checkInPanelRef.current
    if (!node) return undefined

    const updateHeight = () => {
      const panelHeight = node.getBoundingClientRect().height
      setChartHeight(Math.max(280, Math.round(panelHeight - 56)))
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(node)
    return () => observer.disconnect()
  }, [checkedIn, activeTask, pausedTasks.length, attendance?.autoCheckedOut, initialized])

  const onCheckIn = async () => {
    try {
      setSubmitting(true)
      await checkIn()
      toast({ title: 'Checked in', description: 'You can now start working on assigned projects.' })
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

  const onCheckOut = async () => {
    try {
      setSubmitting(true)
      await checkOut()
      reset()
      toast({ title: 'Checked out', description: 'Any active task was stopped and logged.' })
    } catch (err) {
      toast({
        title: 'Check out failed',
        description: err.response?.data?.error || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onStartTask = async (data) => {
    try {
      setSubmitting(true)
      await startTask({
        assignedTaskId: data.assignedTaskId,
        description: data.description,
      })
      reset({ assignedTaskId: '', description: '' })
      toast({
        title: 'Task started',
        description: `Timer started for ${selectedTask?.title || 'task'}. Time is logged to the project.`,
      })
    } catch (err) {
      toast({
        title: 'Could not start project',
        description: err.response?.data?.error || 'Please check in and select a project.',
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

  const openCompleteDialog = (work) => {
    setCompleteTarget(work)
    setCompletionSummary(work?.description || '')
    setCompletionError('')
    setCompleteDialogOpen(true)
  }

  const onCompleteProject = async () => {
    if (!completeTarget?.timesheetId) return

    const original = (completeTarget.description || '').trim()
    const summary = completionSummary.trim()

    if (summary.length < 3) {
      setCompletionError('Enter at least 3 characters summarizing what you completed.')
      return
    }

    try {
      setSubmitting(true)
      setCompletionError('')
      await completeTask(completeTarget.timesheetId, summary)
      setCompleteDialogOpen(false)
      setCompleteTarget(null)
      setCompletionSummary('')
      toast({
        title: 'Submitted for approval',
        description: 'Your project work is waiting for admin approval.',
      })
    } catch (err) {
      const message = err.response?.data?.error || 'Please try again.'
      setCompletionError(message)
      toast({
        title: 'Could not complete project',
        description: message,
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
    if (pausedTasks && pausedTasks[0]) {
      const task = pausedTasks[0]
      pausedMs += task.totalPausedMs
      if (task.pausedAt) {
        pausedMs += Math.max(0, liveNow - new Date(task.pausedAt).getTime())
      }
    } else if (activeTask) {
      pausedMs += activeTask.totalPausedMs
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
        let hours = '—'
        if (typeof s.hours === 'number') {
          hours = s.hours
        } else if (!s.logoutTime && s.loginTime) {
          hours = hoursFromMs(liveNow - loginMs)
        }
        entries.push({
          id: `task-${s.id}`,
          sortAt: loginMs,
          date: s.date,
          project: s.project || '—',
          start: s.start,
          end: s.end,
          hours,
          status: s.workflowStatus || s.taskStatus || s.status || '—',
        })
      })

    return entries.sort((a, b) => b.sortAt - a.sortAt)
  }, [sessions, historyRange, checkedIn, liveNow])

  if (!initialized && loading) {
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
        <div
          ref={checkInPanelRef}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-1"
        >
          <h3 className="font-heading text-lg font-semibold">Check In / Out</h3>
          <div className="flex gap-3">
            <Button onClick={onCheckIn} disabled={checkedIn || submitting} className="flex-1 gap-2">
              <LogIn className="h-4 w-4" /> Check In
            </Button>
            <Button
              variant="outline"
              onClick={onCheckOut}
              disabled={!checkedIn || submitting}
              className="flex-1 gap-2"
            >
              <LogOut className="h-4 w-4" /> Check Out
            </Button>
          </div>
          {checkedIn && checkInTime && checkInElapsed && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Checked in</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-primary">{checkInElapsed}</p>
              <p className="mt-1 text-xs text-muted">
                Since {checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
          {!checkedIn && !attendance?.autoCheckedOut && (
            <p className="text-xs text-muted">Check in before starting a task.</p>
          )}
          {!checkedIn && attendance?.autoCheckedOut && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mt-2">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Auto Checked-Out
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Your previous session was automatically closed by the system.
              </p>
            </div>
          )}

          {checkedIn && currentWorkTask && (
            <div className="mt-3 rounded-lg border border-border bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Current project</p>
              <p className="mt-1 font-heading text-sm font-semibold text-foreground">{currentWorkTask.project}</p>
              <p className="text-xs text-muted">{currentWorkTask.taskTitle}</p>
              {activeTask && (
                <p className="mt-1 text-xs text-primary">Elapsed {elapsed}</p>
              )}
              {pausedTasks[0] && !activeTask && (
                <p className="mt-1 text-xs text-amber-700 font-medium">
                  Paused · {formatDuration(pausedTasks[0].startedAt, pausedTasks[0].pausedAt, pausedTasks[0].totalPausedMs)}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {activeTask ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onPauseTask(activeTask.timesheetId)}
                    disabled={submitting}
                    className="flex-1 gap-2"
                  >
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => onResumeTask(pausedTasks[0].timesheetId)}
                    disabled={submitting}
                    className="flex-1 gap-2"
                  >
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => openCompleteDialog(currentWorkTask)}
                  disabled={submitting}
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white"
                >
                  <CheckCircle2 className="h-4 w-4" /> Complete
                </Button>
              </div>
            </div>
          )}

          <hr className="my-4 border-border" />
          <h4 className="font-heading font-semibold">Start New Project</h4>
          <form onSubmit={handleSubmit(onStartTask)} className="mt-3 space-y-3">
            <div>
              <Label>Assigned Project</Label>
              <Select
                value={selectedTaskId}
                onValueChange={(v) => setValue('assignedTaskId', v, { shouldValidate: true })}
                disabled={!checkedIn || hasOpenWorkTask || startableTasks.length === 0}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={
                      startableTasks.length === 0
                        ? 'No projects assigned — contact admin'
                        : 'Select assigned project'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {startableTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.projectName} — {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTask?.description && (
                <p className="mt-1.5 text-xs text-muted">{selectedTask.description}</p>
              )}
              {errors.assignedTaskId && (
                <p className="mt-1 text-xs text-danger">{errors.assignedTaskId.message}</p>
              )}
            </div>
            <div>
              <Label>Work Description</Label>
              <Textarea
                className="mt-1"
                {...register('description')}
                placeholder="What are you working on?"
                disabled={!checkedIn || hasOpenWorkTask}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={submitting || hasOpenWorkTask || !checkedIn || startableTasks.length === 0}
              className="w-full gap-2"
            >
              <Play className="h-4 w-4" /> Start Project
            </Button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <h4 className="mb-4 font-heading text-lg font-semibold">Weekly Hours</h4>
          <div className="w-full" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyHours}
                margin={{ top: 12, right: 24, left: 4, bottom: 8 }}
                barCategoryGap="20%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis
                  width={44}
                  tick={{ fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip />
                <Bar dataKey="hours" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
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
            }}
          />
        </div>

        <DataTable columns={historyColumns} data={unifiedHistory} statusKey="status" />
      </div>

      <Dialog
        open={completeDialogOpen}
        onOpenChange={(open) => {
          setCompleteDialogOpen(open)
          if (!open) {
            setCompleteTarget(null)
            setCompletionSummary('')
            setCompletionError('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete project work</DialogTitle>
            <DialogDescription>
              Review or update the work description to summarize what you completed.
            </DialogDescription>
          </DialogHeader>
          {completeTarget && (
            <p className="text-sm font-medium text-foreground">{completeTarget.project}</p>
          )}
          <div>
            <Label htmlFor="completion-summary">Completion summary</Label>
            <Textarea
              id="completion-summary"
              className="mt-1.5 min-h-[120px]"
              value={completionSummary}
              onChange={(e) => {
                setCompletionSummary(e.target.value)
                if (completionError) setCompletionError('')
              }}
              placeholder="Describe what you finished on this project…"
            />
            {completionError && (
              <p className="mt-1.5 text-xs text-danger">{completionError}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setCompleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={onCompleteProject}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white"
            >
              <CheckCircle2 className="h-4 w-4" /> Submit completion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
