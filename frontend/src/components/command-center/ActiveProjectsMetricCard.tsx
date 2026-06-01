import { Briefcase } from 'lucide-react'
import { cn } from '@/utils/cn'

const PROGRESS_COLORS = ['#3a912d', '#2f7d24', '#266b1c', '#76b86c']

type ProjectRow = {
  name: string
  progress: number
}

export function ActiveProjectsMetricCard({
  projects,
  count,
  loading,
  className,
}: {
  projects: ProjectRow[]
  count: number
  loading?: boolean
  className?: string
}) {
  const topProjects = projects.slice(0, 4)

  return (
    <div className={cn('dashboard-metric-card dashboard-metric-card-circle dashboard-metric-card-expanded', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="dashboard-metric-label">Active Projects</p>
        <span className="dashboard-metric-icon-sm">
          <Briefcase className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
      <div className="dashboard-metric-circle-wrap">
        <div className="dashboard-metric-circle">
          <span className="dashboard-metric-circle-value">{loading ? '—' : count}</span>
        </div>
      </div>
      <p className="dashboard-metric-trend dashboard-metric-trend-below dashboard-metric-trend-up">
        <span aria-hidden>▲</span>
        <span>Live from projects</span>
      </p>

      {!loading && topProjects.length > 0 && (
        <ul className="dashboard-project-progress-list">
          {topProjects.map((project, index) => {
            const pct = Math.min(100, Math.max(0, Math.round(project.progress)))
            return (
              <li key={project.name} className="dashboard-project-progress-item">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] font-medium text-slate-600">{project.name}</span>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#266b1c]">{pct}%</span>
                </div>
                <div className="dashboard-project-progress-track">
                  <div
                    className="dashboard-project-progress-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: PROGRESS_COLORS[index % PROGRESS_COLORS.length],
                    }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
