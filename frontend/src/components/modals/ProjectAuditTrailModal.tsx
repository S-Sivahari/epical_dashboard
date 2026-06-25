import { useEffect, useState, useCallback } from 'react'
import { Modal } from '@components/ui/Modal'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import {
  Clock,
  Users,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  StopCircle,
  ClipboardList,
  Rocket,
  ThumbsUp,
  FileEdit,
  Timer,
  Activity,
} from 'lucide-react'

/* ================================================================
   TYPES
   ================================================================ */
interface AuditEvent {
  type: string
  timestamp: string
  employee: string
  employeeId?: string
  details: string
  metadata?: Record<string, unknown>
}

interface AuditTrailData {
  project: {
    id: string
    name: string
    client: string
    technologyNode: string
    status: string
    completionPercentage?: number
  }
  events: AuditEvent[]
  summary: {
    totalHours: number
    totalSessions: number
    totalTasks: number
    completedTasks: number
    employees: number
  }
}

/* ================================================================
   EVENT CONFIG — icons, colors, labels
   ================================================================ */
const EVENT_CONFIG: Record<string, { icon: typeof Clock; color: string; bg: string; label: string; border: string }> = {
  project_created:     { icon: Rocket,        color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'Project Created' },
  task_assigned:       { icon: ClipboardList,  color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200',    label: 'Project Assigned' },
  work_started:        { icon: PlayCircle,     color: 'text-green-600',   bg: 'bg-green-50',    border: 'border-green-200',   label: 'Work Started' },
  work_paused:         { icon: PauseCircle,    color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   label: 'Work Paused' },
  work_completed:      { icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'Work Completed' },
  work_stopped:        { icon: StopCircle,     color: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-200',   label: 'Work Ended' },
  task_completed:      { icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', label: 'Project Completed' },
  task_approved:       { icon: ThumbsUp,       color: 'text-purple-600',  bg: 'bg-purple-50',   border: 'border-purple-200',  label: 'Project Approved' },
  correction_requested:{ icon: FileEdit,       color: 'text-orange-600',  bg: 'bg-orange-50',   border: 'border-orange-200',  label: 'Correction Requested' },
  hours_overridden:    { icon: Timer,          color: 'text-indigo-600',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  label: 'Hours Overridden' },
}

const DEFAULT_CONFIG = { icon: Activity, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Event' }

/* ================================================================
   HELPER FUNCTIONS
   ================================================================ */
function formatTimestamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return { date: '—', time: '—' }
  }
  const date = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  return { date, time }
}

function getRelativeTime(iso: string) {
  const now = new Date()
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

/** Merge assignment events into one timeline entry listing all assignees for the same task. */
function mergeAssignmentEvents(events: AuditEvent[]): AuditEvent[] {
  const nonAssignments: AuditEvent[] = []
  const assignmentGroups = new Map<string, AuditEvent[]>()

  for (const event of events) {
    if (event.type !== 'task_assigned') {
      nonAssignments.push(event)
      continue
    }

    const taskTitle = String(event.metadata?.taskTitle || event.metadata?.taskId || 'project')
    const existing = assignmentGroups.get(taskTitle) ?? []
    existing.push(event)
    assignmentGroups.set(taskTitle, existing)
  }

  const mergedAssignments: AuditEvent[] = []

  for (const group of assignmentGroups.values()) {
    if (group.length === 1) {
      mergedAssignments.push(group[0])
      continue
    }

    const sorted = [...group].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    const names = [...new Set(sorted.map((event) => event.employee).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
    const latest = sorted[sorted.length - 1]
    const taskTitle = String(latest.metadata?.taskTitle || 'Project')

    mergedAssignments.push({
      ...latest,
      employee: names.join(', '),
      details: `Project "${taskTitle}" assigned to ${names.join(', ')}`,
      metadata: {
        ...latest.metadata,
        assignedEmployees: names,
      },
    })
  }

  return [...nonAssignments, ...mergedAssignments].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

/* ================================================================
   COMPONENT — Summary Metric Card
   ================================================================ */
function SummaryCard({ label, value, icon: Icon, accentColor }: {
  label: string
  value: string | number
  icon: typeof Clock
  accentColor: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentColor}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold uppercase tracking-wider text-black">{label}</p>
        <p className="text-[21px] font-black text-black leading-tight tabular-nums">{value}</p>
      </div>
    </div>
  )
}

/* ================================================================
   COMPONENT — Timeline Event Card
   ================================================================ */
function TimelineEvent({ event, isLast }: { event: AuditEvent; isLast: boolean }) {
  const config = EVENT_CONFIG[event.type] || DEFAULT_CONFIG
  const Icon = config.icon
  const { date, time } = formatTimestamp(event.timestamp)
  const relative = getRelativeTime(event.timestamp)
  const hours = event.metadata?.totalHours as number | undefined
  const showEmployeeFooter = event.type !== 'task_assigned'

  return (
    <div className="flex gap-4 group">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${config.border} ${config.bg} shadow-sm transition-transform group-hover:scale-110`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gradient-to-b from-slate-200 to-slate-100 min-h-[24px]" />
        )}
      </div>

      {/* Event content */}
      <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
        <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <Badge className={`${config.bg} ${config.color} border ${config.border} text-[13px] font-bold px-2 py-0.5`}>
              {config.label}
            </Badge>
            <div className="text-right shrink-0">
              <p className="text-[13px] font-bold text-black">{relative}</p>
            </div>
          </div>

          {/* Details */}
          <p className="text-[15px] font-semibold text-black leading-relaxed">{event.details}</p>

          {/* Footer */}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {showEmployeeFooter ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={event.employee} size="sm" color={`hsl(${hashName(event.employee)},55%,45%)`} />
                <span className="text-[13px] font-bold text-black">{event.employee}</span>
              </div>
            ) : null}
            <span className="text-[13px] font-semibold text-black">
              {date} · {time}
            </span>
            {hours !== undefined && hours > 0 && (
              <span className="text-[13px] font-black text-black tabular-nums">
                {hours.toFixed(1)}h
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Simple string hash for consistent avatar colors. */
function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360
  }
  return h
}

/* ================================================================
   MAIN COMPONENT — ProjectAuditTrailModal
   ================================================================ */
export function ProjectAuditTrailModal({
  isOpen,
  onClose,
  projectId,
  projectName,
}: {
  isOpen: boolean
  onClose: () => void
  projectId: string
  projectName: string
}) {
  const [data, setData] = useState<AuditTrailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch audit trail when modal opens
  const fetchAuditTrail = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/projects/${projectId}/audit-trail`)
      setData(res.data)
    } catch (err) {
      console.error('Failed to fetch audit trail:', err)
      setError('Failed to load audit trail. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (isOpen && projectId) {
      fetchAuditTrail()
    }
  }, [isOpen, projectId, fetchAuditTrail])

  const displayEvents = data ? mergeAssignmentEvents(data.events) : []

  return (
    <Modal isOpen={isOpen} title="" onClose={onClose} size="xl">
      {/* Custom header with project info */}
      <div className="-mt-10 mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-[19px] font-black text-black leading-tight">
              {projectName || data?.project?.name || 'Project'} — Audit Trail
            </h2>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner />
          <p className="mt-3 text-[15px] font-bold text-black">Loading audit trail…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[17px] font-bold text-red-600">{error}</p>
          <button
            onClick={fetchAuditTrail}
            className="mt-3 text-[15px] font-bold text-black hover:text-black/70 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Content */}
      {data && !loading && !error && (
        <div className="space-y-5 animate-fadeIn">
          {/* Summary Cards */}
          <div className="grid gap-3 grid-cols-2">
            <SummaryCard
              label="Total Hours"
              value={`${Number(data.summary.totalHours).toFixed(1)}h`}
              icon={Clock}
              accentColor="bg-slate-600"
            />
            <SummaryCard
              label="Team Members"
              value={data.summary.employees}
              icon={Users}
              accentColor="bg-blue-600"
            />
          </div>

          {/* Events Count */}
          <div className="flex justify-end">
            <span className="text-[13px] font-bold text-black tabular-nums">
              {displayEvents.length} event{displayEvents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Timeline */}
          <div className="max-h-[50vh] overflow-y-auto pr-1 -mr-1">
            {displayEvents.length > 0 ? (
              <div className="pt-1">
                {displayEvents.map((event, i) => (
                  <TimelineEvent
                    key={`${event.type}-${event.timestamp}-${event.employee}-${i}`}
                    event={event}
                    isLast={i === displayEvents.length - 1}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                <Activity className="h-10 w-10 text-slate-400 mb-3" />
                <p className="text-[15px] font-bold text-black">
                  No activity recorded for this project yet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
