import { useMemo } from 'react'
import { cn } from '@/utils/cn'
import { useLeaves } from '@hooks/useLeaves'
import {
  excludeCancelledLeaves,
  filterLeaves,
  formatYearLabel,
  type LeaveFilters,
} from '@/utils/leaveFilters'

type StatusType = 'Pending' | 'Approved' | 'Rejected'

export function LeaveStatusTabsBar({
  filters,
  onFiltersChange,
  monthLabel: monthLabelProp,
  className,
}: {
  filters: LeaveFilters
  onFiltersChange: (f: LeaveFilters) => void
  monthLabel?: string
  className?: string
}) {
  const { leaves } = useLeaves()
  const visibleLeaves = useMemo(() => excludeCancelledLeaves(leaves), [leaves])

  const periodLabel = useMemo(() => {
    if (monthLabelProp) return monthLabelProp
    if (filters.dateFrom) return formatYearLabel(filters.dateFrom)
    return formatYearLabel(String(new Date().getFullYear()))
  }, [filters.dateFrom, monthLabelProp])

  const statusCounts = useMemo(() => {
    const inPeriod = filterLeaves(visibleLeaves, { ...filters, status: 'All' })
    return {
      Pending: inPeriod.filter((l) => l.status === 'Pending').length,
      Approved: inPeriod.filter((l) => l.status === 'Approved').length,
      Rejected: inPeriod.filter((l) => l.status === 'Rejected').length,
    }
  }, [visibleLeaves, filters])

  return (
    <div className={cn('admin-leaves-status-tabs admin-leaves-status-tabs--hub', className)}>
      <nav className="admin-leaves-status-tab-rail admin-leaves-tab-rail" aria-label="Leave status">
        {(['Pending', 'Approved', 'Rejected'] as StatusType[]).map((status) => {
          const count = statusCounts[status]
          const active = filters.status === status
          return (
            <button
              key={status}
              type="button"
              data-status={status}
              onClick={() => onFiltersChange({ ...filters, status })}
              className={cn(
                'admin-leaves-tab-btn admin-leaves-status-tab-btn',
                active ? 'admin-leaves-tab-btn--active' : 'admin-leaves-tab-btn--inactive',
              )}
            >
              <span>{status}</span>
              <span className="admin-leaves-status-tab-count">{count}</span>
            </button>
          )
        })}
      </nav>
      <span className="admin-leaves-status-month-label">{periodLabel}</span>
    </div>
  )
}
