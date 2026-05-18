import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Play, Square, LogIn, LogOut, Timer } from 'lucide-react'
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
import { timesheetProjects, weeklyHours } from '@pages/employee/data/mockData'

const taskSchema = z.object({
  project: z.string().min(1, 'Select a project'),
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

export default function Timesheet() {
  const { checkedIn, checkInTime, activeTask, sessions, checkIn, checkOut, startTask, stopTask } = useTimesheetStore()
  const { toast } = useToast()
  const [dateFilter, setDateFilter] = useState('')

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { project: '', description: '' },
  })

  const onStartTask = (data) => {
    startTask(data)
    toast({ title: 'Task started', description: `Working on ${data.project}` })
  }

  const filtered = dateFilter ? sessions.filter((s) => s.date === dateFilter) : sessions
  const totalWeekly = weeklyHours.reduce((a, b) => a + b.hours, 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KPIStatCard title="Weekly Hours" value={`${totalWeekly}h`} icon={Timer} trend="98% of target" />
        <KPIStatCard title="Sessions Today" value={String(sessions.filter((s) => s.date === new Date().toISOString().split('T')[0]).length)} icon={Play} />
        <KPIStatCard title="Productivity" value="94%" icon={Timer} trend="+2% vs last week" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-1">
          <h3 className="font-heading text-lg font-semibold">Check In / Out</h3>
          <div className="flex gap-3">
            <Button onClick={checkIn} disabled={checkedIn} className="flex-1 gap-2">
              <LogIn className="h-4 w-4" /> Check In
            </Button>
            <Button variant="outline" onClick={checkOut} disabled={!checkedIn} className="flex-1 gap-2">
              <LogOut className="h-4 w-4" /> Check Out
            </Button>
          </div>
          {checkedIn && checkInTime && (
            <p className="text-sm text-primary">Checked in at {checkInTime.toLocaleTimeString()}</p>
          )}

          <hr className="my-4 border-border" />
          <h4 className="font-heading font-semibold">Start New Task</h4>
          <form onSubmit={handleSubmit(onStartTask)} className="mt-3 space-y-3">
            <div>
              <Label>Project</Label>
              <Select value={watch('project')} onValueChange={(v) => setValue('project', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {timesheetProjects.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.project && <p className="mt-1 text-xs text-danger">{errors.project.message}</p>}
            </div>
            <div>
              <Label>Task Description</Label>
              <Textarea className="mt-1" {...register('description')} placeholder="What are you working on?" />
              {errors.description && <p className="mt-1 text-xs text-danger">{errors.description.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting || !!activeTask} className="w-full gap-2">
              <Play className="h-4 w-4" /> Start Task
            </Button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          {activeTask ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">Running Task</p>
                  <p className="font-heading font-semibold">{activeTask.project}</p>
                  <p className="text-sm text-muted">{activeTask.description}</p>
                </div>
                <Button variant="danger" onClick={stopTask} className="gap-2">
                  <Square className="h-4 w-4" /> Stop
                </Button>
              </div>
            </motion.div>
          ) : (
            <p className="text-muted">No active task. Start a new task to begin tracking.</p>
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
