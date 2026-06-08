import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Trash2, FileText, FileSpreadsheet, Search, RotateCcw,
  Check, X, Eye, ChevronDown, User, Tag, ClipboardList, Wallet,
} from 'lucide-react'
import { AdminLeaveDateRange } from './AdminLeaveDateRange'
import './adminLeavesHub.css'
import { PageWrapper } from '@components/layout/PageWrapper'
import { cn } from '@/utils/cn'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { LeaveRequests } from './LeaveRequests'
import { CompensationManagement } from './CompensationManagement'
import { EmployeeLeaveProfileModal } from './EmployeeLeaveProfileModal'
import { useLeaves } from '@hooks/useLeaves'
import { useAuthStore } from '@store/authStore'
import { useEmployeeStore } from '@store/employeeStore'
import {
  filterLeaves,
  excludeCancelledLeaves,
  canCancelLeave,
  isRevokedApprovedLeave,
  formatMonthLabel,
  formatLeaveDayCount,
  getCurrentMonthDateRange,
  getCurrentMonthKey,
  isDateKeyInRange,
  type LeaveFilters,
} from '@/utils/leaveFilters'
import { formatDate, formatDateTime } from '@/utils/formatDate'
import {
  exportCompensationToExcel,
  exportCompensationToPDF,
  exportLeavesToExcel,
  exportLeavesToPDF,
  type CompensationExportRow,
} from '@/utils/exportLeaveReport'
import { leaveExportFileName } from '@/utils/exportFileName'
import type { LeaveRequest } from '@/types'

type TabType = 'requests' | 'compensation'

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Compensation Leave']

function formatLocalDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatLeaveActivityPhrase(type: string, status: string, leave?: LeaveRequest) {
  const normalized = type.trim().toLowerCase()
  const typePhrase = normalized.endsWith('leave') ? normalized : `${normalized} leave`
  if (status === 'Approved') return `${typePhrase} approved`
  if (status === 'Rejected') {
    return leave && isRevokedApprovedLeave(leave)
      ? `${typePhrase} revoked`
      : `${typePhrase} rejected`
  }
  if (status === 'Cancelled') return `${typePhrase} cancelled`
  return `${typePhrase} applied`
}

function getTodayDateKey() {
  return formatLocalDate(new Date())
}

function buildExportFilename(tab: TabType) {
  return leaveExportFileName(tab)
}

function getActivityDateKey(leave: {
  status: string
  createdAt?: string
  updatedAt?: string
  approvalDate?: string
  approvedAt?: string
  rejectedAt?: string
  cancelledAt?: string
}) {
  const ts = getLeaveActivityTimestamp(leave)
  if (ts <= 0) return null
  return formatLocalDate(new Date(ts))
}

function getLeaveActivityTimestamp(leave: {
  status: string
  createdAt?: string
  updatedAt?: string
  approvalDate?: string
  approvedAt?: string
  rejectedAt?: string
  cancelledAt?: string
}) {
  const raw = getLeaveActivityRawDate(leave)
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? 0 : t
}

function getLeaveActivityRawDate(leave: {
  status: string
  createdAt?: string
  updatedAt?: string
  approvalDate?: string
  approvedAt?: string
  rejectedAt?: string
  cancelledAt?: string
}) {
  if (leave.status === 'Approved') {
    return leave.approvalDate ?? leave.approvedAt ?? leave.updatedAt ?? leave.createdAt
  }
  if (leave.status === 'Rejected') {
    return leave.rejectedAt ?? leave.updatedAt ?? leave.createdAt
  }
  if (leave.status === 'Cancelled') {
    return leave.cancelledAt ?? leave.updatedAt ?? leave.createdAt
  }
  return leave.createdAt ?? leave.updatedAt
}

function formatLeaveActivityWhen(leave: {
  status: string
  createdAt?: string
  updatedAt?: string
  approvalDate?: string
  approvedAt?: string
  rejectedAt?: string
  cancelledAt?: string
}) {
  const raw = getLeaveActivityRawDate(leave)
  if (!raw) return ''
  const prefix =
    leave.status === 'Approved'
      ? 'Approved'
      : leave.status === 'Rejected'
        ? isRevokedApprovedLeave(leave as LeaveRequest)
          ? 'Revoked'
          : 'Rejected'
        : leave.status === 'Cancelled'
          ? 'Cancelled'
          : 'Applied'
  const activityDate = getActivityDateKey(leave)
  const todaySuffix = activityDate === getTodayDateKey() ? ' · Today' : ''
  return `${prefix} ${formatDateTime(raw)}${todaySuffix}`
}

