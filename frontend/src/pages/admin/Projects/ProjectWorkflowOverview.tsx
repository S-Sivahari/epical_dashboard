import { Link } from 'react-router-dom'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'
import type { ProjectCell } from '@/types/projectWorkspace'
import {
  CELL_TYPE_LABELS,
  WORKFLOW_STATUS_LABELS,
  normalizeCellWorkflow,
  workflowProgressPercent,
  workflowStageStatusClass,
} from './projectWorkspaceUi'
import { CELL_WORKFLOW_STAGES } from '@/types/projectWorkspace'

type ProjectWorkflowOverviewProps = {
  projectId: string
  cells: ProjectCell[]
  libraryNameById: Map<string, string>
}

export function ProjectWorkflowOverview({ projectId, cells, libraryNameById }: ProjectWorkflowOverviewProps) {
  if (cells.length === 0) {
    return <p className="admin-projects-workflow-empty">No cells in this project yet.</p>
  }

  return (
    <div className="admin-projects-workflow-overview-wrap">
      <table className="admin-projects-workflow-overview-table">
        <thead>
          <tr>
            <th>Cell</th>
            <th>Library</th>
            <th>Type</th>
            <th>Progress</th>
            {CELL_WORKFLOW_STAGES.map((stage) => (
              <th key={stage.key}>{stage.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => {
            const workflow = normalizeCellWorkflow(cell.workflow)
            const progress = workflowProgressPercent(cell)
            return (
              <tr key={cell.id}>
                <td>
                  <Link
                    to={ROUTES.PROJECT_CELL(projectId, cell.id)}
                    className="admin-projects-workflow-cell-link"
                  >
                    {cell.name}
                  </Link>
                </td>
                <td>{libraryNameById.get(cell.libraryId) || '—'}</td>
                <td>{CELL_TYPE_LABELS[cell.cellType] ?? cell.cellType}</td>
                <td>
                  <div className="admin-projects-workflow-overview-progress">
                    <div className="admin-projects-workflow-compact-bar" aria-hidden>
                      <span className="admin-projects-workflow-compact-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span>{progress}%</span>
                  </div>
                </td>
                {workflow.map((stage) => (
                  <td key={`${cell.id}-${stage.stageKey}`}>
                    <span className={cn(
                      'admin-projects-workflow-stage-chip',
                      workflowStageStatusClass(stage.status),
                    )}>
                      {WORKFLOW_STATUS_LABELS[stage.status]}
                    </span>
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
