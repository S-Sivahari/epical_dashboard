import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaves } from '@hooks/useLeaves'
import type { LeaveRequest } from '@/types'
import { formatDate } from '@/utils/formatDate'

export function PendingLeaves() {
  const { leaves, loading, approveLeave, rejectLeave, fetchLeaves } = useLeaves()
  const pending = leaves.filter((l) => l.status === 'Pending')

  const columns: Column<LeaveRequest>[] = [
    { key: 'employeeName', header: 'Employee' },
    { key: 'type', header: 'Leave type' },
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
      <DataTable columns={columns} data={pending} loading={loading} />

      <section className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="font-display text-base font-semibold text-ink">Leave history</h3>
        <p className="mt-1 text-sm text-muted">All requests (sample)</p>
        <div className="mt-4">
          <DataTable
            columns={
              [
                { key: 'from', header: 'Date', render: () => '—' },
                { key: 'employeeName', header: 'Employee' },
                { key: 'type', header: 'Type' },
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
                {
                  key: 'status',
                  header: 'Status',
                  render: (l) => (
                    <Badge variant={l.status === 'Approved' ? 'success' : l.status === 'Rejected' ? 'danger' : 'warning'}>
                      {l.status}
                    </Badge>
                  ),
                },
                { key: 'reason', header: 'Reason' },
              ] as Column<LeaveRequest>[]
            }
            data={leaves}
            loading={loading}
          />
        </div>
      </section>

    </div>
  )
}
