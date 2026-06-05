import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { LogIn, LogOut, Loader2, AlertTriangle, Clock, CalendarDays, FolderKanban } from 'lucide-react'
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
import { TimesheetSummaryCard } from '@pages/employee/TimesheetSummaryCard'

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

  const projectWiseTotal = useMemo(
    () => (allTimeProjectWiseHours ?? []).reduce((sum, p) => sum + (p.hours || 0), 0),
    [allTimeProjectWiseHours],
  )

  const projectCount = (allTimeProjectWiseHours ?? []).length
  const historyHasMore = unifiedHistory.length > 3

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
      {/* Page Header with Task Summary */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white rounded-xl border border-border p-3 shadow-sm mb-4">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--emerald-dark)] leading-none">Projects & Timesheets</h1>
        </div>

        {/* Dynamic Pie Chart Status Summary */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
            <svg width="68" height="68" viewBox="0 0 68 68" className="transform -rotate-90">
              {(() => {
                const total = assignedTasks.length || 1;
                const inProgressCount = assignedTasks.filter(t => t.status === 'in_progress' || t.status === 'pending_review' || t.status === 'Active' || !t.status).length;
                const completedCount = assignedTasks.filter(t => t.status === 'completed' || t.status === 'Completed').length;
                const cancelledCount = assignedTasks.filter(t => t.status === 'cancelled' || t.status === 'Cancelled').length;

                const radius = 28;
                const circumference = 2 * Math.PI * radius;
                
                const progressPercent = (inProgressCount / total) * 100;
                const completedPercent = (completedCount / total) * 100;
                const cancelledPercent = (cancelledCount / total) * 100;
                
                const progressDash = (progressPercent / 100) * circumference;
                const completedDash = (completedPercent / 100) * circumference;
                const cancelledDash = (cancelledPercent / 100) * circumference;
                
                const progressOffset = 0;
                const completedOffset = -progressDash;
                const cancelledOffset = -(progressDash + completedDash);
                
                return (
                  <>
                    <circle 
                      cx="34" 
                      cy="34" 
                      r={radius} 
                      fill="none" 
                      stroke="rgba(38, 107, 28, 0.08)" 
                      strokeWidth="11"
                    />
                    {inProgressCount > 0 && (
                      <circle
                        cx="34"
                        cy="34"
                        r={radius}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="11"
                        strokeDasharray={`${progressDash} ${circumference}`}
                        strokeDashoffset={progressOffset}
                        strokeLinecap="round"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))' }}
                      />
                    )}
                    {completedCount > 0 && (
                      <circle
                        cx="34"
                        cy="34"
                        r={radius}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="11"
                        strokeDasharray={`${completedDash} ${circumference}`}
                        strokeDashoffset={completedOffset}
                        strokeLinecap="round"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(34, 197, 94, 0.3))' }}
                      />
                    )}
                    {cancelledCount > 0 && (
                      <circle
                        cx="34"
                        cy="34"
                        r={radius}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="11"
                        strokeDasharray={`${cancelledDash} ${circumference}`}
                        strokeDashoffset={cancelledOffset}
                        strokeLinecap="round"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3))' }}
                      />
                    )}
                  </>
                );
              })()}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-[var(--emerald-dark)] font-display leading-none">
                {assignedTasks.length}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">Total</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 pl-3 border-l border-emerald-200/60">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-sm"></div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">In Progress</span>
              </div>
              <div className="text-xl font-black text-blue-600 tabular-nums">
                {assignedTasks.filter(t => t.status === 'in_progress' || t.status === 'pending_review' || t.status === 'Active' || !t.status).length}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-sm"></div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Completed</span>
              </div>
              <div className="text-xl font-black text-green-600 tabular-nums">
                {assignedTasks.filter(t => t.status === 'completed' || t.status === 'Completed').length}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-sm"></div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cancelled</span>
              </div>
              <div className="text-xl font-black text-red-600 tabular-nums">
                {assignedTasks.filter(t => t.status === 'cancelled' || t.status === 'Cancelled').length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 lg:grid-rows-[auto] lg:items-stretch">
        
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Compact Stat Cards Row */}
          <div className="grid grid-cols-2 gap-3">
            <TimesheetSummaryCard
              variant="teal"
              title="Daily Hours Today"
              value={formatDurationFromMs(todayHoursMs)}
              icon={Clock}
            />
            <TimesheetSummaryCard
              variant="turquoise"
              title="Weekly Hours"
              value={`${totalWeekly.toFixed(1)}h`}
              icon={CalendarDays}
            />
          </div>

          {/* Work Session Card - Project and Description Only */}
          <section className="emp-timesheet-card p-4">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900">Work Session</h3>
            </div>
            <div className="space-y-3">
              {!checkedIn && attendance?.autoCheckedOut && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Auto Checked-Out
                  </div>
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    Your previous session was closed by the system.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-800">Assigned Project *</Label>
                <Select
                  value={selectedTaskId}
                  onValueChange={(v) => setValue('assignedTaskId', v, { shouldValidate: true })}
                  disabled={checkedIn || checkoutReview || startableTasks.length === 0}
                >
                  <SelectTrigger className="h-9">
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
                {selectedTask?.description && !checkedIn && (
                  <p className="line-clamp-2 text-[10px] text-muted">{selectedTask.description}</p>
                )}
                {errors.assignedTaskId && !checkedIn && (
                  <p className="text-[10px] text-danger">{errors.assignedTaskId.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-800">Work Description *</Label>
                <Textarea
                  className="min-h-[4rem] max-h-[12rem] resize-y text-sm leading-relaxed"
                  rows={3}
                  {...register('description')}
                  placeholder="Describe what you're working on..."
                  disabled={checkedIn && !checkoutReview}
                />
                {checkoutReview && (
                  <p className="text-[10px] font-medium text-amber-700">
                    Update your work summary before checking out.
                  </p>
                )}
                {checkoutError && <p className="text-[10px] text-danger">{checkoutError}</p>}
              </div>
            </div>
          </section>

          {/* Wrapper for Active Session + Buttons to match right column height */}
          <div className="flex flex-col gap-4 flex-1">
            {/* Active Session Status Card */}
            <section className="emp-timesheet-card p-4 flex-1">
              <div className="mb-2">
                <h3 className="text-sm font-bold text-slate-900">Active Session</h3>
              </div>
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
            </section>

            {/* Check In/Check Out Buttons - Always at bottom */}
            <section className="emp-timesheet-card p-4">
              <div className="flex gap-2">
                {checkoutReview ? (
                  <>
                    <Button type="button" variant="outline" onClick={cancelCheckOut} disabled={submitting} className="h-9 flex-1">
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={onConfirmCheckOut}
                      disabled={submitting}
                      className="emp-ts-btn-primary h-9 gap-2 flex-1"
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
                      className="emp-ts-btn-primary h-9 gap-2 flex-1"
                    >
                      <LogIn className="h-4 w-4 shrink-0" /> Check In
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={beginCheckOut}
                      disabled={!checkedIn || submitting}
                      className="h-9 gap-2 flex-1"
                    >
                      <LogOut className="h-4 w-4 shrink-0" /> Check Out
                    </Button>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Weekly Hours Chart - Primary Visual */}
          <section className="emp-timesheet-card p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Weekly Hours</h3>
              <span className="text-xs font-bold text-slate-600 tabular-nums">{totalWeekly.toFixed(1)}h total</span>
            </div>
            <div style={{ height: 280 }}>
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

          {/* Project Breakdown Chart - Grows to match left column */}
          <section className="emp-timesheet-card p-4 flex-1">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900">Project Breakdown</h3>
              <span className="text-xs font-bold text-slate-600 tabular-nums">{projectWiseTotal.toFixed(1)}h total</span>
            </div>
            <div>
              <Suspense
                fallback={
                  <div className="flex min-h-[200px] items-center justify-center text-xs text-muted">
                    Loading…
                  </div>
                }
              >
                <TimesheetProjectWiseChart data={allTimeProjectWiseHours} />
              </Suspense>
            </div>
          </section>
        </div>
      </div>

      {/* Work History - Full Width Bottom Section */}
      <section className="emp-timesheet-card p-4 overflow-visible">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900">Work History</h3>
            {unifiedHistory.length > 0 && (
              <p className="text-xs text-slate-600 mt-0.5">
                {unifiedHistory.length} log{unifiedHistory.length === 1 ? '' : 's'} in selected range
              </p>
            )}
          </div>
          <div className="flex-shrink-0 relative z-20">
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

        {(isInitialLoading || sessionsLoading) && unifiedHistory.length === 0 ? (
          <div className="space-y-2">
            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/80" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/60" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100/60" />
          </div>
        ) : (
          <div className="relative">
            {(isInitialLoading || sessionsLoading) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 backdrop-blur-[1px]">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
            <div className="emp-timesheet-history-scroll timesheet-panel-scroll rounded-lg border border-slate-200/80 max-h-[450px] overflow-auto">
              <DataTable
                columns={historyColumns}
                data={unifiedHistory}
                compact
                emptyMessage="No work logs for this date range."
              />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
