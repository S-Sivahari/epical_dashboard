import { useOutletContext } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { EmployeeProjectAnalyticsPanel } from '@components/employee/projects/EmployeeProjectAnalyticsPanel'
import { EmployeeProjectBreadcrumb } from '@components/employee/projects/EmployeeProjectBreadcrumb'

export default function EmployeeProjectsDashboard() {
  const { workspaces, projects, loading } = useOutletContext()

  return (
    <div className="emp-wf-surface emp-wf-hub-surface">
      <EmployeeProjectBreadcrumb items={[{ label: 'Projects' }]} />

      <header className="emp-wf-hub-hero">
        <div>
          <p className="emp-wf-hub-eyebrow">Overview</p>
          <h1 className="emp-wf-hub-title">Dashboard</h1>
          <p className="emp-wf-hub-subtitle">
            Track effort, reviews, and progress across your assigned projects.
          </p>
        </div>
        <div className="emp-wf-hub-hero-badge">
          <BarChart3 className="h-4 w-4" aria-hidden />
          {projects.length} assigned
        </div>
      </header>

      {loading && !projects.length ? (
        <p className="emp-wf-status">Loading dashboard…</p>
      ) : !projects.length ? (
        <p className="emp-wf-status">No assigned projects yet.</p>
      ) : (
        <EmployeeProjectAnalyticsPanel workspaces={workspaces} showPortfolioSummary />
      )}
    </div>
  )
}
