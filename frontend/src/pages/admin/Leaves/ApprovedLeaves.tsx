import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Ban } from 'lucide-react'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaves } from '@hooks/useLeaves'
import type { LeaveRequest } from '@/types'
import { formatDate } from '@/utils/formatDate'
import { filterLeaves, type LeaveFilters } from '@/utils/leaveFilters'

export function ApprovedLeaves({ filters }: { filters: LeaveFilters }) {
  const { leaves, loading, cancelLeave } = useLeaves()
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [leaveToCancel, setLeaveToCancel] = useState<LeaveRequest | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const handleConfirmCancel = async () => {
    if (!leaveToCancel) return
    if (!cancelReason.trim()) {
      toast.error('Cancellation reason is required')
      return
    }
    try {
      await cancelLeave(leaveToCancel.id, cancelReason)
      toast.success('Leave cancelled successfully')
    } catch {
      toast.error('Failed to cancel leave')
    } finally {
      setCancelModalOpen(false)
      setLeaveToCancel(null)
      setCancelReason('')
    }
  }

  const getComplexStatus = (leave: LeaveRequest) => {
    if (leave.status === 'Cancelled') return 'Cancelled'
    if (leave.status !== 'Approved') return leave.status

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const fromDate = new Date(leave.from)
    const toDate = new Date(leave.to)

    if (today > toDate) return 'Completed'
    if (today >= fromDate && today <= toDate) return 'In Progress'
    return 'Approved'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'neutral'
      case 'In Progress': return 'info'
      case 'Approved': return 'success'
      case 'Cancelled': return 'danger'
      default: return 'warning'
    }
  }

  const filteredLeaves = useMemo(() => {
    return filterLeaves(
      leaves.filter((l) => l.status === 'Approved' || l.status === 'Cancelled'),
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
    {
      key: 'approvalDate',
      header: 'Approval Date',
      render: (l) => l.approvalDate ? formatDate(l.approvalDate) : '—',
    },
    {
      key: 'approvedBy',
      header: 'Approved By',
      render: (l) => l.approvedBy || 'Admin',
    },
    {
      key: 'status',
      header: 'Current Status',
      render: (l) => {
        const status = getComplexStatus(l)
        return <Badge variant={getStatusColor(status)}>{status}</Badge>
      }
    },
    {
      key: 'id',
      header: 'Actions',
      render: (l) =>
        l.status === 'Approved' && getComplexStatus(l) !== 'Completed' ? (
          <button
            title="Cancel Leave"
            className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors"
            onClick={() => {
              setLeaveToCancel(l)
              setCancelReason('')
              setCancelModalOpen(true)
            }}
          >
            <Ban className="w-4 h-4" />
          </button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <DataTable columns={columns} data={filteredLeaves} loading={loading} empty="No approved leaves found." />

      <Modal
        isOpen={cancelModalOpen}
        title="Cancel Approved Leave"
        size="sm"
        onClose={() => {
          setCancelModalOpen(false)
          setLeaveToCancel(null)
          setCancelReason('')
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to cancel this approved leave? This will update the status immediately.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">
              Cancellation Reason <span className="text-danger">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={3}
              placeholder="Enter reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setCancelModalOpen(false)
                setLeaveToCancel(null)
                setCancelReason('')
              }}
            >
              Close
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmCancel}
              disabled={!cancelReason.trim()}
            >
              Cancel Leave
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
