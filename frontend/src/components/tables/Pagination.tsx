import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { usePagination } from '@hooks/usePagination'

export function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange?: (n: number) => void
  className?: string
}) {
  const { totalPages, from, to } = usePagination(total, page, pageSize)
  return (
    <div className={cn('flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm text-muted">
        Showing <span className="font-medium text-ink">{from}</span>–
        <span className="font-medium text-ink">{to}</span> of{' '}
        <span className="font-medium text-ink">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            Rows
            <select
              className="rounded-lg border border-border bg-white px-2 py-1 text-sm text-ink"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex gap-1">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
