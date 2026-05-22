import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Play, Square, LogIn, LogOut, Timer, Loader2 } from 'lucide-react'
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

function formatDuration(startedAt) {
  if (!startedAt) return '0h 0m'
  const ms = Date.now() - new Date(startedAt).getTime()
  const hours = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  return `${hours}h ${mins}m`
}

export default function Timesheet() {
  const {
    checkedIn,
    checkInTime,
    activeTask,
    assignedTasks,
    sessions,
    loading,
    initialized,
    hydrate,
    checkIn,
    checkOut,
    startTask,
    stopTask,
  } = useTimesheetStore()
  const { toast } = useToast()
  const [dateFilter, setDateFilter] = useState('')
  const [elapsed, setElapsed] = useState('0h 0m')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!activeTask?.startedAt) return undefined
    const tick = () => setElapsed(formatDuration(activeTask.startedAt))
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [activeTask?.startedAt])

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { assignedTaskId: '', description: '' },
  })

  const selectedTaskId = watch('assignedTaskId')
  const selectedTask = assignedTasks.find((t) => t.id === selectedTaskId)

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

  const onStopTask = async () => {
    try {
      setSubmitting(true)
      await stopTask()
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

  const filtered = dateFilter ? sessions.filter((s) => s.date === dateFilter) : sessions

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
                disabled={!checkedIn || !!activeTask || assignedTasks.length === 0}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue
                    placeholder={
                      assignedTasks.length === 0
                        ? 'No tasks assigned — contact admin'
                        : 'Select assigned task'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignedTasks.map((t) => (
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
              disabled={submitting || !!activeTask || !checkedIn || assignedTasks.length === 0}
              className="w-full gap-2"
            >
              <Play className="h-4 w-4" /> Start Task
            </Button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          {activeTask ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-primary/5 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted">Running Task</p>
                  <p className="font-heading font-semibold">{activeTask.project}</p>
                  <p className="text-sm font-medium text-foreground">{activeTask.taskTitle}</p>
                  <p className="mt-1 text-xs text-muted">{activeTask.description}</p>
                  <p className="mt-2 text-sm text-primary">
                    Started {activeTask.startedAt.toLocaleString()} · Elapsed {elapsed}
                  </p>
                </div>
                <Button variant="danger" onClick={onStopTask} disabled={submitting} className="gap-2 shrink-0">
                  <Square className="h-4 w-4" /> Stop Task
                </Button>
              </div>
            </motion.div>
          ) : (
            <p className="text-muted">
              No active task. Check in, pick an assigned task, add a description, and start tracking.
            </p>
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
    </div>
  )
}
