import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { DataTable, type Column } from '@components/tables/DataTable'
import { useLeaves } from '@hooks/useLeaves'
import type { LeaveRequest } from '@/types'
import { formatDate } from '@/utils/formatDate'

export function ApprovedLeaves() {
  const { leaves, loading, cancelLeave } = useLeaves()
  const [searchQuery, setSearchQuery] = useState('')
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
    return leaves
      .filter((l) => l.status === 'Approved' || l.status === 'Cancelled')
      .filter((l) =>
        l.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
      )
  }, [leaves, searchQuery])

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
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Search by employee name..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <DataTable columns={columns} data={filteredLeaves} loading={loading} empty="No approved leaves found." />

      <ConfirmModal
        isOpen={cancelModalOpen}
        title="Cancel Approved Leave"
        description="Are you sure you want to cancel this approved leave? This will update the status immediately."
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
