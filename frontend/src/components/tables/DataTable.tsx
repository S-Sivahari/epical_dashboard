import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Spinner } from '@components/ui/Spinner'

export interface Column<T> {
  key: keyof T | string
  header: ReactNode
  className?: string
  sortable?: boolean
  render?: (row: T) => ReactNode
}

export function DataTable<T extends { id?: string }>({
  columns,
  data = [],
  loading,
  empty,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: {
  columns: Column<T>[]
  data?: T[]
  loading?: boolean
  empty?: ReactNode
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (key: string) => void
  className?: string
}) {
  if (loading) {
    return (
      <div
        className={cn(
          'flex min-h-[200px] items-center justify-center rounded-xl border border-border bg-surface/40',
          className,
        )}
      >
        <Spinner size="lg" />
      </div>
    )
  }
  if (!data.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center text-sm text-muted',
          className,
        )}
      >
        {empty ?? 'No records found.'}
      </div>
    )
  }
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border bg-white shadow-sm', className)}>
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-surface/80">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                scope="col"
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted',
                  c.className,
                  c.sortable && 'cursor-pointer hover:bg-surface/80'
                )}
                onClick={() => c.sortable && onSort?.(String(c.key))}
              >
                <div className="flex items-center gap-1.5">
                  {c.header}
                  {c.sortable && (
                    <div className="flex flex-col -space-y-[2px]">
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none" className={cn(sortColumn === c.key && sortDirection === 'asc' ? 'text-primary' : 'text-muted/30')}>
                        <path d="M4 0L8 6H0L4 0Z" fill="currentColor"/>
                      </svg>
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none" className={cn(sortColumn === c.key && sortDirection === 'desc' ? 'text-primary' : 'text-muted/30')}>
                        <path d="M4 6L0 0H8L4 6Z" fill="currentColor"/>
                      </svg>
                    </div>
                  )}
                </div>
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
