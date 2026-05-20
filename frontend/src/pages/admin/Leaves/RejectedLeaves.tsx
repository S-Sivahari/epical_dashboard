import { useMemo } from 'react'
import { Badge } from '@components/ui/Badge'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaves } from '@hooks/useLeaves'
import type { LeaveRequest } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { filterLeaves, type LeaveFilters } from '@/utils/leaveFilters'

export function RejectedLeaves({ filters }: { filters: LeaveFilters }) {
  const { leaves, loading } = useLeaves()

  const filteredLeaves = useMemo(() => {
    return filterLeaves(
      leaves.filter((l) => l.status === 'Rejected'),
      filters
    )
  }, [leaves, filters])

  const columns: Column<LeaveRequest>[] = [
    { key: 'employeeName', header: 'Employee' },
    { key: 'type', header: 'Leave type' },
    {
      key: 'from',
      header: 'Start Date',
      render: (l) => formatDate(l.from),
    },
    {
      key: 'to',
      header: 'End Date',
      render: (l) => formatDate(l.to),
    },
    { key: 'reason', header: 'Reason' },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <Badge variant="danger">{l.status}</Badge>,
    },
  ]

  return (
    <div className="space-y-6">
      <DataTable 
        columns={columns} 
        data={filteredLeaves} 
        loading={loading} 
        empty="No rejected leave requests found." 
      />
    </div>
  )
}
