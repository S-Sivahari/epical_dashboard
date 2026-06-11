import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { usePagination } from '@hooks/usePagination'

export function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = 'employees',
  className,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  className?: string
}) {
  const { totalPages, from, to, visiblePages } = usePagination(total, page, pageSize)

  if (total === 0) return null

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm text-ink/80">
        Showing{' '}
        <span className="font-semibold text-ink">{from}</span>
        {' – '}
        <span className="font-semibold text-ink">{to}</span>
        {' of '}
        <span className="font-semibold text-ink">{total}</span>
        {' '}{itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink/70">Rows per page</span>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="admin-field h-9 cursor-pointer appearance-none pl-2.5 pr-8 text-sm font-medium text-ink"
                aria-label="Rows per page"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700"
                aria-hidden
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex items-center gap-1">
            {visiblePages.map((pageNum, index) => {
              const prevPage = visiblePages[index - 1]
              const showEllipsis = prevPage != null && pageNum - prevPage > 1
              return (
                <span key={pageNum} className="flex items-center gap-1">
                  {showEllipsis ? <span className="px-1 text-sm text-ink/50">…</span> : null}
                  <button
                    type="button"
                    onClick={() => onPageChange(pageNum)}
                    className={cn(
                      'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
                      pageNum === page
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-ink hover:bg-emerald-50',
                    )}
                    aria-label={`Page ${pageNum}`}
                    aria-current={pageNum === page ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                </span>
              )
            })}
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="gap-1"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
