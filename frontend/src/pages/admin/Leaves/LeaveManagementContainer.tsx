import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Trash2, FileText, FileSpreadsheet, Search, RotateCcw,
  Check, X, Eye, TrendingUp, MoreVertical, ChevronDown,
} from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { LeaveRequests } from './LeaveRequests'
import { CompensationManagement } from './CompensationManagement'
import { EmployeeLeaveProfileModal } from './EmployeeLeaveProfileModal'
import { useLeaves } from '@hooks/useLeaves'
import { useLeaveStore } from '@store/leaveStore'
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

function buildExportFilename(tab: TabType) {
  const date = new Date().toISOString().slice(0, 10)
  return `Leave_Management_${tab}_${date}`
}

// ── SVG Donut Chart ──────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  const r = 30, circ = 2 * Math.PI * r
  let offset = 0
  if (total === 0) return (
    <svg viewBox="0 0 80 80" className="h-20 w-20">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
      <text x="40" y="44" textAnchor="middle" fontSize="10" fill="#9ca3af" fontWeight="600">0</text>
    </svg>
  )
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circ
        const el = (
          <circle key={i} cx="40" cy="40" r={r} fill="none" stroke={seg.color}
            strokeWidth="14" strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset} />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

// ── SVG Mini Bar Chart ───────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-16 flex-1">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center gap-0.5 flex-1">
          <div className="w-full rounded-t-sm"
            style={{ height: `${Math.max((d.value / max) * 56, 4)}px`, backgroundColor: d.color }} />
        </div>
      ))}
    </div>
  )
}

