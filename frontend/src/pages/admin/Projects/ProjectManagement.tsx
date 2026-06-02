import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
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
import {
  countWords,
  enforceMaxWords,
  MAX_PROJECT_DESCRIPTION_WORDS,
} from '@/lib/textLimits'
import { stringToHue, stringToHueColor } from '@/utils/stringColor'
import {
  Clock,
  Search,
  X,
  Archive,
  FileDown,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Plus,
  Lock,
  Globe,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FolderOpen,
  CheckCircle2,
  SlidersHorizontal,
  ArrowUpRight,
  Edit2,
} from 'lucide-react'
import { formatDate } from '@/utils/formatDate'
import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  downloadExcelBuffer,
  fetchExportLogo,
  scaleExportLogo,
} from '@/utils/exportLogo'
import api from '@/services/api'
import { getEmployees } from '@/services/employeeService'
import type { Employee } from '@/types'
import { cn } from '@/utils/cn'
import {
  ProjectHoursHoverCard,
  ProjectHoursHoverCardProvider,
} from '@components/projects/ProjectHoursHoverCard'

/* ================================================================
   TYPE DEFINITIONS
   ================================================================ */
interface Project {
  id: string
  name: string
  client: string
  technologyNode: string
  accessType: 'public' | 'private'
  status: 'Active' | 'Completed' | 'Rejected' | 'Cancelled'
  description: string
  visibleUsers: string[]
  teamLead?: string
  completedTasks?: number
  totalTasks?: number
  completionPercentage?: number
}

interface TimesheetLog {
  id: string
  employeeId: string
  employeeName: string
  projectId?: string
  project: string
  client: string
  technologyNode: string
  date: string // YYYY-MM-DD
  loginTime: string // ISO string
  logoutTime?: string // ISO string
  correctionRequest?: {
    requestedLogin: string
    requestedLogout: string
    reason: string
    message: string
  }
  requestStatus: 'No Request' | 'Pending Review' | 'Corrected' | 'Approved' | 'Rejected'
  status: 'Approved' | 'Pending' | 'Rejected'
  billable: boolean
  task: string
  adminNotes?: string
  overriddenHours?: number
  taskStatus?: 'Pending' | 'In Progress' | 'Completed' | 'Session Incomplete'
  totalHours?: number
  totalPausedMs?: number
  autoCheckedOut?: boolean
}

/* ================================================================
   MOCK DATA
   ================================================================ */
