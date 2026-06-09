import { useMemo } from 'react'
import { cn } from '@pages/employee/lib/utils'
import { getCellKanbanColumn, getKanbanColumnsForView } from '@/utils/cellWorkflowUi'
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

  const boardMinWidth = compact
    ? viewTab === 'layout'
      ? '520px'
      : '420px'
    : viewTab === 'layout'
      ? '920px'
      : '720px'

  return (
    <div className={cn('emp-project-workflow', compact && 'emp-project-workflow--compact')}>
      <div className="emp-project-workflow-head">
        {!compact ? <h2 className="emp-project-workflow-title">Project Workflow</h2> : null}
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
      </div>

      <div className="emp-wf-board-wrap">
        <div className="emp-wf-board" style={{ minWidth: boardMinWidth }}>
          {columns.map((column) => {
            const columnCells = grouped[column.id] || []
            return (
              <section
                key={column.id}
                className={cn(
                  'emp-wf-column',
                  activeFilter === column.id && 'is-highlighted',
                  activeFilter && activeFilter !== column.id && 'is-dimmed',
                )}
              >
                <header className="emp-wf-column-head">
                  <span className="emp-wf-column-label">
                    <span className="emp-wf-column-dot" style={{ backgroundColor: column.dot }} />
                    {column.label.toUpperCase()}
                  </span>
                  <span className="emp-wf-column-count">{columnCells.length}</span>
                </header>
                {!compact && columnCells.length > 0 ? (
                  <p className="emp-wf-column-meta">
                    {columnCells.length} BLOCK{columnCells.length === 1 ? '' : 'S'} · {engineerIds || 1} ENGINEER
                    {(engineerIds || 1) === 1 ? '' : 'S'}
                  </p>
                ) : null}
                <div className="emp-wf-column-body">
                  {columnCells.length === 0 ? (
                    <p className="emp-wf-empty">No blocks</p>
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
