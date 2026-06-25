import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock3, Layers, Workflow } from 'lucide-react'
import { assignMyProjectCell } from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import {
  complexityTag,
  getViewProgressStatus,
  LAYOUT_STAGE_LABELS,
  normalizeWorkflow,
  VIEW_PROGRESS_LABELS,
} from '@/utils/cellWorkflowUi'
import { cellTypeLabel } from '@pages/admin/Projects/projectWorkspaceUi'
import { formatDateTime } from '@/utils/formatDate'
import { CellCompletionTimeSummaryLauncher } from '@pages/admin/Projects/CellCompletionTimeSummaryLauncher'
import { cn } from '@pages/employee/lib/utils'

function cellProgressPercent(cell) {
  const status = getViewProgressStatus(cell, 'layout')
  if (status === 'completed') return 100
  if (status === 'in_progress') {
    const wf = normalizeWorkflow(cell?.viewWorkflow)
    const stages = ['floor_plan', 'drc_r1', 'routing', 'drc', 'lvs_r2']
    const stageIdx = stages.indexOf(wf.layout.stage)
    if (stageIdx < 0) return 35
    return Math.min(95, Math.round(((stageIdx + 1) / stages.length) * 100))
  }
  return 0
}

function cellStageLabel(cell) {
  const wf = normalizeWorkflow(cell?.viewWorkflow)
  return LAYOUT_STAGE_LABELS[wf.layout.stage] || wf.layout.stage
}

export function EmployeeAssignedCellsList({
  cells = [],
  projectId,
  libraryNameById = {},
  emptyMessage = 'No cells to show.',
  emphasizeEffort = false,
  isTeamLead = false,
  assigneeOptions = [],
  onAssigned,
}) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [assigningId, setAssigningId] = useState(null)

  const handleAssign = async (cell, assigneeId) => {
    if (!assigneeId || !projectId) return
    const assignee = assigneeOptions.find((option) => option.id === assigneeId)
    setAssigningId(cell.id)
    try {
      await assignMyProjectCell(projectId, cell.id, {
        assignedEmployeeId: assigneeId,
        assignedEmployeeName: assignee?.name || '',
      })
      toast({ title: 'Cell assigned', description: `${cell.name} assigned to ${assignee?.name || 'engineer'}.` })
      onAssigned?.()
    } catch (err) {
      toast({
        title: 'Error',
        description: err?.response?.data?.error || 'Failed to assign cell',
      })
    } finally {
      setAssigningId(null)
    }
  }

  if (!cells.length) {
    return <p className="emp-wf-status">{emptyMessage}</p>
  }

  return (
    <div className="emp-wf-cell-grid">
      {cells.map((cell) => {
        const progress = cellProgressPercent(cell)
        const status = getViewProgressStatus(cell, 'layout')
        const statusLabel = VIEW_PROGRESS_LABELS[status] || status
        const libraryName = libraryNameById[cell.libraryId] || 'Library'
        const effort = Number(cell.estimatedEffort) || 0
        const workedDuration = cell.productiveWorkDuration ?? cell.workflowDuration
        const latestActivity = cell.workflowTiming?.latestActivityTime

        const isUnassigned = !cell.assignedEmployeeId?.trim()
        const roleLabel = cell.isAssignedToMe
          ? 'Yours'
          : isTeamLead && isUnassigned
            ? 'Unassigned'
            : 'View only'

        return (
          <article
            key={cell.id}
            className={cn(
              'emp-wf-cell-card',
              cell.isAssignedToMe ? 'emp-wf-cell-card--yours' : 'emp-wf-cell-card--view',
              emphasizeEffort && 'emp-wf-cell-card--effort',
            )}
          >
            <div
              className="emp-wf-cell-card-open"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/employee/projects/${projectId}/cells/${cell.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/employee/projects/${projectId}/cells/${cell.id}`)
                }
              }}
            >
            <div className="emp-wf-cell-card-top">
              <div className="emp-wf-cell-card-icon" aria-hidden>
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="emp-wf-cell-card-title">{cell.name}</h3>
                <p className="emp-wf-cell-card-meta">
                  {libraryName} · {complexityTag(cell.complexity)}
                </p>
              </div>
              <ArrowRight className="emp-wf-cell-card-arrow h-4 w-4 shrink-0" aria-hidden />
            </div>

            <div className="emp-wf-cell-card-progress">
              <div className="emp-wf-cell-card-progress-head">
                <span>{cellStageLabel(cell)}</span>
                <strong>{progress}%</strong>
              </div>
              <div className="emp-wf-cell-card-progress-track" aria-hidden>
                <span
                  className="emp-wf-cell-card-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(progress, 0))}%` }}
                />
              </div>
            </div>

            <div className="emp-wf-cell-card-stats">
              <span className={cn('emp-wf-cell-card-stat', emphasizeEffort && 'is-primary')}>
                <Clock3 className="h-3.5 w-3.5" />
                {effort}h est.
              </span>
              {(workedDuration?.formatted || (workedDuration?.totalMs ?? 0) > 0
                || cell.status === 'completed'
                || cell.status === 'in_progress') ? (
                <span
                  className="emp-wf-cell-card-stat emp-wf-cell-card-stat--timing"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <CellCompletionTimeSummaryLauncher
                    cell={cell}
                    className="emp-wf-cell-card-duration"
                  />
                </span>
              ) : null}
              <span className="emp-wf-cell-card-stat">
                <Workflow className="h-3.5 w-3.5" />
                {statusLabel}
              </span>
              <span className="emp-wf-cell-card-stat">
                {cellTypeLabel(cell.cellType || 'block').toUpperCase()}
              </span>
            </div>

            {latestActivity ? (
              <p className="emp-wf-cell-card-latest-activity">
                Latest activity:{' '}
                <time dateTime={latestActivity}>{formatDateTime(latestActivity)}</time>
              </p>
            ) : null}

            <span
              className={cn(
                'emp-wf-cell-card-role',
                cell.isAssignedToMe ? 'is-yours' : isTeamLead && isUnassigned ? 'is-unassigned' : 'is-view',
              )}
            >
              {roleLabel}
            </span>
            </div>

            {isTeamLead && isUnassigned ? (
              <label className="emp-wf-cell-card-assign" onClick={(e) => e.stopPropagation()}>
                <span className="sr-only">Assign {cell.name}</span>
                <select
                  className="emp-wf-cell-card-assign-select"
                  value=""
                  disabled={assigningId === cell.id}
                  onChange={(e) => void handleAssign(cell, e.target.value)}
                >
                  <option value="">Assign engineer…</option>
                  {assigneeOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
