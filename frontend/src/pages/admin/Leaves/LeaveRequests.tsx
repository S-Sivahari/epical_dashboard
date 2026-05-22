import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { useLeaves } from '@hooks/useLeaves'
// import type removed
import { formatDate, formatDateTime } from '@/utils/formatDate'
import { filterLeaves, type LeaveFilters } from '@/utils/leaveFilters'

import {  X, ChevronLeft, ChevronRight, Check, Eye, Ban } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'

type StatusType = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

const ITEMS_PER_PAGE = 8

function toTimestamp(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return null
}

interface StatusPagination {
  [key: string]: number
}

export function LeaveRequests() {
  const { leaves, loading, approveLeave, rejectLeave, cancelLeave } = useLeaves()
  
  const [filters, setFilters] = useState<LeaveFilters>({ employeeName: '', employeeId: '', status: 'Pending' })
  const [statusPagination, setStatusPagination] = useState<StatusPagination>({
    Pending: 1,
    Approved: 1,
    Rejected: 1,
    Cancelled: 1,
  })

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [leaveToReject, setLeaveToReject] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const rejectInputRef = useRef<HTMLTextAreaElement>(null)

  // View Reason Modal State
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false)
  const [viewingReason, setViewingReason] = useState('')

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [leaveToCancel, setLeaveToCancel] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const cancelInputRef = useRef<HTMLTextAreaElement>(null)

  const handleViewReason = (reason: string) => {
    setViewingReason(reason)
    setIsReasonModalOpen(true)
  }

  const clearFilters = () => setFilters({ employeeName: '', employeeId: '', status: 'Pending' })

  const currentStatus = (filters.status as StatusType) || 'Pending'

  // Filter leaves by status (Memoized)
  const filteredByStatus = useMemo(() => {
    return leaves.filter(l => l.status === currentStatus)
  }, [leaves, currentStatus])

  // Apply name and ID filters (Memoized)
  const filteredLeaves = useMemo(() => {
    return filterLeaves(filteredByStatus, { ...filters, status: currentStatus })
  }, [filteredByStatus, filters, currentStatus])

  // Calculate pagination
  const currentPage = statusPagination[currentStatus] || 1
  const totalPages = Math.ceil(filteredLeaves.length / ITEMS_PER_PAGE) || 1
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  
  // Paginated leaves (Memoized)
  const paginatedLeaves = useMemo(() => {
    return filteredLeaves.slice(startIdx, startIdx + ITEMS_PER_PAGE)
  }, [filteredLeaves, startIdx])

  const handlePageChange = (newPage: number) => {
    setStatusPagination((prev) => ({
      ...prev,
      [currentStatus]: newPage,
    }))
  }

  // Auto-focus textarea when rejection modal opens
  useEffect(() => {
    if (isRejectModalOpen && rejectInputRef.current) {
      setTimeout(() => rejectInputRef.current?.focus(), 50)
    }
  }, [isRejectModalOpen])

  const openRejectModal = (id: string) => {
    setLeaveToReject(id)
    setRejectionReason('')
    setRejectionError('')
    setIsRejectModalOpen(true)
  }

  const handleRejectConfirm = async () => {
    const trimmedReason = rejectionReason.trim()
    if (!trimmedReason) {
      setRejectionError('Rejection reason is required.')
      return
    }
    if (trimmedReason.length > 250) {
      setRejectionError('Rejection reason must be under 250 characters.')
      return
    }
    
    try {
      await rejectLeave(leaveToReject!, trimmedReason)
      toast.success('Leave rejected successfully')
      setIsRejectModalOpen(false)
    } catch {
      toast.error('Failed to reject leave')
    }
  }

  // Auto-focus textarea when cancel modal opens
  useEffect(() => {
    if (isCancelModalOpen && cancelInputRef.current) {
      setTimeout(() => cancelInputRef.current?.focus(), 50)
    }
  }, [isCancelModalOpen])

  const openCancelModal = (id: string) => {
    setLeaveToCancel(id)
    setCancelReason('')
    setCancelError('')
    setIsCancelModalOpen(true)
  }

  const handleCancelConfirm = async () => {
    const trimmedReason = cancelReason.trim()
    if (!trimmedReason) {
      setCancelError('Cancellation reason is required.')
      return
    }
    
    try {
      await cancelLeave(leaveToCancel!, trimmedReason)
      toast.success('Leave cancelled successfully')
      setIsCancelModalOpen(false)
    } catch {
      toast.error('Failed to cancel leave')
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await approveLeave(id)
      toast.success('Leave approved successfully')
    } catch {
      toast.error('Failed to approve leave')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <Badge variant="warning">Pending</Badge>
      case 'Approved':
        return <Badge variant="success">Approved</Badge>
      case 'Rejected':
        return <Badge variant="danger">Rejected</Badge>
      case 'Cancelled':
        return <Badge variant="neutral">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  // Get unique employee names and IDs
  const uniqueEmployeeNames = useMemo(() => {
    return Array.from(new Set(leaves.map((l) => l.employeeName))).sort()
  }, [leaves])

  const uniqueEmployeeIds = useMemo(() => {
    return Array.from(new Set(leaves.map((l) => l.employeeId))).sort()
  }, [leaves])

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="space-y-5">
        {/* Compact Filters Toolbar */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <select
              value={filters.employeeName}
              onChange={(e) => {
                setFilters({ ...filters, employeeName: e.target.value })
                setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
              }}
              className="h-9 w-full sm:w-56 rounded-lg border border-border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Employee Names</option>
              {uniqueEmployeeNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={filters.employeeId}
              onChange={(e) => {
                setFilters({ ...filters, employeeId: e.target.value })
                setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
              }}
              className="h-9 w-full sm:w-56 rounded-lg border border-border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Employee IDs</option>
              {uniqueEmployeeIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted hover:text-ink shrink-0 h-9">
            <X className="mr-1.5 h-4 w-4" /> Clear Filters
          </Button>
        </div>

        {/* Status Tabs */}
        <div className="flex space-x-6 border-b border-border overflow-x-auto custom-scrollbar">
          {['Pending', 'Approved', 'Rejected', 'Cancelled'].map((status) => {
            const count = leaves.filter(l => l.status === status).length
            return (
              <button
                key={status}
                onClick={() => {
                  setFilters({ ...filters, status })
                }}
                className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
                  filters.status === status
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-ink hover:border-border'
                }`}
              >
                {status}
                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
                  filters.status === status ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Card Grid Layout */}
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-white shadow-sm">
              <span className="text-sm text-muted font-medium">Loading requests...</span>
            </div>
          ) : paginatedLeaves.length === 0 ? (
            <div className="flex flex-col h-64 items-center justify-center rounded-xl border border-dashed border-border bg-white shadow-sm">
              <span className="text-sm text-muted font-medium">No {currentStatus.toLowerCase()} leave requests found.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {paginatedLeaves.map((l) => (
                <div key={l.id} className="group flex flex-col sm:flex-row justify-between items-start sm:items-center rounded-xl border border-border bg-white p-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all gap-3">
                  
                  {/* Left Section: Name & Details */}
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-ink text-sm truncate">{l.employeeName}</h4>
                      {getStatusBadge(l.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span className="font-medium bg-gray-50 px-2 py-0.5 rounded border border-gray-100 text-ink">{l.type}</span>
                      <span className="flex items-center text-ink">
                        {formatDate(l.from)} <span className="opacity-50 mx-1.5">→</span> {formatDate(l.to)}
                      </span>
                      <span className="font-semibold text-ink bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                        {l.days} {l.days === 1 ? 'day' : 'days'}
                      </span>
                      {l.reason && (
                        <span className="line-clamp-1 min-w-0 max-w-full sm:max-w-xs text-ink" title={l.reason}>
                          <span className="font-medium">Reason:</span> {l.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Section: Applied Date & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-center border-t sm:border-t-0 border-border pt-3 sm:pt-0 mt-2 sm:mt-0">
                    <div className="flex flex-col items-end gap-0.5 text-xs font-medium tracking-wider text-ink sm:text-sm">
                      {toTimestamp(l.createdAt) && (
                        <span>
                          <span className="uppercase">Applied:</span>{' '}
                          <span className="normal-case">{formatDateTime(toTimestamp(l.createdAt)!)}</span>
                        </span>
                      )}
                      {l.status === 'Approved' && toTimestamp(l.approvalDate ?? l.updatedAt) && (
                        <span>
                          <span className="uppercase">Approved:</span>{' '}
                          <span className="normal-case">{formatDateTime(toTimestamp(l.approvalDate ?? l.updatedAt)!)}</span>
                        </span>
                      )}
                    </div>
                    
                    <div className="flex gap-1.5">
                      {l.status === 'Pending' && (
                        <>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <Button
                                size="sm"
                                variant="primary"
                                className="h-8 w-8 rounded-full p-0 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white shadow-sm border-none transition-transform hover:scale-105"
                                onClick={() => handleApprove(l.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
                                Approve Request
                                <Tooltip.Arrow className="fill-ink" />
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>

                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <Button
                                size="sm"
                                variant="danger"
                                className="h-8 w-8 rounded-full p-0 flex items-center justify-center shadow-sm transition-transform hover:scale-105"
                                onClick={() => openRejectModal(l.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                              <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
                                Reject Request
                                <Tooltip.Arrow className="fill-ink" />
                              </Tooltip.Content>
                            </Tooltip.Portal>
                          </Tooltip.Root>
                        </>
                      )}
                      
                      {l.status === 'Rejected' && l.rejectionReason && (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 w-8 rounded-full p-0 flex items-center justify-center shadow-sm transition-transform hover:scale-105"
                              onClick={() => handleViewReason(l.rejectionReason!)}
                            >
                              <Eye className="h-4 w-4 text-muted" />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
                              View Rejection Reason
                              <Tooltip.Arrow className="fill-ink" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      )}
                      
                      {l.status === 'Approved' && (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <Button
                              size="sm"
                              variant="danger"
                              className="h-8 w-8 rounded-full p-0 flex items-center justify-center shadow-sm transition-transform hover:scale-105"
                              onClick={() => openCancelModal(l.id)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
                              Cancel Request
                              <Tooltip.Arrow className="fill-ink" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      )}
                      
                      {(l.status === 'Cancelled' || (l.status === 'Rejected' && !l.rejectionReason)) && (
                        <span className="text-[10px] text-muted italic">No actions</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Compact Pagination Controls */}
        {filteredLeaves.length > 0 && (
          <div className="rounded-xl border border-border bg-white px-5 py-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted font-medium">
              Showing <span className="font-bold text-ink">{startIdx + 1}</span> to{' '}
              <span className="font-bold text-ink">{Math.min(startIdx + ITEMS_PER_PAGE, filteredLeaves.length)}</span> of{' '}
              <span className="font-bold text-ink">{filteredLeaves.length}</span> requests
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Prev
              </Button>
              <div className="flex items-center px-2">
                <span className="text-xs font-semibold text-ink bg-surface px-2.5 py-1 rounded-md border border-border">
                  {currentPage} / {totalPages}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Leave Request"
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">
              Reason for Rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={rejectInputRef}
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value)
                if (rejectionError) setRejectionError('')
              }}
              placeholder="Please provide a reason..."
              className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 resize-none transition-shadow ${
                rejectionError ? 'border-red-500 focus:ring-red-200' : 'border-border focus:ring-primary/30'
              }`}
              rows={4}
              maxLength={250}
            />
            <div className="flex justify-between items-center mt-1">
              {rejectionError ? (
                <span className="text-xs font-medium text-red-500">{rejectionError}</span>
              ) : (
                <span className="text-xs text-muted">A valid reason is required.</span>
              )}
              <span className={`text-xs font-medium ${rejectionReason.length >= 250 ? 'text-red-500' : 'text-muted'}`}>
                {rejectionReason.length}/250
              </span>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => setIsRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Reason Modal */}
      <Modal
        isOpen={isReasonModalOpen}
        onClose={() => setIsReasonModalOpen(false)}
        title="Rejection Reason"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 p-4 border border-red-100">
            <p className="text-sm text-red-900 leading-relaxed break-words">
              {viewingReason}
            </p>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="secondary"
              onClick={() => setIsReasonModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Approved Leave"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Are you sure you want to cancel this approved leave? This will update the status immediately.
          </p>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={cancelInputRef}
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value)
                if (cancelError) setCancelError('')
              }}
              placeholder="Please provide a reason..."
              className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 resize-none transition-shadow ${
                cancelError ? 'border-red-500 focus:ring-red-200' : 'border-border focus:ring-primary/30'
              }`}
              rows={4}
            />
            {cancelError && (
              <div className="text-xs font-medium text-red-500 mt-1">{cancelError}</div>
            )}
          </div>
          
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button
              variant="secondary"
              onClick={() => setIsCancelModalOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelConfirm}
              disabled={!cancelReason.trim()}
            >
              Cancel Leave
            </Button>
          </div>
        </div>
      </Modal>
    </Tooltip.Provider>
  )
}
