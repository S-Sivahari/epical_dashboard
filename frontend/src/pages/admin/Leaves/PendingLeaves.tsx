import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaves } from '@hooks/useLeaves'
import type { LeaveRequest } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { filterLeaves, type LeaveFilters } from '@/utils/leaveFilters'
import { useMemo } from 'react'

export function PendingLeaves({ filters }: { filters: LeaveFilters }) {
  const { leaves, loading, approveLeave, rejectLeave, fetchLeaves } = useLeaves()
  
  const pending = useMemo(() => {
    return filterLeaves(leaves.filter(l => l.status === 'Pending'), filters)
  }, [leaves, filters])



  const columns: Column<LeaveRequest>[] = [
    { key: 'employeeName', header: 'Employee' },
    { key: 'type', header: 'Leave type' },
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
      header: 'From',
      render: (l) => formatDate(l.from),
    },
    {
      key: 'to',
      header: 'To',
      render: (l) => formatDate(l.to),
    },
    { key: 'days', header: 'Days' },
    { key: 'reason', header: 'Reason' },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <Badge variant="warning">{l.status}</Badge>,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (l) => (
        <div className="flex gap-2">
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
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <DataTable columns={columns} data={pending} loading={loading} empty="No pending leave requests." />
    </div>
  )
}
