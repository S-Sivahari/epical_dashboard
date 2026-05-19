import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Spinner } from '@components/ui/Spinner'

export interface Column<T> {
  key: keyof T | string
  header: string
  className?: string
  render?: (row: T) => ReactNode
}

export function DataTable<T extends { id?: string }>({
  columns,
  data = [],
  loading,
  empty,
}: {
  columns: Column<T>[]
  data?: T[]
  loading?: boolean
  empty?: ReactNode
}) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-surface/40">
        <Spinner size="lg" />
      </div>
    )
  }
  if (!data.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted">
        {empty ?? 'No records found.'}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-sm">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-surface/80">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                scope="col"
                className={cn('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted', c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row, i) => (
            <tr key={(row as { id?: string }).id ?? i} className="hover:bg-surface/60">
              {columns.map((c) => (
                <td key={String(c.key)} className={cn('whitespace-nowrap px-4 py-3 text-ink', c.className)}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
