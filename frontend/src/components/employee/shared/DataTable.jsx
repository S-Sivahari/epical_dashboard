import { cn } from '@pages/employee/lib/utils'
import { Badge, statusVariant } from '@components/employee/ui/badge'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

export function DataTable({ columns, data, statusKey, compact = false, emptyMessage = 'No records found.' }) {
  if (!data?.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-10 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      data-portal-card=""
      className={cn(
        portalCardClass({ className: 'w-full max-w-full overflow-x-auto rounded-lg bg-background/40 shadow-none' }),
      )}
    >
      <table className={cn('w-full text-sm', compact ? 'min-w-0 table-auto' : 'min-w-[800px]')}>
        <thead>
          <tr className="border-b border-border bg-slate-50/80">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left font-heading font-semibold text-foreground">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id ?? i} className="border-b border-border last:border-0 transition-colors hover:bg-slate-50/50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-muted',
                    col.key === 'description' && 'max-w-[280px] whitespace-normal break-words'
                  )}
                >
                  {typeof col.render === 'function' ? (
                    col.render(row)
                  ) : col.key === statusKey && row[col.key] ? (
                    <Badge variant={statusVariant(row[col.key])}>{row[col.key]}</Badge>
                  ) : (
                    row[col.key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
