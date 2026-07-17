import { CELL_WORKFLOW_STAGES, type ProjectCell } from '@/types/projectWorkspace'
import { formatWorkflowDurationFromMs } from '@/utils/durationFormat'
import { exportToExcel } from '@/utils/exportExcel'
import { buildExportFileName } from '@/utils/exportFileName'
import { exportToPDF } from '@/utils/exportPDF'
import {
  WORKFLOW_STATUS_LABELS,
  cellCompletionProgressPercent,
  cellTypeLabel,
  normalizeCellWorkflow,
} from '@/pages/admin/Projects/projectWorkspaceUi'

type WorkProgressExportOptions = {
  projectName: string
  cells: ProjectCell[]
  libraryNameById: Map<string, string>
  generatedBy: string
  filters?: Record<string, string | undefined>
}

const headers = [
  { key: 'cell', label: 'Cell' },
  { key: 'library', label: 'Library' },
  { key: 'type', label: 'Type' },
  { key: 'progress', label: 'Progress' },
  { key: 'estimatedHours', label: 'Est. Hours' },
  { key: 'workingHours', label: 'Working Hours' },
  ...CELL_WORKFLOW_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.key === 'drc_first' ? 'DRC 1' : stage.key === 'drc_final' ? 'Final DRC' : stage.label,
  })),
]

function buildRows(cells: ProjectCell[], libraryNameById: Map<string, string>): Record<string, unknown>[] {
  return cells.map((cell) => {
    const workflow = normalizeCellWorkflow(cell.workflow)
    const workingDuration = cell.productiveWorkDuration ?? cell.workflowDuration
    const row: Record<string, unknown> = {
      cell: cell.name,
      library: libraryNameById.get(cell.libraryId) || '—',
      type: cellTypeLabel(cell.cellType),
      progress: `${cellCompletionProgressPercent(cell)}%`,
      estimatedHours: cell.estimatedEffort ?? 0,
      workingHours: workingDuration?.formatted
        || formatWorkflowDurationFromMs(workingDuration?.totalMs ?? 0),
    }

    workflow.forEach((stage) => {
      row[stage.stageKey] = WORKFLOW_STATUS_LABELS[stage.status]
    })
    return row
  })
}

function reportOptions(options: WorkProgressExportOptions) {
  return {
    generatedBy: options.generatedBy,
    filters: options.filters,
    panelTitle: options.projectName,
    reportTitle: 'Cell Work Progress',
  }
}

export async function exportCellWorkProgressToPDF(options: WorkProgressExportOptions): Promise<void> {
  await exportToPDF(
    buildRows(options.cells, options.libraryNameById),
    buildExportFileName('cell_work_progress', [options.projectName]),
    headers,
    reportOptions(options),
  )
}

export async function exportCellWorkProgressToExcel(options: WorkProgressExportOptions): Promise<void> {
  await exportToExcel(
    buildRows(options.cells, options.libraryNameById),
    buildExportFileName('cell_work_progress', [options.projectName]),
    headers,
    {
      ...reportOptions(options),
      sheetName: 'Work Progress',
    },
  )
}
