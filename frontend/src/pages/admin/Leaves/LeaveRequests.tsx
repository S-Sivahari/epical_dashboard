import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@components/ui/Button'
import { cn } from '@/utils/cn'
import { Modal } from '@components/ui/Modal'
import { useLeaves } from '@hooks/useLeaves'
import { formatDate, formatDateTime } from '@/utils/formatDate'
import {
  filterLeaves,
  excludeCancelledLeaves,
  canCancelLeave,
  isRevokedApprovedLeave,
  formatMonthLabel,
  formatLeaveDayCount,
  getCurrentMonthDateRange,
  getCurrentMonthKey,
  type LeaveFilters,
} from '@/utils/leaveFilters'
import * as leaveService from '@services/leaveService'

import { X, ChevronLeft, ChevronRight, Check, AlertTriangle, ShieldCheck } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { EmployeeLeaveProfileModal } from './EmployeeLeaveProfileModal'

type StatusType = 'Pending' | 'Approved' | 'Rejected'

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

export function LeaveRequests({
  filters,
  onFiltersChange,
  monthLabel: monthLabelProp,
}: {
  filters: LeaveFilters
  onFiltersChange: (f: LeaveFilters) => void
  monthLabel?: string
}) {
  const { leaves, loading, approveLeave, rejectLeave, revokeApprovedLeave } = useLeaves()

  const visibleLeaves = useMemo(() => excludeCancelledLeaves(leaves), [leaves])

  const setFilters = (next: LeaveFilters | ((prev: LeaveFilters) => LeaveFilters)) => {
    onFiltersChange(typeof next === 'function' ? next(filters) : next)
  }
  const [statusPagination, setStatusPagination] = useState<StatusPagination>({
    Pending: 1,
    Approved: 1,
    Rejected: 1,
  })

  // Approve Confirmation Modal State (shows balance before confirming)
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [leaveToApprove, setLeaveToApprove] = useState<any | null>(null)
  const [approveBalance, setApproveBalance] = useState<{ total: number; used: number; remaining: number } | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [leaveToReject, setLeaveToReject] = useState<string | null>(null)
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false)
  const [leaveToRevoke, setLeaveToRevoke] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeError, setRevokeError] = useState('')
  const [revoking, setRevoking] = useState(false)
  const revokeInputRef = useRef<HTMLTextAreaElement>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const rejectInputRef = useRef<HTMLTextAreaElement>(null)

  // Employee leave profile (click name on any status tab)
  const [profileEmployeeId, setProfileEmployeeId] = useState<string | null>(null)
  const [profileEmployeeName, setProfileEmployeeName] = useState('')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  const openEmployeeProfile = (employeeId: string, employeeName: string) => {
    setProfileEmployeeId(employeeId)
    setProfileEmployeeName(employeeName)
    setIsProfileModalOpen(true)
  }

  const closeEmployeeProfile = () => {
    setIsProfileModalOpen(false)
    setProfileEmployeeId(null)
    setProfileEmployeeName('')
  }



  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey())

  useEffect(() => {
    const syncMonth = () => {
      const nextKey = getCurrentMonthKey()
      if (nextKey === monthKey) return
      setMonthKey(nextKey)
      setStatusPagination({ Pending: 1, Approved: 1, Rejected: 1 })
    }
    syncMonth()
    const id = window.setInterval(syncMonth, 60_000)
    return () => window.clearInterval(id)
  }, [monthKey])

  const monthRange = useMemo(() => getCurrentMonthDateRange(), [monthKey])

  const panelFilters = useMemo(
    () => ({
      ...filters,
      dateFrom: monthRange.from,
      dateTo: monthRange.to,
    }),
    [filters, monthRange],
  )

  const computedMonthLabel = useMemo(() => formatMonthLabel(monthRange.from), [monthRange.from])
  const monthLabel = monthLabelProp ?? computedMonthLabel

  const statusCounts = useMemo(() => {
    const inMonth = filterLeaves(visibleLeaves, { ...panelFilters, status: 'All' })
    return {
      Pending: inMonth.filter((l) => l.status === 'Pending').length,
      Approved: inMonth.filter((l) => l.status === 'Approved').length,
      Rejected: inMonth.filter((l) => l.status === 'Rejected').length,
    }
  }, [visibleLeaves, panelFilters])

  const currentStatus = (filters.status as StatusType) || 'Pending'

  const filteredLeaves = useMemo(() => {
    return filterLeaves(visibleLeaves, { ...panelFilters, status: currentStatus })
  }, [visibleLeaves, panelFilters, currentStatus])

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
      setIsRejectModalOpen(false)
      setLeaveToReject(null)
      toast.success('Leave request rejected')
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Failed to reject leave')
    }
  }

  const openRevokeModal = (id: string) => {
    setLeaveToRevoke(id)
    setRevokeReason('')
    setRevokeError('')
    setIsRevokeModalOpen(true)
  }

  useEffect(() => {
    if (isRevokeModalOpen && revokeInputRef.current) {
      setTimeout(() => revokeInputRef.current?.focus(), 50)
    }
  }, [isRevokeModalOpen])

  const handleRevokeConfirm = async () => {
    if (!leaveToRevoke) return
    const trimmed = revokeReason.trim()
    if (!trimmed) {
      setRevokeError('Rejection reason is required.')
      return
    }
    if (trimmed.length > 500) {
      setRevokeError('Rejection reason must be under 500 characters.')
      return
    }
    setRevoking(true)
    setRevokeError('')
    try {
      await revokeApprovedLeave(leaveToRevoke, trimmed)
      setIsRevokeModalOpen(false)
      setLeaveToRevoke(null)
      setRevokeReason('')
      toast.success('Approved leave revoked')
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Failed to revoke leave')
    } finally {
      setRevoking(false)
    }
  }



  const openApproveModal = async (leave: any) => {
    setLeaveToApprove(leave)
    setApproveBalance(null)
    setIsApproveModalOpen(true)
    setLoadingBalance(true)
    try {
      const balances = await leaveService.getBalances(leave.employeeId)
      setApproveBalance(balances[leave.type] ?? null)
    } catch {
      toast.error('Could not load leave balance for this employee')
    } finally {
      setLoadingBalance(false)
    }
  }

  const handleApproveConfirm = async () => {
    if (!leaveToApprove) return
    try {
      await approveLeave(leaveToApprove.id)
      setIsApproveModalOpen(false)
      setLeaveToApprove(null)
      toast.success('Leave request approved')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to approve leave')
    }
  }

  const statusPillClass = (status: string) => {
    if (status === 'Pending') return 'admin-leaves-status-pill admin-leaves-status-pill--pending'
    if (status === 'Approved') return 'admin-leaves-status-pill admin-leaves-status-pill--approved'
    if (status === 'Rejected') return 'admin-leaves-status-pill admin-leaves-status-pill--rejected'
    return 'admin-leaves-status-pill'
  }

  const activityCell = (l: (typeof paginatedLeaves)[number]) => {
    if (l.status === 'Approved') {
      const approvedTs = toTimestamp(l.approvalDate ?? l.approvedAt ?? l.updatedAt)
      if (approvedTs) {
        return <span className="admin-leaves-req-approved">{formatDateTime(approvedTs)}</span>
      }
    }
    if (l.status === 'Rejected') {
      const rejectedTs = toTimestamp(l.rejectedAt ?? l.updatedAt)
      if (rejectedTs) {
        return (
          <span className="admin-leaves-req-approved admin-leaves-req-approved--muted">
            {isRevokedApprovedLeave(l) ? 'Revoked' : 'Rejected'} {formatDateTime(rejectedTs)}
          </span>
        )
      }
    }
    if (l.status === 'Pending' && toTimestamp(l.createdAt)) {
      return (
        <span className="admin-leaves-req-approved admin-leaves-req-approved--muted">
          Applied {formatDateTime(toTimestamp(l.createdAt)!)}
        </span>
      )
    }
    return <span className="admin-leaves-req-approved admin-leaves-req-approved--muted">—</span>
  }

  const activityColumnLabel =
    currentStatus === 'Rejected' ? 'Rejected' : currentStatus === 'Pending' ? 'Applied' : 'Approved'

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="admin-leaves-center-panel">
        <div className="admin-leaves-status-tabs">
          <div className="admin-leaves-status-tab-list">
            {(['Pending', 'Approved', 'Rejected'] as StatusType[]).map((status) => {
              const count = statusCounts[status]
              const active = filters.status === status
              return (
                <button
                  key={status}
                  type="button"
                  data-status={status}
                  onClick={() => setFilters({ ...filters, status })}
                  className={cn('admin-leaves-status-tab', active && 'admin-leaves-status-tab--active')}
                >
                  {status}
                  <span className="admin-leaves-status-tab-count">{count}</span>
                </button>
              )
            })}
          </div>
          <span className="admin-leaves-month-label">{monthLabel}</span>
        </div>

        <div className="admin-leaves-scroll flex-1 min-h-0">
          {loading ? (
            <div className="admin-leaves-feed-empty">Loading requests…</div>
          ) : paginatedLeaves.length === 0 ? (
            <div className="admin-leaves-empty-state">
              <p>No {currentStatus.toLowerCase()} leave requests found for {monthLabel}.</p>
            </div>
          ) : (
            <table className="admin-leaves-requests-table">
              <thead>
                <tr>
                  <th>Request</th>
                  {currentStatus === 'Approved' && (
                    <th className="admin-leaves-days-col">Days</th>
                  )}
                  <th>{activityColumnLabel}</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeaves.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => openEmployeeProfile(l.employeeId, l.employeeName)}
                    title="View employee leave profile"
                  >
                    <td>
                      <div className="admin-leaves-req-employee">{l.employeeName}</div>
                      <div className="admin-leaves-req-detail">
                        {l.type} · {formatDate(l.from)} – {formatDate(l.to)}
                        {currentStatus !== 'Approved' ? ` · ${formatLeaveDayCount(l)}` : ''}
                        {l.reason ? ` · ${l.reason}` : ''}
                        {l.status === 'Rejected' && l.rejectionReason
                          ? ` · Reason: ${l.rejectionReason}`
                          : ''}
                      </div>
                    </td>
                    {currentStatus === 'Approved' && (
                      <td className="admin-leaves-days-col">
                        <span className="admin-leaves-days-badge" title="Leave duration">
                          {formatLeaveDayCount(l)}
                        </span>
                      </td>
                    )}
                    <td>{activityCell(l)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={statusPillClass(l.status)}>
                          {l.status === 'Rejected' && isRevokedApprovedLeave(l) ? 'Revoked' : l.status}
                        </span>
                        <div className="admin-leaves-row-actions">
                          {l.status === 'Pending' && (
                            <>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <button
                                    type="button"
                                    className="admin-leaves-row-action-btn admin-leaves-row-action-btn--success"
                                    onClick={() => void openApproveModal(l)}
                                    aria-label="Approve"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
                                    Approve
                                    <Tooltip.Arrow className="fill-ink" />
                                  </Tooltip.Content>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <button
                                    type="button"
                                    className="admin-leaves-row-action-btn admin-leaves-row-action-btn--danger"
                                    onClick={() => openRejectModal(l.id)}
                                    aria-label="Reject"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
                                    Reject
                                    <Tooltip.Arrow className="fill-ink" />
                                  </Tooltip.Content>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                            </>
                          )}
                          {l.status === 'Approved' && canCancelLeave(l) && (
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <button
                                  type="button"
                                  className="admin-leaves-row-action-btn admin-leaves-row-action-btn--danger"
                                  onClick={() => openRevokeModal(l.id)}
                                  aria-label="Revoke approved leave"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
                                  Revoke
                                  <Tooltip.Arrow className="fill-ink" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredLeaves.length > 0 && (
          <div className="admin-leaves-pagination">
            <span>
              {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filteredLeaves.length)} of {filteredLeaves.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="min-w-[3rem] text-center font-bold text-ink">
                {currentPage}/{totalPages}
              </span>
              <Button variant="secondary" size="sm" className="h-7 px-2 text-xs" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Approve Confirmation Modal with Balance Check */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => { setIsApproveModalOpen(false); setLeaveToApprove(null) }}
        title="Confirm Leave Approval"
        size="md"
      >
        {leaveToApprove && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface p-3 border border-border space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Employee</span>
                <span className="font-medium text-ink">{leaveToApprove.employeeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Leave Type</span>
                <span className="font-medium text-ink">{leaveToApprove.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Period</span>
                <span className="font-medium text-ink">{formatDate(leaveToApprove.from)} → {formatDate(leaveToApprove.to)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Days Requested</span>
                <span className="font-semibold text-ink">{leaveToApprove.days}</span>
              </div>
            </div>

            {loadingBalance ? (
              <div className="flex items-center gap-2 text-sm text-muted py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Checking leave balance...
              </div>
            ) : approveBalance ? (
              <div className={`rounded-lg p-3 border text-sm space-y-1 ${approveBalance.remaining >= leaveToApprove.days
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
                }`}>
                <div className="flex items-center gap-2 font-medium mb-2">
                  {approveBalance.remaining >= leaveToApprove.days
                    ? <ShieldCheck className="h-4 w-4 text-green-600" />
                    : <AlertTriangle className="h-4 w-4 text-red-600" />}
                  <span className={approveBalance.remaining >= leaveToApprove.days ? 'text-green-800' : 'text-red-800'}>
                    {approveBalance.remaining >= leaveToApprove.days ? 'Sufficient Balance' : 'Insufficient Balance'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total Allocation</span>
                  <span className="font-medium">{approveBalance.total} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Already Used</span>
                  <span className="font-medium">{approveBalance.used} days</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Remaining</span>
                  <span className={approveBalance.remaining >= leaveToApprove.days ? 'text-green-700' : 'text-red-700'}>
                    {approveBalance.remaining} days
                  </span>
                </div>
                <div className="flex justify-between font-semibold border-t border-current/20 pt-1 mt-1">
                  <span>After Approval</span>
                  <span className={approveBalance.remaining - leaveToApprove.days >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {(approveBalance.remaining - leaveToApprove.days).toFixed(1)} days
                  </span>
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-surface/40 px-3 py-2 text-sm text-muted">
                Leave balance could not be loaded. You can still approve if you have verified eligibility manually.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="secondary" onClick={() => { setIsApproveModalOpen(false); setLeaveToApprove(null) }}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white border-none"
                onClick={() => void handleApproveConfirm()}
              >
                <Check className="h-4 w-4 mr-1.5" />
                Confirm Approval
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
              className={`w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 resize-none transition-shadow ${rejectionError ? 'border-red-500 focus:ring-red-200' : 'border-border focus:ring-primary/30'
                }`}
              rows={4}
              maxLength={250}
            />
            {rejectionError ? (
              <p className="mt-1 text-xs font-medium text-red-500">{rejectionError}</p>
            ) : null}
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

      <Modal
        isOpen={isRevokeModalOpen}
        onClose={() => {
          if (revoking) return
          setIsRevokeModalOpen(false)
          setLeaveToRevoke(null)
          setRevokeReason('')
          setRevokeError('')
        }}
        title="Revoke Approved Leave"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            This will move the leave to Rejected and restore the employee&apos;s balance.
          </p>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={revokeInputRef}
              value={revokeReason}
              onChange={(e) => {
                setRevokeReason(e.target.value)
                if (revokeError) setRevokeError('')
              }}
              placeholder="Provide a reason for the employee…"
              className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                revokeError ? 'border-red-500 focus:ring-red-200' : 'border-border focus:ring-primary/30'
              }`}
              rows={4}
              maxLength={500}
            />
            {revokeError ? (
              <p className="mt-1 text-xs font-medium text-red-500">{revokeError}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={revoking}
              onClick={() => {
                setIsRevokeModalOpen(false)
                setLeaveToRevoke(null)
                setRevokeReason('')
                setRevokeError('')
              }}
            >
              Keep Approved
            </Button>
            <Button variant="danger" disabled={revoking} onClick={() => void handleRevokeConfirm()}>
              {revoking ? 'Revoking…' : 'Revoke leave'}
            </Button>
          </div>
        </div>
      </Modal>

      <EmployeeLeaveProfileModal
        isOpen={isProfileModalOpen}
        employeeId={profileEmployeeId}
        employeeName={profileEmployeeName}
        onClose={closeEmployeeProfile}
      />


    </Tooltip.Provider>
  )
}
