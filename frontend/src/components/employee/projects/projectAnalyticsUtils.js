import { getViewProgressStatus, normalizeWorkflow } from '@/utils/cellWorkflowUi'

const METRIC_COLORS = {
  effort: '#2563eb',
  review: '#d97706',
  complete: '#16a34a',
  archived: '#64748b',
  in_progress: '#3b82f6',
  not_started: '#94a3b8',
  assigned: '#0d9488',
}

const CELL_STATUS_COLORS = {
  completed: '#16a34a',
  in_progress: '#f59e0b',
  not_started: '#94a3b8',
  review: '#d97706',
}

function countCellsByCellStatus(cells = []) {
  const counts = { not_started: 0, in_progress: 0, completed: 0 }
  for (const cell of cells) {
    if (cell.status === 'completed') counts.completed += 1
    else if (cell.status === 'in_progress') counts.in_progress += 1
    else counts.not_started += 1
  }
  return counts
}

function countPendingReviews(cells = []) {
  return cells.reduce((count, cell) => {
    const pendingReview = normalizeWorkflow(cell?.viewWorkflow).layout.pendingReview
    return pendingReview ? count + 1 : count
  }, 0)
}

function sumEstimatedEffort(cells = [], { assignedOnly = false } = {}) {
  return cells.reduce((total, cell) => {
    if (assignedOnly && !cell.isAssignedToMe) return total
    return total + (Number(cell.estimatedEffort) || 0)
  }, 0)
}

export const OVERVIEW_CHART_SERIES = [
  { key: 'totalEffort', name: 'Total effort (hrs)', color: '#0d9488' },
  { key: 'yourEffort', name: 'Your effort (hrs)', color: '#2563eb' },
  { key: 'pendingReviews', name: 'Review pending', color: '#d97706' },
  { key: 'complete', name: 'Complete', color: '#16a34a' },
  { key: 'inProgress', name: 'In progress', color: '#f59e0b' },
  { key: 'notStarted', name: 'Not started', color: '#94a3b8' },
  { key: 'assigned', name: 'Assigned to you', color: '#0891b2' },
]

/** Grouped bar chart rows for portfolio workload overview */
export function buildGroupedOverviewChartData(cells = []) {
  const statusCounts = countCellsByCellStatus(cells)
  const pendingReviews = countPendingReviews(cells)
  const totalEffort = sumEstimatedEffort(cells)
  const assignedEffort = sumEstimatedEffort(cells, { assignedOnly: true })
  const assignedCount = cells.filter((c) => c.isAssignedToMe).length

  return [
    {
      category: 'Effort',
      totalEffort,
      yourEffort: assignedEffort,
      pendingReviews: 0,
      complete: 0,
      inProgress: 0,
      notStarted: 0,
      assigned: 0,
    },
    {
      category: 'Cell status',
      totalEffort: 0,
      yourEffort: 0,
      pendingReviews: 0,
      complete: statusCounts.completed,
      inProgress: statusCounts.in_progress,
      notStarted: statusCounts.not_started,
      assigned: 0,
    },
    {
      category: 'Reviews',
      totalEffort: 0,
      yourEffort: 0,
      pendingReviews,
      complete: 0,
      inProgress: 0,
      notStarted: 0,
      assigned: assignedCount,
    },
  ]
}

/** Per-cell effort bars with review/status coloring (single-project view) */
export function buildCellEffortChartData(cells = []) {
  return cells
    .map((cell) => {
      const wf = normalizeWorkflow(cell?.viewWorkflow)
      const pendingReview = wf.layout.pendingReview
      const status = getViewProgressStatus(cell, 'layout')
      const name = cell.name?.length > 22 ? `${cell.name.slice(0, 20)}…` : cell.name || 'Cell'

      let fill = CELL_STATUS_COLORS[status] || CELL_STATUS_COLORS.not_started
      if (pendingReview) fill = CELL_STATUS_COLORS.review

      return {
        id: cell.id,
        name,
        fullName: cell.name || 'Cell',
        effort: Number(cell.estimatedEffort) || 0,
        pendingReview: pendingReview ? pendingReview.toUpperCase() : null,
        status,
        fill,
        isAssignedToMe: Boolean(cell.isAssignedToMe),
      }
    })
    .sort((a, b) => b.effort - a.effort)
}

export function aggregateWorkspaceStats(workspaces = []) {
  const allCells = workspaces.flatMap((ws) => ws?.cells || [])

  return {
    projects: workspaces.filter(Boolean).length,
    cells: allCells.length,
    yours: allCells.filter((c) => c.isAssignedToMe).length,
    complete: allCells.filter((c) => c.status === 'completed').length,
    inProgress: allCells.filter((c) => c.status === 'in_progress').length,
    notStarted: allCells.filter((c) => c.status === 'ready').length,
    effort: sumEstimatedEffort(allCells),
    reviews: countPendingReviews(allCells),
  }
}

export function shouldUseCellEffortChart(workspaces = []) {
  return workspaces.length === 1 && (workspaces[0]?.cells?.length || 0) > 0
}
