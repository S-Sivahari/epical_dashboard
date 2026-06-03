import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Trash2, FileText, FileSpreadsheet, Search, RotateCcw,
  Check, X, Eye, ChevronDown,
} from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { cn } from '@/utils/cn'
import { Button } from '@components/ui/Button'
import { LeaveRequests } from './LeaveRequests'
import { CompensationManagement } from './CompensationManagement'
import { EmployeeLeaveProfileModal } from './EmployeeLeaveProfileModal'
import { useLeaves } from '@hooks/useLeaves'
import { useAuthStore } from '@store/authStore'
import { useEmployeeStore } from '@store/employeeStore'
import { filterLeaves, excludeCancelledLeaves, type LeaveFilters } from '@/utils/leaveFilters'
import { formatDate } from '@/utils/formatDate'
import {
  exportCompensationToExcel,
  exportCompensationToPDF,
  exportLeavesToExcel,
  exportLeavesToPDF,
  type CompensationExportRow,
} from '@/utils/exportLeaveReport'

type TabType = 'requests' | 'compensation'

const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Earned Leave']

function formatLocalDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getCurrentMonthDateRange() {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: formatLocalDate(first), to: formatLocalDate(last) }
}

function formatLeaveActivityPhrase(type: string, status: string) {
  const normalized = type.trim().toLowerCase()
  const typePhrase = normalized.endsWith('leave') ? normalized : `${normalized} leave`
  if (status === 'Approved') return `${typePhrase} approved`
  if (status === 'Rejected') return `${typePhrase} rejected`
  return `${typePhrase} requested`
}

function buildExportFilename(tab: TabType) {
  const date = new Date().toISOString().slice(0, 10)
  return `Leave_Management_${tab}_${date}`
}

// ── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const r = 24, circ = 2 * Math.PI * r
  let offset = 0
  if (total === 0) return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="11" />
      <text x="32" y="35" textAnchor="middle" fontSize="10" fill="#9ca3af" fontWeight="600">0</text>
    </svg>
  )
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90">
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ
        const el = (
          <circle key={i} cx="32" cy="32" r={r} fill="none" stroke={seg.color}
            strokeWidth="11" strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset} />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function LeaveManagementContainer() {
  const [activeTab, setActiveTab] = useState<TabType>('requests')
  const defaultMonthRange = getCurrentMonthDateRange()

  // Leave Requests filters – these are passed directly into <LeaveRequests>
  const [leaveFilters, setLeaveFilters] = useState<LeaveFilters>({
    selectedEmployees: [],
    status: 'Pending',
    leaveType: '',
    dateFrom: defaultMonthRange.from,
    dateTo: defaultMonthRange.to,
  })

  // Top-bar quick filters (drive leaveFilters + data-tools table)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState(defaultMonthRange.from)
  const [filterTo, setFilterTo] = useState(defaultMonthRange.to)
  const [searched, setSearched] = useState(false)

  // Compensation export
  const [compensationExportRows, setCompensationExportRows] = useState<CompensationExportRow[]>([])
  const [compensationSearch, setCompensationSearch] = useState('')

  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  const { leaves, loading, approveLeave, rejectLeave } = useLeaves()
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

  const openProfile = (employeeId: string, employeeName: string) => {
    setProfileEmployeeId(employeeId)
    setProfileEmployeeName(employeeName)
    setIsProfileModalOpen(true)
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const visibleLeaves = useMemo(() => excludeCancelledLeaves(leaves), [leaves])
  const pendingLeaves = useMemo(() => visibleLeaves.filter((l) => l.status === 'Pending'), [visibleLeaves])
  const approvedLeaves = useMemo(() => visibleLeaves.filter((l) => l.status === 'Approved'), [visibleLeaves])
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {}
    visibleLeaves.forEach((l) => { map[l.type] = (map[l.type] || 0) + 1 })
    return map
  }, [visibleLeaves])

  const donutSegments = useMemo(() => [
    { value: typeCounts['Casual Leave'] || 0, color: '#16a34a' },
    { value: typeCounts['Sick Leave'] || 0, color: '#22c55e' },
    { value: typeCounts['Earned Leave'] || 0, color: '#86efac' },
    { value: Object.entries(typeCounts).filter(([k]) => !['Casual Leave', 'Sick Leave', 'Earned Leave'].includes(k)).reduce((s, [, v]) => s + v, 0), color: '#bbf7d0' },
  ], [typeCounts])

  const upcomingLeaves = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return approvedLeaves.filter((l) => l.from >= today).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 4)
  }, [approvedLeaves])

  // Activity feed: most recent leaves sorted by creation
  const activityFeed = useMemo(() => {
    return [...visibleLeaves]
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
      .slice(0, 10)
  }, [visibleLeaves])



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

  // Quick actions from activity feed
  const handleQuickApprove = async (id: string) => {
    try { await approveLeave(id); toast.success('Leave approved') } catch { toast.error('Failed to approve') }
  }
  const handleQuickReject = async (id: string) => {
    try { await rejectLeave(id, 'Rejected by admin'); toast.success('Leave rejected') } catch { toast.error('Failed to reject') }
  }

  return (
    <PageWrapper className="admin-hub-page-wrap relative z-10 py-3 font-body">
      <div className="crewiq-dashboard admin-leaves-view relative">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-leaves-shell relative z-10">
          <header className="admin-leaves-hub-header">
            <div className="admin-leaves-hero-top">
              <div className="min-w-0">
                <h1 className="admin-leaves-hero-title font-display">Leave Management Hub</h1>
              </div>
              <nav className="admin-leaves-tab-rail" aria-label="Leave views">
                {([
                  { id: 'requests' as TabType, label: `Leave Requests (${pendingLeaves.length})` },
                  { id: 'compensation' as TabType, label: 'Compensation Management' },
                ]).map((tab) => (
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
                    <span className="admin-leaves-tab-label">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </header>

        {activeTab === 'requests' && (
          <div className="admin-leaves-filter-bar">
            {/* Employee dropdown */}
            <div className="relative min-w-[160px] flex-1">
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="admin-leaves-filter-input h-9 w-full appearance-none pl-3 pr-8"
              >
                <option value="">All Employees</option>
                {Array.from(new Set(visibleLeaves.map((l) => l.employeeName))).sort().map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            </div>

            {/* Leave type dropdown */}
            <div className="relative min-w-[160px] flex-1">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="admin-leaves-filter-input h-9 w-full appearance-none pl-3 pr-8"
              >
                <option value="">All leave types</option>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            </div>

            {/* From date */}
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
              className="admin-leaves-filter-input h-9 min-w-[145px] px-3"
            />

            {/* To date */}
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
              min={filterFrom || undefined}
              className="admin-leaves-filter-input h-9 min-w-[145px] px-3"
            />

            <Button size="sm"
              className="admin-leaves-primary-btn h-9 border-none px-5 font-semibold shadow-sm"
              onClick={applySearch}
            >
              <Search className="h-3.5 w-3.5 mr-1.5" /> Search
            </Button>

            <Button size="sm" variant="secondary"
              className="admin-leaves-secondary-btn h-9 font-semibold"
              onClick={resetSearch}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>

            {/* Export buttons on right */}
            <div className="ml-auto flex items-center gap-1.5">
              <Button size="sm" variant="secondary"
                className="admin-leaves-secondary-btn h-9 font-semibold"
                onClick={() => void handleExport('pdf')} loading={exporting === 'pdf'}
              >
                <FileText className="h-3.5 w-3.5 text-red-500 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="secondary"
                className="admin-leaves-secondary-btn h-9 font-semibold"
                onClick={() => void handleExport('excel')} loading={exporting === 'excel'}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 mr-1" /> Excel
              </Button>
            </div>
          </div>
        )}

        {/* ── Requests tab: 3-column layout ────────────────────────── */}
        {activeTab === 'requests' && (
          <div className="admin-leaves-body-grid admin-leaves-three-col">

            {/* ════════════════════════════════════════════════════════
                LEFT COLUMN — Insights + Upcoming
            ════════════════════════════════════════════════════════ */}
            <div className="admin-leaves-left-col flex flex-col gap-2.5">

              {/* Leave Status Insights (compact) */}
              <div className="admin-leaves-panel admin-leaves-insights-panel admin-leaves-bb-panel">
                <div className="admin-leaves-bb-panel-head">
                  <h3 className="admin-leaves-panel-title">Leave Status Insights</h3>
                </div>
                <div className="admin-leaves-bb-panel-body">
                  <div className="flex items-center gap-2.5">
                    <DonutChart segments={donutSegments} />
                    <div className="min-w-0 flex-1 grid grid-cols-2 gap-x-2.5 gap-y-1.5">
                      {[
                        { label: 'Casual', color: '#16a34a', key: 'Casual Leave' },
                        { label: 'Sick', color: '#22c55e', key: 'Sick Leave' },
                        { label: 'Earned', color: '#86efac', key: 'Earned Leave' },
                        { label: 'Others', color: '#bbf7d0', key: '' },
                      ].map(({ label, color, key }) => (
                        <div key={label} className="admin-leaves-legend-row flex items-center justify-between gap-1.5 text-xs">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                            <span className="truncate font-medium text-gray-600">{label}</span>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-gray-800">
                            {key
                              ? (typeCounts[key] || 0)
                              : Object.entries(typeCounts).filter(([k]) => !['Casual Leave', 'Sick Leave', 'Earned Leave'].includes(k)).reduce((s, [, v]) => s + v, 0)
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upcoming Leaves */}
              <div className="admin-leaves-panel admin-leaves-upcoming-panel admin-leaves-bb-panel flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="admin-leaves-bb-panel-head">
                  <h3 className="admin-leaves-panel-title">Upcoming Leaves</h3>
                </div>
                <div className="admin-leaves-bb-panel-body min-h-0 flex-1">
                  {upcomingLeaves.length === 0 ? (
                    <p className="py-2 text-center text-sm text-gray-400">No upcoming approved leaves.</p>
                  ) : (
                    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                      {upcomingLeaves.map((l) => (
                        <div key={l.id} className="admin-leaves-upcoming-row flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-[var(--history-batch-bg)]">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                            {l.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1 leading-tight">
                            <p className="truncate text-sm font-semibold text-gray-800">{l.employeeName}</p>
                            <p className="text-xs text-gray-500">{l.type}</p>
                            <p className="text-xs font-semibold text-emerald-700">{formatDate(l.from)}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Approved</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ════════════════════════════════════════════════════════
                CENTER COLUMN — Full Leave Requests (real component)
            ════════════════════════════════════════════════════════ */}
            <div className="admin-leaves-panel flex flex-col overflow-y-auto" style={{ maxHeight: '572px' }}>
              {searched && (filterEmployee || filterType || filterFrom || filterTo) && (
                <div className="admin-leaves-filter-chips flex flex-wrap items-center gap-2 px-4 py-2">
                  <span className="text-xs font-semibold admin-leaves-text-brand">Filtered:</span>
                  {filterEmployee && <span className="admin-leaves-chip">{filterEmployee}</span>}
                  {filterType && <span className="admin-leaves-chip">{filterType}</span>}
                  {filterFrom && <span className="admin-leaves-chip">From: {filterFrom}</span>}
                  {filterTo && <span className="admin-leaves-chip">To: {filterTo}</span>}
                  <button type="button" onClick={resetSearch} className="admin-leaves-link-btn ml-auto flex items-center gap-1 text-xs font-semibold">
                    <X className="h-3 w-3" /> Clear
                  </button>
                </div>
              )}
              <LeaveRequests filters={leaveFilters} onFiltersChange={setLeaveFilters} />
            </div>

            {/* ════════════════════════════════════════════════════════
                RIGHT COLUMN — Activity Feed
            ════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-3">

              {/* Recent Activity Feed */}
              <div className="admin-leaves-panel admin-leaves-activity-feed admin-leaves-bb-panel flex flex-col overflow-hidden" style={{ maxHeight: '572px' }}>
                <div className="admin-leaves-panel-head flex shrink-0 items-center">
                  <h3 className="admin-leaves-panel-title">Recent Activity Feed</h3>
                </div>

                <div className="admin-leaves-bb-panel-body min-h-0 flex-1">
                {loading ? (
                  <div className="flex flex-1 items-center justify-center py-5">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                  </div>
                ) : activityFeed.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-5 text-sm text-gray-400">No leave requests yet.</div>
                ) : (
                  <div className="admin-leaves-activity-list overflow-y-auto flex-1 min-h-0">
                    {activityFeed.map((l, index) => {
                      const empAvatar = avatarMap[l.employeeId] ?? avatarMap[String(l.employeeId)]
                      const initials = empAvatar?.initials || l.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                      return (
                        <div
                          key={l.id}
                          className={cn(
                            'admin-leaves-activity-item flex items-start gap-2 border-l-[3px] px-2.5 py-2 transition-colors',
                            l.status === 'Approved' && 'border-l-emerald-500',
                            l.status === 'Rejected' && 'border-l-red-500',
                            l.status === 'Pending' && 'border-l-amber-400',
                            index % 2 === 0 ? 'bg-white' : 'bg-[var(--history-batch-bg)]',
                            'hover:bg-emerald-50/50',
                          )}
                        >
                          {/* Status indicator */}
                          <div className="shrink-0 pt-0.5">
                            {l.status === 'Approved' && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500"><Check className="h-3.5 w-3.5 text-white" /></span>}
                            {l.status === 'Rejected' && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-400"><X className="h-3.5 w-3.5 text-white" /></span>}
                            {l.status === 'Pending' && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400"><span className="h-2 w-2 rounded-full bg-white" /></span>}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="mb-0.5 flex flex-wrap items-center gap-1">
                              <span
                                className={cn(
                                  'rounded px-1.5 py-px text-[11px] font-bold uppercase tracking-wide',
                                  l.status === 'Approved' && 'bg-emerald-100 text-emerald-800',
                                  l.status === 'Rejected' && 'bg-red-100 text-red-700',
                                  l.status === 'Pending' && 'bg-amber-100 text-amber-800',
                                )}
                              >
                                {l.status}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 leading-tight">
                              <span className="text-emerald-700">{l.employeeName}</span>
                              {`'s ${formatLeaveActivityPhrase(l.type, l.status)}`}
                            </p>
                            <p className="text-xs text-gray-500 leading-tight">{formatDate(l.from)} – {formatDate(l.to)} · {l.days}d</p>
                            <p className="text-[11px] text-gray-400 leading-tight">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
                          </div>

                          {/* Real employee avatar */}
                          {empAvatar?.avatarUrl ? (
                            <img
                              src={empAvatar.avatarUrl}
                              alt={l.employeeName}
                              className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white shadow-sm"
                            />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 ring-1 ring-white shadow-sm">
                              {initials}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button type="button"
                              className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                              onClick={() => openProfile(l.employeeId, l.employeeName)}
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                            {l.status === 'Pending' && (
                              <>
                                <button type="button"
                                  className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                  onClick={() => void handleQuickApprove(l.id)}
                                >
                                  <Check className="h-3 w-3" /> Approve
                                </button>
                                <button type="button"
                                  className="flex items-center gap-1 rounded border border-red-100 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                                  onClick={() => void handleQuickReject(l.id)}
                                >
                                  <Trash2 className="h-3 w-3" /> Reject
                                </button>
                              </>
                            )}
                            {l.status === 'Approved' && (
                              <button type="button"
                                className="flex items-center gap-1 rounded border border-red-100 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                                onClick={() => void handleQuickReject(l.id)}
                              >
                                <Trash2 className="h-3 w-3" /> Reject
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ── Compensation tab ─────────────────────────────────────── */}
        {activeTab === 'compensation' && (
          <div className="admin-leaves-panel admin-leaves-compensation-wrap overflow-hidden">
            <CompensationManagement
              onExportDataChange={setCompensationExportRows}
              onSearchChange={setCompensationSearch}
            />
          </div>
        )}

        </div>
      </div>

      <EmployeeLeaveProfileModal
        isOpen={isProfileModalOpen}
        employeeId={profileEmployeeId}
        employeeName={profileEmployeeName}
        onClose={() => { setIsProfileModalOpen(false); setProfileEmployeeId(null); setProfileEmployeeName('') }}
      />
    </PageWrapper>
  )
}
