import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { usePagination } from '@hooks/usePagination'

export function PaginationBar({
  total,
  page,
  pageSize,
  onPageChange,
  className,
}: {
  total: number
  page: number
  pageSize: number
  onPageChange: (p: number) => void
  className?: string
}) {
  const { totalPages, from, to } = usePagination(total, page, pageSize)
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm text-muted">
        <span className="font-medium text-ink">{from}</span>
        {' – '}
        <span className="font-medium text-ink">{to}</span>
        {' of '}
        <span className="font-medium text-ink">{total}</span>
      </p>
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
  )
}
