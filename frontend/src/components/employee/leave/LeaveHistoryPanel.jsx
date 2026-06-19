import { History } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'
import { InteractiveCard, portalCardClass } from '@components/employee/shared/interactiveCard'
import { Button } from '@components/employee/ui/button'
import { DataTable } from '@components/employee/shared/DataTable'
import { SearchBar } from '@components/employee/shared/SearchBar'
import { FilterDropdown } from '@components/employee/shared/FilterDropdown'
import { DateInput } from '@components/shared/DateInput'

const CARD_CLASS = portalCardClass({ className: 'emp-leave-card' })

export function LeaveHistoryPanel({
  columns,
  historyLeaves,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  historyFromDate,
  onHistoryFromDateChange,
  historyToDate,
  onHistoryToDateChange,
  onClearDateRange,
  leaveBoundsMax,
}) {
  return (
    <InteractiveCard
      className={cn(
        CARD_CLASS,
        'emp-leave-history-card emp-leave-top-panel flex w-full flex-col',
      )}
    >
      <div className="emp-leave-history-head">
        <div className="emp-leave-history-toolbar__title">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <History className="h-4 w-4" />
          </div>
          <h3 className="font-heading text-base font-semibold tracking-tight text-foreground">
            Leave history
          </h3>
        </div>
      </div>

      <div className="emp-leave-history-toolbar">
        <div className="emp-leave-history-toolbar__date">
          <span className="emp-leave-history-toolbar__date-label">From date</span>
          <DateInput
            className="emp-leave-control rounded-xl"
            value={historyFromDate}
            onChange={onHistoryFromDateChange}
            minDate="2000-01-01"
            maxDate={leaveBoundsMax}
            placeholder="dd/mm/yyyy"
          />
        </div>

        <div className="emp-leave-history-toolbar__date">
          <span className="emp-leave-history-toolbar__date-label">To date</span>
          <DateInput
            className="emp-leave-control rounded-xl"
            value={historyToDate}
            onChange={onHistoryToDateChange}
            minDate={historyFromDate || '2000-01-01'}
            maxDate={leaveBoundsMax}
            placeholder="dd/mm/yyyy"
          />
        </div>

        {(historyFromDate || historyToDate) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="emp-dash-btn emp-dash-btn--sm emp-leave-history-toolbar__clear h-9 shrink-0"
            onClick={onClearDateRange}
          >
            Clear
          </Button>
        )}

        <FilterDropdown
          value={statusFilter}
          onChange={onStatusFilterChange}
          placeholder="Status"
          options={[
            { value: 'all', label: 'All' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />

        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder="Search by reason…"
          className="emp-leave-history-toolbar__search"
        />
      </div>

      <div className="emp-leave-history-scroll custom-scrollbar">
        <DataTable
          columns={columns}
          data={historyLeaves}
          statusKey="status"
          compact
          emptyMessage="No leave history records match your filters."
        />
      </div>
    </InteractiveCard>
  )
}
