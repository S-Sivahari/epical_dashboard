import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/utils/cn'
import { useLeaves } from '@hooks/useLeaves'
import {
  excludeCancelledLeaves,
  filterLeaves,
  formatMonthLabel,
  getCurrentMonthDateRange,
  getCurrentMonthKey,
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
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey())

  useEffect(() => {
    const syncMonth = () => {
      const nextKey = getCurrentMonthKey()
      if (nextKey !== monthKey) setMonthKey(nextKey)
    }
    syncMonth()
    const id = window.setInterval(syncMonth, 60_000)
    return () => window.clearInterval(id)
  }, [monthKey])

  const monthRange = useMemo(() => getCurrentMonthDateRange(), [monthKey])
  const computedMonthLabel = useMemo(() => formatMonthLabel(monthRange.from), [monthRange.from])
  const monthLabel = monthLabelProp ?? computedMonthLabel

  const panelFilters = useMemo(
    () => ({
      ...filters,
      dateFrom: monthRange.from,
      dateTo: monthRange.to,
    }),
    [filters, monthRange],
  )

  const statusCounts = useMemo(() => {
    const inMonth = filterLeaves(visibleLeaves, { ...panelFilters, status: 'All' })
    return {
      Pending: inMonth.filter((l) => l.status === 'Pending').length,
      Approved: inMonth.filter((l) => l.status === 'Approved').length,
      Rejected: inMonth.filter((l) => l.status === 'Rejected').length,
    }
  }, [visibleLeaves, panelFilters])

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
      <span className="admin-leaves-status-month-label">{monthLabel}</span>
    </div>
  )
}
