import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FolderKanban, Globe, Lock, User, Clock, Cpu } from 'lucide-react'
import { Badge } from '@components/employee/ui/badge'
import { Progress } from '@components/employee/ui/progress'
import api from '@services/api'

function projectStatusLabel(status) {
  if (status === 'Active') return 'In Progress'
  return status
}

function statusBadgeVariant(status) {
  if (status === 'Completed') return 'success'
  if (status === 'Rejected') return 'danger'
  return 'warning'
}

function ProjectBlockCard({ project }) {
  const completion = project.completionPercentage ?? 0
  const showProgress = (project.totalTasks ?? 0) > 0

  return (
    <motion.article
      whileHover={{ y: -3 }}
      className="flex flex-col rounded-xl border border-border bg-white p-5 shadow-card transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-heading text-base font-bold text-foreground truncate" title={project.name}>
            {project.name}
          </h4>
          <p className="mt-0.5 text-sm text-muted truncate">{project.client}</p>
        </div>
        <Badge variant={statusBadgeVariant(project.status)}>{projectStatusLabel(project.status)}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {project.accessType === 'private' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            <Lock className="h-3 w-3" /> Private
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
            <Globe className="h-3 w-3" /> Public
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <User className="h-3 w-3" /> {project.assignmentRole}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="font-medium text-foreground/80">{project.technologyNode}</span>
        </p>
        {project.teamLead && (
          <p className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0" />
            Team Lead: <span className="font-semibold text-foreground">{project.teamLead}</span>
          </p>
        )}
        {project.myHours > 0 && (
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Your logged hours: <span className="font-bold text-primary">{project.myHours}h</span>
            </span>
          </p>
        )}
      </div>

      {project.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted">{project.description}</p>
      )}

      {showProgress && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-muted">
            <span>Task completion</span>
            <span className="text-foreground">{completion}%</span>
          </div>
          <Progress value={completion} className="h-2" />
          <p className="mt-1 text-[10px] text-muted">
            {project.completedTasks ?? 0} of {project.totalTasks} tasks completed
          </p>
        </div>
      )}
    </motion.article>
  )
}

export function AssignedProjectsSection({ initialProjects = null, loading: loadingProp = false }) {
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

    // Parent dashboard is still loading — avoid duplicate /projects/assigned/me call
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

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold">My Assigned Projects</h3>
            <p className="text-sm text-muted">Projects you can access based on your role and assignment</p>
          </div>
        </div>
        {!loading && (
          <span className="text-sm font-semibold text-primary">
            {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="mt-5 rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
          {error}
        </p>
      )}

      {!loading && !error && projects.length === 0 && (
        <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          No projects are assigned to you yet. Contact your administrator if you expect project access.
        </p>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectBlockCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  )
}
