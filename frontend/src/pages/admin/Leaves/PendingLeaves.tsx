<<<<<<< HEAD
import { useEffect, useRef } from 'react'
=======
import { useState } from 'react'
>>>>>>> d58e55571b5c14feaa8762cccd77842ca127b466
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaves } from '@hooks/useLeaves'
import type { LeaveRequest } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { filterLeaves, type LeaveFilters } from '@/utils/leaveFilters'
import { useMemo } from 'react'

export function PendingLeaves({ filters }: { filters: LeaveFilters }) {
  const { leaves, loading, approveLeave, rejectLeave, fetchLeaves } = useLeaves()
<<<<<<< HEAD
  const previousLeaveCount = useRef(leaves.length)

  const pending = useMemo(() => {
    return filterLeaves(leaves.filter((l) => l.status === 'Pending'), filters)
  }, [leaves, filters])

  useEffect(() => {
    if (leaves.length > previousLeaveCount.current) {
      toast.success('New leave request received')
    }
    previousLeaveCount.current = leaves.length
  }, [leaves.length])
=======
  const pending = leaves.filter((l) => l.status === 'Pending')
  
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const handleRejectClick = (leaveId: string) => {
    setSelectedLeaveId(leaveId)
    setRejectModalOpen(true)
  }

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }
    if (!selectedLeaveId) return

    try {
      await rejectLeave(selectedLeaveId, rejectionReason)
      toast.success('Leave rejected with reason')
      setRejectModalOpen(false)
      setRejectionReason('')
      setSelectedLeaveId(null)
      await fetchLeaves()
    } catch (error) {
      toast.error('Failed to reject leave')
    }
  }
>>>>>>> d58e55571b5c14feaa8762cccd77842ca127b466

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
            onClick={() => handleRejectClick(l.id)}
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

      <Modal
        isOpen={rejectModalOpen}
        title="Reject Leave Request"
        onClose={() => {
          setRejectModalOpen(false)
          setRejectionReason('')
          setSelectedLeaveId(null)
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Rejection Reason *</label>
            <Input
              placeholder="Enter reason for rejection"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setRejectModalOpen(false)
                setRejectionReason('')
                setSelectedLeaveId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>

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
                { key: 'reason', header: 'Reason' },
                {
                  key: 'rejectionReason',
                  header: 'Rejection Reason',
                  render: (l) => l.rejectionReason || '—',
                },
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