type LeaveFeedRowProps = {
  badgeLabel: string
  badgeClass: string
  title: ReactNode
  line2?: string
  line3?: string
  daysLabel?: string
  stackBadge?: boolean
  avatar: React.ReactNode
  actions: React.ReactNode
}

function LeaveFeedRow({
  badgeLabel,
  badgeClass,
  title,
  line2,
  line3,
  daysLabel,
  stackBadge = false,
  avatar,
  actions,
}: LeaveFeedRowProps) {
  return (
    <div className={cn('admin-leaves-feed-row', stackBadge && 'admin-leaves-feed-row--stacked-badge')}>
      {avatar}
      <div className="admin-leaves-feed-row-main">
        <p className="admin-leaves-feed-row-title">
          <span className="admin-leaves-feed-row-title-inner">
            <span className={cn('admin-leaves-feed-badge', badgeClass)}>{badgeLabel}</span>
            <span className="admin-leaves-feed-row-title-text">{title}</span>
          </span>
        </p>
        {line2 ? <p className="admin-leaves-feed-row-sub">{line2}</p> : null}
        {line3 ? <p className="admin-leaves-feed-row-meta">{line3}</p> : null}
      </div>
      {daysLabel ? (
        <span className="admin-leaves-feed-days" title="Leave duration">
          {daysLabel}
        </span>
      ) : null}
      <div className="admin-leaves-feed-actions">{actions}</div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function LeaveManagementContainer() {
  const [activeTab, setActiveTab] = useState<TabType>('requests')
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey())
  const initialMonthRange = getCurrentMonthDateRange()

  // Leave Requests filters – these are passed directly into <LeaveRequests>
  const [leaveFilters, setLeaveFilters] = useState<LeaveFilters>({
    selectedEmployees: [],
    status: 'Pending',
    leaveType: '',
    dateFrom: initialMonthRange.from,
    dateTo: initialMonthRange.to,
  })

  // Top-bar quick filters (drive leaveFilters + data-tools table)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState(initialMonthRange.from)
  const [filterTo, setFilterTo] = useState(initialMonthRange.to)
  const [searched, setSearched] = useState(false)

  // Compensation export
  const [compensationExportRows, setCompensationExportRows] = useState<CompensationExportRow[]>([])
  const [compensationSearch, setCompensationSearch] = useState('')

  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  const { leaves, loading, approveLeave, rejectLeave, revokeApprovedLeave } = useLeaves()

  useEffect(() => {
    const syncMonth = () => {
      const nextKey = getCurrentMonthKey()
      if (nextKey === monthKey) return
      const { from, to } = getCurrentMonthDateRange()
      setMonthKey(nextKey)
      setFilterFrom(from)
      setFilterTo(to)
      setLeaveFilters((prev) => ({
        ...prev,
        dateFrom: from,
        dateTo: to,
        selectedEmployees: [],
        leaveType: '',
      }))
      setFilterEmployee('')
      setFilterType('')
      setSearched(false)
    }

    syncMonth()
    const id = window.setInterval(syncMonth, 60_000)
    return () => window.clearInterval(id)
  }, [monthKey])
  const user = useAuthStore((s) => s.user)

  // Employee avatar lookup map: employeeId → { avatarUrl, initials }
  const allEmployees = useEmployeeStore((s) => s.employees)
  const avatarMap = useMemo(() => {
    const map: Record<string, { avatarUrl?: string; initials: string }> = {}
    allEmployees.forEach((e) => {
      const initials = `${e.firstName?.[0] ?? ''}${e.lastName?.[0] ?? ''}`.toUpperCase()
      const entry = { avatarUrl: e.avatarUrl, initials }
      map[e.id] = entry
      if (e.employeeId) map[String(e.employeeId)] = entry
    })
    return map
  }, [allEmployees])

  // Employee leave profile modal state
  const [profileEmployeeId, setProfileEmployeeId] = useState<string | null>(null)
  const [profileEmployeeName, setProfileEmployeeName] = useState('')
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectLeaveId, setRejectLeaveId] = useState<string | null>(null)
  const [rejectModalMode, setRejectModalMode] = useState<'pending' | 'approved'>('pending')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const openProfile = (employeeId: string, employeeName: string) => {
    setProfileEmployeeId(employeeId)
    setProfileEmployeeName(employeeName)
    setIsProfileModalOpen(true)
  }

  // ── Derived data (scoped to current calendar month) ─────────────────────────
  const monthRange = useMemo(() => getCurrentMonthDateRange(), [monthKey])
  const monthLabel = useMemo(() => formatMonthLabel(monthRange.from), [monthRange.from])

  const visibleLeaves = useMemo(() => excludeCancelledLeaves(leaves), [leaves])

  const monthlyLeaves = useMemo(
    () =>
      filterLeaves(visibleLeaves, {
        selectedEmployees: [],
        status: 'All',
        leaveType: '',
        dateFrom: monthRange.from,
        dateTo: monthRange.to,
      }),
    [visibleLeaves, monthRange],
  )

  const pendingLeaves = useMemo(
    () => monthlyLeaves.filter((l) => l.status === 'Pending'),
    [monthlyLeaves],
  )
  const approvedLeaves = useMemo(
    () => monthlyLeaves.filter((l) => l.status === 'Approved'),
    [monthlyLeaves],
  )

  const upcomingLeaves = useMemo(
    () => [...approvedLeaves].sort((a, b) => a.from.localeCompare(b.from)),
    [approvedLeaves],
  )

  const activityFeed = useMemo(() => {
    return [...leaves]
      .filter((l) => ['Approved', 'Rejected', 'Pending', 'Cancelled'].includes(l.status))
      .filter((l) => {
        const activityDate = getActivityDateKey(l)
        return activityDate != null && isDateKeyInRange(activityDate, monthRange.from, monthRange.to)
      })
      .sort((a, b) => getLeaveActivityTimestamp(b) - getLeaveActivityTimestamp(a))
  }, [leaves, monthRange])

  // Export helpers
  const filteredLeaveRequests = useMemo(() => {
    const status = leaveFilters.status || 'Pending'
    return filterLeaves(excludeCancelledLeaves(leaves).filter((l) => l.status === status), { ...leaveFilters, status })
  }, [leaves, leaveFilters])

  const exportFilterMeta = useMemo((): Record<string, string | undefined> => {
    const base: Record<string, string | undefined> = { section: activeTab === 'requests' ? 'Leave Requests' : 'Compensation' }
    if (activeTab === 'requests') return { ...base, status: leaveFilters.status, leaveType: leaveFilters.leaveType || undefined }
    return { ...base, search: compensationSearch || undefined }
  }, [activeTab, leaveFilters, compensationSearch])

  const handleExport = async (format: 'pdf' | 'excel') => {
    const filename = buildExportFilename(activeTab)
    const generatedBy = user?.name || 'Admin'
    try {
      setExporting(format)
      if (activeTab === 'requests') {
        if (!filteredLeaveRequests.length) { toast.error('No leave requests match filters'); return }
        if (format === 'pdf') await exportLeavesToPDF(filteredLeaveRequests, filename, exportFilterMeta, generatedBy)
        else await exportLeavesToExcel(filteredLeaveRequests, filename, exportFilterMeta, generatedBy)
        return
      }
      if (!compensationExportRows.length) { toast.error('No compensation entries to export'); return }
      if (format === 'pdf') await exportCompensationToPDF(compensationExportRows, filename, exportFilterMeta, generatedBy)
      else await exportCompensationToExcel(compensationExportRows, filename, exportFilterMeta, generatedBy)
    } finally { setExporting(null) }
  }

  // Apply top-bar filters into the LeaveRequests component filters
  const applySearch = () => {
    setLeaveFilters((prev) => ({
      ...prev,
      selectedEmployees: filterEmployee ? [filterEmployee] : [],
      leaveType: filterType,
      dateFrom: filterFrom,
      dateTo: filterTo,
    }))
    setSearched(true)
  }

  const resetSearch = () => {
    const { from, to } = getCurrentMonthDateRange()
    setFilterEmployee('')
    setFilterType('')
    setFilterFrom(from)
    setFilterTo(to)
    setLeaveFilters({ selectedEmployees: [], status: leaveFilters.status, leaveType: '', dateFrom: from, dateTo: to })
    setSearched(false)
  }

  const leaveActionError = (err: unknown, fallback: string) => {
    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    return typeof message === 'string' && message.trim() ? message : fallback
  }

  // Quick actions from activity feed — pending leaves only
  const handleQuickApprove = async (id: string) => {
    try {
      await approveLeave(id)
      toast.success('Leave approved')
    } catch (err) {
      toast.error(leaveActionError(err, 'Failed to approve leave'))
    }
  }
  const openQuickRejectModal = (id: string, mode: 'pending' | 'approved' = 'pending') => {
    setRejectLeaveId(id)
    setRejectModalMode(mode)
    setRejectReason('')
    setRejectError('')
    setRejectModalOpen(true)
  }

  const handleQuickRejectConfirm = async () => {
    if (!rejectLeaveId) return
    const trimmed = rejectReason.trim()
    if (!trimmed) {
      setRejectError('Rejection reason is required.')
      return
    }
    if (trimmed.length > 500) {
      setRejectError('Rejection reason must be under 500 characters.')
      return
    }
    setRejectSubmitting(true)
    setRejectError('')
    try {
      if (rejectModalMode === 'approved') {
        await revokeApprovedLeave(rejectLeaveId, trimmed)
        toast.success('Approved leave revoked')
      } else {
        await rejectLeave(rejectLeaveId, trimmed)
        toast.success('Leave rejected')
      }
      setRejectModalOpen(false)
      setRejectLeaveId(null)
      setRejectReason('')
    } catch (err) {
      toast.error(
        leaveActionError(
          err,
          rejectModalMode === 'approved' ? 'Failed to revoke leave' : 'Failed to reject leave',
        ),
      )
    } finally {
      setRejectSubmitting(false)
    }
  }

  return (
    <PageWrapper fillViewport className="admin-hub-page-wrap admin-leaves-page-wrap relative z-10 font-body !py-3">
      <div className="crewiq-dashboard admin-leaves-view relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-leaves-shell relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="admin-leaves-hub-header">
            <div className="admin-leaves-hero-top">
              <div className="min-w-0">
                <h1 className="admin-leaves-hero-title font-display">Leave Management Hub</h1>
              </div>
              <nav className="admin-leaves-tab-rail" aria-label="Leave views">
                {([
                  {
                    id: 'requests' as TabType,
                    label: `Leave Requests (${pendingLeaves.length})`,
                    icon: ClipboardList,
                  },
                  {
                    id: 'compensation' as TabType,
                    label: 'Compensation Management',
                    icon: Wallet,
                  },
                ]).map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={
                        activeTab === tab.id
                          ? 'admin-leaves-tab-btn admin-leaves-tab-btn--active'
                          : 'admin-leaves-tab-btn admin-leaves-tab-btn--inactive'
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="admin-leaves-tab-label">{tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </div>
          </header>

        {activeTab === 'requests' && (
          <div className="admin-leaves-filter-bar admin-leaves-filter-bar--dense">
            <div className="admin-leaves-filter-field">
              <User className="admin-leaves-filter-field-icon" aria-hidden />
              <select
                id="admin-leave-employee-filter"
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="admin-leaves-filter-input appearance-none"
                aria-label="Filter by employee"
              >
                <option value="">Filter by Employee</option>
                {Array.from(new Set(visibleLeaves.map((l) => l.employeeName))).sort().map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDown className="admin-leaves-filter-chevron" aria-hidden />
            </div>

            <div className="admin-leaves-filter-field">
              <Tag className="admin-leaves-filter-field-icon" aria-hidden />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="admin-leaves-filter-input appearance-none"
                aria-label="Filter by leave type"
              >
                <option value="">Filter by Leave Type</option>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="admin-leaves-filter-chevron" aria-hidden />
            </div>

            <AdminLeaveDateRange
              from={filterFrom}
              to={filterTo}
              onChange={(from, to) => {
                setFilterFrom(from)
                setFilterTo(to)
              }}
            />

            <div className="admin-leaves-filter-actions">
              <Button
                size="sm"
                className="admin-leaves-primary-btn border-none font-semibold shadow-sm"
                onClick={applySearch}
              >
                <Search className="mr-1 h-3.5 w-3.5" /> Search
              </Button>
              <Button size="sm" variant="secondary" className="admin-leaves-secondary-btn font-semibold" onClick={resetSearch}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="admin-leaves-secondary-btn font-semibold"
                onClick={() => void handleExport('pdf')}
                loading={exporting === 'pdf'}
              >
                <FileText className="mr-1 h-3.5 w-3.5 text-red-500" /> PDF
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="admin-leaves-secondary-btn font-semibold"
                onClick={() => void handleExport('excel')}
                loading={exporting === 'excel'}
              >
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Excel
              </Button>
            </div>
          </div>
        )}

        {/* ── Requests tab: 3-column layout ────────────────────────── */}
        {activeTab === 'requests' && (
          <div className="admin-leaves-body-grid admin-leaves-three-col">

            <div className="admin-leaves-panel admin-leaves-upcoming-panel admin-leaves-feed-panel admin-leaves-bb-panel admin-leaves-col-panel">
              <div className="admin-leaves-col-panel-head">
                <h3 className="admin-leaves-col-panel-title">Approved — {monthLabel}</h3>
              </div>
              <div className="admin-leaves-scroll">
                {upcomingLeaves.length === 0 ? (
                  <div className="admin-leaves-feed-empty">
                    No approved leaves in {monthLabel}.
                  </div>
                ) : (
                  upcomingLeaves.map((l) => {
                    const empAvatar = avatarMap[l.employeeId] ?? avatarMap[String(l.employeeId)]
                    const initials = empAvatar?.initials || l.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    return (
                      <LeaveFeedRow
                        key={l.id}
                        badgeLabel={l.type}
                        badgeClass="bg-emerald-100 text-emerald-800"
                        title={
                          <>
                            <span className="admin-leaves-feed-name">{l.employeeName}</span>
                            {`'s ${formatLeaveActivityPhrase(l.type, 'Approved')}`}
                          </>
                        }
                        line2={`${formatDate(l.from)} – ${formatDate(l.to)}`}
                        daysLabel={formatLeaveDayCount(l)}
                        avatar={
                          empAvatar?.avatarUrl ? (
                            <img src={empAvatar.avatarUrl} alt={l.employeeName} className="admin-leaves-feed-avatar" />
                          ) : (
                            <div className="admin-leaves-feed-avatar-fallback">{initials}</div>
                          )
                        }
                        actions={
                          <button
                            type="button"
                            className="admin-leaves-feed-btn"
                            onClick={() => openProfile(l.employeeId, l.employeeName)}
                          >
                            <Eye className="h-3 w-3" /> View
                          </button>
                        }
                      />
                    )
                  })
                )}
              </div>
            </div>

            <div className="admin-leaves-panel admin-leaves-col-panel flex min-h-0 flex-1 flex-col">
              {searched && (filterEmployee || filterType || filterFrom || filterTo) && (
                <div className="admin-leaves-filter-chips flex shrink-0 flex-wrap items-center gap-2 px-2 py-1.5">
                  <span className="text-xs font-bold admin-leaves-text-brand">Filtered:</span>
                  {filterEmployee && <span className="admin-leaves-chip">{filterEmployee}</span>}
                  {filterType && <span className="admin-leaves-chip">{filterType}</span>}
                  {filterFrom && <span className="admin-leaves-chip">From: {filterFrom}</span>}
                  {filterTo && <span className="admin-leaves-chip">To: {filterTo}</span>}
                  <button type="button" onClick={resetSearch} className="admin-leaves-link-btn ml-auto flex items-center gap-1 text-xs font-bold">
                    <X className="h-3 w-3" /> Clear
                  </button>
                </div>
              )}
              <LeaveRequests filters={leaveFilters} onFiltersChange={setLeaveFilters} monthLabel={monthLabel} />
            </div>

            <div className="admin-leaves-panel admin-leaves-activity-feed admin-leaves-feed-panel admin-leaves-bb-panel admin-leaves-col-panel">
              <div className="admin-leaves-col-panel-head">
                <h3 className="admin-leaves-col-panel-title">Recent Activity</h3>
              </div>
              <div className="admin-leaves-scroll">
                {loading ? (
                  <div className="admin-leaves-feed-empty">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                  </div>
                ) : activityFeed.length === 0 ? (
                  <div className="admin-leaves-feed-empty">No leave activity in {monthLabel}.</div>
                ) : (
                  activityFeed.map((l) => {
                    const empAvatar = avatarMap[l.employeeId] ?? avatarMap[String(l.employeeId)]
                    const initials = empAvatar?.initials || l.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    return (
                      <LeaveFeedRow
                        key={l.id}
                        stackBadge
                        badgeLabel={
                          l.status === 'Rejected' && isRevokedApprovedLeave(l) ? 'Revoked' : l.status
                        }
                        badgeClass={cn(
                          l.status === 'Approved' && 'bg-emerald-100 text-emerald-800',
                          l.status === 'Rejected' && 'bg-red-100 text-red-700',
                          l.status === 'Pending' && 'bg-amber-100 text-amber-800',
                          l.status === 'Cancelled' && 'bg-slate-100 text-slate-700',
                        )}
                        title={
                          <>
                            <span className="admin-leaves-feed-name">{l.employeeName}</span>
                            {`'s ${formatLeaveActivityPhrase(l.type, l.status, l)}`}
                          </>
                        }
                        line2={`${formatDate(l.from)} – ${formatDate(l.to)} · ${formatLeaveDayCount(l)}`}
                        line3={formatLeaveActivityWhen(l)}
                        avatar={
                          empAvatar?.avatarUrl ? (
                            <img src={empAvatar.avatarUrl} alt={l.employeeName} className="admin-leaves-feed-avatar" />
                          ) : (
                            <div className="admin-leaves-feed-avatar-fallback">{initials}</div>
                          )
                        }
                        actions={
                          <>
                            <button
                              type="button"
                              className="admin-leaves-feed-btn"
                              onClick={() => openProfile(l.employeeId, l.employeeName)}
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                            {l.status === 'Pending' && (
                              <>
                                <button
                                  type="button"
                                  className="admin-leaves-feed-btn admin-leaves-feed-btn--approve"
                                  onClick={() => void handleQuickApprove(l.id)}
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="admin-leaves-feed-btn admin-leaves-feed-btn--danger"
                                  onClick={() => openQuickRejectModal(l.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            )}
                            {l.status === 'Approved' && canCancelLeave(l) && (
                              <button
                                type="button"
                                className="admin-leaves-feed-btn admin-leaves-feed-btn--danger"
                                onClick={() => openQuickRejectModal(l.id, 'approved')}
                              >
                                <Trash2 className="h-3 w-3" /> Revoke
                              </button>
                            )}
                          </>
                        }
                      />
                    )
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* ── Compensation tab ─────────────────────────────────────── */}
        {activeTab === 'compensation' && (
          <div className="admin-leaves-panel admin-leaves-compensation-wrap min-h-0 flex-1 overflow-hidden">
            <CompensationManagement
              onExportDataChange={setCompensationExportRows}
              onSearchChange={setCompensationSearch}
            />
          </div>
        )}

        </div>
      </div>

      <Modal
        isOpen={rejectModalOpen}
        onClose={() => {
          if (rejectSubmitting) return
          setRejectModalOpen(false)
          setRejectLeaveId(null)
          setRejectModalMode('pending')
          setRejectReason('')
          setRejectError('')
        }}
        title={rejectModalMode === 'approved' ? 'Revoke Approved Leave' : 'Reject Leave Request'}
        size="md"
      >
        <div className="space-y-4">
          {rejectModalMode === 'approved' ? (
            <p className="text-sm text-muted">
              This will move the leave to Rejected and restore the employee&apos;s balance.
            </p>
          ) : null}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value)
                if (rejectError) setRejectError('')
              }}
              placeholder="Provide a reason for the employee…"
              className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                rejectError ? 'border-red-500 focus:ring-red-200' : 'border-border focus:ring-primary/30'
              }`}
              rows={4}
              maxLength={500}
            />
            {rejectError ? (
              <p className="mt-1 text-xs font-medium text-red-500">{rejectError}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              disabled={rejectSubmitting}
              onClick={() => {
                setRejectModalOpen(false)
                setRejectLeaveId(null)
                setRejectReason('')
                setRejectError('')
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" disabled={rejectSubmitting} onClick={() => void handleQuickRejectConfirm()}>
              {rejectSubmitting
                ? rejectModalMode === 'approved'
                  ? 'Revoking…'
                  : 'Rejecting…'
                : rejectModalMode === 'approved'
                  ? 'Revoke leave'
                  : 'Reject leave'}
            </Button>
          </div>
        </div>
      </Modal>

      <EmployeeLeaveProfileModal
        isOpen={isProfileModalOpen}
        employeeId={profileEmployeeId}
        employeeName={profileEmployeeName}
        onClose={() => { setIsProfileModalOpen(false); setProfileEmployeeId(null); setProfileEmployeeName('') }}
      />
    </PageWrapper>
  )
}
