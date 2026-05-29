import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { Modal } from '@components/ui/Modal'
import { ConfirmModal } from '@components/modals/ConfirmModal'

import { ProjectAuditTrailModal } from '@components/modals/ProjectAuditTrailModal'
import { ArchivedProjectsModal } from '@components/modals/ArchivedProjectsModal'
import { toast } from 'sonner'
  return (
    <PageWrapper className="py-4 sm:py-5">
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mb-2">
          <Breadcrumb items={[{ label: 'Admin Dashboard' }, { label: 'Projects & Timesheets' }]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
            {[
              { key: 'projects' as const, label: 'Projects', icon: FolderOpen, count: filteredProjects.length },
              { key: 'timesheets' as const, label: 'Timesheets', icon: Clock, count: filteredTimesheets.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-bold transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
                {tab.key === 'projects' && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                      activeTab === tab.key ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeTab === 'projects' && (
              <>
                <Button
                  onClick={() => setArchivedModalOpen(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-0 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                >
                  <Archive className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Archived</span>
                </Button>
                <Button
                  onClick={openCreateProject}
                  className="flex h-9 items-center gap-1.5 rounded-lg border-0 bg-emerald-600 px-3.5 py-0 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/15"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Project
                </Button>
              </>
            )}
            {activeTab === 'timesheets' && (
              <>
                <button
                  onClick={handleExportPDF}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                  title="Export timesheet data as PDF report"
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span className="hidden sm:inline">PDF Report</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                  title="Export timesheet data as Excel spreadsheet"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="hidden sm:inline">Excel</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
  { id: 'E-1002', name: 'Rahul Verma', team: 'Verification', hue: 210 },
  { id: 'E-1003', name: 'Meera Nair', team: 'Hardware', hue: 335 },
  { id: 'E-1004', name: 'Amit Patel', team: 'R&D', hue: 35 },
  { id: 'E-1005', name: 'Priya Das', team: 'Operations', hue: 270 },
  { id: 'E-1006', name: 'Kiran Rao', team: 'Design', hue: 190 },
  { id: 'E-1007', name: 'Sneha Iyer', team: 'Verification', hue: 10 },
  { id: 'E-1008', name: 'Vikram Singh', team: 'R&D', hue: 60 },
]

// MOCK_TEAMS removed — was unused after teamFilterOptions cleanup


/* ================================================================
   HELPER – Click-outside hook
   ================================================================ */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function listener(e: MouseEvent | TouchEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}

/* ================================================================
   HELPER – Hours Calculation (with Overridden Hours respect)
   ================================================================ */
const calculateHours = (login: string, logout?: string, overriddenHours?: number): number | null => {
  if (overriddenHours !== undefined && overriddenHours !== null) return overriddenHours
  if (!logout) return null
  const loginDate = new Date(login)
  const logoutDate = new Date(logout)
  if (isNaN(loginDate.getTime()) || isNaN(logoutDate.getTime())) return 0
  const diffMs = logoutDate.getTime() - loginDate.getTime()
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
}

/** Hours-by-project and employee leaderboard from filtered logs (export/PDF). */
function buildTimesheetExportAnalytics(logs: TimesheetLog[]) {
  const byProject: Record<string, number> = {}
  const byEmployee: Record<string, { name: string; dept: string; hours: number }> = {}

  logs.forEach((t) => {
    const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours) || 0
    byProject[t.project] = (byProject[t.project] || 0) + hours

    const emp = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId)
    const existing = byEmployee[t.employeeId]
    if (existing) {
      existing.hours += hours
    } else {
      byEmployee[t.employeeId] = {
        name: t.employeeName,
        dept: emp?.team ?? '—',
        hours,
      }
    }
  })

  const hoursByProject = Object.entries(byProject)
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)

  const leaderboard = Object.values(byEmployee)
    .map((e) => ({ ...e, hours: Math.round(e.hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)

  return { hoursByProject, leaderboard }
}

function formatExportHours(hours: number): string {
  const n = Math.round(hours * 10) / 10
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`
}

/** Simplified operational status for the Timesheets log view (read-only). */
const getTimesheetWorkflowStatus = (
  t: Pick<TimesheetLog, 'logoutTime' | 'taskStatus' | 'status' | 'requestStatus'>
): 'Completed' | 'In Progress' => {
  const isCompleted =
    t.taskStatus === 'Completed' ||
    (!!t.logoutTime &&
      t.status === 'Approved' &&
      t.requestStatus !== 'Pending Review' &&
      t.requestStatus !== 'Rejected')
  return isCompleted ? 'Completed' : 'In Progress'
}

/* ================================================================
   HELPER – Format Date-Time
   ================================================================ */
const formatDateTime = (isoString?: string): string => {
  if (!isoString) return '—'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return isoString
  const dateStr = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${dateStr}, ${timeStr}`
}

/* ================================================================
   COMPONENT – Metric Card (Redesigned with Emerald Theme)
   ================================================================ */
function MetricCard({
  label,
  value,
  icon: Icon,
  accentClass,
  iconClassName,
  secondaryText,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accentClass: string
  iconClassName: string
  secondaryText?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_-2px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-slate-200 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClass}`} />
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 font-display text-3xl font-extrabold tabular-nums leading-none tracking-tight text-slate-900">
            {value}
          </p>
          {secondaryText && (
            <p className="mt-1.5 text-xs font-medium text-slate-500">{secondaryText}</p>
          )}
        </div>
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset transition-transform duration-200 group-hover:scale-[1.03] ${iconClassName}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </span>
      </div>
    </div>
  )
}

/* ================================================================
   COMPONENT – Custom Date Range Picker (Linear/SaaS Style)
   ================================================================ */
interface DateRangePickerProps {
  startDate: string
  endDate: string
  preset: string
  onChange: (start: string, end: string, preset: string) => void
}

function CustomDateRangePicker({ startDate, endDate, preset, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(startDate || '2026-05-01'))
  const [tempStart, setTempStart] = useState<string | null>(startDate)
  const [tempEnd, setTempEnd] = useState<string | null>(endDate)
  const containerRef = useRef<HTMLDivElement>(null)

  const applySingleDay = (dateStr: string) => {
    setTempStart(dateStr)
    setTempEnd(dateStr)
    onChange(dateStr, dateStr, 'Custom')
    setOpen(false)
  }

  const applyRange = (start: string, end: string) => {
    setTempStart(start)
    setTempEnd(end)
    onChange(start, end, 'Custom')
    setOpen(false)
  }

  useClickOutside(containerRef, () => {
    setOpen(false)
    setTempStart(startDate)
    setTempEnd(endDate)
  })

  useEffect(() => {
    if (open) {
      setTempStart(startDate)
      setTempEnd(endDate)
      setCurrentMonth(new Date(startDate || '2026-05-01'))
    }
  }, [open, startDate, endDate])

  const getPresetDates = (selectedPreset: string): { start: string; end: string } => {
    const today = new Date('2026-05-21') // Anchored system date
    let start = new Date('2026-05-21')
    let end = new Date('2026-05-21')

    switch (selectedPreset) {
      case 'Today':
        break
      case 'Yesterday':
        start.setDate(today.getDate() - 1)
        end.setDate(today.getDate() - 1)
        break
      case 'This Week': {
        const day = today.getDay()
        const diffToMon = day === 0 ? -6 : 1 - day
        start.setDate(today.getDate() + diffToMon)
        end.setDate(start.getDate() + 6)
        break
      }
      case 'Last Week': {
        const day = today.getDay()
        const diffToMon = day === 0 ? -6 : 1 - day
        start.setDate(today.getDate() + diffToMon - 7)
        end.setDate(start.getDate() + 6)
        break
      }
      case 'Past Two Weeks':
        start.setDate(today.getDate() - 13)
        break
      case 'This Month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        break
      case 'Last Month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'This Year':
        start = new Date(today.getFullYear(), 0, 1)
        end = new Date(today.getFullYear(), 11, 31)
        break
      case 'Last Year':
        start = new Date(today.getFullYear() - 1, 0, 1)
        end = new Date(today.getFullYear() - 1, 11, 31)
        break
    }

    const pad = (num: number) => String(num).padStart(2, '0')
    const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return { start: format(start), end: format(end) }
  }

  const handlePresetClick = (p: string) => {
    const { start, end } = getPresetDates(p)
    onChange(start, end, p)
    setOpen(false)
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDayClick = (dateStr: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      if (!tempStart || (tempStart && tempEnd)) {
        setTempStart(dateStr)
        setTempEnd(null)
        return
      }
      const start = dateStr < tempStart ? dateStr : tempStart
      const end = dateStr < tempStart ? tempStart : dateStr
      applyRange(start, end)
      return
    }
    applySingleDay(dateStr)
  }

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevDaysInMonth = new Date(year, month, 0).getDate()

    const cells: { day: number; dateString: string; isCurrentMonth: boolean }[] = []

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = prevDaysInMonth - i
      const prevM = month === 0 ? 11 : month - 1
      const prevY = month === 0 ? year - 1 : year
      const dateString = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      cells.push({ day, dateString, isCurrentMonth: false })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      cells.push({ day: i, dateString, isCurrentMonth: true })
    }

    const remaining = 42 - cells.length
    for (let i = 1; i <= remaining; i++) {
      const nextM = month === 11 ? 0 : month + 1
      const nextY = month === 11 ? year + 1 : year
      const dateString = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      cells.push({ day: i, dateString, isCurrentMonth: false })
    }

    return cells
  }, [currentMonth])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-white whitespace-nowrap"
      >
        <CalendarIcon className="h-3.5 w-3.5 text-emerald-650 flex-shrink-0" />
        <span className="truncate max-w-xs text-xs leading-tight">
          {preset === 'Custom' && startDate === endDate
            ? `${formatDate(startDate)}`
            : preset === 'Custom'
              ? `${formatDate(startDate)} – ${formatDate(endDate)}`
              : `${preset} (${formatDate(startDate)} – ${formatDate(endDate)})`}
        </span>
        <ChevronDown className="h-3 w-3 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex flex-col md:flex-row gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-fadeIn w-[92vw] sm:w-auto sm:min-w-[500px]">
          {/* Calendar Grid */}
          <div className="flex-1 select-none">
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-slate-800">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {calendarCells.map((cell, idx) => {
                const isSelectedStart = tempStart && cell.dateString === tempStart
                const isSelectedEnd = tempEnd && cell.dateString === tempEnd
                const isSingleDay = tempStart && tempEnd && tempStart === tempEnd && cell.dateString === tempStart
                const isWithinRange =
                  tempStart && tempEnd && tempStart !== tempEnd && cell.dateString > tempStart && cell.dateString < tempEnd

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => handleDayClick(cell.dateString, e)}
                    title={`Filter logs for ${cell.dateString}. Shift+click a second date for a range.`}
                    className={`
                      h-7 w-7 rounded-lg flex items-center justify-center font-semibold transition-all
                      ${cell.isCurrentMonth ? 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}
                      ${isSingleDay || isSelectedStart || isSelectedEnd ? 'bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white shadow-sm' : ''}
                      ${isWithinRange ? 'bg-emerald-50 text-emerald-800 rounded-none' : ''}
                    `}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-[10px] text-slate-400 font-medium">
              Click any date to filter that day. Hold Shift, click a start date, then another date for a custom range.
            </p>
          </div>

          {/* Divider */}
          <div className="hidden md:block border-l border-slate-150" />

          {/* Quick Presets Panel */}
          <div className="w-36 flex flex-col gap-0.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Quick Presets
            </p>
            {[
              'Today',
              'Yesterday',
              'This Week',
              'Last Week',
              'Past Two Weeks',
              'This Month',
              'Last Month',
              'This Year',
              'Last Year',
            ].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetClick(p)}
                className={`
                  text-left px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                  ${preset === p ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}
                `}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   COMPONENT – Overlapping Avatar Group (Jira / Linear style)
   ================================================================ */
function AvatarGroup({ users, max = 3 }: { users: string[]; max?: number }) {
  if (!users || users.length === 0) return null

  const visible = users.slice(0, max)
  const remaining = users.length - max

  return (
    <div className="flex -space-x-2 overflow-hidden">
      {visible.map((username) => {
        const emp = MOCK_EMPLOYEES.find((e) => e.name === username)
        const hue = emp ? emp.hue : 120
        const initials = username
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()

        return (
          <div
            key={username}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold shadow-sm ring-1 ring-slate-200/40"
            style={{
              background: `linear-gradient(135deg, hsl(${hue}, 80%, 96%) 0%, hsl(${hue}, 55%, 85%) 100%)`,
              color: `hsl(${hue}, 85%, 28%)`,
            }}
            title={username}
          >
            {initials}
          </div>
        )
      })}
      {remaining > 0 && (
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-black text-slate-600 shadow-sm ring-1 ring-slate-200/40">
          +{remaining}
        </div>
      )}
    </div>
  )
}

/** Empty selection = no restriction. Non-empty = value must be in the list. */
function matchesMultiFilter(selected: string[], value: string): boolean {
  if (selected.length === 0) return true
  return selected.includes(value)
}

/* ================================================================
   COMPONENT – Multi-select filter dropdown (Projects / Timesheets)
   ================================================================ */
function FilterCheckboxGroup({
  label,
  placeholder,
  options,
  selected,
  onChange,
  compact = false,
}: {
  label: string
  placeholder: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  const summary = useMemo(() => {
    if (selected.length === 0) return placeholder
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0])
      return opt?.label ?? selected[0]
    }
    return `${selected.length} selected`
  }, [selected, options, placeholder])

  return (
    <div ref={rootRef} className="relative">
      {!compact && (
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border bg-white px-2.5 text-left text-xs font-bold outline-none transition-all ${
          open || selected.length > 0
            ? 'border-emerald-500 text-slate-700 ring-4 ring-emerald-500/10'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <span className="truncate text-xs">{summary}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onChange(options.map((o) => o.value))}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-48 space-y-0.5 overflow-y-auto pr-0.5">
            {options.length === 0 ? (
              <p className="px-2 py-2 text-xs font-semibold text-slate-400">No options</p>
            ) : (
              options.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
                  />
                  <span className="truncate font-semibold" title={opt.label}>
                    {opt.label}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   COMPONENT – Checkbox List (for Modal Allowed Users)
   ================================================================ */
function CheckboxList({
  label,
  items,
  selected,
  onChange,
}: {
  label: string
  items: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item])
  }
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2 max-h-32 overflow-y-auto space-y-0.5">
        {items.map((item) => (
          <label
            key={item}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-white border border-transparent hover:border-slate-100"
          >
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => toggle(item)}
              className="h-3.5 w-3.5 rounded border-slate-350 text-emerald-600 focus:ring-emerald-500/20"
            />
            <span>{item}</span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-400 font-semibold">
        {selected.length} of {items.length} selected
      </p>
    </div>
  )
}

/* ================================================================
   COMPONENT – Project Card (Grid View Card)
   ================================================================ */
const ProjectCard = memo(function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
}) {
  const isCompleted = project.status === 'Completed'
  const isCancelled = project.status === 'Cancelled'
  const isRejected = project.status === 'Rejected'

  // Visibility/scope summary
  const visibilitySummary =
    project.accessType === 'private'
      ? `${project.visibleUsers.length} Users · Lead: ${project.teamLead || 'Not assigned'}`
      : 'All Members'

  const projectInitial =
    project.name.charAt(project.name.indexOf(' ') + 1) || project.name.charAt(0)

  return (
    <div className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_16px_-4px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200/60 hover:shadow-[0_8px_24px_-6px_rgba(16,185,129,0.15)] animate-fadeIn">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/80 text-sm font-extrabold text-emerald-800 ring-1 ring-emerald-200/50">
              {projectInitial}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-bold leading-snug text-slate-800 transition-colors group-hover:text-emerald-700">
                {project.name}
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                <span className="text-slate-400">Client · </span>
                {project.client}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {isCancelled ? (
              <Badge variant="danger" className="border border-rose-100 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                <X className="mr-1 h-3.5 w-3.5" /> Cancelled
              </Badge>
            ) : isRejected ? (
              <Badge variant="danger" className="border border-rose-100 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                <X className="mr-1 h-3.5 w-3.5" /> Rejected
              </Badge>
            ) : isCompleted ? (
              <Badge variant="neutral" className="border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Completed
              </Badge>
            ) : (
              <Badge variant="info" className="border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-500" />
                In Progress
              </Badge>
            )}
            {project.accessType === 'private' ? (
              <Badge variant="warning" className="border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                <Lock className="mr-1 h-3.5 w-3.5 text-amber-600" /> Private
              </Badge>
            ) : (
              <Badge variant="info" className="border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-800">
                <Globe className="mr-1 h-3.5 w-3.5 text-sky-600" /> Public
              </Badge>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Visibility</p>
          <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-700">{visibilitySummary}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="truncate font-mono">{project.technologyNode}</span>
            </span>
            {project.accessType === 'private' && project.teamLead && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="truncate">Lead: {project.teamLead}</span>
              </span>
            )}
          </div>
          {project.accessType === 'private' && project.visibleUsers.length > 0 && (
            <AvatarGroup users={project.visibleUsers} max={3} />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
        <button
          onClick={onEdit}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          title="Edit Project"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700"
          title="Archive Project"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
})

/* ================================================================
   COMPONENT – Project Card List Row View
   ================================================================ */
const ProjectListRow = memo(function ProjectListRow({
  project,
  onEdit,
  onDelete,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
}) {
  const isCompleted = project.status === 'Completed'
  const isCancelled = project.status === 'Cancelled'
  const isRejected = project.status === 'Rejected'

  const projectInitial =
    project.name.charAt(project.name.indexOf(' ') + 1) || project.name.charAt(0)

  return (
    <tr className="group transition-colors hover:bg-emerald-50/30">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-extrabold text-emerald-800 ring-1 ring-emerald-200/50">
            {projectInitial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800 group-hover:text-emerald-700">{project.name}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-slate-600">{project.client}</td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 font-mono">
          <Cpu className="h-3.5 w-3.5 text-emerald-600" />
          {project.technologyNode}
        </span>
      </td>
      <td className="px-5 py-4">
        {project.accessType === 'private' ? (
          <Badge variant="warning" className="border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
            <Lock className="mr-1 h-3.5 w-3.5 text-amber-600" /> Private
          </Badge>
        ) : (
          <Badge variant="info" className="border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-800">
            <Globe className="mr-1 h-3.5 w-3.5 text-sky-600" /> Public
          </Badge>
        )}
      </td>
      <td className="px-5 py-4">
        {project.accessType === 'private' ? (
          <div className="flex items-center gap-2">
            {project.teamLead && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                Lead: {project.teamLead}
              </span>
            )}
            <AvatarGroup users={project.visibleUsers} max={3} />
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-500">All Members (Public)</span>
        )}
      </td>
      <td className="px-5 py-4">
        {isCancelled ? (
          <Badge variant="danger" className="border border-rose-100 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
            <X className="mr-1 h-3.5 w-3.5" /> Cancelled
          </Badge>
        ) : isRejected ? (
          <Badge variant="danger" className="border border-rose-100 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
            <X className="mr-1 h-3.5 w-3.5" /> Rejected
          </Badge>
        ) : isCompleted ? (
          <Badge variant="neutral" className="border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Completed
          </Badge>
        ) : (
          <Badge variant="info" className="border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-500" />
            In Progress
          </Badge>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            title="Edit Project"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700"
            title="Archive Project"
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
})

/* ================================================================
   COMPONENT – Employee Leaderboard / Progress Layout
   ================================================================ */
function EmployeeLeaderboard({
  data,
}: {
  data: { name: string; dept: string; hours: number; hue: number }[]
}) {
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const maxHours = sortedData.length > 0 ? Math.max(...sortedData.map((d) => d.hours)) : 0

  return (
    <div className="space-y-2.5">
      {sortedData.map((item, idx) => {
        const percent = maxHours > 0 ? (item.hours / maxHours) * 100 : 0
        const hue = item.hue ?? Math.round((idx * 137.5) % 360)
        return (
          <div
            key={item.name}
            className="group rounded-lg border border-transparent px-1.5 py-1.5 transition-colors hover:border-slate-100 hover:bg-slate-50/80"
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={item.name} size="sm" color={`hsl(${hue},55%,45%)`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-slate-800 group-hover:text-emerald-800">
                    {item.name}
                  </p>
                  <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-900">
                    {item.hours.toFixed(1)}
                    <span className="ml-0.5 text-[11px] font-bold text-slate-500">h</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${percent}%`,
                      background: `linear-gradient(90deg, hsl(${hue}, 70%, 48%) 0%, hsl(${hue}, 75%, 58%) 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )
      })}
      {sortedData.length === 0 && (
        <p className="py-10 text-center text-sm font-semibold text-slate-500">
          No hours logged in this period.
        </p>
      )}
    </div>
  )
}

/* ================================================================
   MAIN DASHBOARD COMPONENT
   ================================================================ */
export function ProjectManagement() {
  // ── Core State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'projects' | 'timesheets'>('projects')
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [timesheets, setTimesheets] = useState<TimesheetLog[]>([])
  const [loading, setLoading] = useState(false)

  const projects = allProjects

  // ── Projects Filter & Layout States ─────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClients, setFilterClients] = useState<string[]>([])
  const [filterEmployees, setFilterEmployees] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterAccessTypes, setFilterAccessTypes] = useState<string[]>([])

  // ── Projects Pagination States ──────────────────────────────
  const [projectsCurrentPage, setProjectsCurrentPage] = useState(1)
  const projectsPerPage = 9

  // ── Timesheets Pagination States ────────────────────────────
  const [timesheetsCurrentPage, setTimesheetsCurrentPage] = useState(1)
  const timesheetsPerPage = 10

  // ── Project Modal States ────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])



  // ── Project Audit Trail Modal States ────────────────────────────
  const [auditTrailModalOpen, setAuditTrailModalOpen] = useState(false)
  const [selectedAuditProjectId, setSelectedAuditProjectId] = useState<string | null>(null)
  const [selectedAuditProjectName, setSelectedAuditProjectName] = useState<string>('')

  // ── Project Archiving & Delete Confirmation States ──────────────
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [archivedModalOpen, setArchivedModalOpen] = useState(false)

  const openAuditTrail = useCallback((id: string, name: string) => {
    setSelectedAuditProjectId(id)
    setSelectedAuditProjectName(name)
    setAuditTrailModalOpen(true)
  }, [])

  const emptyForm = {
    name: '',
    client: '',
    technologyNode: '',
    accessType: 'public' as 'public' | 'private',
    description: '',
    visibleUsers: [] as string[],
    teamLead: '',
    status: 'Active' as 'Active' | 'Completed' | 'Cancelled',
  }
  const [form, setForm] = useState(emptyForm)

  // ── Timesheets Date Range Picker States ─────────────────────
  const [datePreset, setDatePreset] = useState<string>('This Month')
  const [tsStartDate, setTsStartDate] = useState('2026-05-01')
  const [tsEndDate, setTsEndDate] = useState('2026-05-31')

  // ── Timesheets Filters States ───────────────────────────────
  const [tsSearch, setTsSearch] = useState('')
  const [tsEmployeeFilters, setTsEmployeeFilters] = useState<string[]>([])
  const [tsProjectFilters, setTsProjectFilters] = useState<string[]>([])
  const [tsStatusFilters, setTsStatusFilters] = useState<string[]>([])

  // ── API Fetch Functions ─────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await getEmployees({ pageSize: 1000 })
      setEmployees(res.data)
    } catch (err) {
      console.error('Failed to fetch employees:', err)
      // Silently fail - use empty list
    }
  }, [])

  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.get('/projects')
      setAllProjects(res.data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load projects.')
    }
  }, [])

  const fetchTimesheetsData = useCallback(async () => {
    const params: Record<string, string> = {
      from: tsStartDate,
      to: tsEndDate,
    }
    if (tsSearch.trim()) params.search = tsSearch.trim()

    try {
      const logsRes = await api.get('/timesheets', { params })
      setTimesheets(logsRes.data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load timesheet data.')
    }
  }, [tsStartDate, tsEndDate, tsSearch])

  const refreshAllData = useCallback(async () => {
    await Promise.all([fetchProjects(), fetchTimesheetsData()])
  }, [fetchProjects, fetchTimesheetsData])

  useEffect(() => {
    fetchProjects()
    fetchEmployees()
  }, [fetchProjects, fetchEmployees])

  useEffect(() => {
    if (activeTab === 'timesheets') {
      fetchTimesheetsData()
    }
  }, [fetchTimesheetsData, activeTab])

  // ── Derived Client / Project Lists for Filter Options ──────────
  const uniqueClients = useMemo(() => {
    return [...new Set(projects.map((p) => p.client))].sort()
  }, [projects])

  const uniqueEmployees = useMemo(() => {
    const empSet = new Set<string>()
    projects.forEach((p) => {
      if (p.teamLead) empSet.add(p.teamLead)
      p.visibleUsers.forEach((u) => empSet.add(u))
    })
    return [...empSet].sort()
  }, [projects])



  // ── Projects Tab Filter Implementation ──────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filterClients.length > 0) count++
    if (filterEmployees.length > 0) count++
    if (filterStatuses.length > 0) count++
    if (filterAccessTypes.length > 0) count++
    return count
  }, [filterClients, filterEmployees, filterStatuses, filterAccessTypes])

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const query = searchQuery.toLowerCase()
      const matchSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.client.toLowerCase().includes(query) ||
        p.technologyNode.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)

      const matchClient = matchesMultiFilter(filterClients, p.client)
      const matchStatus = matchesMultiFilter(filterStatuses, p.status)
      const matchAccess = matchesMultiFilter(filterAccessTypes, p.accessType)
      
      // Check if any selected employee is associated with the project
      const matchEmployee =
        filterEmployees.length === 0 ||
        filterEmployees.includes(p.teamLead || '') ||
        filterEmployees.some((emp) => p.visibleUsers.includes(emp))

      return matchSearch && matchClient && matchStatus && matchAccess && matchEmployee
    })
  }, [
    projects,
    searchQuery,
    filterClients,
    filterEmployees,
    filterStatuses,
    filterAccessTypes,
  ])

  // ── Projects Pagination derived values ──────────────────────
  const totalProjectsPages = Math.ceil(filteredProjects.length / projectsPerPage)
  const indexOfLastProject = projectsCurrentPage * projectsPerPage
  const indexOfFirstProject = indexOfLastProject - projectsPerPage
  const currentProjects = filteredProjects.slice(indexOfFirstProject, indexOfLastProject)

  // Reset projects page to 1 when filters or search query change
  useEffect(() => {
    setProjectsCurrentPage(1)
  }, [searchQuery, filterClients, filterEmployees, filterStatuses, filterAccessTypes])

  // ── Projects Tab Metrics Calculation ─────────────────────────
  const projectMetrics = useMemo(() => {
    return {
      total: projects.length,
      inProgress: projects.filter((p) => p.status === 'Active').length,
      completed: projects.filter((p) => p.status === 'Completed').length,
    }
  }, [projects])

  // ── Projects State Handlers ──────────────────────────────────
  const openCreateProject = useCallback(() => {
    setModalMode('create')
    setForm({
      ...emptyForm,
    })
    setEditingId(null)
    setModalOpen(true)
  }, [])

  const openEditProject = useCallback((p: Project) => {
    setModalMode('edit')
    setEditingId(p.id)
    setForm({
      name: p.name,
      client: p.client,
      technologyNode: p.technologyNode,
      accessType: p.accessType,
      description: p.description,
      visibleUsers: [...p.visibleUsers],
      teamLead: p.teamLead || '',
      status: (p.status === 'Rejected' ? 'Cancelled' : p.status) as 'Active' | 'Completed' | 'Cancelled',
    })
    setModalOpen(true)
  }, [])




  const handleSaveProject = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!form.name.trim() || !form.client.trim() || !form.technologyNode.trim()) {
        toast.error('Please specify Project Name, Client, and Technology Node.')
        return
      }

      const descriptionWords = countWords(form.description)
      if (!form.description.trim()) {
        toast.error('Project description is required.')
        return
      }
      if (descriptionWords > MAX_PROJECT_DESCRIPTION_WORDS) {
        toast.error(
          `Project description must be ${MAX_PROJECT_DESCRIPTION_WORDS} words or fewer (currently ${descriptionWords}).`
        )
        return
      }

      setLoading(true)
      try {
        if (modalMode === 'create') {
          const res = await api.post('/projects', {
            name: form.name.trim(),
            client: form.client.trim(),
            technologyNode: form.technologyNode.trim(),
            accessType: form.accessType,
            description: form.description.trim(),
            visibleUsers: form.accessType === 'private' ? form.visibleUsers : [],
            teamLead: form.teamLead.trim() || undefined,
          })
          toast.success(`Project "${res.data.name}" created successfully.`)
          await refreshAllData()
        } else {
          const oldProject = allProjects.find((p) => p.id === editingId)
          const oldProjectName = oldProject ? oldProject.name : ''
          const newProjectName = form.name.trim()

          await api.put(`/projects/${editingId}`, {
            name: newProjectName,
            client: form.client.trim(),
            technologyNode: form.technologyNode.trim(),
            accessType: form.accessType,
            description: form.description.trim(),
            status: form.status,
            visibleUsers: form.accessType === 'private' ? form.visibleUsers : [],
            teamLead: form.teamLead.trim() || undefined,
          })
          toast.success('Project details updated successfully.')

          if (oldProjectName && oldProjectName !== newProjectName) {
            setTsProjectFilters((prev) =>
              prev.map((n) => (n === oldProjectName ? newProjectName : n))
            )
          }
          await refreshAllData()
        }
        setModalOpen(false)
      } catch (err: any) {
        console.error(err)
        toast.error(err.response?.data?.error || 'Failed to save project.')
      } finally {
        setLoading(false)
      }
    },
    [form, modalMode, editingId, refreshAllData, allProjects]
  )

  const handleDeleteProject = useCallback(
    (p: Project) => {
      setProjectToDelete(p)
      setDeleteConfirmOpen(true)
    },
    []
  )

  const handleConfirmArchive = useCallback(async () => {
    if (!projectToDelete || !projectToDelete.id) {
      toast.error('Invalid project. Please try again.')
      return
    }
    
    setDeleteConfirmOpen(false)
    setLoading(true)
    const pName = projectToDelete.name
    const projectId = projectToDelete.id
    
    try {
      const response = await api.post(`/projects/${projectId}/archive`)
      
      if (response.status === 200) {
        setTsProjectFilters((prev) => prev.filter((n) => n !== pName))
        setProjectToDelete(null)
        
        // Small delay to ensure UI updates before refresh
        setTimeout(() => {
          refreshAllData()
        }, 300)
        
        toast.success(`Project "${pName}" and all associated history have been safely archived.`)
      }
    } catch (err: any) {
      console.error('Archive error:', err)
      setProjectToDelete(null)
      
      const errorMsg = err.response?.data?.error || err.message || 'Failed to archive project.'
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [projectToDelete, refreshAllData])


  const clearProjectsFilters = useCallback(() => {
    setSearchQuery('')
    setFilterClients([])
    setFilterEmployees([])
    setFilterStatuses([])
    setFilterAccessTypes([])
  }, [])

  // ── Timesheets Date Range Change Handler ─────────────────────
  const handleDateRangeChange = (start: string, end: string, preset: string) => {
    setTsStartDate(start)
    setTsEndDate(end)
    setDatePreset(preset)
  }

  // Mapper helper to link employee team to logical teams for filtering
  const getEmployeeTeam = useCallback((empName: string): string => {
    const emp = MOCK_EMPLOYEES.find((e) => e.name === empName)
    if (!emp) return 'Design Team'
    return `${emp.team} Team`
  }, [])

  // ── Timesheets Filtering Implementation ──────────────────────
  const filteredTimesheets = useMemo(() => {
    return timesheets.filter((t) => {
      const logDate = new Date(t.date)
      const startDate = new Date(tsStartDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(tsEndDate)
      endDate.setHours(23, 59, 59, 999)

      if (logDate < startDate || logDate > endDate) return false

      const query = tsSearch.toLowerCase()
      const matchSearch =
        !query ||
        t.employeeName.toLowerCase().includes(query) ||
        t.project.toLowerCase().includes(query) ||
        t.task.toLowerCase().includes(query)

      const matchEmployee = matchesMultiFilter(tsEmployeeFilters, t.employeeName)
      const matchProject = matchesMultiFilter(tsProjectFilters, t.project)
      const matchStatus = matchesMultiFilter(
        tsStatusFilters,
        getTimesheetWorkflowStatus(t)
      )

      return matchSearch && matchEmployee && matchProject && matchStatus
    })
  }, [
    timesheets,
    tsStartDate,
    tsEndDate,
    tsSearch,
    tsEmployeeFilters,
    tsProjectFilters,
    tsStatusFilters,
    getEmployeeTeam,
  ])

  // Derived Project Hours based on filteredTimesheets
  const derivedHoursByProject = useMemo(() => {
    const projectMap: Record<string, { name: string; hours: number; projectId?: string }> = {}
    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours) || 0
      if (projectMap[t.project]) {
        projectMap[t.project].hours += hours
      } else {
        projectMap[t.project] = {
          name: t.project,
          hours,
          projectId: t.projectId
        }
      }
    })
    return Object.values(projectMap)
      .map(p => ({ ...p, hours: Math.round(p.hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
  }, [filteredTimesheets])

  // Derived Employee Hours based on filteredTimesheets
  const derivedLeaderboardData = useMemo(() => {
    const empMap: Record<string, { name: string; dept: string; hours: number; hue: number }> = {}
    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours) || 0
      const empInfo = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId)
      if (empMap[t.employeeName]) {
        empMap[t.employeeName].hours += hours
      } else {
        empMap[t.employeeName] = {
          name: t.employeeName,
          dept: empInfo?.team ?? '—',
          hours,
          hue: empInfo?.hue ?? 200
        }
      }
    })
    return Object.values(empMap)
      .map(e => ({ ...e, hours: Math.round(e.hours * 10) / 10 }))
  }, [filteredTimesheets])

  // ── Timesheets Pagination derived values ────────────────────
  const totalTimesheetsPages = Math.ceil(filteredTimesheets.length / timesheetsPerPage)
  const indexOfLastTimesheet = timesheetsCurrentPage * timesheetsPerPage
  const indexOfFirstTimesheet = indexOfLastTimesheet - timesheetsPerPage
  const currentTimesheets = filteredTimesheets.slice(indexOfFirstTimesheet, indexOfLastTimesheet)

  // Reset timesheets page to 1 when filters or search query change
  useEffect(() => {
    setTimesheetsCurrentPage(1)
  }, [tsSearch, tsStartDate, tsEndDate, tsEmployeeFilters, tsProjectFilters, tsStatusFilters])

  // ── Export Implementations (Excel / PDF) ─────────────────────
  const handleExportExcel = useCallback(async () => {
    if (!filteredTimesheets.length) {
      toast.error('No timesheet data available to export.')
      return
    }

    const { hoursByProject, leaderboard } = buildTimesheetExportAnalytics(filteredTimesheets)
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Timesheet Report')
    let row = 1

    const addRow = (values: (string | number)[]) => {
      sheet.getRow(row).values = values
      row += 1
    }

    addRow(['EPICAL LAYOUTS PVT LTD'])
    addRow(['Timesheet Report'])
    addRow([`Date range: ${tsStartDate} to ${tsEndDate}`])
    addRow([`Generated: ${new Date().toLocaleString()}`])
    addRow([])

    addRow(['AGGREGATED HOURS BY PROJECT'])
    addRow(['Project', 'Hours'])
    hoursByProject.forEach((p) => {
      addRow([p.name, formatExportHours(p.hours)])
    })
    addRow([])

    addRow(['AGGREGATED HOURS BY EMPLOYEE'])
    addRow(['Rank', 'Employee', 'Department', 'Hours'])
    leaderboard.forEach((e, index) => {
      addRow([index + 1, e.name, e.dept, formatExportHours(e.hours)])
    })
    addRow([])

    addRow(['DETAILED TIME LOGS'])
    addRow(['Employee', 'Employee ID', 'Project', 'Login Time', 'Logout Time', 'Total Hours'])
    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours)
      addRow([
        t.employeeName,
        t.employeeId,
        t.project,
        formatDateTime(t.loginTime),
        t.logoutTime ? formatDateTime(t.logoutTime) : '—',
        hours !== null ? formatExportHours(hours) : '—',
      ])
    })

    sheet.columns = [
      { width: 22 },
      { width: 14 },
      { width: 22 },
      { width: 24 },
      { width: 24 },
      { width: 12 },
    ]

    const buffer = await workbook.xlsx.writeBuffer()
    downloadExcelBuffer(buffer, `Timesheet_Report_${tsStartDate}_to_${tsEndDate}.xlsx`)
    toast.success('Excel spreadsheet generated and downloaded successfully.')
  }, [filteredTimesheets, tsStartDate, tsEndDate])

  const handleExportPDF = useCallback(async () => {
    if (!filteredTimesheets.length) {
      toast.error('No timesheet data available to export.')
      return
    }

    const { hoursByProject, leaderboard } = buildTimesheetExportAnalytics(filteredTimesheets)
    
    // Sort leaderboard alphabetically matching the A-Z requirement
    const sortedLeaderboard = [...leaderboard].sort((a, b) => a.name.localeCompare(b.name))

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
    const pageWidth = doc.internal.pageSize.width || 842
    const pageHeight = doc.internal.pageSize.height || 595
    const marginX = 40

    const logo = await fetchExportLogo()

    const tableTheme = {
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' as const },
      headStyles: { fillColor: [30, 41, 59] as [number, number, number], fontStyle: 'bold' as const, textColor: [255, 255, 255] as [number, number, number] },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
      theme: 'grid' as const,
      margin: { left: marginX, right: marginX, bottom: 36 },
    }

    const addSectionTitle = (title: string, y: number) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(30, 41, 59)
      doc.text(title, marginX, y)
      return y + 14
    }

    let headerY = 20

    // Draw the green chip logo if available
    let logoWidth = 0
    if (logo) {
      const scaled = scaleExportLogo(logo.width, logo.height, 48)
      const format = logo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(logo.dataUrl, format, marginX, headerY, scaled.width, scaled.height)
      logoWidth = scaled.width
    }

    // Draw Title next to Logo
    const textX = marginX + logoWidth + 12
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(30, 41, 59)
    doc.text('EPICAL LAYOUTS PVT LTD', textX, headerY + 16)

    doc.setFontSize(12)
    doc.setTextColor(71, 85, 105)
    doc.text('Timesheet Report', textX, headerY + 32)
    
    headerY += 45

    // Generated Timestamp
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - marginX, headerY, { align: 'right' })
    headerY += 10

    // Horizontal Line divider
    doc.setDrawColor(226, 232, 240)
    doc.line(marginX, headerY, pageWidth - marginX, headerY)

    let cursorY = headerY + 18

    const colWidth = 360
    const colGap = 42
    const col2X = marginX + colWidth + colGap

    // Helper to convert HSL to RGB
    const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
      s /= 100
      l /= 100
      const k = (n: number) => (n + h / 30) % 12
      const a = s * Math.min(l, 1 - l)
      const f = (n: number) => {
        const r = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
        return Math.round(255 * r)
      }
      return [f(0), f(8), f(4)]
    }

    // 3D Bar Drawer
    const draw3DBar = (x: number, y: number, width: number, height: number, baseColor: [number, number, number]) => {
      const adjustColor = (color: [number, number, number], percent: number) => {
        return color.map(c => Math.min(255, Math.max(0, Math.round(c * (1 + percent))))) as [number, number, number]
      }

      const frontColor = baseColor
      const topColor = adjustColor(baseColor, 0.35)
      const rightColor = adjustColor(baseColor, -0.3)

      const depth = 3

      // 1. Draw front face (rectangle)
      doc.setFillColor(frontColor[0], frontColor[1], frontColor[2])
      doc.rect(x, y, width, height, 'F')

      // 2. Draw top face (parallelogram)
      doc.setFillColor(topColor[0], topColor[1], topColor[2])
      doc.triangle(x, y, x + depth, y - depth, x + width + depth, y - depth, 'F')
      doc.triangle(x, y, x + width + depth, y - depth, x + width, y, 'F')

      // 3. Draw right side face (parallelogram)
      doc.setFillColor(rightColor[0], rightColor[1], rightColor[2])
      doc.triangle(x + width, y, x + width + depth, y - depth, x + width + depth, y - depth + height, 'F')
      doc.triangle(x + width, y, x + width + depth, y - depth + height, x + width, y + height, 'F')
    }

    // 1. LEFT COLUMN: PROJECT HOURS
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.setFillColor(74, 175, 125)
    doc.rect(marginX, cursorY, 3, 10, 'F')
    doc.text('PROJECT HOURS', marginX + 8, cursorY + 8)

    let leftY = cursorY + 24
    const maxProjectHours = Math.max(...hoursByProject.map(p => p.hours), 1)
    const averageProjectHours = hoursByProject.length > 0 ? (hoursByProject.reduce((sum, p) => sum + p.hours, 0) / hoursByProject.length) : 0

    hoursByProject.forEach((p) => {
      // Calculate bar width proportional to max, with min width of 5
      const barWidth = Math.max(5, (p.hours / maxProjectHours) * 160)
      
      // Determine project color based on average comparison
      const isGreaterThanAverage = p.hours > averageProjectHours
      const baseColor: [number, number, number] = isGreaterThanAverage ? [74, 175, 125] : [241, 108, 111]

      // Draw the 3D bar
      draw3DBar(marginX, leftY, barWidth, 8, baseColor)

      // Project text to the right of the bar
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(`${formatExportHours(p.hours)} — ${p.name}`, marginX + barWidth + 10, leftY + 7)

      leftY += 18
    })

    // 2. RIGHT COLUMN: EMPLOYEE HOURS
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.setFillColor(59, 130, 246)
    doc.rect(col2X, cursorY, 3, 10, 'F')
    doc.text('EMPLOYEE HOURS', col2X + 8, cursorY + 8)

    let rightY = cursorY + 24
    const maxEmployeeHours = Math.max(...sortedLeaderboard.map(e => e.hours), 1)

    sortedLeaderboard.forEach((e, idx) => {
      // Calculate bar width
      const barWidth = Math.max(5, (e.hours / maxEmployeeHours) * 160)
      
      // Get unique colors for different employees using golden angle
      const baseColor = hslToRgb(Math.round((idx * 137.5) % 360), 75, 50)

      // Draw the 3D bar
      draw3DBar(col2X, rightY, barWidth, 8, baseColor)

      // Employee text to the right of the bar
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(30, 41, 59)
      doc.text(`${formatExportHours(e.hours)} — ${e.name}`, col2X + barWidth + 10, rightY + 7)

      rightY += 18
    })

    // Set cursorY to the maximum end of either column
    cursorY = Math.max(leftY, rightY) + 25

    // Detailed time logs
    cursorY = addSectionTitle('Detailed Time Logs', cursorY)

    const tableHeaders = ['Employee', 'Project', 'Login Time', 'Logout Time', 'Duration']

    const tableRows = filteredTimesheets.map((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours)
      const durationStr = (() => {
        if (hours === null) return '—'
        const totalMinutes = Math.round(hours * 60)
        const hrs = Math.floor(totalMinutes / 60)
        const mins = totalMinutes % 60
        return `${hrs}hr ${mins}min`
      })()
      
      return [
        `${t.employeeName} (${t.employeeId})`,
        t.project,
        formatDateTime(t.loginTime),
        t.logoutTime ? formatDateTime(t.logoutTime) : '—',
        durationStr,
      ]
    })

    autoTable(doc, {
      ...tableTheme,
      head: [tableHeaders],
      body: tableRows,
      startY: cursorY,
      styles: { ...tableTheme.styles, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 180 },
        1: { cellWidth: 170 },
        2: { cellWidth: 140 },
        3: { cellWidth: 140 },
        4: { cellWidth: 90, halign: 'right' },
      },
    })

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 20, { align: 'right' })
      doc.text('Confidential - EPICAL Timesheet Data', marginX, pageHeight - 20)
    }

    doc.save(`Timesheet_Report_${tsStartDate}_to_${tsEndDate}.pdf`)
    toast.success('PDF report exported successfully.')
  }, [filteredTimesheets, tsStartDate, tsEndDate])

  const clearTimesheetFilters = useCallback(() => {
    setTsSearch('')
    setTsEmployeeFilters([])
    setTsProjectFilters([])
    setTsStatusFilters([])
  }, [])

  const tsEmployeeFilterOptions = useMemo(() => {
    const names = new Set<string>()
    MOCK_EMPLOYEES.forEach((e) => names.add(e.name))
    timesheets.forEach((t) => {
      if (t.employeeName) names.add(t.employeeName)
    })
    return [...names].sort().map((name) => ({ value: name, label: name }))
  }, [timesheets])

  const tsProjectFilterOptions = useMemo(
    () =>
      projects.map((p) => ({
        value: p.name,
        label:
          p.status === 'Completed'
            ? `${p.name} (Completed)`
            : p.status === 'Rejected'
              ? `${p.name} (Rejected)`
              : p.name,
      })),
    [projects]
  )

  const tsStatusFilterOptions = useMemo(
    () => [
      { value: 'Completed', label: 'Completed' },
      { value: 'In Progress', label: 'In Progress' },
    ],
    []
  )

  const hasActiveTimesheetFilters =
    tsSearch.trim().length > 0 ||
    tsEmployeeFilters.length > 0 ||
    tsProjectFilters.length > 0 ||
    tsStatusFilters.length > 0


  return (
<<<<<<< HEAD
    <PageWrapper>
      {/* ── Page Header (Linear Clean Style) ───────────────── */}
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Admin Dashboard' }, { label: 'Projects & Timesheets' }]} />
          <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-slate-800">
          </h1>
        </div>

        {/* Header CTA Trigger */}
        <div className="flex items-center gap-2">
          {activeTab === 'projects' && (
            <>
              <Button
                onClick={() => setArchivedModalOpen(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all shadow-sm rounded-xl py-2 px-4 flex items-center gap-1.5 border border-slate-200"
=======
    <PageWrapper className="py-4 sm:py-5">
      {/* ── Compact admin header: tabs + contextual actions ───────────────── */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
            {[
              { key: 'projects' as const, label: 'Projects', icon: FolderOpen, count: filteredProjects.length },
              { key: 'timesheets' as const, label: 'Timesheets', icon: Clock, count: filteredTimesheets.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-bold transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
>>>>>>> 7e5928b (project_management)
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
                {tab.key === 'projects' && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
                      activeTab === tab.key ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/80 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeTab === 'projects' && (
              <>
                <Button
                  onClick={() => setArchivedModalOpen(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-0 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                >
                  <Archive className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Archived</span>
                </Button>
                <Button
                  onClick={openCreateProject}
                  className="flex h-9 items-center gap-1.5 rounded-lg border-0 bg-emerald-600 px-3.5 py-0 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-500/15"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Project
                </Button>
              </>
            )}
            {activeTab === 'timesheets' && (
              <>
                <button
                  onClick={handleExportPDF}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                  title="Export timesheet data as PDF report"
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span className="hidden sm:inline">PDF Report</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                  title="Export timesheet data as Excel spreadsheet"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="hidden sm:inline">Excel</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================
           TAB 1 – PROJECTS
           ================================================================ */}
      {activeTab === 'projects' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Project metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Total Projects"
              value={projectMetrics.total}
              icon={FolderOpen}
              accentClass="bg-slate-400"
              iconClassName="bg-slate-100 text-slate-600 ring-slate-200/80"
            />
            <MetricCard
              label="In Progress Projects"
              value={projectMetrics.inProgress}
              icon={ArrowUpRight}
              accentClass="bg-emerald-600"
              iconClassName="bg-emerald-50 text-emerald-700 ring-emerald-200/60"
            />
            <MetricCard
              label="Completed Projects"
              value={projectMetrics.completed}
              icon={CheckCircle2}
              accentClass="bg-teal-500"
              iconClassName="bg-teal-50 text-teal-700 ring-teal-200/60"
            />
          </div>

          {/* Search & filters toolbar */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 sm:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects, clients, tech nodes…"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all ${
                    showFilters || activeFiltersCount > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-xs font-semibold text-slate-500 tabular-nums">
                  <span className="font-bold text-slate-800">{filteredProjects.length}</span>
                  <span className="text-slate-400"> / {projects.length}</span>
                </p>

                <div className="flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`rounded-md p-2 transition-all ${
                      viewMode === 'grid'
                        ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/80'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="Grid layout"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`rounded-md p-2 transition-all ${
                      viewMode === 'list'
                        ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200/80'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    title="List layout"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {showFilters && (
              <div className="mt-3 border-t border-slate-100 pt-3 animate-fadeIn">
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                  <FilterCheckboxGroup
                    label="Client Name"
                    placeholder="All Clients"
                    compact
                    options={uniqueClients.map((c) => ({ value: c, label: c }))}
                    selected={filterClients}
                    onChange={setFilterClients}
                  />

                  <FilterCheckboxGroup
                    label="Employee"
                    placeholder="All Employees"
                    compact
                    options={uniqueEmployees.map((emp) => ({ value: emp, label: emp }))}
                    selected={filterEmployees}
                    onChange={setFilterEmployees}
                  />

                  <FilterCheckboxGroup
                    label="Project Status"
                    placeholder="All Statuses"
                    compact
                    options={[
                      { value: 'Active', label: 'In Progress' },
                      { value: 'Completed', label: 'Completed' },
                      { value: 'Cancelled', label: 'Cancelled' },
                    ]}
                    selected={filterStatuses}
                    onChange={setFilterStatuses}
                  />

                  <FilterCheckboxGroup
                    label="Access Control"
                    placeholder="All Access"
                    compact
                    options={[
                      { value: 'public', label: 'Public' },
                      { value: 'private', label: 'Private' },
                    ]}
                    selected={filterAccessTypes}
                    onChange={setFilterAccessTypes}
                  />


                </div>

                {activeFiltersCount > 0 && (
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <p className="text-xs font-semibold text-slate-500">
                      {activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'} active
                    </p>
                    <button
                      onClick={clearProjectsFilters}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Projects View Render */}
          {viewMode === 'grid' ? (
            <>
              {filteredProjects.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {currentProjects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onEdit={() => openEditProject(p)}
                      onDelete={() => handleDeleteProject(p)}

                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  message="No projects correspond to your search criteria."
                  onClear={clearProjectsFilters}
                  hasFilters={activeFiltersCount > 0 || !!searchQuery}
                />
              )}
            </>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Project Details
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Client
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Technology Node
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Access Control
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Visibility Scope
                      </th>
                      <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {currentProjects.map((p) => (
                      <ProjectListRow
                        key={p.id}
                        project={p}
                        onEdit={() => openEditProject(p)}
                        onDelete={() => handleDeleteProject(p)}

                      />
                    ))}
                    {filteredProjects.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-400 font-medium">
                          No projects matched the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Projects Pagination Controls */}
          {totalProjectsPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-500">
                Showing {indexOfFirstProject + 1}–{Math.min(indexOfLastProject, filteredProjects.length)} of {filteredProjects.length} projects
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={projectsCurrentPage === 1}
                  onClick={() => setProjectsCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  Previous
                </button>
                {Array.from({ length: totalProjectsPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setProjectsCurrentPage(page)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition-all ${
                      projectsCurrentPage === page
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/10'
                        : 'border border-slate-250 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={projectsCurrentPage === totalProjectsPages}
                  onClick={() => setProjectsCurrentPage((p) => Math.min(totalProjectsPages, p + 1))}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
           TAB 2 – TIMESHEETS (Manage Timesheets / Review Time Logs)
           ================================================================ */}
      {activeTab === 'timesheets' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Timesheets filter toolbar */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-2 xl:grid-cols-[minmax(11rem,1.4fr)_auto_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(7.5rem,0.9fr)_auto]">
                <div className="relative min-w-0 md:col-span-2 xl:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tsSearch}
                    onChange={(e) => setTsSearch(e.target.value)}
                    placeholder="Search employees, projects…"
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-8 text-sm font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                  />
                  {tsSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => setTsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="shrink-0">
                  <CustomDateRangePicker
                    startDate={tsStartDate}
                    endDate={tsEndDate}
                    preset={datePreset}
                    onChange={handleDateRangeChange}
                  />
                </div>

                <div className="h-9 min-w-0">
                  <FilterCheckboxGroup
                    label="Employee"
                    placeholder="All Employees"
                    compact
                    options={tsEmployeeFilterOptions}
                    selected={tsEmployeeFilters}
                    onChange={setTsEmployeeFilters}
                  />
                </div>

                <div className="h-9 min-w-0">
                  <FilterCheckboxGroup
                    label="Project"
                    placeholder="All Projects"
                    compact
                    options={tsProjectFilterOptions}
                    selected={tsProjectFilters}
                    onChange={setTsProjectFilters}
                  />
                </div>

                <div className="h-9 min-w-0">
                  <FilterCheckboxGroup
                    label="Status"
                    placeholder="All Statuses"
                    compact
                    options={tsStatusFilterOptions}
                    selected={tsStatusFilters}
                    onChange={setTsStatusFilters}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 xl:justify-end">
                  <span className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-xs font-semibold tabular-nums text-slate-600">
                    <span className="font-bold text-slate-800">{filteredTimesheets.length}</span>
                    <span className="ml-1 text-slate-400">logs</span>
                  </span>
                  {hasActiveTimesheetFilters && (
                    <button
                      type="button"
                      onClick={clearTimesheetFilters}
                      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      title="Reset filters"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {hasActiveTimesheetFilters && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Active</span>

                {tsSearch.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                    Search: &quot;{tsSearch}&quot;
                    <button
                      type="button"
                      onClick={() => setTsSearch('')}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}

                {tsEmployeeFilters.map((empName) => (
                  <span
                    key={empName}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50/80 px-2 py-1 text-xs font-semibold text-emerald-900"
                  >
                    {empName}
                    <button
                      type="button"
                      onClick={() => setTsEmployeeFilters(tsEmployeeFilters.filter((name) => name !== empName))}
                      className="text-emerald-600/70 hover:text-emerald-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {tsProjectFilters.map((proj) => (
                  <span
                    key={proj}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    {proj}
                    <button
                      type="button"
                      onClick={() => setTsProjectFilters(tsProjectFilters.filter((p) => p !== proj))}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {tsStatusFilters.map((status) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50/80 px-2 py-1 text-xs font-semibold text-blue-900"
                  >
                    {status}
                    <button
                      type="button"
                      onClick={() => setTsStatusFilters(tsStatusFilters.filter((s) => s !== status))}
                      className="text-blue-600/70 hover:text-blue-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={clearTimesheetFilters}
                  className="ml-auto text-xs font-bold text-emerald-600 hover:text-emerald-800"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Analytics panels */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  <span className="h-3.5 w-1 shrink-0 rounded-full bg-emerald-500" />
                  Aggregated Hours by Project
                </h3>
                {derivedHoursByProject.length > 0 && (
                  <span className="text-xs font-bold tabular-nums text-slate-500">
                    {derivedHoursByProject.length} project{derivedHoursByProject.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {derivedHoursByProject.length > 0 ? (
                <div className="timesheet-panel-scroll h-60 overflow-auto pr-0.5 sm:h-64">
                  <ProjectHoursHoverCardProvider>
                    <div
                      className={
                        derivedHoursByProject.length > 9
                          ? 'grid w-max min-w-full gap-2 p-0.5'
                          : 'grid w-full grid-cols-2 gap-2 sm:grid-cols-3'
                      }
                      style={
                        derivedHoursByProject.length > 9
                          ? {
                              gridTemplateRows: 'repeat(3, minmax(4.25rem, auto))',
                              gridAutoFlow: 'column',
                              gridAutoColumns: 'minmax(7.25rem, 8.5rem)',
                            }
                          : undefined
                      }
                    >
                      {(() => {
                        const totalHours = derivedHoursByProject.reduce((sum, p) => sum + p.hours, 0)
                        const averageHours =
                          derivedHoursByProject.length > 0 ? totalHours / derivedHoursByProject.length : 0

                        return derivedHoursByProject.map((project) => {
                          const isGreaterThanAverage = project.hours > averageHours
                          const percentage =
                            totalHours > 0 ? ((project.hours / totalHours) * 100).toFixed(2) : '0.00'
                          const cardBg = isGreaterThanAverage ? 'bg-[#4aaf7d]' : 'bg-[#f16c6f]'
                          const foundProject = allProjects.find((p) => p.name === project.name)

                          return (
                            <ProjectHoursHoverCard
                              key={project.name}
                              projectName={project.name}
                              hours={project.hours}
                              percentage={percentage}
                              isGreaterThanAverage={isGreaterThanAverage}
                              cardBg={cardBg}
                              client={foundProject?.client}
                              technologyNode={foundProject?.technologyNode}
                              accessType={foundProject?.accessType}
                              onCardClick={() => {
                                if (project.projectId) {
                                  openAuditTrail(project.projectId, project.name)
                                } else if (foundProject) {
                                  openAuditTrail(foundProject.id, foundProject.name)
                                } else {
                                  openAuditTrail('', project.name)
                                }
                              }}
                            />
                          )
                        })
                      })()}
                    </div>
                  </ProjectHoursHoverCardProvider>
                </div>
              ) : (
                <div className="flex h-60 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/40 text-sm font-semibold text-slate-500 sm:h-64">
                  No data logs available in the chosen dates.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  <span className="h-3.5 w-1 shrink-0 rounded-full bg-emerald-500" />
                  Aggregated Hours by Employee
                </h3>
                {derivedLeaderboardData.length > 0 && (
                  <span className="text-xs font-bold tabular-nums text-slate-500">
                    {derivedLeaderboardData.length} employee{derivedLeaderboardData.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="timesheet-panel-scroll max-h-[15.75rem] overflow-y-auto pr-0.5">
                <EmployeeLeaderboard data={derivedLeaderboardData} />
              </div>
            </div>
          </div>

          {/* Timesheet log table */}
          <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="max-h-[min(32rem,70vh)] overflow-auto timesheet-panel-scroll">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
                    <th className="px-5 py-3">Employee</th>
                    <th className="px-5 py-3">Project</th>
                    <th className="px-5 py-3">Login Time</th>
                    <th className="px-5 py-3">Logout Time</th>
                    <th className="px-5 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {currentTimesheets.map((t) => {
                    const empInfo = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId)
                    const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours)

                    return (
                      <tr
                        key={t.id}
                        className="group transition-colors hover:bg-emerald-50/35"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={t.employeeName}
                              size="sm"
                              color={empInfo ? `hsl(${empInfo.hue},55%,45%)` : '#10b981'}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-slate-800 leading-tight">
                                {t.employeeName}
                              </p>
                              <p className="text-[11px] font-semibold text-slate-500 font-mono">
                                {t.employeeId}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (t.projectId) {
                                openAuditTrail(t.projectId, t.project)
                              } else {
                                const found = allProjects.find((p) => p.name === t.project)
                                if (found) {
                                  openAuditTrail(found.id, found.name)
                                } else {
                                  toast.error(`Could not find project: ${t.project}`)
                                }
                              }
                            }}
                            className="group/btn block max-w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 rounded-md"
                          >
                            <p className="flex items-center gap-1 font-bold text-slate-800 transition-colors group-hover/btn:text-emerald-700">
                              <span className="truncate">{t.project}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 text-emerald-500 transition-all group-hover/btn:opacity-100" />
                            </p>
                          </button>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <p className="font-semibold text-slate-700">{formatDateTime(t.loginTime)}</p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <p className="font-semibold text-slate-700">
                            {t.logoutTime ? formatDateTime(t.logoutTime) : '—'}
                          </p>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-extrabold tabular-nums text-slate-900">
                            {(() => {
                              if (hours === null) return '—'
                              const totalMinutes = Math.round(hours * 60)
                              const hrs = Math.floor(totalMinutes / 60)
                              const mins = totalMinutes % 60
                              return `${hrs}h ${mins}m`
                            })()}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredTimesheets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm font-semibold text-slate-500">
                        No individual logs correspond to selected range and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalTimesheetsPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-500">
                Showing {indexOfFirstTimesheet + 1}–{Math.min(indexOfLastTimesheet, filteredTimesheets.length)} of {filteredTimesheets.length} logs
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={timesheetsCurrentPage === 1}
                  onClick={() => setTimesheetsCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  Previous
                </button>
                {Array.from({ length: totalTimesheetsPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setTimesheetsCurrentPage(page)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition-all ${
                      timesheetsCurrentPage === page
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/10'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={timesheetsCurrentPage === totalTimesheetsPages}
                  onClick={() => setTimesheetsCurrentPage((p) => Math.min(totalTimesheetsPages, p + 1))}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
           MODALS (Forms)
           ================================================================ */}

      {/* ── CREATE / EDIT PROJECT MODAL ────────────────────── */}
      <Modal
        isOpen={modalOpen}
        title={modalMode === 'create' ? 'Create New Project' : 'Edit Project Details'}
        onClose={() => setModalOpen(false)}
        size="lg"
      >
        <form onSubmit={handleSaveProject} className="space-y-4 pt-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Project Name"
              placeholder="e.g. Project Apollo"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Client Name"
              placeholder="e.g. Globex Electronics"
              value={form.client}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, client: e.target.value })}
              required
            />
          </div>

          <div className="w-full">
            <Input
              label="Technology Node"
              placeholder="e.g. 7nm FinFET, 28nm FD-SOI"
              value={form.technologyNode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, technologyNode: e.target.value })}
              required
            />
          </div>

          <SelectField
            label="Access Control Configuration"
            id="m-proj-access"
            value={form.accessType}
            onChange={(e) => {
              const accessType = e.target.value as 'public' | 'private'
              setForm({
                ...form,
                accessType,
                visibleUsers: accessType === 'private' ? form.visibleUsers : [],
              })
            }}
            options={[
              { value: 'public', label: 'Public — Visible system-wide to all employees' },
              { value: 'private', label: 'Private — Access restricted specifically by user/team' },
            ]}
          />

          {/* Team Lead Selection - Always Available */}
          <SelectField
            label="Team Lead"
            id="m-proj-team-lead"
            value={form.teamLead}
            onChange={(e) => setForm({ ...form, teamLead: e.target.value })}
            options={[
              { value: '', label: 'Select team lead...' },
              ...employees.map((e) => ({
                value: `${e.firstName} ${e.lastName || ''}`.trim(),
                label: `${e.firstName} ${e.lastName || ''}`.trim() + ` (${e.department})`,
              })),
            ]}
          />

          {/* Conditional private security rules */}
          {form.accessType === 'private' && (
            <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 animate-fadeIn">
              <CheckboxList
                label="Allowed Users"
                items={employees.map((e) => `${e.firstName} ${e.lastName || ''}`.trim())}
                selected={form.visibleUsers}
                onChange={(next) => setForm({ ...form, visibleUsers: next })}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Project Description scope
            </label>
            <textarea
              placeholder="Provide a detailed scope of this project, goals, and standard specifications..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: enforceMaxWords(e.target.value) })
              }
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              required
            />
            <p
              className={`mt-1 text-right text-[11px] font-semibold ${
                countWords(form.description) >= MAX_PROJECT_DESCRIPTION_WORDS
                  ? 'text-amber-600'
                  : 'text-slate-400'
              }`}
            >
              {countWords(form.description)} / {MAX_PROJECT_DESCRIPTION_WORDS} words
            </p>
          </div>

          {modalMode === 'edit' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Project Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Completed' | 'Cancelled' })}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-700 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              >
                <option value="Active">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={loading}
              className="rounded-xl font-bold py-2 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-2 px-4 border-0"
            >
              {modalMode === 'create' ? 'Create Project' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>



      {/* Project Audit Trail Modal */}
      {selectedAuditProjectId && (
        <ProjectAuditTrailModal
          isOpen={auditTrailModalOpen}
          onClose={() => {
            setAuditTrailModalOpen(false)
            setSelectedAuditProjectId(null)
            setSelectedAuditProjectName('')
          }}
          projectId={selectedAuditProjectId}
          projectName={selectedAuditProjectName}
        />
      )}

      {/* Project Archive Confirmation Modal */}
      {projectToDelete && (
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          title="Archive Project"
          description={`Are you sure you want to archive the project "${projectToDelete.name}"? All associated history will be safely archived and this action cannot be undone.`}
          confirmLabel="Archive Project"
          danger
          onClose={() => {
            setDeleteConfirmOpen(false)
            setProjectToDelete(null)
          }}
          onConfirm={handleConfirmArchive}
        />
      )}

      {/* Archived Projects Browser Modal */}
      <ArchivedProjectsModal
        isOpen={archivedModalOpen}
        onClose={() => setArchivedModalOpen(false)}
        onRefreshActiveProjects={refreshAllData}
      />
    </PageWrapper>
  )
}

/* ================================================================
   COMPONENT – Empty State
   ================================================================ */
function EmptyState({
  message,
  onClear,
  hasFilters,
}: {
  message: string
  onClear: () => void
  hasFilters: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-12 px-6">
      <FolderOpen className="mb-3 h-10 w-10 text-slate-300" />
      <p className="text-center text-sm font-semibold text-slate-600">{message}</p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-3 text-xs font-extrabold text-emerald-600 hover:text-emerald-800 transition-colors bg-emerald-50 hover:bg-emerald-100/70 py-2 px-4 rounded-xl border border-emerald-200/45 shadow-sm"
        >
          Reset Applied Filters
        </button>
      )}
    </div>
  )
}

/* ================================================================
   COMPONENT – ProjectArchiveConfirmModal
   ================================================================ */
interface ProjectArchiveConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  onConfirm: () => void
}

// @ts-expect-error Reserved component — not yet wired into the UI
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ProjectArchiveConfirmModal = function ProjectArchiveConfirmModal({
  isOpen,
  onClose,
  projectName,
  onConfirm,
}: ProjectArchiveConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} title="" onClose={onClose} size="md">
      {/* Sleek icon header */}
      <div className="-mt-10 mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-md">
          <Archive className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-sm font-black text-slate-800 leading-tight">Archive Project</h3>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-slate-550 text-slate-500 font-bold leading-relaxed">
          Are you sure you want to archive project <strong className="text-slate-800 font-extrabold">"{projectName}"</strong>?
        </p>
        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
          This will safely move the project and its complete history (assigned tasks and timesheet logs) to separate archived storage. Active dashboards stay clean. You can restore the project at any time.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="rounded-xl font-bold py-2 px-4 text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl py-2 px-4 text-xs h-9 border-0 shadow-sm"
          >
            Archive Project
          </Button>
        </div>
      </div>
    </Modal>
  )
}
