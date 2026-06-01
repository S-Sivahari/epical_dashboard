import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
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
    <div
      className={cn(
        'admin-table-scroll max-h-[70vh] overflow-auto rounded-xl border border-border bg-white shadow-glass',
        className,
      )}
    >
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                scope="col"
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted transition-colors duration-150',
                  c.className,
                  c.sortable && 'cursor-pointer hover:bg-emerald-50/60',
                  sortColumn === c.key && 'bg-emerald-50/40 text-primary',
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
            <motion.tr
              key={(row as { id?: string }).id ?? i}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
              className="transition-colors duration-150 hover:bg-emerald-50/50"
            >
              {columns.map((c) => (
                <td key={String(c.key)} className={cn('whitespace-nowrap px-4 py-3 text-ink', c.className)}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? '')}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
