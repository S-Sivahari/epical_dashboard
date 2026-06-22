import type { EmployeeProjectWorkspace, WorkspaceSummary } from '@/types/projectWorkspace'

/** Map employee workspace API payload into admin workspace summary shape for shared UI. */
export function mapEmployeeWorkspaceToSummary(ws: EmployeeProjectWorkspace): WorkspaceSummary {
  return {
    project: {
      id: ws.project.id,
      name: ws.project.name,
      client: ws.project.client,
      accessType: 'private',
      teamLead: '',
      technologyNode: ws.project.technologyNode,
      description: '',
      status: ws.project.status,
      completionPercentage: ws.project.completionPercentage ?? 0,
    },
    libraries: ws.libraries,
    cells: ws.cells,
    stats: {
      libraryCount: ws.stats.libraryCount,
      cellCount: ws.stats.cellCount,
      completedCells: ws.stats.completedCells,
      notStartedCells: ws.stats.notStartedCells,
      inProgressCells: ws.stats.inProgressCells,
      blockedCells: ws.stats.blockedCells,
      readyCells: ws.stats.readyCells,
      unassignedCells: ws.stats.unassignedCells,
      openReviews: ws.pendingReviewCount ?? 0,
    },
  }
}
