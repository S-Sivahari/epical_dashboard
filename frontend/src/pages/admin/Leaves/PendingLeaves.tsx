import { toast } from 'sonner'
import { useState } from 'react'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaves } from '@hooks/useLeaves'
import type { LeaveRequest } from '@/types'
import { formatDate } from '@/utils/formatDate'

export function PendingLeaves() {
  const { leaves, loading, approveLeave, rejectLeave, cancelLeave, fetchLeaves } = useLeaves()

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [leaveToCancel, setLeaveToCancel] = useState<LeaveRequest | null>(null)

  const handleConfirmCancel = async () => {
    if (!leaveToCancel) return
    try {
      await cancelLeave(leaveToCancel.id)
      toast.success('Leave cancelled successfully')
    } catch {
      toast.error('Failed to cancel leave')
    } finally {
      setCancelModalOpen(false)
      setLeaveToCancel(null)
    }
  }

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
      render: (l) => (
        <Badge
          variant={
            l.status === 'Approved'
              ? 'success'
              : l.status === 'Rejected'
                ? 'danger'
                : 'warning'
          }
        >
          {l.status}
        </Badge>
      ),
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
              variant="danger"
              onClick={() => {
                setLeaveToCancel(l)
                setCancelModalOpen(true)
              }}
            >
              Cancel Leave
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <DataTable columns={columns} data={leaves} loading={loading} />

      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Cancel Approved Leave"
        description="Are you sure you want to cancel this approved leave?"
        confirmLabel="Cancel Leave"
        danger
        onClose={() => {
          setCancelModalOpen(false)
          setLeaveToCancel(null)
        }}
        onConfirm={handleConfirmCancel}
      />
    </div>
  )
}
