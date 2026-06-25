import { Link } from 'react-router-dom'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'
import { formatWorkflowDurationFromMs } from '@/utils/durationFormat'
import type { ProjectCell } from '@/types/projectWorkspace'
import {
  STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
  cellCompletionProgressPercent,
  cellTypeLabel,
  normalizeCellWorkflow,
  projectCellProgressPercent,
  workflowStageStatusClass,
} from './projectWorkspaceUi'
import { CELL_WORKFLOW_STAGES } from '@/types/projectWorkspace'
import { CellCompletionTimeSummaryLauncher } from './CellCompletionTimeSummaryLauncher'

type ProjectWorkflowOverviewProps = {
  projectId: string
  cells: ProjectCell[]
  totalCellCount?: number
  completedCellCount?: number
  libraryNameById: Map<string, string>
  getCellPath?: (projectId: string, cellId: string) => string
}

export function ProjectWorkflowOverview({
  projectId,
  cells,
  totalCellCount = 0,
  completedCellCount = 0,
  libraryNameById,
  getCellPath,
}: ProjectWorkflowOverviewProps) {
  const projectProgress = projectCellProgressPercent(completedCellCount, totalCellCount)
  const cellPath = getCellPath ?? ((pid, cid) => ROUTES.PROJECT_CELL(pid, cid))
  if (cells.length === 0) {
    return (
      <div className="admin-projects-workflow-overview-wrap">
        <p className="admin-projects-workflow-empty">
          {totalCellCount === 0 ? 'No cells in this project yet.' : 'No cells match your filters.'}
        </p>
      </div>
    )
  }

  return (
    <div className="admin-projects-workflow-overview-wrap">
      <p className="admin-projects-workflow-overview-summary">
        <span className="admin-projects-workflow-overview-summary-count">
          {completedCellCount}/{totalCellCount} cells completed
        </span>
        <span className="admin-projects-workflow-overview-summary-pct">{projectProgress}%</span>
      </p>
      <table className="admin-projects-workflow-overview-table">
        <thead>
          <tr>
            <th>Cell</th>
            <th>Library</th>
            <th>Type</th>
            <th>Progress</th>
            <th>Est. Hours</th>
            <th>Working Hours</th>
            {CELL_WORKFLOW_STAGES.map((stage) => (
              <th key={stage.key}>{stage.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => {
            const workflow = normalizeCellWorkflow(cell.workflow)
            const progress = cellCompletionProgressPercent(cell)
            const workingDuration = cell.productiveWorkDuration ?? cell.workflowDuration
            const hasWorkingTime = Boolean(
              workingDuration?.formatted
              || (workingDuration?.totalMs ?? 0) > 0
              || cell.status === 'completed'
              || cell.status === 'in_progress',
            )
            return (
              <tr key={cell.id}>
                <td>
                  <Link
                    to={cellPath(projectId, cell.id)}
                    className="admin-projects-workflow-cell-link"
                  >
                    {cell.name}
                  </Link>
                </td>
                <td>{libraryNameById.get(cell.libraryId) || '—'}</td>
                <td>{cellTypeLabel(cell.cellType)}</td>
                <td>
                  <div className="admin-projects-workflow-overview-progress">
                    <div className="admin-projects-workflow-compact-bar" aria-hidden>
                      <span className="admin-projects-workflow-compact-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span title={STATUS_LABELS[cell.status]}>{progress}%</span>
                  </div>
                </td>
                <td>{cell.estimatedEffort ?? 0}h</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {hasWorkingTime ? (
                    <CellCompletionTimeSummaryLauncher cell={cell} />
                  ) : (
                    formatWorkflowDurationFromMs(workingDuration?.totalMs ?? 0)
                  )}
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