// ── SVG Trend Line ───────────────────────────────────────────────────────────
function TrendLine({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-10 w-full bg-gray-50 rounded" />
  const max = Math.max(...points, 1)
  const w = 100, h = 40, step = w / (points.length - 1)
  const coords = points.map((p, i) => `${i * step},${h - (p / max) * (h - 4)}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={`0,${h} ${coords.join(' ')} ${w},${h}`} fill="rgba(22,163,74,0.08)" stroke="none" />
      <polyline points={coords.join(' ')} fill="none" stroke="#16a34a" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function LeaveManagementContainer() {
  const [activeTab, setActiveTab] = useState<TabType>('requests')

  // Leave Requests filters – these are passed directly into <LeaveRequests>
  const [leaveFilters, setLeaveFilters] = useState<LeaveFilters>({
    selectedEmployees: [],
    status: 'Pending',
    leaveType: '',
    dateFrom: '',
    dateTo: '',
  })

  // Top-bar quick filters (drive leaveFilters + data-tools table)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searched, setSearched] = useState(false)

  // Compensation export
  const [compensationExportRows, setCompensationExportRows] = useState<CompensationExportRow[]>([])
  const [compensationSearch, setCompensationSearch] = useState('')

  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const { leaves, loading, approveLeave, rejectLeave } = useLeaves()
  const deleteAllLeaves = useLeaveStore((s) => s.deleteAllLeaves)
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
  const rejectedLeaves = useMemo(() => visibleLeaves.filter((l) => l.status === 'Rejected'), [visibleLeaves])

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

  const barData = useMemo(() => [
    { label: 'Casual', value: typeCounts['Casual Leave'] || 0, color: '#16a34a' },
    { label: 'Sick', value: typeCounts['Sick Leave'] || 0, color: '#86efac' },
    { label: 'Earned', value: typeCounts['Earned Leave'] || 0, color: '#ef4444' },
  ], [typeCounts])

  const upcomingLeaves = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return approvedLeaves.filter((l) => l.from >= today).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 4)
  }, [approvedLeaves])

  const trendPoints = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return visibleLeaves.filter((l) => l.from.startsWith(ym)).length
    })
  }, [visibleLeaves])

  // Activity feed: most recent leaves sorted by creation
  const activityFeed = useMemo(() => {
    return [...visibleLeaves]
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
      .slice(0, 10)
  }, [visibleLeaves])

  // Data-tools table: respects the top-bar quick filters
  const dataTableLeaves = useMemo(() => {
    return visibleLeaves
      .filter((l) => {
        if (filterEmployee && !l.employeeName.toLowerCase().includes(filterEmployee.toLowerCase())) return false
        if (filterType && l.type !== filterType) return false
        if (filterFrom && l.from < filterFrom) return false
        if (filterTo && l.to > filterTo) return false
        return true
      })
      .slice(0, 6)
  }, [visibleLeaves, filterEmployee, filterType, filterFrom, filterTo])

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

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      await deleteAllLeaves()
      setDeleteAllOpen(false)
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to delete leave records')
    } finally { setDeletingAll(false) }
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
    setFilterEmployee(''); setFilterType(''); setFilterFrom(''); setFilterTo('')
    setLeaveFilters({ selectedEmployees: [], status: leaveFilters.status, leaveType: '', dateFrom: '', dateTo: '' })
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
          <div className="admin-leaves-body-grid grid grid-cols-1 gap-4 lg:grid-cols-[270px_1fr_290px]">

            {/* ════════════════════════════════════════════════════════
                LEFT COLUMN — Insights + Trend + Upcoming
            ════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-3">

              {/* Leave Status Insights */}
              <div className="admin-leaves-panel p-4">
                <h3 className="admin-leaves-panel-title mb-3 text-sm font-bold">Leave Status Insights</h3>

                {/* Donut + bar */}
                <div className="flex items-center gap-3 mb-3">
                  <DonutChart segments={donutSegments} />
                  <MiniBarChart data={barData} />
                </div>

                {/* Legend */}
                <div className="space-y-1.5 mb-4">
                  {[
                    { label: 'Casual', color: '#16a34a', key: 'Casual Leave' },
                    { label: 'Sick', color: '#22c55e', key: 'Sick Leave' },
                    { label: 'Earned', color: '#86efac', key: 'Earned Leave' },
                    { label: 'Others', color: '#bbf7d0', key: '' },
                  ].map(({ label, color, key }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="text-gray-600">{label}</span>
                      </div>
                      <span className="font-bold text-gray-800">
                        {key
                          ? (typeCounts[key] || 0)
                          : Object.entries(typeCounts).filter(([k]) => !['Casual Leave', 'Sick Leave', 'Earned Leave'].includes(k)).reduce((s, [, v]) => s + v, 0)
                        }
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status tiles — clickable to filter */}
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { status: 'Pending', count: pendingLeaves.length, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', label: 'text-gray-500' },
                    { status: 'Approved', count: approvedLeaves.length, bg: 'admin-leaves-status-approved', border: 'admin-leaves-status-approved-border', text: 'text-white', label: 'text-white/80' },
                    { status: 'Rejected', count: rejectedLeaves.length, bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-600', label: 'text-gray-500' },
                  ] as const).map(({ status, count, bg, border, text, label }) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setLeaveFilters((f) => ({ ...f, status }))}
                      className={`flex flex-col items-center rounded-lg border p-2 transition-all hover:scale-105 ${bg} ${border} ${leaveFilters.status === status ? 'admin-leaves-status-ring' : ''}`}
                    >
                      <span className={`text-[10px] font-semibold uppercase ${label}`}>{status}</span>
                      <span className={`mt-1 text-xl font-bold ${text}`}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trend chart */}
              <div className="admin-leaves-panel p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="h-3.5 w-3.5 admin-leaves-accent-icon" />
                  <h3 className="admin-leaves-panel-title text-xs font-bold">Leave Trend Over Time</h3>
                </div>
                <TrendLine points={trendPoints} />
                <div className="mt-1 flex justify-between text-[9px] text-gray-400">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(); d.setMonth(d.getMonth() - (6 - i))
                    return <span key={i}>{d.toLocaleString('default', { month: 'short' })}</span>
                  })}
                </div>
              </div>

              {/* Upcoming Leaves */}
              <div className="admin-leaves-panel flex-1 p-4">
                <h3 className="admin-leaves-panel-title mb-3 text-sm font-bold">Upcoming Leaves</h3>
                {upcomingLeaves.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">No upcoming approved leaves.</p>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingLeaves.map((l) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          {l.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-800 truncate">{l.employeeName}</p>
                          <p className="text-[10px] text-gray-500">{l.type}</p>
                          <p className="text-[10px] font-semibold text-emerald-700">{formatDate(l.from)}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Approved</span>
                        <MoreVertical className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════
                CENTER COLUMN — Full Leave Requests (real component)
            ════════════════════════════════════════════════════════ */}
            <div className="admin-leaves-panel overflow-hidden">
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
                RIGHT COLUMN — Activity Feed + Data Tools
            ════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-3">

              {/* Recent Activity Feed */}
              <div className="admin-leaves-panel flex flex-col overflow-hidden" style={{ maxHeight: '520px' }}>
                <div className="admin-leaves-panel-head flex shrink-0 items-center justify-between px-4 py-3">
                  <h3 className="admin-leaves-panel-title text-sm font-bold">Recent Activity Feed</h3>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                    onClick={() => setDeleteAllOpen(true)}
                  >
                    <Trash2 className="h-3 w-3" /> Delete All
                  </button>
                </div>

                {loading ? (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
                  </div>
                ) : activityFeed.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-8 text-xs text-gray-400">No leave requests yet.</div>
                ) : (
                  <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
                    {activityFeed.map((l) => {
                      const empAvatar = avatarMap[l.employeeId] ?? avatarMap[String(l.employeeId)]
                      const initials = empAvatar?.initials || l.employeeName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                      return (
                        <div key={l.id} className="flex items-start gap-2.5 px-3 py-3 hover:bg-gray-50/60 transition-colors">
                          {/* Status indicator */}
                          <div className="mt-0.5 shrink-0">
                            {l.status === 'Approved' && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500"><Check className="h-3 w-3 text-white" /></span>}
                            {l.status === 'Rejected' && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-400"><X className="h-3 w-3 text-white" /></span>}
                            {l.status === 'Pending' && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-gray-800 leading-snug">
                              <span className="text-emerald-700">{l.employeeName}</span>
                              {`'s ${l.type.toLowerCase()} leave ${l.status === 'Approved' ? 'approved' : l.status === 'Rejected' ? 'rejected' : 'requested'}`}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(l.from)} – {formatDate(l.to)} · {l.days}d</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
                          </div>

                          {/* Real employee avatar */}
                          {empAvatar?.avatarUrl ? (
                            <img
                              src={empAvatar.avatarUrl}
                              alt={l.employeeName}
                              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white shadow-sm"
                            />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 ring-1 ring-white shadow-sm">
                              {initials}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex flex-col gap-1 shrink-0">
                            <button type="button"
                              className="flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                              onClick={() => openProfile(l.employeeId, l.employeeName)}
                            >
                              <Eye className="h-2.5 w-2.5" /> View
                            </button>
                            {l.status === 'Pending' && (
                              <>
                                <button type="button"
                                  className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-100"
                                  onClick={() => void handleQuickApprove(l.id)}
                                >
                                  <Check className="h-2.5 w-2.5" /> Approve
                                </button>
                                <button type="button"
                                  className="flex items-center gap-1 rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
                                  onClick={() => void handleQuickReject(l.id)}
                                >
                                  <Trash2 className="h-2.5 w-2.5" /> Reject
                                </button>
                              </>
                            )}
                            {l.status === 'Approved' && (
                              <button type="button"
                                className="flex items-center gap-1 rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-100"
                                onClick={() => void handleQuickReject(l.id)}
                              >
                                <Trash2 className="h-2.5 w-2.5" /> Reject
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Data Tools — compact filtered table */}
              <div className="admin-leaves-panel overflow-hidden">
                <div className="admin-leaves-panel-head flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Employee</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Type</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Date</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Days</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {dataTableLeaves.length === 0
                    ? <p className="px-3 py-4 text-center text-xs text-gray-400">No records.</p>
                    : dataTableLeaves.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 text-[11px]">
                        <span className="font-semibold text-gray-800 truncate flex-1 min-w-0">{l.employeeName}</span>
                        <span className="text-gray-500 shrink-0 max-w-[70px] truncate">{l.type.replace(' Leave', '')}</span>
                        <span className="text-gray-500 shrink-0">{formatDate(l.from)}</span>
                        <span className="font-bold text-emerald-700 shrink-0">{l.days}d</span>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Quick action buttons */}
              <Button size="sm" variant="secondary"
                className="admin-leaves-secondary-btn h-8 w-full text-xs font-semibold"
                onClick={() => void handleExport('pdf')} loading={exporting === 'pdf'}
              >
                <FileText className="h-3.5 w-3.5 text-red-500 mr-1" /> View Full Report (PDF)
              </Button>
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

      <ConfirmModal
        isOpen={deleteAllOpen}
        title="Delete all leave records?"
        description="This will permanently delete every leave request and all leave history from the database, including pending, approved, rejected, and cancelled records. Related leave notifications will also be removed. This action cannot be undone."
        confirmLabel={deletingAll ? 'Deleting...' : 'Delete all'}
        danger
        onClose={() => { if (deletingAll) return; setDeleteAllOpen(false) }}
        onConfirm={handleDeleteAll}
      />

      <EmployeeLeaveProfileModal
        isOpen={isProfileModalOpen}
        employeeId={profileEmployeeId}
        employeeName={profileEmployeeName}
        onClose={() => { setIsProfileModalOpen(false); setProfileEmployeeId(null); setProfileEmployeeName('') }}
      />
    </PageWrapper>
  )
}
