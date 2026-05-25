import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Play, Square, LogIn, LogOut, Timer, Loader2, History, Circle, Pause, CheckCircle2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@components/employee/ui/button'
import { Input } from '@components/employee/ui/input'
import { Label } from '@components/employee/ui/label'
import { Textarea } from '@components/employee/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/employee/ui/select'
import { KPIStatCard } from '@components/employee/shared/KPIStatCard'
import { DataTable } from '@components/employee/shared/DataTable'
import { useTimesheetStore } from '@store/employee/timesheetStore'
import { useToast } from '@components/employee/shared/ToastProvider'

const taskSchema = z.object({
  assignedTaskId: z.string().min(1, 'Select an assigned task'),
  description: z.string().min(3, 'Description required'),
})

const sessionColumns = [
  { key: 'project', label: 'Project' },
  { key: 'task', label: 'Task' },
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'hours', label: 'Hours' },
  { key: 'date', label: 'Date' },
]

function formatDuration(startedAt, pausedAt = null, totalPausedMs = 0) {
  if (!startedAt) return '0h 0m'
  const end = pausedAt ? new Date(pausedAt).getTime() : Date.now()
  const ms = Math.max(0, end - new Date(startedAt).getTime() - (totalPausedMs || 0))
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${mins}m`
}

function formatTimelineTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

function getSessionApprovalStatus(session) {
  return session.approvalStatus || session.status || 'Pending'
}

/** Employee-facing label for a work session in the activity timeline. */
function getEmployeeSessionStatus(session) {
  const approval = getSessionApprovalStatus(session)
  if (session.taskStatus === 'Completed' && approval === 'Approved') return 'Approved by admin'
  if (session.taskStatus === 'Completed') return 'Waiting for approval'
  if (session.workflowStatus === 'Completed') return 'Completed'
  if (session.workflowStatus === 'Waiting for approval') return 'Waiting for approval'
  if (session.workflowStatus === 'Paused' || session.taskStatus === 'Paused') return 'Paused'
  if (!session.logoutTime) return 'In Progress'
  return 'Stopped'
}

function getEmployeeSessionEndDetail(session) {
  const hours = session.hours !== '—' ? session.hours : 0
  const approval = getSessionApprovalStatus(session)
  if (session.taskStatus === 'Completed' && approval === 'Approved') {
    return `Your work has been approved by the admin (${hours}h logged).`
  }
  if (session.taskStatus === 'Completed') {
    return `Submitted for admin approval (${hours}h logged).`
  }
  return `Stopped after logging ${hours}h.`
}

function isSessionApprovedByAdmin(session) {
  const approval = getSessionApprovalStatus(session)
  return session.taskStatus === 'Completed' && approval === 'Approved'
}

/** True when admin approved noticeably after the employee submitted (logout). */
function shouldShowSeparateApprovalEntry(session) {
  if (!isSessionApprovedByAdmin(session) || !session.updatedAt || !session.logoutTime) {
    return false
  }
  const approvedAt = new Date(session.updatedAt).getTime()
  const logoutAt = new Date(session.logoutTime).getTime()
  return approvedAt > logoutAt + 2000
}

function getTimelineBadgeClass(status) {
  if (status === 'Completed' || status === 'Approved' || status === 'Approved by admin') {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (status === 'Rejected') return 'bg-rose-100 text-rose-700'
  if (status === 'Paused') return 'bg-violet-100 text-violet-700'
  if (status === 'Waiting for approval') return 'bg-sky-100 text-sky-700'
  if (status === 'In Progress' || status === 'Assigned') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
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
    stopTask,
    pauseTask,
    resumeTask,
    completeTask,
  } = useTimesheetStore()
  const { toast } = useToast()
  const [dateFilter, setDateFilter] = useState('')
  const [elapsed, setElapsed] = useState('0h 0m')
  const [submitting, setSubmitting] = useState(false)

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

  const onCheckIn = async () => {
    try {
      setSubmitting(true)
      await checkIn()
      toast({ title: 'Checked in', description: 'You can now start working on assigned tasks.' })
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
        title: 'Could not start task',
        description: err.response?.data?.error || 'Please check in and select a task.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onStopTask = async (timesheetId) => {
    try {
      setSubmitting(true)
      await stopTask(timesheetId)
      toast({ title: 'Task stopped', description: 'Hours saved and visible in the admin dashboard.' })
    } catch (err) {
      toast({
        title: 'Could not stop task',
        description: err.response?.data?.error || 'Please try again.',
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

  const onCompleteTask = async (timesheetId) => {
    try {
      setSubmitting(true)
      await completeTask(timesheetId)
      toast({
        title: 'Submitted for approval',
        description: 'Your task is waiting for admin approval.',
      })
    } catch (err) {
      toast({
        title: 'Could not complete task',
        description: err.response?.data?.error || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = dateFilter ? sessions.filter((s) => s.date === dateFilter) : sessions

  const projectTimeline = useMemo(() => {
    const entries = []
    const sessionsAwaitingApproval = new Set(
      filtered
        .filter((s) => s.taskStatus === 'Completed' && getSessionApprovalStatus(s) !== 'Approved')
        .map((s) => s.id)
    )

    assignedTasks.forEach((task) => {
      if (!task.createdAt) return
      if (task.status === 'assigned') {
        entries.push({
          id: `assigned-${task.id}`,
          kind: 'assigned',
          project: task.projectName,
          title: task.title,
          status: 'Assigned',
          timestamp: task.createdAt,
          detail: task.description || 'Task assigned to you by admin.',
        })
        return
      }
      if (task.status === 'pending_review') {
        if (task.timesheetId && sessionsAwaitingApproval.has(task.timesheetId)) return
        entries.push({
          id: `pending-${task.id}`,
          kind: 'pending',
          project: task.projectName,
          title: task.title,
          status: 'Waiting for approval',
          timestamp: task.updatedAt || task.createdAt,
          detail: 'Task submitted. Waiting for admin approval.',
        })
        return
      }
      if (task.status === 'completed') {
        const linked = task.timesheetId
          ? filtered.find((s) => s.id === task.timesheetId && isSessionApprovedByAdmin(s))
          : null
        if (linked && shouldShowSeparateApprovalEntry(linked)) return
        if (linked) return
        entries.push({
          id: `approved-task-${task.id}`,
          kind: 'approved',
          project: task.projectName,
          title: 'Work approved by admin',
          status: 'Approved by admin',
          timestamp: task.updatedAt || task.createdAt,
          detail: `Your work on ${task.projectName} has been approved by the admin.`,
        })
      }
    })

    filtered.forEach((session) => {
      if (session.loginTime) {
        entries.push({
          id: `start-${session.id}`,
          kind: 'start',
          project: session.project,
          title: session.task || 'Project work',
          status: 'In Progress',
          timestamp: session.loginTime,
          detail: `Started work on ${session.project}.`,
        })
      }

      if (session.logoutTime) {
        const approved = isSessionApprovedByAdmin(session)
        const separateApproval = shouldShowSeparateApprovalEntry(session)

        entries.push({
          id: `end-${session.id}`,
          kind: session.taskStatus === 'Completed' ? 'complete' : 'stop',
          project: session.project,
          title: session.task || 'Project work',
          status: separateApproval ? 'Waiting for approval' : getEmployeeSessionStatus(session),
          timestamp: session.logoutTime,
          detail: separateApproval
            ? `Submitted for admin approval (${session.hours !== '—' ? session.hours : 0}h logged).`
            : getEmployeeSessionEndDetail(session),
        })

        if (separateApproval) {
          entries.push({
            id: `approved-${session.id}`,
            kind: 'approved',
            project: session.project,
            title: 'Work approved by admin',
            status: 'Approved by admin',
            timestamp: session.updatedAt,
            detail: `Your work on ${session.project} has been approved by the admin (${session.hours !== '—' ? session.hours : 0}h logged).`,
          })
        }
      }
    })

    if (attendance?.checkInTime) {
      entries.push({
        id: 'attendance-check-in',
        kind: 'attendance-in',
        project: 'Attendance',
        title: 'Check in',
        status: checkedIn ? 'In Progress' : 'Checked In',
        timestamp: attendance.checkInTime,
        detail: 'Workday started.',
      })
    }

    if (attendance?.checkOutTime) {
      entries.push({
        id: 'attendance-check-out',
        kind: 'attendance-out',
        project: 'Attendance',
        title: 'Check out',
        status: 'Completed',
        timestamp: attendance.checkOutTime,
        detail: 'Workday ended.',
      })
    }

    return entries
      .filter((entry) => entry.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [assignedTasks, attendance, checkedIn, filtered])

  const weeklyHours = useMemo(() => {
    const byDay = {}
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    sessions.forEach((s) => {
      if (!s.loginTime || typeof s.hours !== 'number') return
      const d = new Date(s.loginTime)
      const key = days[d.getDay()]
      byDay[key] = (byDay[key] || 0) + s.hours
    })
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => ({
      day,
      hours: Math.round((byDay[day] || 0) * 10) / 10,
      target: 8,
    }))
  }, [sessions])

  const totalWeekly = weeklyHours.reduce((a, b) => a + b.hours, 0)
  const todayKey = new Date().toISOString().split('T')[0]
  const sessionsToday = sessions.filter((s) => s.date === todayKey).length

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
      <div className="grid gap-4 sm:grid-cols-3">
        <KPIStatCard title="Weekly Hours" value={`${totalWeekly}h`} icon={Timer} trend="From logged tasks" />
        <KPIStatCard title="Sessions Today" value={String(sessionsToday)} icon={Play} />
        <KPIStatCard
          title="Assigned Tasks"
          value={String(assignedTasks.length)}
          icon={Timer}
          trend={checkedIn ? 'Ready to work' : 'Check in first'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-1">
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
          {checkedIn && checkInTime && (
            <p className="text-sm text-primary">
              Checked in at {checkInTime.toLocaleTimeString()}
            </p>
          )}
          {!checkedIn && (
            <p className="text-xs text-muted">Check in before starting a task.</p>
          )}

          <hr className="my-4 border-border" />
          <h4 className="font-heading font-semibold">Start New Task</h4>
          <form onSubmit={handleSubmit(onStartTask)} className="mt-3 space-y-3">
            <div>
              <Label>Assigned Task</Label>
              <Select
                value={selectedTaskId}
                onValueChange={(v) => setValue('assignedTaskId', v, { shouldValidate: true })}
                disabled={!checkedIn || !!activeTask || startableTasks.length === 0}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={
                      startableTasks.length === 0
                        ? 'No tasks assigned — contact admin'
                        : 'Select assigned task'
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
                disabled={!checkedIn || !!activeTask}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={submitting || !!activeTask || !checkedIn || startableTasks.length === 0}
              className="w-full gap-2"
            >
              <Play className="h-4 w-4" /> Start Task
            </Button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          {activeTask ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-primary/5 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-muted">Running Task</p>
                  <p className="font-heading font-semibold">{activeTask.project}</p>
                  <p className="text-sm font-medium text-foreground">{activeTask.taskTitle}</p>
                  <p className="mt-1 text-xs text-muted">{activeTask.description}</p>
                  <p className="mt-2 text-sm text-primary">
                    Started {activeTask.startedAt.toLocaleString()} · Elapsed {elapsed}
                  </p>
                  {activeTask.workflowStatus && (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      Status: {activeTask.workflowStatus}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="outline" onClick={() => onPauseTask(activeTask.timesheetId)} disabled={submitting} className="gap-2">
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                  <Button
                    onClick={() => onCompleteTask(activeTask.timesheetId)}
                    disabled={submitting}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Complete
                  </Button>
                  <Button variant="danger" onClick={() => onStopTask(activeTask.timesheetId)} disabled={submitting} className="gap-2">
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <p className="text-muted">
              No running task. Check in, pick an assigned task from the left, add a description, and start tracking, or resume a paused task below.
            </p>
          )}

          {pausedTasks.length > 0 && (
            <div className="mt-6 border-t border-border pt-6">
              <h4 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                <Pause className="h-4 w-4 text-primary" /> Paused Tasks ({pausedTasks.length})
              </h4>
              <div className="space-y-4">
                {pausedTasks.map((task) => (
                  <div key={task.timesheetId} className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-heading font-semibold text-base">{task.project}</p>
                        <p className="text-sm font-medium text-foreground">{task.taskTitle}</p>
                        <p className="mt-1 text-xs text-muted">{task.description}</p>
                        <p className="mt-2 text-xs text-primary/80 font-medium">
                          Started {task.startedAt.toLocaleString()} · Elapsed {formatDuration(task.startedAt, task.pausedAt, task.totalPausedMs)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0 sm:self-center">
                        <Button onClick={() => onResumeTask(task.timesheetId)} disabled={submitting} size="sm" className="gap-1.5 h-9 px-3">
                          <Play className="h-3.5 w-3.5" /> Resume
                        </Button>
                        <Button
                          onClick={() => onCompleteTask(task.timesheetId)}
                          disabled={submitting}
                          size="sm"
                          className="gap-1.5 h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </Button>
                        <Button variant="danger" onClick={() => onStopTask(task.timesheetId)} disabled={submitting} size="sm" className="gap-1.5 h-9 px-3">
                          <Square className="h-3.5 w-3.5" /> Stop
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 h-64">
            <h4 className="mb-4 font-heading font-semibold">Weekly Hours</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-lg font-semibold">Work Sessions</h3>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-auto" />
        </div>
        <DataTable columns={sessionColumns} data={filtered} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold">Project Activity Timeline</h3>
            <p className="text-sm text-muted">Real-time project, task, and attendance events with timestamps</p>
          </div>
        </div>

        {projectTimeline.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            No project activity yet.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {projectTimeline.map((entry) => (
              <div key={entry.id} className="flex gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="mt-1 flex flex-col items-center">
                  <Circle
                    className={`h-3 w-3 ${
                      entry.kind === 'stop' ||
                      entry.kind === 'complete' ||
                      entry.kind === 'approved' ||
                      entry.kind === 'attendance-out' ||
                      entry.status === 'Completed' ||
                      entry.status === 'Approved by admin'
                        ? 'text-emerald-500'
                        : entry.status === 'Waiting for approval'
                          ? 'text-sky-500'
                          : 'text-primary'
                    }`}
                  />
                  <div className="mt-1 h-full w-px flex-1 bg-border" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-sm font-semibold text-ink">{entry.project}</p>
                      <p className="text-xs text-muted">{entry.title}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTimelineBadgeClass(entry.status)}`}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{entry.detail}</p>
                  <p className="mt-1 text-[11px] font-medium text-muted">{formatTimelineTime(entry.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
