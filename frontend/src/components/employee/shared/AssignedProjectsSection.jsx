import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, Clock, ArrowRight } from 'lucide-react'
import { Badge } from '@components/employee/ui/badge'
import api from '@services/api'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'

function projectStatusLabel(status) {
  if (status === 'Active') return 'In Progress'
  return status
}

function statusBadgeVariant(status) {
  if (status === 'Completed') return 'success'
  if (status === 'Rejected') return 'danger'
  return 'warning'
}

function ProjectRow({ project, compact = false }) {
  return (
    <li
      className={cn(
        'grid grid-cols-[minmax(0,1.4fr)_auto_3.5rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,1.6fr)_auto_4rem_4.5rem] sm:gap-3',
        compact ? 'px-2 py-1.5 sm:px-3' : 'px-3 py-2.5 sm:px-4',
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground" title={project.name}>
          {project.name}
        </p>
        <p className="truncate text-[11px] text-muted">
          {project.client}
          {project.myHours > 0 ? (
            <span className="sm:hidden"> · {project.myHours}h</span>
          ) : null}
        </p>
      </div>

      <Badge variant={statusBadgeVariant(project.status)} className="shrink-0 text-[10px]">
        {projectStatusLabel(project.status)}
      </Badge>

      <span className="hidden text-right font-semibold text-foreground sm:block">
        {project.myHours > 0 ? `${project.myHours}h` : '—'}
      </span>

      <span className="truncate text-right text-[10px] font-medium text-muted">
        {project.assignmentRole}
      </span>
    </li>
  )
}

export function AssignedProjectsSection({
  initialProjects = null,
  loading: loadingProp = false,
  className,
  compact = false,
  fill = false,
}) {
  const [projects, setProjects] = useState(initialProjects ?? [])
  const [loading, setLoading] = useState(initialProjects == null || loadingProp)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (initialProjects != null) {
      setProjects(initialProjects)
      setLoading(loadingProp)
      setError(null)
      return
    }

    if (loadingProp) {
      setLoading(true)
      setError(null)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get('/projects/assigned/me')
        if (!cancelled) setProjects(res.data ?? [])
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError('Could not load assigned projects.')
          setProjects([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [initialProjects, loadingProp])

  const summary = useMemo(() => {
    const totalHours = projects.reduce((sum, p) => sum + (p.myHours ?? 0), 0)
    const active = projects.filter((p) => p.status === 'Active').length

    return { totalHours, active }
  }, [projects])

  return (
    <InteractiveCard
      to="/employee/timesheet"
      className={portalCardClass({
        className: cn(
          compact
            ? 'flex h-full min-h-0 flex-col overflow-hidden p-3'
            : 'overflow-hidden p-4 sm:p-5',
          className,
        ),
      })}
    >
      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border',
          compact ? 'pb-2' : 'pb-3',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn('emp-dash-icon emp-dash-icon--violet', compact && 'h-7 w-7')}
            aria-hidden
          >
            <FolderKanban className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </div>
          <div className="min-w-0">
            <h3 className={cn('font-heading font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
              My assigned projects
            </h3>
            {!loading && projects.length > 0 && !compact ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                <span>
                  <span className="font-semibold text-foreground">{projects.length}</span> total
                </span>
                <span aria-hidden>·</span>
                <span>
                  <span className="font-semibold text-foreground">{summary.active}</span> active
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="font-semibold text-foreground">{summary.totalHours}h</span> logged
                </span>
              </p>
            ) : !loading && projects.length > 0 && compact ? (
              <p className="mt-0.5 text-[11px] text-muted">
                {projects.length} project{projects.length === 1 ? '' : 's'} · {summary.totalHours}h logged
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-muted">Projects you can access</p>
            )}
          </div>
        </div>
        <Link
          to="/employee/timesheet"
          className={cn(
            'inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline',
            compact ? 'text-[10px]' : 'text-xs',
          )}
        >
          Timesheet <ArrowRight className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </Link>
      </div>

      <div
        className={cn(
          fill && 'emp-dash-widget-body min-h-0 flex-1',
          compact && !fill && 'mt-2',
          !compact && 'mt-3',
        )}
      >
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('animate-pulse rounded-lg bg-slate-100', compact ? 'h-8' : 'h-12')} />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center text-sm text-amber-800">
            {error}
          </p>
        )}

        {!loading && !error && projects.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
            No projects assigned yet.
          </p>
        )}

        {!loading && !error && projects.length > 0 && (
          <div
            className={cn(
              'overflow-hidden rounded-lg border border-border',
              !fill && compact && 'max-h-36 overflow-y-auto overscroll-contain',
            )}
          >
            <div className="hidden border-b border-border bg-[#f6f4fa]/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[minmax(0,1.6fr)_auto_4rem_4.5rem] sm:gap-3">
              <span>Project</span>
              <span>Status</span>
              <span className="text-right">Hours</span>
              <span className="text-right">Role</span>
            </div>
            <ul className="divide-y divide-border">
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} compact={compact} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </InteractiveCard>
  )
}
