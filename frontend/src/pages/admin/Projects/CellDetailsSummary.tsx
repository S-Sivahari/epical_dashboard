import { cellTypeLabel } from './projectWorkspaceUi'

type CellDetailsSummaryProps = {
  cell: {
    name: string
    libraryId?: string
    cellType?: string
    description?: string
    complexity?: string
    estimatedEffort?: number
    assignedEmployeeName?: string
  }
  libraryName?: string
  variant?: 'admin' | 'employee'
}

const DETAILS_CLASS = {
  admin: {
    section: 'admin-projects-cell-details admin-projects-cell-details--summary',
    grid: 'admin-projects-cell-details-grid admin-projects-cell-details-grid--summary',
    item: 'admin-projects-cell-details-item',
    desc: 'admin-projects-cell-details-desc',
  },
  employee: {
    section: 'emp-wf-cell-details emp-wf-cell-details--summary',
    grid: 'emp-wf-cell-details-grid emp-wf-cell-details-grid--summary',
    item: 'emp-wf-cell-details-item',
    desc: 'emp-wf-cell-details-desc',
  },
} as const

export function CellDetailsSummary({
  cell,
  libraryName,
  variant = 'admin',
}: CellDetailsSummaryProps) {
  const typeLabel = cellTypeLabel(cell.cellType || 'block')
  const description = cell.description?.trim()
  const styles = DETAILS_CLASS[variant]

  const fields = [
    { label: 'Library', value: libraryName || '—' },
    { label: 'Cell', value: cell.name },
    { label: 'Type', value: typeLabel },
    { label: 'Complexity', value: cell.complexity || '—' },
    { label: 'Effort', value: `${cell.estimatedEffort ?? 0}h` },
    { label: 'Assigned', value: cell.assignedEmployeeName?.trim() || 'Unassigned' },
  ]

  return (
    <section className={styles.section} aria-label="Cell details">
      <dl className={styles.grid}>
        {fields.map((field) => (
          <div key={field.label} className={styles.item}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {description ? (
        <p className={styles.desc}>
          <span className="font-semibold text-slate-500">Note:</span> {description}
        </p>
      ) : null}
    </section>
  )
}
