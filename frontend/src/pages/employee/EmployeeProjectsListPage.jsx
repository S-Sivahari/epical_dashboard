import { useOutletContext } from 'react-router-dom'
import { FolderKanban } from 'lucide-react'
import { EmployeeAssignedProjectsList } from '@components/employee/projects/EmployeeAssignedProjectsList'

export default function EmployeeProjectsListPage() {
  const { projects, workspacesById, loading } = useOutletContext()

  return (
    <div className="emp-wf-surface emp-wf-hub-surface">
      <header className="emp-wf-hub-hero">
        <div>
          <p className="emp-wf-hub-eyebrow">Assigned work</p>
          <h1 className="emp-wf-hub-title">My Projects</h1>
          <p className="emp-wf-hub-subtitle">
            Open a project to view cells, analytics, and cell workflows.
          </p>
        </div>
        <div className="emp-wf-hub-hero-badge">
          <FolderKanban className="h-4 w-4" aria-hidden />
          {projects.length} projects
        </div>
      </header>

      <EmployeeAssignedProjectsList
        projects={projects}
        workspacesById={workspacesById}
        loading={loading}
      />
    </div>
  )
}
