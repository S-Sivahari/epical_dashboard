import { useMemo } from 'react'
import { cn } from '@pages/employee/lib/utils'
import {
  getCellKanbanColumn,
  getKanbanColumnsForView,
  getPipelineColumnStatus,
  normalizeWorkflow,
} from '@/utils/cellWorkflowUi'
import { ViewProgressStatusBadge } from './ViewProgressStatusBadge'
import { WorkflowBlockCard } from './WorkflowBlockCard'

export function ProjectWorkflowBoard({
  cells,
  user,
  viewTab,
  activeFilter,
  onFilterChange,
  savingId,
  onAdvance,
  onRequestReview,
  adminMode = false,
  openReviewByCellId,
  onResolveReview,
  reviewSaving = false,
  compact = false,
  checklistFilled = true,
}) {
  const columns = getKanbanColumnsForView(viewTab)

  const grouped = useMemo(() => {
    const map = Object.fromEntries(columns.map((col) => [col.id, []]))
    for (const cell of cells || []) {
      const columnId = getCellKanbanColumn(cell, viewTab)
      if (map[columnId]) map[columnId].push(cell)
    }
    return map
  }, [cells, viewTab, columns])

  const engineerIds = useMemo(() => {
    const ids = new Set()
    for (const cell of cells || []) {
      if (cell.assignedEmployeeId) ids.add(cell.assignedEmployeeId)
    }
    return ids.size
  }, [cells])

  const isSingleCell = compact && (cells?.length === 1)
  const pipelineCell = isSingleCell ? cells[0] : null

  const boardMinWidth = compact
    ? viewTab === 'layout'
      ? '680px'
      : '420px'
    : viewTab === 'layout'
      ? '920px'
      : '720px'

  return (
    <div className={cn('emp-project-workflow', compact && 'emp-project-workflow--compact')}>
      {!compact || !isSingleCell ? (
        <div className="emp-project-workflow-head">
          {!compact ? <h2 className="emp-project-workflow-title">Project Workflow</h2> : null}
          {!isSingleCell ? (
            <div className="emp-wf-filters">
              {columns.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  className={cn('emp-wf-pill', col.pill, activeFilter === col.id && 'is-active')}
                  onClick={() => onFilterChange(activeFilter === col.id ? null : col.id)}
                >
                  {col.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="emp-wf-board-wrap">
        <div
          className={cn('emp-wf-board', isSingleCell && 'emp-wf-board--pipeline')}
          style={{ minWidth: boardMinWidth }}
        >
          {columns.map((column) => {
            const columnCells = grouped[column.id] || []
            const columnStatus = pipelineCell
              ? getPipelineColumnStatus(pipelineCell, column.id, viewTab)
              : null
            const isCurrentStage = pipelineCell
              ? getCellKanbanColumn(pipelineCell, viewTab) === column.id
              : false
            const pendingReview =
              isCurrentStage && viewTab === 'layout'
                ? normalizeWorkflow(pipelineCell?.viewWorkflow).layout.pendingReview
                : null

            return (
              <section
                key={column.id}
                className={cn(
                  'emp-wf-column',
                  isSingleCell && columnStatus === 'completed' && 'emp-wf-column--stage-completed',
                  isSingleCell && columnStatus === 'not_started' && 'emp-wf-column--stage-pending',
                  isSingleCell && isCurrentStage && 'emp-wf-column--active-stage',
                  activeFilter === column.id && 'is-highlighted',
                  activeFilter && activeFilter !== column.id && 'is-dimmed',
                )}
              >
                <header className="emp-wf-column-head">
                  <span className="emp-wf-column-label">
                    <span className="emp-wf-column-dot" style={{ backgroundColor: column.dot }} />
                    {column.label.toUpperCase()}
                    {pendingReview ? (
                      <span className="emp-wf-column-review-hint"> · Awaiting {pendingReview.toUpperCase()}</span>
                    ) : null}
                  </span>
                  {pipelineCell ? (
                    <ViewProgressStatusBadge status={columnStatus} />
                  ) : !isSingleCell && columnCells.length > 0 ? (
                    <span className="emp-wf-column-count">{columnCells.length}</span>
                  ) : null}
                </header>
                {!compact && columnCells.length > 0 ? (
                  <p className="emp-wf-column-meta">
                    {columnCells.length} BLOCK{columnCells.length === 1 ? '' : 'S'} · {engineerIds || 1} ENGINEER
                    {(engineerIds || 1) === 1 ? '' : 'S'}
                  </p>
                ) : null}
                <div className="emp-wf-column-body">
                  {columnCells.length === 0 ? (
                    isSingleCell ? (
                      <div className="emp-wf-empty emp-wf-empty--pipeline" aria-hidden />
                    ) : (
                      <p className="emp-wf-empty">No blocks</p>
                    )
                  ) : (
                    columnCells.map((cell) => (
                      <WorkflowBlockCard
                        key={cell.id}
                        cell={cell}
                        user={user}
                        viewTab={viewTab}
                        savingId={savingId}
                        onAdvance={onAdvance}
                        onRequestReview={onRequestReview}
                        adminMode={adminMode}
                        openReview={openReviewByCellId?.get?.(cell.id) ?? null}
                        onResolveReview={onResolveReview}
                        reviewSaving={reviewSaving}
                        hideStageRow={isSingleCell}
                        checklistFilled={checklistFilled}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
