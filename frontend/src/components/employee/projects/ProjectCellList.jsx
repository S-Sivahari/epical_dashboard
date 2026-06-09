import { useNavigate } from 'react-router-dom'
import { ChevronRight, Eye } from 'lucide-react'
import { EmployeePhotoAvatar } from '@components/employee/shared/EmployeePhotoAvatar'
import {
  LAYOUT_STAGE_LABELS,
  VIEW_PROGRESS_LABELS,
  complexityTag,
  normalizeWorkflow,
} from '@/utils/cellWorkflowUi'
function cellWorkflowSummary(cell) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  const { layout } = wf
  const stage = LAYOUT_STAGE_LABELS[layout.stage] || layout.stage
  const status = VIEW_PROGRESS_LABELS[layout.status] || layout.status
  if (layout.pendingReview) {
    return `${stage} · Awaiting ${layout.pendingReview.toUpperCase()} review`
  }
  return `${stage} · ${status}`
}

export function ProjectCellList({ cells, projectId, user }) {
  const navigate = useNavigate()

  if (!cells?.length) {
    return <p className="emp-wf-status">No cells in this library.</p>
  }

  return (
    <ul className="emp-wf-cell-list">
      {cells.map((cell) => {
        const displayName = cell.assignedEmployeeName?.trim() || 'Unassigned'
        const avatarName = cell.isAssignedToMe ? (user?.name || displayName) : displayName
        const avatarId = cell.isAssignedToMe ? user?.id : cell.assignedEmployeeId

        return (
          <li key={cell.id}>
            <button
              type="button"
              className="emp-wf-cell-list-item"
              onClick={() => navigate(`/employee/projects/${projectId}/cells/${cell.id}`)}
            >
              <div className="emp-wf-cell-list-main">
                <div className="emp-wf-cell-list-head">
                  <h3 className="emp-wf-cell-list-title">{cell.name}</h3>
                  {cell.isAssignedToMe ? (
                    <span className="emp-wf-assigned-badge">Yours</span>
                  ) : (
                    <span className="emp-wf-view-only">
                      <Eye className="h-3 w-3" />
                      View
                    </span>
                  )}
                </div>
                <p className="emp-wf-cell-list-summary">{cellWorkflowSummary(cell)}</p>
                <div className="emp-wf-cell-list-tags">
                  <span className="emp-wf-tag emp-wf-tag--complexity">{complexityTag(cell.complexity)}</span>
                  <span className="emp-wf-tag emp-wf-tag--type">{String(cell.cellType || 'block').toUpperCase()}</span>
                  {cell.isBlocked ? <span className="emp-wf-tag emp-wf-tag--blocked">Blocked</span> : null}
                </div>
              </div>

              <div className="emp-wf-cell-list-aside">
                <EmployeePhotoAvatar
                  employeeId={avatarId}
                  name={avatarName}
                  className="emp-wf-avatar h-8 w-8 shrink-0"
                  fallbackClassName="!bg-[#2563eb] !text-white text-[10px] font-bold"
                />
                <span className="emp-wf-cell-list-hours">{cell.estimatedEffort || 0}h</span>
                <ChevronRight className="emp-wf-cell-list-chevron h-4 w-4" aria-hidden />
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
