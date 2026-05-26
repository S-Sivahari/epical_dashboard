import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { useLeaves } from '@hooks/useLeaves'
import { formatDate, formatDateTime } from '@/utils/formatDate'
import { filterLeaves, excludeCancelledLeaves, type LeaveFilters } from '@/utils/leaveFilters'
import * as leaveService from '@services/leaveService'

import { X, ChevronLeft, ChevronRight, Check, Ban, ChevronDown, Search, AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { EmployeeLeaveProfileModal } from './EmployeeLeaveProfileModal'

const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Earned Leave']

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
}: {
  filters: LeaveFilters
  onFiltersChange: (f: LeaveFilters) => void
}) {
  const { leaves, loading, approveLeave, rejectLeave, cancelLeave } = useLeaves()

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

  // Cancel Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [leaveToCancel, setLeaveToCancel] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const cancelInputRef = useRef<HTMLTextAreaElement>(null)

  const clearFilters = () => setFilters({ selectedEmployees: [], status: 'Pending', leaveType: '', dateFrom: '', dateTo: '' })

  const currentStatus = (filters.status as StatusType) || 'Pending'

  // Filter leaves by status (Memoized)
  const filteredByStatus = useMemo(() => {
    return visibleLeaves.filter(l => l.status === currentStatus)
  }, [visibleLeaves, currentStatus])

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
      toast.success('Leave approved successfully')
      setIsApproveModalOpen(false)
      setLeaveToApprove(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to approve leave')
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
      default:
        return <Badge>{status}</Badge>
    }
  }

  // Multi-select dropdown state
  const [empDropOpen, setEmpDropOpen] = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const empDropRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (empDropRef.current && !empDropRef.current.contains(e.target as Node)) {
        setEmpDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get unique employee names
  const uniqueEmployeeNames = useMemo(() => {
    return Array.from(new Set(leaves.map((l) => l.employeeName))).sort()
  }, [leaves])

  const filteredEmpNames = useMemo(() => {
    if (!empSearch.trim()) return uniqueEmployeeNames
    return uniqueEmployeeNames.filter((n) =>
      n.toLowerCase().includes(empSearch.toLowerCase())
    )
  }, [uniqueEmployeeNames, empSearch])

  const toggleEmployee = (name: string) => {
    const current = filters.selectedEmployees || []
    const next = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name]
    setFilters({ ...filters, selectedEmployees: next })
    setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="space-y-4">
        {/* Filters */}
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-border/60">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1" ref={empDropRef}>
              <button
                type="button"
                onClick={() => setEmpDropOpen((v) => !v)}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-lg bg-surface/50 px-3 text-sm text-ink transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <span className="truncate text-left">
                  {(filters.selectedEmployees?.length ?? 0) === 0
                    ? 'All Employees'
                    : `${filters.selectedEmployees.length} selected`}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${empDropOpen ? 'rotate-180' : ''}`} />
              </button>

              {empDropOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-border/60">
                  <div className="p-2">
                    <div className="flex items-center gap-2 rounded-lg bg-surface/60 px-2.5 py-2">
                      <Search className="h-4 w-4 shrink-0 text-muted" />
                      <input
                        type="text"
                        placeholder="Search employees..."
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ ...filters, selectedEmployees: [...uniqueEmployeeNames] })
                        setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({ ...filters, selectedEmployees: [] })
                        setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
                      }}
                      className="text-muted hover:text-ink"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredEmpNames.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted">No employees found</p>
                    ) : (
                      filteredEmpNames.map((name) => {
                        const checked = (filters.selectedEmployees || []).includes(name)
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => toggleEmployee(name)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface ${checked ? 'bg-primary/5 text-primary' : 'text-ink'}`}
                          >
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-primary bg-primary' : 'border-border'}`}>
                              {checked && <Check className="h-3 w-3 text-white" />}
                            </span>
                            <span className="truncate">{name}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <select
              value={filters.leaveType || ''}
              onChange={(e) => {
                setFilters({ ...filters, leaveType: e.target.value })
                setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
              }}
              className="h-10 w-full rounded-lg bg-surface/50 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 sm:w-40"
            >
              <option value="">All leave types</option>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => {
                setFilters({ ...filters, dateFrom: e.target.value })
                setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
              }}
              className="h-10 rounded-lg bg-surface/50 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/20"
              title="Leave period from"
              aria-label="Leave period from"
            />
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => {
                setFilters({ ...filters, dateTo: e.target.value })
                setStatusPagination({ ...statusPagination, [currentStatus]: 1 })
              }}
              className="h-10 rounded-lg bg-surface/50 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/20"
              title="Leave period to"
              aria-label="Leave period to"
            />

            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 shrink-0 text-muted">
              <X className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {(filters.selectedEmployees?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {filters.selectedEmployees.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {name}
                  <button type="button" onClick={() => toggleEmployee(name)} className="hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2">
          {(['Pending', 'Approved', 'Rejected'] as StatusType[]).map((status) => {
            const count = visibleLeaves.filter((l) => l.status === status).length
            const active = filters.status === status
            return (
              <button
                key={status}
                type="button"
                onClick={() => setFilters({ ...filters, status })}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-muted ring-1 ring-border/60 hover:text-ink'
                }`}
              >
                {status}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-white/20 text-white' : 'bg-surface text-muted'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Leave requests list */}
        <div>
          {loading ? (
            <div className="flex h-52 items-center justify-center rounded-xl bg-white py-12 shadow-sm ring-1 ring-border/60">
              <span className="text-sm text-muted">Loading requests...</span>
            </div>
          ) : paginatedLeaves.length === 0 ? (
            <div className="flex h-52 flex-col items-center justify-center rounded-xl bg-white py-12 shadow-sm ring-1 ring-border/60">
              <span className="text-sm text-muted">No {currentStatus.toLowerCase()} leave requests found.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {paginatedLeaves.map((l) => (
                <div
                  key={l.id}
                  onClick={() => openEmployeeProfile(l.employeeId, l.employeeName)}
                  className="group flex cursor-pointer flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-border/60 transition-all hover:shadow-md hover:ring-primary/30 sm:flex-row sm:items-center sm:justify-between"
                  title="Click to view leave history and balances"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-primary">{l.employeeName}</span>
                      {getStatusBadge(l.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <span className="font-medium text-ink">{l.type}</span>
                      <span>
                        {formatDate(l.from)} <span className="mx-1 opacity-40">→</span> {formatDate(l.to)}
                      </span>
                      <span className="font-medium text-ink">
                        {l.days} {l.days === 1 ? 'day' : 'days'}
                      </span>
                      {l.reason && (
                        <span className="line-clamp-1 min-w-0 max-w-full text-ink sm:max-w-md" title={l.reason}>
                          {l.reason}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
                    <div className="space-y-1.5 text-right text-xs text-muted sm:text-sm">
                      {toTimestamp(l.createdAt) && (
                        <p>Applied {formatDateTime(toTimestamp(l.createdAt)!)}</p>
                      )}
                      {l.status === 'Rejected' && l.rejectionReason && (
                        <div className="max-w-[220px] rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-left text-[11px] leading-snug text-red-900">
                          {l.rejectionReason}
                        </div>
                      )}
                      {l.status === 'Approved' && (
                        <>
                          {toTimestamp(l.approvalDate ?? l.updatedAt) && (
                            <p>Approved {formatDateTime(toTimestamp(l.approvalDate ?? l.updatedAt)!)}</p>
                          )}
                          {(l as any).approvedBy && (
                            <p className="inline-flex items-center gap-1 text-ink">
                              <UserCheck className="h-3.5 w-3.5 text-green-500" />
                              {(l as any).approvedBy}
                            </p>
                          )}
                        </>
                      )}
                      {l.status === 'Rejected' && (l as any).rejectedBy && (
                        <p className="inline-flex items-center gap-1 text-ink">
                          <UserCheck className="h-3.5 w-3.5 text-red-500" />
                          {(l as any).rejectedBy}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {l.status === 'Pending' && (
                        <>
                          <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                              <Button
                                size="sm"
                                variant="primary"
                                className="h-9 w-9 rounded-lg p-0 bg-green-600 hover:bg-green-700"
                                onClick={() => void openApproveModal(l)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
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
                              <Button
                                size="sm"
                                variant="danger"
                                className="h-9 w-9 rounded-lg p-0"
                                onClick={() => openRejectModal(l.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
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

                      {l.status === 'Approved' && (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <Button
                              size="sm"
                              variant="danger"
                              className="h-9 w-9 rounded-lg p-0"
                              onClick={() => openCancelModal(l.id)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="z-[100] rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md">
                              Cancel
                              <Tooltip.Arrow className="fill-ink" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {filteredLeaves.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
            <p className="text-sm text-muted">
              Showing {startIdx + 1}–{Math.min(startIdx + ITEMS_PER_PAGE, filteredLeaves.length)} of {filteredLeaves.length}
            </p>

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
              <span className="min-w-[4rem] text-center text-sm font-medium text-ink">
                {currentPage} / {totalPages}
              </span>
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
              <div className={`rounded-lg p-3 border text-sm space-y-1 ${
                approveBalance.remaining >= leaveToApprove.days
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

      <EmployeeLeaveProfileModal
        isOpen={isProfileModalOpen}
        employeeId={profileEmployeeId}
        employeeName={profileEmployeeName}
        onClose={closeEmployeeProfile}
      />

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
