import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaves } from '@hooks/useLeaves'
import type { LeaveRequest } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { filterLeaves, type LeaveFilters } from '@/utils/leaveFilters'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'

type StatusType = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

const ITEMS_PER_PAGE = 8

interface StatusPagination {
  [key: string]: number
}

export function LeaveRequests() {
  const { leaves, loading, approveLeave, rejectLeave, cancelLeave, fetchLeaves } = useLeaves()
  const [filters, setFilters] = useState<LeaveFilters>({ employeeName: '', employeeId: '', status: 'Pending' })
  const [statusPagination, setStatusPagination] = useState<StatusPagination>({
    Pending: 1,
    Approved: 1,
    Rejected: 1,
    Cancelled: 1,
  })

  const clearFilters = () => setFilters({ employeeName: '', employeeId: '', status: 'Pending' })

  const currentStatus = (filters.status as StatusType) || 'Pending'

  // Filter leaves by status
  const filteredByStatus = useMemo(() => {
    return leaves.filter(l => l.status === currentStatus)
  }, [leaves, currentStatus])

  // Apply name and ID filters
  const filteredLeaves = useMemo(() => {
    return filterLeaves(filteredByStatus, { ...filters, status: currentStatus })
  }, [filteredByStatus, filters, currentStatus])

  // Calculate pagination
  const currentPage = statusPagination[currentStatus] || 1
  const totalPages = Math.ceil(filteredLeaves.length / ITEMS_PER_PAGE)
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedLeaves = filteredLeaves.slice(startIdx, startIdx + ITEMS_PER_PAGE)

  const handlePageChange = (newPage: number) => {
    setStatusPagination({
      ...statusPagination,
      [currentStatus]: newPage,
    })
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'warning'
      case 'Approved':
        return 'success'
      case 'Rejected':
        return 'danger'
      case 'Cancelled':
        return 'secondary'
      default:
        return 'default'
    }
  }

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'employeeName',
      header: 'Employee Name',
      render: (l) => <span className="font-medium">{l.employeeName}</span>,
    },
    {
      key: 'employeeId',
      header: 'Employee ID',
      render: (l) => <span className="text-muted text-sm">{l.employeeId || 'N/A'}</span>,
    },
    { key: 'type', header: 'Leave Type' },
    {
      key: 'leaveDuration',
      header: 'Duration',
      render: (l) =>
        l.leaveDuration === 'Half Day'
          ? `${l.leaveDuration} (${l.halfDaySession ?? 'Session'})`
          : 'Full Day',
    },
    {
      key: 'from',
      header: 'From Date',
      render: (l) => formatDate(l.from),
    },
    {
      key: 'to',
      header: 'To Date',
      render: (l) => formatDate(l.to),
    },
    { key: 'days', header: 'Days', render: (l) => <span className="font-semibold">{l.days}</span> },
    {
      key: 'appliedDate',
      header: 'Applied Date',
      render: (l) => formatDate(l.appliedDate || new Date().toISOString()),
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <Badge variant={getStatusVariant(l.status)}>{l.status}</Badge>,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (l) => (
        <div className="flex gap-2">
          {l.status === 'Pending' && (
            <>
              <Button
                size="sm"
                onClick={async () => {
                  await approveLeave(l.id)
                  toast.success('Leave approved')
                  await fetchLeaves()
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await rejectLeave(l.id)
                  toast.success('Leave rejected')
                  await fetchLeaves()
                }}
              >
                Reject
              </Button>
            </>
          )}
          {l.status === 'Approved' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await cancelLeave(l.id)
                toast.success('Leave cancelled')
                await fetchLeaves()
              }}
            >
              Cancel
            </Button>
          )}
          {(l.status === 'Rejected' || l.status === 'Cancelled') && (
            <span className="text-xs text-muted">No actions</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink">Filters & Search</h3>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted hover:text-ink">
            <X className="mr-2 h-4 w-4" /> Clear Filters
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Employee Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Search name..."
                className="pl-9 h-9 text-sm"
                value={filters.employeeName}
                onChange={(e) => {
                  setFilters({ ...filters, employeeName: e.target.value })
                  setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
                }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Employee ID</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Search ID..."
                className="pl-9 h-9 text-sm"
                value={filters.employeeId}
                onChange={(e) => {
                  setFilters({ ...filters, employeeId: e.target.value })
                  setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex space-x-6 border-b border-border">
        {['Pending', 'Approved', 'Rejected', 'Cancelled'].map((status) => {
          const count = leaves.filter(l => l.status === status).length
          return (
            <button
              key={status}
              onClick={() => {
                setFilters({ ...filters, status })
              }}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                filters.status === status
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink hover:border-border'
              }`}
            >
              {status}
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={paginatedLeaves}
          loading={loading}
          empty={`No ${currentStatus.toLowerCase()} leave requests.`}
        />

        {/* Pagination Controls */}
        {filteredLeaves.length > 0 && (
          <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-muted">
              Showing <span className="font-semibold">{startIdx + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(startIdx + ITEMS_PER_PAGE, filteredLeaves.length)}</span> of{' '}
              <span className="font-semibold">{filteredLeaves.length}</span> results
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted">
                  Page <span className="font-semibold">{currentPage}</span> of{' '}
                  <span className="font-semibold">{totalPages}</span>
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
