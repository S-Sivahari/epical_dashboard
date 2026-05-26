import { cn } from '@pages/employee/lib/utils'
import { Badge, statusVariant } from '@components/employee/ui/badge'

export function DataTable({ columns, data, statusKey }) {
  if (!data?.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted">
        No records found.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
      <table className="w-full min-w-[800px] text-sm">
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
