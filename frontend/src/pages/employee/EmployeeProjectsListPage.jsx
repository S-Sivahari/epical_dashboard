import { useOutletContext } from 'react-router-dom'
import { FolderKanban } from 'lucide-react'
import { EmployeeAssignedProjectsList } from '@components/employee/projects/EmployeeAssignedProjectsList'

export default function EmployeeProjectsListPage() {
  const { projects, workspacesById, loading } = useOutletContext()

  return (
    <div className="admin-projects-employee-hub-panel">
      <header className="admin-projects-head admin-projects-employee-hub-head">
        <div className="admin-projects-head-row">
          <div className="admin-projects-head-icon-wrap">
            <FolderKanban className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="admin-projects-hub-eyebrow">Assigned work</p>
            <h1 className="admin-projects-head-title">My Projects</h1>
          </div>
          <div className="admin-projects-employee-hub-badge">
            <FolderKanban className="h-4 w-4" aria-hidden />
            {projects.length} projects
          </div>
        </div>
        <p className="admin-projects-hub-subtitle">
          Open a project to view cells, analytics, and cell workflows.
        </p>
      </header>

      <div className="admin-projects-employee-hub-body">
        <EmployeeAssignedProjectsList
          projects={projects}
          workspacesById={workspacesById}
          loading={loading}
        />
      </div>
    </div>
  )
}
