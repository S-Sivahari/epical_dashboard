import { useEffect, useMemo, useState } from 'react'
import { FolderKanban, Clock } from 'lucide-react'
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

function ProjectRow({ project }) {
  return (
    <li className="grid grid-cols-[minmax(0,1.4fr)_auto_3.5rem] items-center gap-2 px-3 py-2.5 text-xs sm:grid-cols-[minmax(0,1.6fr)_auto_4rem_4.5rem] sm:gap-3 sm:px-4">
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
      className={portalCardClass({ className: cn('overflow-hidden p-4 sm:p-5', className) })}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="emp-dash-icon emp-dash-icon--violet" aria-hidden>
            <FolderKanban className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground">My assigned projects</h3>
            {!loading && projects.length > 0 ? (
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
            ) : (
              <p className="mt-0.5 text-xs text-muted">Projects you can access</p>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-center text-sm text-amber-800">
          {error}
        </p>
      )}

      {!loading && !error && projects.length === 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted">
          No projects assigned yet.
        </p>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          <div className="hidden border-b border-border bg-[#f6f4fa]/90 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[minmax(0,1.6fr)_auto_4rem_4.5rem] sm:gap-3">
            <span>Project</span>
            <span>Status</span>
            <span className="text-right">Hours</span>
            <span className="text-right">Role</span>
          </div>
          <ul className="divide-y divide-border">
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </ul>
        </div>
      )}
    </InteractiveCard>
  )
}