const MOCK_EMPLOYEES = [
  { id: 'E-1001', name: 'Asha Menon', team: 'Design', hue: 155 },
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
const calculateHours = (
  login: string,
  logout?: string,
  overriddenHours?: number,
  totalHours?: number,
  totalPausedMs?: number
): number | null => {
  if (overriddenHours !== undefined && overriddenHours !== null) return overriddenHours
  if (totalHours !== undefined && totalHours !== null && totalHours > 0) return totalHours
  if (!logout) return null
  const loginDate = new Date(login)
  const logoutDate = new Date(logout)
  if (isNaN(loginDate.getTime()) || isNaN(logoutDate.getTime())) return 0
  const diffMs = logoutDate.getTime() - loginDate.getTime() - (totalPausedMs || 0)
  if (diffMs <= 0) return 0
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
}

function formatAdminDuration(hours: number | null): string {
  if (hours === null) return '—'
  const totalMinutes = Math.round(hours * 60)
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hrs === 0 && mins === 0) return '0m'
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${String(mins).padStart(2, '0')}m`
}

/** Hours-by-project and employee leaderboard from filtered logs (export/PDF). */
function buildTimesheetExportAnalytics(logs: TimesheetLog[]) {
  const byProject: Record<string, number> = {}
  const byEmployee: Record<string, { name: string; dept: string; hours: number }> = {}

  logs.forEach((t) => {
    const hours = calculateHours(
      t.loginTime,
      t.logoutTime,
      t.overriddenHours,
      t.totalHours,
      t.totalPausedMs
    ) || 0
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

function formatExcelDuration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—'
  const totalMinutes = Math.round(hours * 60)
  if (totalMinutes <= 0) return '—'
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hrs === 0) {
    return `${mins}m`
  }
  return `${hrs}h ${String(mins).padStart(2, '0')}m`
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
  variant = 'default',
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accentClass: string
  iconClassName: string
  secondaryText?: string
  variant?: 'default' | 'hero'
}) {
  if (variant === 'hero') {
    return (
      <div className="projects-metric-glass group">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="projects-metric-label">{label}</p>
            <p className="projects-metric-value font-display">{value}</p>
            {secondaryText ? <p className="projects-metric-sub">{secondaryText}</p> : null}
          </div>
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20 ${iconClassName}`}
          >
            <Icon className="h-3 w-3 text-white" strokeWidth={2} />
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="metric-card group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5">
      <div className={`absolute inset-x-0 top-0 h-[2px] ${accentClass} opacity-80`} />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-800">{label}</p>
          <p className="metric-value mt-2 font-display text-2xl font-bold tabular-nums leading-none tracking-tight">
            {value}
          </p>
          {secondaryText && (
            <p className="mt-2 text-[11px] font-semibold text-slate-700">{secondaryText}</p>
          )}
        </div>
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-inset transition-all duration-300 group-hover:scale-105 group-hover:shadow-md ${iconClassName}`}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(startDate || new Date().toISOString().split('T')[0]))
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
      setCurrentMonth(new Date(startDate || new Date().toISOString().split('T')[0]))
    }
  }, [open, startDate, endDate])

  const getPresetDates = (selectedPreset: string): { start: string; end: string } => {
    const today = new Date() // Use actual current date
    let start = new Date()
    let end = new Date()

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
        className="projects-date-trigger inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold text-[var(--emerald-dark)] shadow-sm transition-colors whitespace-nowrap"
      >
        <CalendarIcon className="h-3.5 w-3.5 text-[var(--emerald-dark)] flex-shrink-0" />
        <span className="truncate max-w-xs text-xs leading-tight">
          {preset === 'Custom' && startDate === endDate
            ? `${formatDate(startDate)}`
            : preset === 'Custom'
              ? `${formatDate(startDate)} – ${formatDate(endDate)}`
              : `${preset} (${formatDate(startDate)} – ${formatDate(endDate)})`}
        </span>
        <ChevronDown className="h-3 w-3 text-[var(--emerald-dark)]/70 flex-shrink-0" />
      </button>

      {open && (
        <div className="projects-date-calendar date-range-popover absolute left-0 top-full z-50 mt-2 flex w-[92vw] flex-col gap-3 rounded-2xl p-3 shadow-2xl animate-fadeIn sm:w-auto sm:min-w-[500px] md:flex-row md:p-4">
          {/* Calendar Grid */}
          <div className="flex-1 select-none">
            <div className="projects-date-calendar-header flex items-center justify-between mb-3 rounded-lg px-2 py-1.5">
              <button type="button" onClick={handlePrevMonth} className="projects-date-nav-btn p-1 rounded-md">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="date-range-month-title type-calendar-month">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button" onClick={handleNextMonth} className="projects-date-nav-btn p-1 rounded-md">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="projects-date-weekdays type-calendar-weekday mb-1.5 grid grid-cols-7 gap-1 text-center">
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
                      projects-date-day h-7 w-7 rounded-lg flex items-center justify-center font-semibold transition-all
                      ${cell.isCurrentMonth ? 'projects-date-day-current' : 'projects-date-day-muted'}
                      ${isSingleDay || isSelectedStart || isSelectedEnd ? 'projects-date-day-selected' : ''}
                      ${isWithinRange ? 'projects-date-day-in-range' : ''}
                    `}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>
            <p className="projects-date-hint mt-2.5 text-[10px] font-medium">
              Click any date to filter that day. Hold Shift, click a start date, then another date for a custom range.
            </p>
          </div>

          {/* Divider */}
          <div className="projects-date-divider hidden md:block" />

          {/* Quick Presets Panel */}
          <div className="projects-date-presets w-36 flex flex-col gap-0.5">
            <p className="type-card-label-caps mb-2 text-[9px]">Quick Presets</p>
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
                  projects-date-preset text-left px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                  ${preset === p ? 'projects-date-preset-active' : ''}
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-[rgba(39,39,42,0.88)] bg-[rgba(39,39,42,0.88)] text-[10px] font-bold shadow-sm ring-1 ring-[rgba(161,161,170,0.18)]"
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
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-[rgba(39,39,42,0.88)] bg-[rgba(39,39,42,0.88)] text-[10px] font-black text-slate-600 shadow-sm ring-1 ring-[rgba(161,161,170,0.18)]">
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
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-600">
          {label}
        </span>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border bg-[var(--bg-card)] px-2.5 text-left text-xs font-bold outline-none transition-all ${
          open || selected.length > 0
            ? 'border-[rgba(38,107,28,0.35)] text-ink ring-4 ring-[rgba(38,107,28,0.12)]'
            : 'border-border text-slate-700 hover:border-white/20'
        }`}
      >
        <span className="truncate text-xs">{summary}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-700 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-[var(--bg-card)] p-2 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-border pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">{label}</span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onChange(options.map((o) => o.value))}
                className="text-[10px] font-bold text-[var(--emerald-dark)] hover:text-[var(--green-600)]"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-bold text-slate-700 hover:text-ink"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-48 space-y-0.5 overflow-y-auto pr-0.5">
            {options.length === 0 ? (
              <p className="px-2 py-2 text-xs font-semibold text-slate-700">No options</p>
            ) : (
              options.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink transition-colors hover:bg-emerald-50/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-border bg-[var(--bg-input)] accent-[var(--emerald-dark)]"
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
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-450">
        {label}
      </label>
      <div className="rounded-xl border border-border bg-[var(--bg-input)] p-2 max-h-32 overflow-y-auto space-y-0.5">
        {items.map((item) => (
          <label
            key={item}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-ink transition-colors hover:bg-emerald-50/50 border border-transparent hover:border-border"
          >
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => toggle(item)}
              className="h-3.5 w-3.5 rounded border-border bg-[var(--bg-input)] accent-[var(--emerald-dark)]"
            />
            <span className="font-semibold">{item}</span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-600 font-bold">
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

  const leadName = project.teamLead || 'Not assigned'
  const memberCount = project.visibleUsers.length
  const maxVisibleNames = 3
  const visibleNames = project.visibleUsers.slice(0, maxVisibleNames)
  const remainingCount = memberCount - maxVisibleNames

  const membersText = memberCount > 0 
    ? visibleNames.join(' • ') + (remainingCount > 0 ? ` • +${remainingCount} more` : '')
    : (project.accessType === 'public' ? 'All Members' : 'None assigned')

  const projectInitial =
    project.name.charAt(project.name.indexOf(' ') + 1) || project.name.charAt(0)

  return (
    <div
      className={cn(
        'projects-card group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-500/10 bg-white/70 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-500/20 hover:shadow-emerald-500/5 animate-fadeIn',
        isCompleted && 'border-emerald-500/20 bg-emerald-50/40',
      )}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-500/80 to-teal-500/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="flex flex-col h-full justify-between space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold bg-gradient-to-br from-emerald-50 to-emerald-100/80 text-[var(--emerald-dark)] shadow-inner border border-emerald-500/10">
              {projectInitial}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className={cn(
                'text-[15px] font-bold leading-snug transition-colors font-display truncate text-slate-800',
                isCompleted ? 'text-[var(--emerald-dark)] group-hover:text-[var(--green-600)]' : 'group-hover:text-[var(--emerald-dark)]'
              )}>
                {project.name}
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-slate-400 truncate">
                {project.client}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isCancelled ? (
              <span className="inline-flex items-center rounded-md border border-rose-500/15 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-550">
                Cancelled
              </span>
            ) : isRejected ? (
              <span className="inline-flex items-center rounded-md border border-rose-500/15 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-550">
                Rejected
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center rounded-md border border-emerald-500/15 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md border border-blue-500/15 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-650">
                In Progress
              </span>
            )}
            {project.accessType === 'private' ? (
              <span className="inline-flex items-center rounded-md border border-amber-500/15 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
                Private
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md border border-sky-500/15 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-650">
                Public
              </span>
            )}
          </div>
        </div>

        {project.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}

        <div className="project-members-section space-y-1.5 border-t border-slate-100 pt-3.5">
          <div className="flex items-center text-xs">
            <span className="font-semibold text-slate-400 w-16 shrink-0">Lead:</span>
            <span className="font-bold text-slate-700 truncate">{leadName}</span>
          </div>
          <div className="flex items-baseline text-xs">
            <span className="font-semibold text-slate-400 w-16 shrink-0">Members:</span>
            <span className="font-medium text-slate-600 leading-normal truncate flex-1">
              {membersText}
              {memberCount > 0 && (
                <span className="ml-1 text-[10px] text-slate-400 font-bold">({memberCount})</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3.5 mt-auto">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-500/10 bg-emerald-50/20 px-2.5 py-0.5 text-[10px] font-bold text-[var(--emerald-dark)] shadow-sm">
              <Cpu className="h-3 w-3 shrink-0" strokeWidth={2.5} />
              <span className="truncate font-mono">{project.technologyNode}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-emerald-50 hover:text-[var(--emerald-dark)]"
              title="Edit Project"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-rose-50 hover:text-rose-500"
              title="Archive Project"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
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
    <tr className={cn('group transition-colors border-b border-border hover:bg-emerald-50/50', isCompleted ? 'bg-emerald-50/60' : '')}>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--emerald-surface)] text-sm font-extrabold text-[var(--emerald-dark)] ring-1 ring-[rgba(38,107,28,0.22)]">
            {projectInitial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink group-hover:text-[var(--emerald-dark)]">{project.name}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-slate-800">{project.client}</td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--bg-input)] px-2.5 py-1 text-[11px] font-bold text-slate-800 font-mono">
          <Cpu className="h-3.5 w-3.5 text-[var(--emerald-dark)]" />
          {project.technologyNode}
        </span>
      </td>
      <td className="px-5 py-4">
        {project.accessType === 'private' ? (
          <Badge variant="warning" className="border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-400">
            <Lock className="mr-1 h-3.5 w-3.5 text-amber-500" /> Private
          </Badge>
        ) : (
          <Badge variant="info" className="border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-400">
            <Globe className="mr-1 h-3.5 w-3.5 text-sky-500" /> Public
          </Badge>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-455 w-14">Lead:</span>
            <span className="font-bold text-slate-700 truncate max-w-[150px]">{project.teamLead || 'Not assigned'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="font-semibold text-slate-455 w-14">Members:</span>
            <span className="truncate max-w-[200px]" title={project.visibleUsers.join(' • ')}>
              {project.visibleUsers.length > 0 
                ? project.visibleUsers.slice(0, 2).join(' • ') + (project.visibleUsers.length > 2 ? ` • +${project.visibleUsers.length - 2} more` : '')
                : (project.accessType === 'public' ? 'All Members' : 'None')
              }
              {project.visibleUsers.length > 0 && ` (${project.visibleUsers.length})`}
            </span>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        {isCancelled ? (
          <Badge variant="neutral" className="border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-400">
            <X className="mr-1 h-3.5 w-3.5 text-rose-400" /> Cancelled
          </Badge>
        ) : isRejected ? (
          <Badge variant="neutral" className="border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-400">
            <X className="mr-1 h-3.5 w-3.5 text-rose-400" /> Rejected
          </Badge>
        ) : isCompleted ? (
          <Badge variant="success" className="border border-[rgba(38,107,28,0.22)] bg-[var(--emerald-surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--emerald-dark)]">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Completed
          </Badge>
        ) : (
          <Badge variant="info" className="border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-400">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-500" />
            In Progress
          </Badge>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-emerald-50/50 hover:text-ink"
            title="Edit Project"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-amber-500/10 hover:text-amber-400"
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
            className="group rounded-lg border border-transparent px-2 py-2 transition-all hover:border-border hover:bg-emerald-50/50"
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={item.name} size="sm" color={`hsl(${hue},55%,45%)`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-ink group-hover:text-[var(--emerald-dark)] font-display">
                    {item.name}
                  </p>
                  <span className="type-metric-inline shrink-0 text-ink">
                    {item.hours.toFixed(1)}
                    <span className="text-[10px] ml-0.5 font-semibold text-slate-450">h</span>
                  </span>
                </div>
                <div className="mt-1.5 h-[7px] w-full overflow-hidden rounded-full bg-surface/80 ring-1 ring-border">
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
        <p className="py-10 text-center text-sm font-semibold text-slate-600">
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
  const [isAnimated, setIsAnimated] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 200)
    return () => clearTimeout(timer)
  }, [])
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
  const [archivedCount, setArchivedCount] = useState(0)

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
  // FIXED: Initialize with current month instead of hardcoded May dates
  const getCurrentMonthDates = () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    }
  }
  
  const initialDates = getCurrentMonthDates()
  const [datePreset, setDatePreset] = useState<string>('This Month')
  const [tsStartDate, setTsStartDate] = useState(initialDates.start)
  const [tsEndDate, setTsEndDate] = useState(initialDates.end)

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

  const fetchArchivedCount = useCallback(async () => {
    try {
      const res = await api.get('/projects/archived')
      setArchivedCount(res.data.length)
    } catch (err) {
      console.error(err)
      // Silently fail for count - not critical
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
    await Promise.all([fetchProjects(), fetchTimesheetsData(), fetchArchivedCount()])
  }, [fetchProjects, fetchTimesheetsData, fetchArchivedCount])

  useEffect(() => {
    fetchProjects()
    fetchEmployees()
    fetchArchivedCount()
  }, [fetchProjects, fetchEmployees, fetchArchivedCount])

  useEffect(() => {
    fetchTimesheetsData()
  }, [fetchTimesheetsData])

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

  // Track previous filters to only reset page when they actually change
  const prevFiltersRef = useRef({
    searchQuery,
    filterClients,
    filterEmployees,
    filterStatuses,
    filterAccessTypes
  })

  // Reset projects page to 1 when filters or search query change
  useEffect(() => {
    const prev = prevFiltersRef.current
    const filtersChanged =
      prev.searchQuery !== searchQuery ||
      JSON.stringify(prev.filterClients) !== JSON.stringify(filterClients) ||
      JSON.stringify(prev.filterEmployees) !== JSON.stringify(filterEmployees) ||
      JSON.stringify(prev.filterStatuses) !== JSON.stringify(filterStatuses) ||
      JSON.stringify(prev.filterAccessTypes) !== JSON.stringify(filterAccessTypes)

    if (filtersChanged) {
      setProjectsCurrentPage(1)
      prevFiltersRef.current = {
        searchQuery,
        filterClients,
        filterEmployees,
        filterStatuses,
        filterAccessTypes
      }
    }
  }, [searchQuery, filterClients, filterEmployees, filterStatuses, filterAccessTypes])

  // ── Projects Tab Metrics Calculation ─────────────────────────
  const projectMetrics = useMemo(() => {
    return {
      total: projects.length,
      inProgress: projects.filter((p) => p.status === 'Active').length,
      completed: projects.filter((p) => p.status === 'Completed').length,
      cancelled: projects.filter((p) => p.status === 'Cancelled').length,
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
          await api.post('/projects', {
            name: form.name.trim(),
            client: form.client.trim(),
            technologyNode: form.technologyNode.trim(),
            accessType: form.accessType,
            description: form.description.trim(),
            visibleUsers: form.accessType === 'private' ? form.visibleUsers : [],
            teamLead: form.teamLead.trim() || undefined,
          })
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
      const hours = calculateHours(
        t.loginTime,
        t.logoutTime,
        t.overriddenHours,
        t.totalHours,
        t.totalPausedMs
      ) || 0
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
      const hours = calculateHours(
        t.loginTime,
        t.logoutTime,
        t.overriddenHours,
        t.totalHours,
        t.totalPausedMs
      ) || 0
      const empInfo = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId)
      const employeeColorKey = t.employeeId || t.employeeName
      if (empMap[t.employeeName]) {
        empMap[t.employeeName].hours += hours
      } else {
        empMap[t.employeeName] = {
          name: t.employeeName,
          dept: empInfo?.team ?? '—',
          hours,
          hue: empInfo?.hue ?? stringToHue(employeeColorKey),
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

  // Track previous timesheets filters to only reset page when they actually change
  const prevTsFiltersRef = useRef({
    tsSearch,
    tsStartDate,
    tsEndDate,
    tsEmployeeFilters,
    tsProjectFilters,
    tsStatusFilters
  })

  // Reset timesheets page to 1 when filters or search query change
  useEffect(() => {
    const prev = prevTsFiltersRef.current
    const filtersChanged =
      prev.tsSearch !== tsSearch ||
      prev.tsStartDate !== tsStartDate ||
      prev.tsEndDate !== tsEndDate ||
      JSON.stringify(prev.tsEmployeeFilters) !== JSON.stringify(tsEmployeeFilters) ||
      JSON.stringify(prev.tsProjectFilters) !== JSON.stringify(tsProjectFilters) ||
      JSON.stringify(prev.tsStatusFilters) !== JSON.stringify(tsStatusFilters)

    if (filtersChanged) {
      setTimesheetsCurrentPage(1)
      prevTsFiltersRef.current = {
        tsSearch,
        tsStartDate,
        tsEndDate,
        tsEmployeeFilters,
        tsProjectFilters,
        tsStatusFilters
      }
    }
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

    // Ensure grid lines are visible in the excel sheet
    sheet.views = [{ showGridLines: true }]

    // Keep track of rows we merge so we can exclude them from column width auto-adjustment
    const fullMergedRows: number[] = []

    // Helper to merge and style banner headers
    const addMainHeader = (r: number, text: string, bgColor: string, fontSize: number, height: number) => {
      sheet.mergeCells(r, 1, r, 6)
      const cell = sheet.getCell(r, 1)
      cell.value = text
      cell.font = { name: 'Segoe UI', size: fontSize, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getRow(r).height = height
      fullMergedRows.push(r)
    }

    // Helper to add empty spacing rows
    const addEmptyRow = (r: number, height = 15) => {
      sheet.getRow(r).height = height
    }

    // Helper to add section headers
    const addSectionHeader = (r: number, text: string, bgColor: string) => {
      sheet.mergeCells(r, 1, r, 6)
      const cell = sheet.getCell(r, 1)
      cell.value = text
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      sheet.getRow(r).height = 25
      fullMergedRows.push(r)
    }

    // Helper to style table header row
    const styleTableHeader = (r: number, colCount: number, bgColor: string) => {
      sheet.getRow(r).height = 22
      for (let c = 1; c <= colCount; c++) {
        const cell = sheet.getCell(r, c)
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        }
      }
    }

    // Helper to style data cells
    const styleDataRow = (r: number, colCount: number, isEven: boolean, alignments: ('left' | 'center' | 'right')[]) => {
      sheet.getRow(r).height = 20
      const rowBg = isEven ? 'FFFFFFFF' : 'FFF9FAFB'
      for (let c = 1; c <= colCount; c++) {
        const cell = sheet.getCell(r, c)
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF374151' } } // Slate-700
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
        cell.alignment = { horizontal: alignments[c - 1] || 'left', vertical: 'middle' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        }
      }
    }

    let currentRow = 1

    // 1. Banner Title Header
    addMainHeader(currentRow, 'EPICAL LAYOUTS PVT LTD', 'FF047857', 15, 38)
    currentRow++
    addMainHeader(currentRow, 'TIMESHEET PERFORMANCE SUMMARY REPORT', 'FF065F46', 11, 24)
    currentRow++

    addEmptyRow(currentRow, 15)
    currentRow++

    // 2. TIMESHEET REPORT SUMMARY (Section 1)
    addSectionHeader(currentRow, '1. TIMESHEET REPORT SUMMARY', 'FF0F766E') // Teal-700
    currentRow++

    // Calculate total hours across filtered timesheets
    let totalSecHours = 0
    filteredTimesheets.forEach((t) => {
      const h = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours, t.totalHours, t.totalPausedMs) || 0
      totalSecHours += h
    })
    const totalHoursFormatted = formatExcelDuration(totalSecHours)

    const setSummaryRow = (r: number, label1: string, val1: string, label2: string, val2: string) => {
      sheet.getRow(r).height = 20
      
      sheet.getCell(r, 1).value = label1
      sheet.getCell(r, 1).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF4B5563' } } // Gray-600
      sheet.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      
      sheet.getCell(r, 2).value = val1
      sheet.getCell(r, 2).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1F2937' } } // Gray-800
      sheet.getCell(r, 2).alignment = { horizontal: 'left', vertical: 'middle' }

      sheet.getCell(r, 4).value = label2
      sheet.getCell(r, 4).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF4B5563' } } // Gray-600
      sheet.getCell(r, 4).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

      sheet.getCell(r, 5).value = val2
      sheet.getCell(r, 5).font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1F2937' } } // Gray-800
      sheet.getCell(r, 5).alignment = { horizontal: 'left', vertical: 'middle' }

      sheet.mergeCells(r, 2, r, 3)
      sheet.mergeCells(r, 5, r, 6)

      for (let c = 1; c <= 6; c++) {
        sheet.getCell(r, c).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        }
        sheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
      }
    }

    setSummaryRow(
      currentRow,
      'Report Period:',
      `${tsStartDate} to ${tsEndDate}`,
      'Total Hours Logged:',
      totalHoursFormatted
    )
    fullMergedRows.push(currentRow)
    currentRow++

    setSummaryRow(
      currentRow,
      'Generated By:',
      'System Admin',
      'Total Working Employees:',
      String(leaderboard.length)
    )
    fullMergedRows.push(currentRow)
    currentRow++

    setSummaryRow(
      currentRow,
      'Generated Date:',
      new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ', ' +
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      'Total Active Projects:',
      String(hoursByProject.length)
    )
    fullMergedRows.push(currentRow)
    currentRow++

    addEmptyRow(currentRow, 15)
    currentRow++

    // 3. AGGREGATED HOURS BY EMPLOYEE (Section 2)
    addSectionHeader(currentRow, '2. AGGREGATED HOURS BY EMPLOYEE', 'FF0F766E')
    currentRow++

    sheet.getCell(currentRow, 1).value = 'Employee'
    sheet.getCell(currentRow, 2).value = 'Total Hours Logged'
    sheet.mergeCells(currentRow, 2, currentRow, 3)
    styleTableHeader(currentRow, 3, 'FF115E59')
    currentRow++

    leaderboard.forEach((e, idx) => {
      sheet.getCell(currentRow, 1).value = e.name
      sheet.getCell(currentRow, 2).value = formatExcelDuration(e.hours)
      sheet.mergeCells(currentRow, 2, currentRow, 3)
      styleDataRow(currentRow, 3, idx % 2 === 0, ['left', 'center', 'center'])
      currentRow++
    })

    addEmptyRow(currentRow, 15)
    currentRow++

    // 4. AGGREGATED HOURS BY PROJECT (Section 3)
    addSectionHeader(currentRow, '3. AGGREGATED HOURS BY PROJECT', 'FF0F766E')
    currentRow++

    sheet.getCell(currentRow, 1).value = 'Project'
    sheet.getCell(currentRow, 2).value = 'Total Hours Logged'
    sheet.mergeCells(currentRow, 2, currentRow, 3)
    styleTableHeader(currentRow, 3, 'FF115E59')
    currentRow++

    hoursByProject.forEach((p, idx) => {
      sheet.getCell(currentRow, 1).value = p.name
      sheet.getCell(currentRow, 2).value = formatExcelDuration(p.hours)
      sheet.mergeCells(currentRow, 2, currentRow, 3)
      styleDataRow(currentRow, 3, idx % 2 === 0, ['left', 'center', 'center'])
      currentRow++
    })

    addEmptyRow(currentRow, 15)
    currentRow++

    // 5. WORK SESSION LOGS (Section 4)
    addSectionHeader(currentRow, '4. WORK SESSION LOGS', 'FF0369A1') // Sky-700
    currentRow++

    sheet.getCell(currentRow, 1).value = 'Employee'
    sheet.getCell(currentRow, 2).value = 'Employee ID'
    sheet.getCell(currentRow, 3).value = 'Project'
    sheet.getCell(currentRow, 4).value = 'Login Time'
    sheet.getCell(currentRow, 5).value = 'Logout Time'
    sheet.getCell(currentRow, 6).value = 'Total Hours'
    styleTableHeader(currentRow, 6, 'FF0284C7') // Sky-600
    currentRow++

    filteredTimesheets.forEach((t, idx) => {
      const hours = calculateHours(
        t.loginTime,
        t.logoutTime,
        t.overriddenHours,
        t.totalHours,
        t.totalPausedMs
      )
      sheet.getCell(currentRow, 1).value = t.employeeName
      sheet.getCell(currentRow, 2).value = t.employeeId
      sheet.getCell(currentRow, 3).value = t.project
      sheet.getCell(currentRow, 4).value = formatDateTime(t.loginTime)
      sheet.getCell(currentRow, 5).value = t.logoutTime ? formatDateTime(t.logoutTime) : '—'
      sheet.getCell(currentRow, 6).value = formatExcelDuration(hours)

      styleDataRow(currentRow, 6, idx % 2 === 0, ['left', 'center', 'left', 'center', 'center', 'center'])
      currentRow++
    })

    // Setup base column widths
    sheet.columns = [
      { width: 22 }, // Col 1 (Employee / Project)
      { width: 15 }, // Col 2 (Emp ID / Hours)
      { width: 22 }, // Col 3 (Project / merged hours)
      { width: 24 }, // Col 4 (Login / Summary right side labels)
      { width: 24 }, // Col 5 (Logout / Summary right side values)
      { width: 14 }, // Col 6 (Total Hours / merged right side values)
    ]

    // Auto-adjust column widths programmatically based on content, avoiding merged headers
    sheet.columns.forEach((column) => {
      let maxLen = 0
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const cellRow = Number(cell.row)

        if (
          cellRow > 3 &&
          !fullMergedRows.includes(cellRow) &&
          cell.address === cell.master.address
        ) {
          const cellValue = cell.value ? String(cell.value) : ''
          if (cellValue.length > maxLen) {
            maxLen = cellValue.length
          }
        }
      })

      const currentWidth = column.width || 12
      if (maxLen > 0) {
        column.width = Math.max(maxLen + 4, currentWidth)
      }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    downloadExcelBuffer(buffer, `Timesheet_Report_${tsStartDate}_to_${tsEndDate}.xlsx`)
  }, [filteredTimesheets, tsStartDate, tsEndDate])

  const handleExportPDF = useCallback(async () => {
    if (!filteredTimesheets.length) {
      toast.error('No timesheet data available to export.')
      return
    }

    const { hoursByProject, leaderboard } = buildTimesheetExportAnalytics(filteredTimesheets)
    
    // Sort leaderboard alphabetically matching the A-Z requirement
    const sortedLeaderboard = [...leaderboard].sort((a, b) => a.name.localeCompare(b.name))

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt' })
    const pageWidth = doc.internal.pageSize.width || 595
    const pageHeight = doc.internal.pageSize.height || 842
    const marginX = 36
    const contentWidth = pageWidth - marginX * 2

    const logo = await fetchExportLogo()

    const tableTheme = {
      styles: { fontSize: 7.5, cellPadding: 4, overflow: 'linebreak' as const },
      headStyles: { fillColor: [30, 41, 59] as [number, number, number], fontStyle: 'bold' as const, textColor: [255, 255, 255] as [number, number, number] },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
      theme: 'grid' as const,
      margin: { left: marginX, right: marginX, bottom: 44 },
    }

    const addSectionTitle = (title: string, y: number) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(30, 41, 59)
      doc.text(title, marginX, y)
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(marginX, y + 4, marginX + contentWidth, y + 4)
      return y + 16
    }

    let headerY = 20

    // Draw the green chip logo if available
    let logoWidth = 0
    if (logo) {
      const scaled = scaleExportLogo(logo.width, logo.height, 44)
      const format = logo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(logo.dataUrl, format, marginX, headerY, scaled.width, scaled.height)
      logoWidth = scaled.width
    }

    // Draw Title next to Logo
    const textX = marginX + logoWidth + 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(30, 41, 59)
    doc.text('EPICAL LAYOUTS PVT LTD', textX, headerY + 14)

    doc.setFontSize(11)
    doc.setTextColor(71, 85, 105)
    doc.text('Timesheet Report', textX, headerY + 28)
    
    headerY += 40

    // Generated Timestamp
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - marginX, headerY, { align: 'right' })
    headerY += 10

    // Horizontal Line divider
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(1)
    doc.line(marginX, headerY, pageWidth - marginX, headerY)

    let cursorY = headerY + 16

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

    // Maximum bar width scaled for portrait content area
    const maxBarWidth = contentWidth * 0.55

    // ── PROJECT HOURS (full-width, stacked vertically) ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.setFillColor(74, 175, 125)
    doc.rect(marginX, cursorY, 3, 10, 'F')
    doc.text('PROJECT HOURS', marginX + 8, cursorY + 8)

    cursorY += 22
    const maxProjectHours = Math.max(...hoursByProject.map(p => p.hours), 1)
    const averageProjectHours = hoursByProject.length > 0 ? (hoursByProject.reduce((sum, p) => sum + p.hours, 0) / hoursByProject.length) : 0

    hoursByProject.forEach((p) => {
      const barWidth = Math.max(5, (p.hours / maxProjectHours) * maxBarWidth)
      const isGreaterThanAverage = p.hours > averageProjectHours
      const baseColor: [number, number, number] = isGreaterThanAverage ? [74, 175, 125] : [241, 108, 111]

      draw3DBar(marginX, cursorY, barWidth, 8, baseColor)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(30, 41, 59)
      doc.text(`${formatExportHours(p.hours)} — ${p.name}`, marginX + barWidth + 8, cursorY + 7)

      cursorY += 16
    })

    cursorY += 14

    // ── EMPLOYEE HOURS (full-width, stacked below) ──
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    doc.setFillColor(59, 130, 246)
    doc.rect(marginX, cursorY, 3, 10, 'F')
    doc.text('EMPLOYEE HOURS', marginX + 8, cursorY + 8)

    cursorY += 22
    const maxEmployeeHours = Math.max(...sortedLeaderboard.map(e => e.hours), 1)

    sortedLeaderboard.forEach((e, idx) => {
      // Check if we need a new page for the analytics section
      if (cursorY > pageHeight - 60) {
        doc.addPage()
        cursorY = 36
      }

      const barWidth = Math.max(5, (e.hours / maxEmployeeHours) * maxBarWidth)
      const baseColor = hslToRgb(Math.round((idx * 137.5) % 360), 75, 50)

      draw3DBar(marginX, cursorY, barWidth, 8, baseColor)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(30, 41, 59)
      doc.text(`${formatExportHours(e.hours)} — ${e.name}`, marginX + barWidth + 8, cursorY + 7)

      cursorY += 16
    })

    cursorY += 20

    // Check if there's enough room for the table header, otherwise start on a new page
    if (cursorY > pageHeight - 100) {
      doc.addPage()
      cursorY = 36
    }

    // ── Detailed time logs ──
    cursorY = addSectionTitle('Detailed Time Logs', cursorY)

    const tableHeaders = ['Employee', 'Project', 'Login Time', 'Logout Time', 'Duration']

    const tableRows = filteredTimesheets.map((t) => {
      const hours = calculateHours(
        t.loginTime,
        t.logoutTime,
        t.overriddenHours,
        t.totalHours,
        t.totalPausedMs
      )
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
      styles: { ...tableTheme.styles, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.24 },
        1: { cellWidth: contentWidth * 0.22 },
        2: { cellWidth: contentWidth * 0.22 },
        3: { cellWidth: contentWidth * 0.22 },
        4: { cellWidth: contentWidth * 0.10, halign: 'right' },
      },
    })

    // ── Footer on every page ──
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(marginX, pageHeight - 36, pageWidth - marginX, pageHeight - 36)
      doc.setFontSize(7)
      doc.setTextColor(148, 163, 184)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 24, { align: 'right' })
      doc.text('Confidential – EPICAL Timesheet Data', marginX, pageHeight - 24)
    }

    doc.save(`Timesheet_Report_${tsStartDate}_to_${tsEndDate}.pdf`)
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
  // Segmented donut chart math
  const targetCompleted = projectMetrics.total > 0 ? (projectMetrics.completed / projectMetrics.total) * 100 : 0
  const targetInProgress = projectMetrics.total > 0 ? (projectMetrics.inProgress / projectMetrics.total) * 100 : 0
  const targetCancelled = projectMetrics.total > 0 ? (projectMetrics.cancelled / projectMetrics.total) * 100 : 0

  const compPct = isAnimated ? targetCompleted : 0
  const progPct = isAnimated ? targetInProgress : 0
  const cancPct = isAnimated ? targetCancelled : 0

  const circumference = 2 * Math.PI * 26

  const compDash = (compPct / 100) * circumference
  const progDash = (progPct / 100) * circumference
  const cancDash = (cancPct / 100) * circumference

  const compOffset = 0
  const progOffset = -compDash
  const cancOffset = -(compDash + progDash)

  return (
    <div className="crewiq-dashboard admin-projects-view">
      <div className="crewiq-dash-bg" aria-hidden />
      <PageWrapper className="projects-page-wrapper relative z-10 py-3 font-body">
        <div className="projects-shell animate-fadeIn">
          {/* Redesigned Compact Header with Dynamic Pie Chart */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h1 className="text-2xl font-extrabold text-[var(--emerald-dark)] leading-none mb-1">Projects & Timesheets</h1>
              <p className="text-xs font-medium text-slate-600">
                Manage projects, review logs, and track team hours in one place
              </p>
            </div>
            
            {/* Dynamic Pie Chart Status Summary */}
            <div className="flex items-center gap-3 bg-white/80 rounded-xl border border-emerald-200/60 px-4 py-2.5 shadow-sm backdrop-blur-sm">
              <div className="relative flex items-center justify-center" style={{ width: 68, height: 68 }}>
                <svg width="68" height="68" viewBox="0 0 68 68" className="transform -rotate-90">
                  {(() => {
                    const total = projectMetrics.total || 1;
                    const radius = 28;
                    const circumference = 2 * Math.PI * radius;
                    
                    // Calculate percentages
                    const progressPercent = (projectMetrics.inProgress / total) * 100;
                    const completedPercent = (projectMetrics.completed / total) * 100;
                    const cancelledPercent = (projectMetrics.cancelled / total) * 100;
                    
                    // Calculate dash arrays and offsets for pie segments
                    const progressDash = (progressPercent / 100) * circumference;
                    const completedDash = (completedPercent / 100) * circumference;
                    const cancelledDash = (cancelledPercent / 100) * circumference;
                    
                    // Calculate offsets (each segment starts where previous ended)
                    const progressOffset = 0;
                    const completedOffset = -progressDash;
                    const cancelledOffset = -(progressDash + completedDash);
                    
                    return (
                      <>
                        {/* Background circle */}
                        <circle 
                          cx="34" 
                          cy="34" 
                          r={radius} 
                          fill="none" 
                          stroke="rgba(38, 107, 28, 0.08)" 
                          strokeWidth="11"
                        />
                        
                        {/* Progress segment (Blue) */}
                        {projectMetrics.inProgress > 0 && (
                          <circle
                            cx="34"
                            cy="34"
                            r={radius}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="11"
                            strokeDasharray={`${isAnimated ? progressDash : 0} ${circumference}`}
                            strokeDashoffset={progressOffset}
                            strokeLinecap="round"
                            style={{ 
                              transition: 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.1s',
                              filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))'
                            }}
                          />
                        )}
                        
                        {/* Completed segment (Green) */}
                        {projectMetrics.completed > 0 && (
                          <circle
                            cx="34"
                            cy="34"
                            r={radius}
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth="11"
                            strokeDasharray={`${isAnimated ? completedDash : 0} ${circumference}`}
                            strokeDashoffset={completedOffset}
                            strokeLinecap="round"
                            style={{ 
                              transition: 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.3s',
                              filter: 'drop-shadow(0 2px 4px rgba(34, 197, 94, 0.3))'
                            }}
                          />
                        )}
                        
                        {/* Cancelled segment (Red) */}
                        {projectMetrics.cancelled > 0 && (
                          <circle
                            cx="34"
                            cy="34"
                            r={radius}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="11"
                            strokeDasharray={`${isAnimated ? cancelledDash : 0} ${circumference}`}
                            strokeDashoffset={cancelledOffset}
                            strokeLinecap="round"
                            style={{ 
                              transition: 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.5s',
                              filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.3))'
                            }}
                          />
                        )}
                      </>
                    );
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-[var(--emerald-dark)] font-display leading-none">{projectMetrics.total}</span>
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">Total</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 pl-3 border-l border-emerald-200/60">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-sm"></div>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Progress</span>
                  </div>
                  <div className="text-xl font-black text-blue-600 tabular-nums">{projectMetrics.inProgress}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-sm"></div>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Done</span>
                  </div>
                  <div className="text-xl font-black text-green-600 tabular-nums">{projectMetrics.completed}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-sm"></div>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Cancel</span>
                  </div>
                  <div className="text-xl font-black text-red-600 tabular-nums">{projectMetrics.cancelled}</div>
                </div>
              </div>
            </div>
          </div>

      {/* ================================================================
           TAB 1 – PROJECTS
           ================================================================ */}
      {/* Unified grid layout holding the permanently visible sidebar on the left and the main content on the right */}
      <div className="projects-body-grid">
        {/* Left Sidebar with Navigation and Filters */}
        <aside className="projects-sidebar space-y-4">
          <div>
            <p className="projects-sidebar-title">Workspace Navigation</p>
            
            {/* Create Project Button */}
            <button
              onClick={openCreateProject}
              className="sidebar-create-btn mb-3"
            >
              <Plus className="h-4 w-4" />
              <span>Create Project</span>
            </button>

            {/* Navigation List */}
            <div className="sidebar-nav-list">
              <button
                onClick={() => setActiveTab('projects')}
                className={`sidebar-nav-item ${activeTab === 'projects' ? 'active' : ''}`}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="flex-1 text-left">Projects</span>
                <span className="sidebar-nav-badge">{filteredProjects.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('timesheets')}
                className={`sidebar-nav-item ${activeTab === 'timesheets' ? 'active' : ''}`}
              >
                <Clock className="h-4 w-4" />
                <span className="flex-1 text-left">Timesheets</span>
                <span className="sidebar-nav-badge">{filteredTimesheets.length}</span>
              </button>
              <button
                onClick={() => setArchivedModalOpen(true)}
                className="sidebar-nav-item"
              >
                <Archive className="h-4 w-4" />
                <span className="flex-1 text-left">Archived</span>
                <span className="sidebar-nav-badge">{archivedCount}</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 my-3" />

          {/* DYNAMIC FILTERS & SETTINGS SECTION */}
          {activeTab === 'projects' ? (
            <div className="space-y-4">
              <p className="projects-sidebar-title">Project Filters</p>
              
              {/* Search */}
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--emerald-dark)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects, clients…"
                  className="admin-field h-9 w-full pl-9 pr-8 text-sm font-medium text-ink shadow-sm placeholder:text-ink/45"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-700 hover:bg-white/60 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {/* Show/Hide Filters Button */}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all ${
                  showFilters || activeFiltersCount > 0
                    ? 'border-[rgba(38,107,28,0.35)] bg-white/80 text-[var(--emerald-dark)]'
                    : 'border-[rgba(38,107,28,0.2)] bg-white/50 text-slate-800 hover:bg-white/70'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Show Filters
                {activeFiltersCount > 0 ? (
                  <span className="admin-dash-action-btn-sm inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-black text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </button>

              {/* Filters Panel */}
              {showFilters ? (
                <div className="space-y-3 rounded-lg border border-[rgba(38,107,28,0.15)] bg-white/55 p-3 animate-fadeIn">
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
                  {activeFiltersCount > 0 ? (
                    <button
                      onClick={clearProjectsFilters}
                      className="w-full text-center text-xs font-bold text-[var(--emerald-dark)] hover:text-[var(--green-600)] transition-colors"
                    >
                      Reset All Filters
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* Project Health Overview */}
              {!showFilters && (
                <div className="rounded-lg border border-[rgba(38,107,28,0.12)] bg-white/45 p-3">
                  <p className="workspace-summary-label mb-2">Quick Overview</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">In Progress</span>
                      <span className="font-bold text-blue-600">{projectMetrics.inProgress}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Completed</span>
                      <span className="font-bold text-emerald-600">{projectMetrics.completed}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Cancelled</span>
                      <span className="font-bold text-rose-600">{projectMetrics.cancelled}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* View Switcher */}
              <div className="rounded-lg border border-[rgba(38,107,28,0.12)] bg-white/45 p-3">
                <p className="text-xs font-semibold text-slate-700 tabular-nums mb-2">
                  <span className="font-bold text-[var(--emerald-dark)]">{filteredProjects.length}</span>
                  <span className="text-slate-600"> / {projects.length} projects</span>
                </p>
                <div className="projects-view-toggle">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex-1 rounded-md p-2 transition-all ${
                      viewMode === 'grid' ? 'admin-projects-green-solid shadow-sm' : 'text-slate-600 hover:text-ink'
                    }`}
                    title="Grid view"
                  >
                    <LayoutGrid className="mx-auto h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex-1 rounded-md p-2 transition-all ${
                      viewMode === 'list' ? 'admin-projects-green-solid shadow-sm' : 'text-slate-600 hover:text-ink'
                    }`}
                    title="List view"
                  >
                    <List className="mx-auto h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="projects-sidebar-title">Timesheet Filters</p>
              
              {/* Search */}
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--emerald-dark)]" />
                <input
                  type="text"
                  value={tsSearch}
                  onChange={(e) => setTsSearch(e.target.value)}
                  placeholder="Search logs…"
                  className="admin-field h-9 w-full pl-9 pr-8 text-sm font-medium text-ink shadow-sm placeholder:text-ink/45"
                />
                {tsSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => setTsSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-700 hover:bg-emerald-50/50 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Date Range Picker */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Date Period</label>
                <CustomDateRangePicker
                  startDate={tsStartDate}
                  endDate={tsEndDate}
                  preset={datePreset}
                  onChange={handleDateRangeChange}
                />
              </div>

              {/* Employee Filter */}
              <FilterCheckboxGroup
                label="Employee"
                placeholder="All Employees"
                options={tsEmployeeFilterOptions}
                selected={tsEmployeeFilters}
                onChange={setTsEmployeeFilters}
              />

              {/* Project Filter */}
              <FilterCheckboxGroup
                label="Project"
                placeholder="All Projects"
                options={tsProjectFilterOptions}
                selected={tsProjectFilters}
                onChange={setTsProjectFilters}
              />

              {/* Status Filter */}
              <FilterCheckboxGroup
                label="Status"
                placeholder="All Statuses"
                options={tsStatusFilterOptions}
                selected={tsStatusFilters}
                onChange={setTsStatusFilters}
              />

              {hasActiveTimesheetFilters && (
                <button
                  type="button"
                  onClick={clearTimesheetFilters}
                  className="w-full text-center text-xs font-bold text-[var(--emerald-dark)] hover:text-[var(--green-600)] transition-colors mt-2"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Unified main content panel */}
        <div className="projects-main-panel">
          {activeTab === 'projects' ? (
            <div className="space-y-5 animate-fadeIn">
              <div className="projects-main-header">
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--emerald-dark)]">Project Directory</h2>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {viewMode === 'grid' ? 'Grid view' : 'List view'} · {filteredProjects.length} result{filteredProjects.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              
              {viewMode === 'grid' ? (
                <>
                  {filteredProjects.length > 0 ? (
                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                <div className="projects-table-shell">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-border bg-transparent">
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">
                            Project Details
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">
                            Client
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">
                            Technology Node
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">
                            Access Control
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">
                            Visibility Scope
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">
                            Status
                          </th>
                          <th className="px-5 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-sm">
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
                            <td colSpan={7} className="py-16 text-center text-slate-550 font-medium">
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
                <div className="projects-pagination-bar flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Showing {indexOfFirstProject + 1}–{Math.min(indexOfLastProject, filteredProjects.length)} of {filteredProjects.length} projects
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={projectsCurrentPage === 1}
                      onClick={() => setProjectsCurrentPage((p) => Math.max(1, p - 1))}
                      className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-[var(--bg-card)] px-3 text-[11px] font-bold text-slate-700 transition-all hover:bg-emerald-50/60 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalProjectsPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setProjectsCurrentPage(page)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black transition-all ${
                          projectsCurrentPage === page
                            ? 'admin-projects-green-solid shadow-sm'
                            : 'border border-border bg-[var(--bg-card)] text-slate-700 hover:bg-emerald-50/60 hover:text-ink'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={projectsCurrentPage === totalProjectsPages}
                      onClick={() => setProjectsCurrentPage((p) => Math.min(totalProjectsPages, p + 1))}
                      className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-[var(--bg-card)] px-3 text-[11px] font-bold text-slate-700 transition-all hover:bg-emerald-50/60 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--emerald-dark)]">Timesheet Records</h2>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {filteredTimesheets.length} log{filteredTimesheets.length === 1 ? '' : 's'} matching criteria
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[rgba(38,107,28,0.25)] bg-white px-3 text-xs font-bold text-[var(--emerald-dark)] transition-all hover:bg-emerald-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                    <span>Export Excel</span>
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 px-3 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md"
                  >
                    <FileDown className="h-3.5 w-3.5 shrink-0" />
                    <span>PDF Report</span>
                  </button>
                </div>
              </div>

              {hasActiveTimesheetFilters && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Active Filters:</span>
                  {tsSearch.trim() && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-[var(--bg-input)] px-2 py-0.5 text-xs font-semibold text-slate-800">
                      Search: "{tsSearch}"
                      <button type="button" onClick={() => setTsSearch('')} className="text-slate-600 hover:text-slate-800">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {tsEmployeeFilters.map((empName) => (
                    <span key={empName} className="inline-flex items-center gap-1 rounded-md border border-[rgba(38,107,28,0.22)] bg-[var(--emerald-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--emerald-dark)]">
                      {empName}
                      <button type="button" onClick={() => setTsEmployeeFilters(tsEmployeeFilters.filter((name) => name !== empName))} className="text-[var(--emerald-dark)] hover:text-[var(--green-600)]">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {tsProjectFilters.map((proj) => (
                    <span key={proj} className="inline-flex items-center gap-1 rounded-md border border-border bg-[var(--bg-input)] px-2 py-0.5 text-xs font-semibold text-slate-800">
                      {proj}
                      <button type="button" onClick={() => setTsProjectFilters(tsProjectFilters.filter((p) => p !== proj))} className="text-slate-600 hover:text-slate-800">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {tsStatusFilters.map((status) => (
                    <span key={status} className="inline-flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400">
                      {status}
                      <button type="button" onClick={() => setTsStatusFilters(tsStatusFilters.filter((s) => s !== status))} className="text-blue-500/70 hover:text-blue-300">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <button type="button" onClick={clearTimesheetFilters} className="text-xs font-bold text-[var(--emerald-dark)] hover:text-[var(--green-600)] ml-2">
                    Clear all
                  </button>
                </div>
              )}

          {/* Analytics panels */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="projects-analytics-card">
              <div className="projects-analytics-head mb-0 flex items-center justify-between gap-2 border-b-0 pb-0">
                <h3 className="type-card-label-caps flex items-center gap-2 font-extrabold">
                  <span className="h-3.5 w-1 shrink-0 rounded-full bg-white/80" />
                  Aggregated Hours by Project
                </h3>
                {derivedHoursByProject.length > 0 && (
                  <span className="text-xs text-slate-450 font-mono">
                    {derivedHoursByProject.length} project{derivedHoursByProject.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="projects-analytics-body">
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
                <div className="flex h-60 items-center justify-center rounded-lg border border-dashed border-[rgba(38,107,28,0.2)] bg-white/60 text-sm font-semibold text-slate-600 sm:h-64">
                  No data logs available in the chosen dates.
                </div>
              )}
              </div>
            </div>

            <div className="projects-analytics-card">
              <div className="projects-analytics-head mb-0 flex items-center justify-between gap-2 border-b-0 pb-0">
                <h3 className="type-card-label-caps flex items-center gap-2 font-extrabold">
                  <span className="h-3.5 w-1 shrink-0 rounded-full bg-white/80" />
                  Aggregated Hours by Employee
                </h3>
                {derivedLeaderboardData.length > 0 && (
                  <span className="text-xs text-slate-450 font-mono">
                    {derivedLeaderboardData.length} employee{derivedLeaderboardData.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="projects-analytics-body">
              <div className="timesheet-panel-scroll max-h-[15.75rem] overflow-y-auto pr-0.5">
                <EmployeeLeaderboard data={derivedLeaderboardData} />
              </div>
              </div>
            </div>
          </div>

          {/* Timesheet log table */}
          <div className="projects-ts-table-wrap">
            <div className="max-h-[min(32rem,70vh)] overflow-auto timesheet-panel-scroll">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-transparent bg-transparent">
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Employee</th>
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Project</th>
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Login Time</th>
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Logout Time</th>
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {currentTimesheets.map((t) => {
                    const empInfo = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId)
                    const hours = calculateHours(
                      t.loginTime,
                      t.logoutTime,
                      t.overriddenHours,
                      t.totalHours,
                      t.totalPausedMs
                    )

                    return (
                      <tr
                        key={t.id}
                        className="group transition-colors hover:bg-emerald-50/50"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={t.employeeName}
                              size="sm"
                              color={
                                empInfo
                                  ? `hsl(${empInfo.hue},55%,45%)`
                                  : stringToHueColor(t.employeeId || t.employeeName)
                              }
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-ink leading-tight">
                                {t.employeeName}
                              </p>
                              <p className="text-[11px] font-semibold text-slate-600 font-mono">
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
                            className="group/btn block max-w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(38,107,28,0.22)] rounded-md"
                          >
                            <p className="flex items-center gap-1 font-bold text-ink transition-colors group-hover/btn:text-[var(--emerald-dark)]">
                              <span className="truncate">{t.project}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 text-[var(--emerald-dark)] transition-all group-hover/btn:opacity-100" />
                            </p>
                          </button>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <p className="font-semibold text-slate-800">{formatDateTime(t.loginTime)}</p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <p className="font-semibold text-slate-800">
                            {t.logoutTime ? formatDateTime(t.logoutTime) : '—'}
                          </p>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-lg border border-border bg-[var(--bg-input)] px-2.5 py-1 text-ink font-mono text-xs font-bold">
                            {formatAdminDuration(hours)}
                          </span>
                          {t.autoCheckedOut && (
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                              Auto Checked-Out
                            </p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredTimesheets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-sm font-semibold text-slate-600">
                        No individual logs correspond to selected range and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalTimesheetsPages > 1 && (
            <div className="projects-pagination-bar flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-slate-600">
                Showing {indexOfFirstTimesheet + 1}–{Math.min(indexOfLastTimesheet, filteredTimesheets.length)} of {filteredTimesheets.length} logs
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={timesheetsCurrentPage === 1}
                  onClick={() => setTimesheetsCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-[var(--bg-card)] px-3 text-[11px] font-bold text-slate-700 transition-all hover:bg-emerald-50/60 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
                >
                  Previous
                </button>
                {Array.from({ length: totalTimesheetsPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setTimesheetsCurrentPage(page)}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black transition-all ${
                      timesheetsCurrentPage === page
                        ? 'admin-projects-green-solid shadow-sm'
                        : 'border border-border bg-[var(--bg-card)] text-slate-700 hover:bg-emerald-50/60 hover:text-ink'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={timesheetsCurrentPage === totalTimesheetsPages}
                  onClick={() => setTimesheetsCurrentPage((p) => Math.min(totalTimesheetsPages, p + 1))}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-[var(--bg-card)] px-3 text-[11px] font-bold text-slate-700 transition-all hover:bg-emerald-50/60 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
</div>

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
            <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-border bg-emerald-50/40 p-4 animate-fadeIn">
              <CheckboxList
                label="Allowed Users"
                items={employees.map((e) => `${e.firstName} ${e.lastName || ''}`.trim())}
                selected={form.visibleUsers}
                onChange={(next) => setForm({ ...form, visibleUsers: next })}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Project Description scope
            </label>
            <textarea
              placeholder="Provide a detailed scope of this project, goals, and standard specifications..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: enforceMaxWords(e.target.value) })
              }
              rows={3}
              className="w-full rounded-xl border border-border bg-[var(--bg-input)] p-3 text-xs text-ink outline-none transition-all placeholder:text-slate-600 focus:border-[var(--emerald-dark)] focus:ring-2 focus:ring-[rgba(38,107,28,0.15)]"
              required
            />
            <p
              className={`mt-1 text-right text-[11px] font-semibold ${
                countWords(form.description) >= MAX_PROJECT_DESCRIPTION_WORDS
                  ? 'text-amber-500'
                  : 'text-slate-600'
              }`}
            >
              {countWords(form.description)} / {MAX_PROJECT_DESCRIPTION_WORDS} words
            </p>
          </div>

          {modalMode === 'edit' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
                Project Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Completed' | 'Cancelled' })}
                className="w-full rounded-xl border border-border bg-[var(--bg-input)] p-2.5 text-xs text-ink outline-none transition-all focus:border-[var(--emerald-dark)] focus:ring-2 focus:ring-[rgba(38,107,28,0.15)]"
              >
                <option value="Active">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-4 mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={loading}
              className="rounded-xl font-bold py-2 px-4 border-border bg-surface/80 text-slate-800 hover:bg-emerald-50 hover:text-ink"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
              className="admin-dash-action-btn w-full rounded-xl py-2 px-4 font-bold border-0"
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
    </div>
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[var(--bg-input)] py-14 px-6">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-surface/80 ring-1 ring-border">
        <FolderOpen className="h-5 w-5 text-slate-600" />
      </div>
      <p className="text-center text-sm font-semibold text-slate-700">{message}</p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-4 text-xs font-bold text-[var(--emerald-dark)] hover:text-[var(--green-600)] transition-colors bg-[var(--emerald-surface)] hover:bg-[var(--emerald-sage)] py-2 px-4 rounded-lg border border-[rgba(38,107,28,0.22)]"
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
          <Archive className="h-4 w-4 text-ink" />
        </div>
        <h3 className="text-sm font-black text-ink leading-tight">Archive Project</h3>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-slate-800 font-bold leading-relaxed">
          Are you sure you want to archive project <strong className="text-ink font-extrabold">"{projectName}"</strong>?
        </p>
        <p className="text-xs text-slate-700 font-semibold leading-relaxed">
          This will safely move the project and its complete history (assigned tasks and timesheet logs) to separate archived storage. Active dashboards stay clean. You can restore the project at any time.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="rounded-xl font-bold py-2 px-4 text-xs h-9 border-border bg-surface/80 text-slate-800 hover:bg-emerald-50 hover:text-ink"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-ink font-bold rounded-xl py-2 px-4 text-xs h-9 border-0 shadow-sm"
          >
            Archive Project
          </Button>
        </div>
      </div>
    </Modal>
  )
}

