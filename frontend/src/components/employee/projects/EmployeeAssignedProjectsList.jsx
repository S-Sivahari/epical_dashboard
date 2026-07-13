import { useNavigate } from 'react-router-dom'
import { ArrowRight, Briefcase, Clock3, Layers, User } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { formatHoursDecimalAsDuration } from '@utils/durationFormat'

function isTeamLead(role) {
  const normalized = String(role || '').trim().toLowerCase()
  return normalized === 'lead' || normalized === 'team lead'
}

function formatCellCount(count) {
  if (!count) return <span className="emp-wf-project-card-stat-muted">No cells yet</span>
  return `${count} cells`
}

export function EmployeeAssignedProjectsList({ projects = [], workspacesById = {}, loading = false }) {
  const navigate = useNavigate()

  if (loading) {
    return <p className="emp-wf-status">Loading assigned projects…</p>
  }

  if (!projects.length) {
    return <p className="emp-wf-status">No assigned projects yet.</p>
  }

  return (
    <div className="emp-wf-project-grid">
      {projects.map((project) => {
        const ws = workspacesById[project.id]
        const stats = ws?.stats
        const progress = ws?.project?.completionPercentage ?? 0
        const lead = isTeamLead(project.assignmentRole)

        return (
          <button
            key={project.id}
            type="button"
            className={cn(
              'emp-wf-project-card',
              lead ? 'emp-wf-project-card--lead' : 'emp-wf-project-card--member',
            )}
            onClick={() => navigate(`/employee/projects/${project.id}`)}
          >
            <div className="emp-wf-project-card-top">
              <div className="emp-wf-project-card-icon" aria-hidden>
                <Briefcase className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="emp-wf-project-card-title">{project.name}</h3>
                <p className="emp-wf-project-card-meta">
                  {project.client || 'Client'} · {project.technologyNode || 'Node'}
                </p>
              </div>
              <ArrowRight className="emp-wf-project-card-arrow h-4 w-4 shrink-0" aria-hidden />
            </div>

            <div className="emp-wf-project-card-progress">
              <div className="emp-wf-project-card-progress-head">
                <span>Progress</span>
                <strong>{progress}%</strong>
              </div>
              <div className="emp-wf-project-card-progress-track" aria-hidden>
                <span
                  className="emp-wf-project-card-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(progress, 0))}%` }}
                />
              </div>
            </div>

            <div className="emp-wf-project-card-stats">
              <span className="emp-wf-project-card-stat">
                <Layers className="h-3.5 w-3.5" />
                {formatCellCount(stats?.cellCount)}
              </span>
              <span className="emp-wf-project-card-stat">
                <User className="h-3.5 w-3.5" />
                {stats?.assignedToMe ?? '—'} yours
              </span>
              <span className="emp-wf-project-card-stat">
                <Clock3 className="h-3.5 w-3.5" />
                {project.myHours > 0 ? formatHoursDecimalAsDuration(project.myHours) : '0m'}
              </span>
            </div>

            <span className={cn('emp-wf-project-card-role', lead && 'is-lead')}>
              {lead ? 'Team Lead' : 'Member'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

