import type { CellStatus, ProjectCell } from '@/types/projectWorkspace'

export const STATUS_LABELS: Record<CellStatus, string> = {
  ready: 'Ready',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export function cellDisplayStatus(cell: ProjectCell) {
  if (cell.isBlocked && cell.status !== 'completed') return 'Blocked'
  return STATUS_LABELS[cell.status]
}
