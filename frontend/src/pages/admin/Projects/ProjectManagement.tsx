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
  Crown,
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
  
  // FIXED: For active sessions (no logout), calculate live duration
  if (!logout) {
    const loginDate = new Date(login)
    if (isNaN(loginDate.getTime())) return 0
    const now = new Date()
    const diffMs = now.getTime() - loginDate.getTime() - (totalPausedMs || 0)
    if (diffMs <= 0) return 0
    return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
  }
  
  const loginDate = new Date(login)
  const logoutDate = new Date(logout)
  if (isNaN(loginDate.getTime()) || isNaN(logoutDate.getTime())) return 0
  const diffMs = logoutDate.getTime() - loginDate.getTime() - (totalPausedMs || 0)
  if (diffMs <= 0) return 0
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
}

function formatAdminDuration(hours: number | null): string {
  if (hours === null || hours === undefined) return 'In Progress'
  if (hours === 0) return '0m'
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
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accentClass: string
  iconClassName: string
  secondaryText?: string
}) {
  return (
    <div className="admin-card group relative overflow-hidden rounded-xl border border-white/[0.07] bg-[#161922] p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-all duration-300 hover:border-white/[0.12] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5)] hover:-translate-y-0.5">
      <div className={`absolute inset-x-0 top-0 h-[2px] ${accentClass} opacity-80`} />
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-2 font-display text-[28px] font-extrabold tabular-nums leading-none tracking-tight text-white">
            {value}
          </p>
          {secondaryText && (
            <p className="mt-2 text-[11px] font-semibold text-slate-400">{secondaryText}</p>
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
        className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-lg border border-white/10 bg-[#161922] px-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#1d212d] whitespace-nowrap"
      >
        <CalendarIcon className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
        <span className="truncate max-w-xs text-xs leading-tight">
          {preset === 'Custom' && startDate === endDate
            ? `${formatDate(startDate)}`
            : preset === 'Custom'
              ? `${formatDate(startDate)} – ${formatDate(endDate)}`
              : `${preset} (${formatDate(startDate)} – ${formatDate(endDate)})`}
        </span>
        <ChevronDown className="h-3 w-3 text-[#94a3b8] flex-shrink-0" />
      </button>

      {open && (
        <div className="date-range-popover absolute left-0 top-full z-50 mt-2 flex w-[92vw] flex-col gap-4 rounded-2xl border border-white/5 bg-[#161922] p-4 shadow-2xl animate-fadeIn sm:w-auto sm:min-w-[500px] md:flex-row">
          {/* Calendar Grid */}
          <div className="flex-1 select-none">
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-white/5 rounded-lg text-[#94a3b8]">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="date-range-month-title type-calendar-month text-white">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-white/5 rounded-lg text-[#94a3b8]">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="type-calendar-weekday mb-1 grid grid-cols-7 gap-1 text-center text-[#94a3b8]">
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
                      ${cell.isCurrentMonth ? 'text-white hover:bg-emerald-500/20 hover:text-emerald-400' : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'}
                      ${isSingleDay || isSelectedStart || isSelectedEnd ? 'bg-emerald-600 text-white hover:bg-emerald-500 hover:text-white shadow-sm' : ''}
                      ${isWithinRange ? 'bg-emerald-600/20 text-emerald-450 rounded-none' : ''}
                    `}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-[10px] text-[#94a3b8] font-medium">
              Click any date to filter that day. Hold Shift, click a start date, then another date for a custom range.
            </p>
          </div>

          {/* Divider */}
          <div className="hidden md:block border-l border-white/5" />

          {/* Quick Presets Panel */}
          <div className="w-36 flex flex-col gap-0.5">
            <p className="type-card-label-caps mb-2 text-[9px] text-[#94a3b8]">Quick Presets</p>
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
                  ${preset === p ? 'bg-emerald-600/20 text-emerald-400 font-bold' : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'}
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
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-[rgba(39,39,42,0.88)] bg-[rgba(39,39,42,0.88)] text-[10px] font-black text-[#94a3b8] shadow-sm ring-1 ring-[rgba(161,161,170,0.18)]">
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
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
          {label}
        </span>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border bg-[#161922] px-2.5 text-left text-xs font-bold outline-none transition-all ${
          open || selected.length > 0
            ? 'border-emerald-500/50 text-white ring-4 ring-emerald-500/10'
            : 'border-white/10 text-slate-400 hover:border-white/20'
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
          className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-white/5 bg-[#161922] p-2 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/5 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onChange(options.map((o) => o.value))}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-350"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-bold text-slate-400 hover:text-white"
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
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white transition-colors hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-white/10 text-emerald-600 focus:ring-emerald-500/20 bg-[#111319]"
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
   COMPONENT – Unified Permissions Manager (Enterprise-Style)
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
  const [searchQuery, setSearchQuery] = useState('')
  
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items
    const query = searchQuery.toLowerCase()
    return items.filter(item => item.toLowerCase().includes(query))
  }, [items, searchQuery])
  
  // Separate selected and unselected items for better visibility
  const selectedItems = useMemo(() => {
    return filteredItems.filter(item => selected.includes(item))
  }, [filteredItems, selected])
  
  const unselectedItems = useMemo(() => {
    return filteredItems.filter(item => !selected.includes(item))
  }, [filteredItems, selected])
  
  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter((s) => s !== item) : [...selected, item])
  }
  
  const selectAll = () => {
    // Add all filtered items to selection (merge with existing)
    const newSelection = [...new Set([...selected, ...filteredItems])]
    onChange(newSelection)
  }
  
  const clearAll = () => {
    // Only clear items that are in the filtered list
    onChange(selected.filter(s => !filteredItems.includes(s)))
  }
  
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#0f1219] to-[#0a0d14] shadow-lg overflow-hidden">
      {/* Header Section */}
      <div className="border-b border-white/10 bg-[#0f1219]/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {label}
          </label>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
              {selected.length}
            </span>
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-10 rounded-lg border border-white/10 bg-[#0a0d14] text-xs text-white outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:bg-[#0f1219]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-white/10 transition-colors"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Selected Members Chips */}
        {selected.length > 0 && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex flex-wrap gap-1.5">
              {selected.map((member) => (
                <span
                  key={member}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 shadow-sm transition-all hover:bg-emerald-500/20 hover:border-emerald-500/40"
                >
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  <span className="max-w-[120px] truncate" title={member}>{member}</span>
                  <button
                    type="button"
                    onClick={() => toggle(member)}
                    className="ml-0.5 p-0.5 rounded hover:bg-emerald-500/30 transition-colors group"
                    title={`Remove ${member}`}
                  >
                    <X className="h-3 w-3 group-hover:text-emerald-300" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={selectAll}
            disabled={filteredItems.length === 0 || selectedItems.length === filteredItems.length}
            className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Select All {filteredItems.length !== items.length && filteredItems.length > 0 && `(${filteredItems.length})`}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={filteredItems.length === 0 || selected.filter(s => filteredItems.includes(s)).length === 0}
            className="text-[11px] font-bold text-slate-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear {filteredItems.length !== items.length && filteredItems.length > 0 && `(${filteredItems.length})`}
          </button>
        </div>

        {/* Members List */}
        <div className="rounded-lg border border-white/10 bg-[#0a0d14] max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">
          {filteredItems.length > 0 ? (
            <div className="p-2 space-y-0.5">
              {/* Assigned Members First */}
              {selectedItems.length > 0 && (
                <>
                  <div className="px-2 py-1.5 sticky top-0 bg-[#0a0d14] z-10">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Assigned ({selectedItems.length})
                    </p>
                  </div>
                  {selectedItems.map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-all bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/15 hover:border-emerald-500/35 group"
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggle(item)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-emerald-500/30 bg-emerald-500/10 text-emerald-600 focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-0 transition-all cursor-pointer"
                      />
                      <span className="font-bold truncate flex-1" title={item}>
                        {item}
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500 opacity-80 group-hover:opacity-100 transition-opacity" />
                    </label>
                  ))}
                </>
              )}

              {/* Divider */}
              {selectedItems.length > 0 && unselectedItems.length > 0 && (
                <div className="px-2 py-2">
                  <div className="border-t border-white/10" />
                </div>
              )}

              {/* Available Members */}
              {unselectedItems.length > 0 && (
                <>
                  {selectedItems.length > 0 && (
                    <div className="px-2 py-1.5 sticky top-0 bg-[#0a0d14] z-10">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded border border-slate-600 flex items-center justify-center">
                          <span className="h-1 w-1 rounded-full bg-slate-600" />
                        </span>
                        Available ({unselectedItems.length})
                      </p>
                    </div>
                  )}
                  {unselectedItems.map((item) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-all border border-transparent text-slate-300 hover:bg-white/5 hover:border-white/10 hover:text-white group"
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggle(item)}
                        className="h-3.5 w-3.5 shrink-0 rounded border-white/20 bg-[#0f1219] text-emerald-600 focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-0 transition-all cursor-pointer hover:border-white/30"
                      />
                      <span className="font-semibold truncate flex-1" title={item}>
                        {item}
                      </span>
                    </label>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/50 mb-3">
                <Search className="h-5 w-5 text-slate-600" />
              </div>
              <p className="text-xs font-semibold text-slate-500 mb-1">No members found</p>
              {searchQuery && (
                <p className="text-[10px] text-slate-600">Try a different search term</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Section */}
      <div className="border-t border-white/10 bg-[#0a0d14] px-4 py-2.5">
        <p className="text-[10px] font-semibold text-slate-500 text-center">
          {selected.length > 0 ? (
            <>
              <span className="text-emerald-400 font-bold">{selected.length}</span> of{' '}
              <span className="text-slate-400">{items.length}</span> members selected
            </>
          ) : (
            <>No members selected</>
          )}
        </p>
      </div>
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
  const [showMembersModal, setShowMembersModal] = useState(false)
  const isCompleted = project.status === 'Completed'
  const isCancelled = project.status === 'Cancelled'
  const isRejected = project.status === 'Rejected'

  const projectInitial =
    project.name.charAt(project.name.indexOf(' ') + 1) || project.name.charAt(0)

  // Prepare team members display (always show for both public and private)
  const displayMembers = project.accessType === 'public' 
    ? [] 
    : project.visibleUsers.filter(u => u !== project.teamLead)

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 animate-fadeIn',
        isCompleted
          ? 'border-emerald-500/20 bg-gradient-to-br from-[#1a1f2e] to-[#161922] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] hover:border-emerald-500/40 hover:shadow-[0_8px_32px_-8px_rgba(16,185,129,0.15)]'
          : 'border-white/[0.08] bg-gradient-to-br from-[#1a1f2e] to-[#161922] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] hover:border-emerald-500/30 hover:shadow-[0_8px_32px_-8px_rgba(16,185,129,0.12)]'
      )}
    >
      {/* Top accent bar */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-1 rounded-t-2xl",
        isCompleted ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-emerald-500/50 to-cyan-500/50"
      )} />
      
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-black/[0.02] pointer-events-none rounded-2xl" />
      
      <div className="relative flex flex-col p-4">
        {/* Header Section: Avatar + Title + Status */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative">
            <span className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-lg ring-2 transition-all duration-300 group-hover:scale-105",
              isCompleted 
                ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 text-emerald-400 ring-emerald-500/30" 
                : "bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 text-emerald-400 ring-emerald-500/25"
            )}>
              {projectInitial}
            </span>
            {/* Status indicator dot */}
            <span className={cn(
              "absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#161922]",
              isCompleted ? "bg-emerald-500" : isCancelled || isRejected ? "bg-rose-500" : "bg-blue-500 animate-pulse"
            )} />
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className={cn(
              'text-[14px] font-bold leading-tight transition-colors font-display truncate mb-1',
              isCompleted ? 'text-emerald-400 group-hover:text-emerald-300' : 'text-slate-50 group-hover:text-emerald-400'
            )}>
              {project.name}
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 truncate">
              {project.client}
            </p>
          </div>
        </div>

        {/* Info Grid: Tech Node + Access + Status */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Technology Node */}
          <div className="col-span-2 flex items-center gap-2.5 rounded-lg border border-white/5 bg-[#0f1219] px-3 py-2.5">
            <Cpu className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
            <div className="min-w-0 flex-1">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight mb-0.5">Technology</span>
              <span className="block truncate text-[11px] font-bold font-mono text-slate-200 leading-tight">
                {project.technologyNode}
              </span>
            </div>
          </div>

          {/* Access Type */}
          <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-[#0f1219] px-3 py-2.5">
            {project.accessType === 'private' ? (
              <>
                <Lock className="h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight mb-0.5">Access</span>
                  <span className="block text-[10px] font-bold text-amber-400 leading-tight truncate">Private</span>
                </div>
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 shrink-0 text-sky-400" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight mb-0.5">Access</span>
                  <span className="block text-[10px] font-bold text-sky-400 leading-tight truncate">Public</span>
                </div>
              </>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-[#0f1219] px-3 py-2.5">
            {isCancelled ? (
              <>
                <X className="h-4 w-4 shrink-0 text-rose-400" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight mb-0.5">Status</span>
                  <span className="block text-[10px] font-bold text-rose-400 leading-tight truncate">Cancelled</span>
                </div>
              </>
            ) : isRejected ? (
              <>
                <X className="h-4 w-4 shrink-0 text-rose-400" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight mb-0.5">Status</span>
                  <span className="block text-[10px] font-bold text-rose-400 leading-tight truncate">Rejected</span>
                </div>
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight mb-0.5">Status</span>
                  <span className="block text-[10px] font-bold text-emerald-400 leading-tight truncate">Completed</span>
                </div>
              </>
            ) : (
              <>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 leading-tight mb-0.5">Status</span>
                  <span className="block text-[10px] font-bold text-blue-400 leading-tight truncate">In Progress</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Team Section */}
        <div className="rounded-lg border border-white/5 bg-[#0f1219] p-3 mb-3">
          <div className="space-y-2.5">
            {/* Team Lead */}
            <div className="flex items-center gap-2">
              <Crown className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-12 shrink-0">Lead</span>
              <span className="text-[11px] font-bold text-emerald-400 truncate flex-1" title={project.teamLead || 'Not assigned'}>
                {project.teamLead || <span className="text-slate-500">Not assigned</span>}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* Team Members */}
            <div className="flex items-center gap-2">
              {project.accessType === 'public' ? (
                <>
                  <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-12 shrink-0">Team</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 border border-sky-500/20 px-2 py-0.5">
                    <span className="text-[10px] font-bold text-sky-400">Public Access</span>
                  </span>
                </>
              ) : displayMembers.length > 0 ? (
                <>
                  <div className="h-3.5 w-3.5 shrink-0" /> {/* Spacer for alignment */}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-12 shrink-0">Team</span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <button
                      onClick={() => setShowMembersModal(true)}
                      className="text-left text-[10px] font-semibold text-slate-300 hover:text-emerald-400 transition-colors truncate flex-1"
                      title={displayMembers.join(', ')}
                    >
                      {displayMembers.slice(0, 2).join(', ')}
                    </button>
                    {displayMembers.length > 2 && (
                      <span className="inline-flex items-center rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 shrink-0">
                        <span className="text-[9px] font-bold text-slate-400">+{displayMembers.length - 2}</span>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="h-3.5 w-3.5 shrink-0" /> {/* Spacer for alignment */}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-12 shrink-0">Team</span>
                  <span className="text-[10px] font-semibold text-slate-500">No members</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={onEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-emerald-500/10 hover:text-emerald-400 hover:scale-105"
            title="Edit Project"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-rose-500/10 hover:text-rose-400 hover:scale-105"
            title="Archive Project"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showMembersModal && (
        <Modal
          isOpen={showMembersModal}
          title={`Team Members — ${project.name}`}
          onClose={() => setShowMembersModal(false)}
          size="md"
          theme="dark"
        >
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Project Lead</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <Crown className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-sm font-bold text-emerald-400">{project.teamLead || 'Not assigned'}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Team Members ({displayMembers.length})
              </p>
              {displayMembers.length > 0 ? (
                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/5 bg-[#111319] p-2 space-y-1">
                  {displayMembers.map((username) => (
                    <div key={username} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 rounded-md transition-colors">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-300 break-words">{username}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-center rounded-lg bg-[#111319] border border-white/5">
                  <p className="text-xs font-semibold text-slate-500">No team members assigned</p>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-white/5">
              <Button onClick={() => setShowMembersModal(false)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs py-1.5 px-3">
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
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

  // Prepare team members display (exclude lead from members list)
  const displayMembers = project.accessType === 'public' 
    ? [] 
    : project.visibleUsers.filter(u => u !== project.teamLead)

  return (
    <tr className={cn('group transition-colors border-b border-white/5 hover:bg-white/[0.02]', isCompleted ? 'bg-emerald-950/10' : '')}>
      {/* Project Name */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-xs font-extrabold text-emerald-400 ring-1 ring-emerald-500/25">
            {projectInitial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-slate-100 group-hover:text-emerald-400 transition-colors" title={project.name}>
              {project.name}
            </p>
          </div>
        </div>
      </td>

      {/* Client */}
      <td className="px-4 py-3.5">
        <span className="text-[12px] font-semibold text-slate-300 truncate block" title={project.client}>
          {project.client}
        </span>
      </td>

      {/* Technology Node */}
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#111319] px-2.5 py-1 text-[10.5px] font-bold text-slate-300 font-mono">
          <Cpu className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="truncate" title={project.technologyNode}>{project.technologyNode}</span>
        </span>
      </td>

      {/* Access Type */}
      <td className="px-4 py-3.5">
        {project.accessType === 'private' ? (
          <Badge variant="warning" className="border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 inline-flex items-center gap-1">
            <Lock className="h-3 w-3" /> Private
          </Badge>
        ) : (
          <Badge variant="info" className="border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400 inline-flex items-center gap-1">
            <Globe className="h-3 w-3" /> Public
          </Badge>
        )}
      </td>

      {/* Team (Lead + Members) - Redesigned */}
      <td className="px-4 py-3.5">
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Team Lead */}
          <div className="flex items-center gap-1.5">
            <Crown className="h-3 w-3 shrink-0 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-10 shrink-0">Lead</span>
            <span className="text-[11px] font-bold text-emerald-400 truncate flex-1" title={project.teamLead || 'Not assigned'}>
              {project.teamLead || <span className="text-slate-500">Not assigned</span>}
            </span>
          </div>
          
          {/* Team Members */}
          <div className="flex items-center gap-1.5">
            {project.accessType === 'public' ? (
              <>
                <Globe className="h-3 w-3 shrink-0 text-sky-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-10 shrink-0">Team</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5">
                  <span className="text-[10px] font-bold text-sky-400">Public Access</span>
                </span>
              </>
            ) : displayMembers.length > 0 ? (
              <>
                <div className="h-3 w-3 shrink-0" /> {/* Spacer for alignment */}
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-10 shrink-0">Team</span>
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-slate-400 truncate" title={displayMembers.join(', ')}>
                    {displayMembers.slice(0, 2).join(', ')}
                  </span>
                  {displayMembers.length > 2 && (
                    <span className="inline-flex items-center rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 shrink-0">
                      <span className="text-[9px] font-bold text-slate-400">+{displayMembers.length - 2}</span>
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="h-3 w-3 shrink-0" /> {/* Spacer for alignment */}
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-10 shrink-0">Team</span>
                <span className="text-[10px] font-semibold text-slate-500">No members</span>
              </>
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        {isCancelled ? (
          <Badge variant="neutral" className="border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Cancelled
          </Badge>
        ) : isRejected ? (
          <Badge variant="neutral" className="border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400 inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Rejected
          </Badge>
        ) : isCompleted ? (
          <Badge variant="success" className="border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </Badge>
        ) : (
          <Badge variant="info" className="border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            In Progress
          </Badge>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            title="Edit Project"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-amber-500/10 hover:text-amber-400"
            title="Archive Project"
          >
            <Archive className="h-3.5 w-3.5" />
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
    return [...data].sort((a, b) => b.hours - a.hours)
  }, [data])

  const maxHours = sortedData.length > 0 ? Math.max(...sortedData.map((d) => d.hours)) : 0

  return (
    <div className="space-y-2">
      {sortedData.map((item, idx) => {
        const percent = maxHours > 0 ? (item.hours / maxHours) * 100 : 0
        const hue = item.hue ?? Math.round((idx * 137.5) % 360)
        return (
          <div
            key={item.name}
            className="group relative overflow-hidden rounded-lg border border-white/[0.08] bg-gradient-to-r from-[#1a1f2e]/80 to-[#1a1f2e]/60 backdrop-blur-sm transition-all hover:border-white/[0.14] hover:from-[#1a1f2e]/90 hover:to-[#1a1f2e]/70 shadow-[0_2px_6px_rgba(0,0,0,0.2)]"
          >
            <div className="relative flex items-center gap-3 px-3 py-2.5">
              {/* Avatar Circle */}
              <div className="relative z-10 shrink-0">
                <Avatar name={item.name} size="sm" color={`hsl(${hue},60%,50%)`} />
              </div>

              {/* Name and Progress Bar */}
              <div className="relative z-10 min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white group-hover:text-emerald-400 transition-colors font-display drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                  {item.name}
                </p>
              </div>

              {/* Hours Display */}
              <div className="relative z-10 shrink-0">
                <span className="text-sm font-bold text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                  {item.hours.toFixed(1)}
                  <span className="text-[10px] ml-0.5 font-semibold text-slate-300">h</span>
                </span>
              </div>

              {/* Background Progress Bar */}
              <div
                className="absolute inset-0 opacity-25 transition-all duration-500 ease-out"
                style={{
                  width: `${percent}%`,
                  background: `linear-gradient(90deg, hsl(${hue}, 65%, 50%) 0%, hsl(${hue}, 70%, 55%) 100%)`,
                }}
              />
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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

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

  const fetchTimesheetsData = useCallback(async () => {
    const params: Record<string, string> = {
      from: tsStartDate,
      to: tsEndDate,
    }
    if (tsSearch.trim()) params.search = tsSearch.trim()

    try {
      const logsRes = await api.get('/timesheets', { params })
      const newTimesheets = logsRes.data
      
      // FIXED: Deduplicate by ID and use stable comparison to prevent flickering
      const deduped = new Map()
      newTimesheets.forEach((t: TimesheetLog) => {
        if (!deduped.has(t.id)) {
          deduped.set(t.id, t)
        }
      })
      const dedupedTimesheets = Array.from(deduped.values())
      
      // Only update state if data actually changed (prevents unnecessary re-renders)
      setTimesheets((prev) => {
        const isSame = JSON.stringify(prev) === JSON.stringify(dedupedTimesheets)
        return isSame ? prev : dedupedTimesheets
      })
      
      // Update last refresh timestamp
      setLastUpdated(new Date())
    } catch (err) {
      console.error(err)
      toast.error('Failed to load timesheet data.')
    }
  }, [tsStartDate, tsEndDate, tsSearch])

  const refreshAllData = useCallback(async () => {
    await Promise.all([fetchProjects(), fetchTimesheetsData()])
  }, [fetchProjects, fetchTimesheetsData])
  
  // FIXED: Add auto-refresh polling when timesheet tab is active
  useEffect(() => {
    if (activeTab !== 'timesheets') return
    
    // Initial load
    fetchTimesheetsData()
    
    // Poll every 15 seconds for real-time updates
    const pollInterval = setInterval(() => {
      fetchTimesheetsData()
    }, 15000)
    
    return () => clearInterval(pollInterval)
  }, [activeTab, fetchTimesheetsData])

  useEffect(() => {
    fetchProjects()
    fetchEmployees()
  }, [fetchProjects, fetchEmployees])

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
    let filtered = projects.filter((p) => {
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

    // Sort projects: In Progress → Cancelled/Rejected → Completed
    filtered.sort((a, b) => {
      const getStatusPriority = (status: string) => {
        if (status === 'Active') return 1
        if (status === 'Cancelled' || status === 'Rejected') return 2
        if (status === 'Completed') return 3
        return 4
      }
      return getStatusPriority(a.status) - getStatusPriority(b.status)
    })

    return filtered
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
    
    // Create a copy of visibleUsers array to ensure proper state update
    const assignedUsers = [...p.visibleUsers]
    
    setForm({
      name: p.name,
      client: p.client,
      technologyNode: p.technologyNode,
      accessType: p.accessType,
      description: p.description,
      visibleUsers: assignedUsers, // Pre-select assigned users
      teamLead: p.teamLead || '',
      status: (p.status === 'Rejected' ? 'Cancelled' : p.status) as 'Active' | 'Completed' | 'Cancelled',
    })
    
    // Debug log to verify data is loaded correctly
    console.log('Edit Project - Assigned Users:', assignedUsers)
    console.log('Edit Project - Access Type:', p.accessType)
    
    setModalOpen(true)
  }, [])




  const handleSaveProject = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!form.name.trim() || !form.client.trim() || !form.technologyNode.trim()) {
        toast.error('Please specify Project Name, Client, and Technology Node.')
        return
      }

      // Validate Technology Node format: must be (number)nm
      const techNodePattern = /^\d+nm$/
      if (!techNodePattern.test(form.technologyNode.trim())) {
        toast.error('Technology Node must be in the format: [number]nm (e.g., 7nm, 28nm, 5nm)')
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
      .sort((a, b) => b.hours - a.hours)
  }, [filteredTimesheets])
  
  // FIXED: Add live timer for active sessions to update aggregations every 15 seconds
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (activeTab !== 'timesheets') return
    
    // Check if there are any active sessions (no logout time)
    const hasActiveSessions = filteredTimesheets.some(t => !t.logoutTime)
    
    if (!hasActiveSessions) return
    
    // Update every 15 seconds to recalculate hours for active sessions
    const timer = setInterval(() => {
      forceUpdate(n => n + 1)
    }, 15000)
    
    return () => clearInterval(timer)
  }, [activeTab, filteredTimesheets])

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
    
    // Sort leaderboard alphabetically
    const sortedLeaderboard = [...leaderboard].sort((a, b) => a.name.localeCompare(b.name))

    // Create portrait PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.width || 595
    const pageHeight = doc.internal.pageSize.height || 842
    const marginX = 40
    const marginY = 40
    const contentWidth = pageWidth - marginX * 2

    const logo = await fetchExportLogo()

    // Emerald/Green color palette
    const colors = {
      emerald: {
        primary: [16, 185, 129] as [number, number, number],
        dark: [5, 150, 105] as [number, number, number],
        darker: [4, 120, 87] as [number, number, number],
        light: [209, 250, 229] as [number, number, number],
        veryLight: [236, 253, 245] as [number, number, number],
      },
      slate: {
        dark: [30, 41, 59] as [number, number, number],
        medium: [71, 85, 105] as [number, number, number],
        light: [148, 163, 184] as [number, number, number],
        veryLight: [226, 232, 240] as [number, number, number],
      },
      white: [255, 255, 255] as [number, number, number],
    }

    // ═══════════════════════════════════════════════════════════════
    // HEADER SECTION
    // ═══════════════════════════════════════════════════════════════
    let cursorY = marginY

    // Logo and Company Info Section
    let logoHeight = 0
    if (logo) {
      const scaled = scaleExportLogo(logo.width, logo.height, 55)
      const format = logo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(logo.dataUrl, format, marginX, cursorY, scaled.width, scaled.height)
      logoHeight = scaled.height
    }

    // Company name and report title (aligned to the right of logo)
    const textX = marginX + (logoHeight > 0 ? logoHeight + 20 : 0)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(...colors.slate.dark)
    doc.text('EPICAL LAYOUTS PVT LTD', textX, cursorY + 18)

    doc.setFontSize(13)
    doc.setTextColor(...colors.emerald.dark)
    doc.text('Timesheet Performance Report', textX, cursorY + 38)

    // Move cursor below logo/title section
    cursorY += Math.max(logoHeight, 45) + 20

    // Report metadata section (left-aligned, structured)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...colors.slate.medium)
    
    const metaLabelX = marginX
    const metaValueX = marginX + 90
    
    // Report Period
    doc.text('Report Period:', metaLabelX, cursorY)
    doc.setFont('helvetica', 'normal')
    doc.text(`${tsStartDate} to ${tsEndDate}`, metaValueX, cursorY)
    cursorY += 14
    
    // Generated
    doc.setFont('helvetica', 'bold')
    doc.text('Generated:', metaLabelX, cursorY)
    doc.setFont('helvetica', 'normal')
    doc.text(new Date().toLocaleString('en-US', { 
      month: 'short', 
      day: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true 
    }), metaValueX, cursorY)
    cursorY += 14
    
    // Total Entries
    doc.setFont('helvetica', 'bold')
    doc.text('Total Entries:', metaLabelX, cursorY)
    doc.setFont('helvetica', 'normal')
    doc.text(String(filteredTimesheets.length), metaValueX, cursorY)
    cursorY += 20

    // Header divider with emerald accent
    doc.setDrawColor(...colors.emerald.primary)
    doc.setLineWidth(2)
    doc.line(marginX, cursorY, pageWidth - marginX, cursorY)
    
    doc.setDrawColor(...colors.slate.veryLight)
    doc.setLineWidth(0.5)
    doc.line(marginX, cursorY + 2, pageWidth - marginX, cursorY + 2)

    cursorY += 20

    // ═══════════════════════════════════════════════════════════════
    // CHARTS SECTION
    // ═══════════════════════════════════════════════════════════════

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

    // Enhanced 3D Bar with emerald gradient
    const drawEnhancedBar = (x: number, y: number, width: number, height: number, color: [number, number, number]) => {
      const adjustColor = (c: [number, number, number], percent: number) => {
        return c.map(v => Math.min(255, Math.max(0, Math.round(v * (1 + percent))))) as [number, number, number]
      }

      const frontColor = color
      const topColor = adjustColor(color, 0.25)
      const rightColor = adjustColor(color, -0.25)
      const depth = 4

      // Front face
      doc.setFillColor(...frontColor)
      doc.rect(x, y, width, height, 'F')

      // Top face
      doc.setFillColor(...topColor)
      doc.triangle(x, y, x + depth, y - depth, x + width + depth, y - depth, 'F')
      doc.triangle(x, y, x + width + depth, y - depth, x + width, y, 'F')

      // Right face
      doc.setFillColor(...rightColor)
      doc.triangle(x + width, y, x + width + depth, y - depth, x + width + depth, y - depth + height, 'F')
      doc.triangle(x + width, y, x + width + depth, y - depth + height, x + width, y + height, 'F')

      // Subtle highlight
      doc.setDrawColor(...adjustColor(color, 0.4))
      doc.setLineWidth(0.5)
      doc.line(x, y, x + width, y)
    }

    // Calculate chart dimensions (stacked vertically for portrait)
    const maxBarWidth = contentWidth * 0.6

    // ─────────────────────────────────────────────────────────────
    // PROJECT HOURS (Stacked Vertically)
    // ─────────────────────────────────────────────────────────────

    // Section header
    doc.setFillColor(...colors.emerald.primary)
    doc.rect(marginX, cursorY, 4, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...colors.slate.dark)
    doc.text('PROJECT HOURS', marginX + 10, cursorY + 11)

    cursorY += 24

    const maxProjectHours = Math.max(...hoursByProject.map(p => p.hours), 1)
    const avgProjectHours = hoursByProject.length > 0 
      ? hoursByProject.reduce((sum, p) => sum + p.hours, 0) / hoursByProject.length 
      : 0

    hoursByProject.forEach((p, idx) => {
      // Check if we need a new page
      if (cursorY > pageHeight - 80) {
        doc.addPage()
        cursorY = marginY
      }

      const barWidth = Math.max(8, (p.hours / maxProjectHours) * maxBarWidth)
      const isAboveAvg = p.hours > avgProjectHours
      const barColor = isAboveAvg ? colors.emerald.primary : colors.emerald.dark

      drawEnhancedBar(marginX, cursorY, barWidth, 10, barColor)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...colors.slate.dark)
      const hoursText = `${formatExportHours(p.hours)}`
      doc.text(hoursText, marginX + barWidth + 8, cursorY + 8)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...colors.slate.medium)
      const projectName = p.name.length > 45 ? p.name.substring(0, 42) + '...' : p.name
      doc.text(projectName, marginX + barWidth + 8 + doc.getTextWidth(hoursText) + 6, cursorY + 8)

      cursorY += 14
    })

    cursorY += 20

    // ─────────────────────────────────────────────────────────────
    // EMPLOYEE HOURS (Stacked Vertically)
    // ─────────────────────────────────────────────────────────────

    // Section header
    doc.setFillColor(...colors.emerald.primary)
    doc.rect(marginX, cursorY, 4, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...colors.slate.dark)
    doc.text('EMPLOYEE HOURS', marginX + 10, cursorY + 11)

    cursorY += 24

    const maxEmployeeHours = Math.max(...sortedLeaderboard.map(e => e.hours), 1)

    sortedLeaderboard.forEach((e, idx) => {
      // Check if we need a new page
      if (cursorY > pageHeight - 80) {
        doc.addPage()
        cursorY = marginY
      }

      const barWidth = Math.max(8, (e.hours / maxEmployeeHours) * maxBarWidth)
      const hue = Math.round((idx * 137.5) % 360)
      const barColor = hslToRgb(hue, 70, 45)

      drawEnhancedBar(marginX, cursorY, barWidth, 10, barColor)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...colors.slate.dark)
      const hoursText = `${formatExportHours(e.hours)}`
      doc.text(hoursText, marginX + barWidth + 8, cursorY + 8)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...colors.slate.medium)
      const empName = e.name.length > 40 ? e.name.substring(0, 37) + '...' : e.name
      doc.text(empName, marginX + barWidth + 8 + doc.getTextWidth(hoursText) + 6, cursorY + 8)

      cursorY += 14
    })

    cursorY += 20

    // ═══════════════════════════════════════════════════════════════
    // DETAILED TIME LOGS TABLE
    // ═══════════════════════════════════════════════════════════════

    // Check if we need a new page
    if (cursorY > pageHeight - 150) {
      doc.addPage()
      cursorY = marginY
    }

    // Section divider
    doc.setDrawColor(...colors.slate.veryLight)
    doc.setLineWidth(0.5)
    doc.line(marginX, cursorY, pageWidth - marginX, cursorY)
    cursorY += 16

    // Section title
    doc.setFillColor(...colors.emerald.primary)
    doc.rect(marginX, cursorY, 4, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...colors.slate.dark)
    doc.text('DETAILED TIME LOGS', marginX + 10, cursorY + 11)
    cursorY += 24

    // Prepare table data
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
        return `${hrs}h ${mins}m`
      })()
      
      return [
        `${t.employeeName} (${t.employeeId})`,
        t.project,
        formatDateTime(t.loginTime),
        t.logoutTime ? formatDateTime(t.logoutTime) : '—',
        durationStr,
      ]
    })

    // Enhanced table theme with emerald styling
    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: cursorY,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 6,
        overflow: 'linebreak',
        lineColor: colors.slate.veryLight,
        lineWidth: 0.5,
        valign: 'middle',
      },
      headStyles: {
        fillColor: colors.emerald.dark,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
        valign: 'middle',
        cellPadding: 8,
        overflow: 'linebreak',
        minCellHeight: 20,
      },
      alternateRowStyles: {
        fillColor: colors.emerald.veryLight,
      },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.23, halign: 'left', valign: 'middle' },
        1: { cellWidth: contentWidth * 0.21, halign: 'left', valign: 'middle' },
        2: { cellWidth: contentWidth * 0.21, halign: 'center', valign: 'middle' },
        3: { cellWidth: contentWidth * 0.21, halign: 'center', valign: 'middle' },
        4: { cellWidth: contentWidth * 0.14, halign: 'right', valign: 'middle', fontStyle: 'bold' },
      },
      didDrawCell: (data) => {
        // Override header alignment for Duration column
        if (data.section === 'head' && data.column.index === 4) {
          const cell = data.cell
          const text = cell.text[0]
          const cellWidth = cell.width
          const cellX = cell.x
          const cellY = cell.y
          
          // Clear the cell and redraw with right alignment
          doc.setFillColor(...colors.emerald.dark)
          doc.rect(cellX, cellY, cellWidth, cell.height, 'F')
          
          doc.setTextColor(...colors.white)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.text(text, cellX + cellWidth - 8, cellY + cell.height / 2, { 
            align: 'right',
            baseline: 'middle'
          })
        }
      },
      margin: { left: marginX, right: marginX, bottom: 60 },
      didDrawPage: (data) => {
        // Ensure consistent spacing
      },
    })

    // ═══════════════════════════════════════════════════════════════
    // FOOTER ON EVERY PAGE
    // ═══════════════════════════════════════════════════════════════
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      
      // Footer divider
      doc.setDrawColor(...colors.emerald.primary)
      doc.setLineWidth(1)
      doc.line(marginX, pageHeight - 35, pageWidth - marginX, pageHeight - 35)

      // Footer text
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...colors.slate.light)
      doc.text('Confidential – EPICAL Timesheet Data', marginX, pageHeight - 20)
      
      doc.setFont('helvetica', 'bold')
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 20, { align: 'right' })
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
  return (
    <PageWrapper className="dashboard-surface py-4 sm:py-5">
      <div className="crewiq-dashboard">
        {/* ── Compact admin header: tabs + contextual actions ───────────────── */}
        <div className="sticky top-0 z-30 -mx-4 mb-5 border-b border-white/[0.08] bg-gradient-to-b from-[#0c0f1a] to-[#0c0f1a]/95 px-4 py-3 backdrop-blur-xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-gradient-to-b from-[#0f1219] to-[#0a0d12] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            {[
              { key: 'projects' as const, label: 'Projects', icon: FolderOpen, count: filteredProjects.length },
              { key: 'timesheets' as const, label: 'Timesheets', icon: Clock, count: filteredTimesheets.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-[7px] text-[12px] font-bold transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3),0_1px_2px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.1)_inset]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums leading-none ${
                    activeTab === tab.key ? 'bg-white/20 text-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]' : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeTab === 'projects' && (
              <>
                <Button
                  onClick={() => setArchivedModalOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-0 text-[12px] font-bold text-slate-300 transition-all hover:bg-white/[0.08] hover:border-white/[0.16] hover:text-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                >
                  <Archive className="h-3.5 w-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Archived</span>
                </Button>
                <Button
                  onClick={openCreateProject}
                  className="flex h-8 items-center gap-1.5 rounded-lg border-0 bg-gradient-to-b from-emerald-500 to-emerald-600 px-3.5 py-0 text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(16,185,129,0.3),0_1px_2px_rgba(0,0,0,0.3)] transition-all hover:from-emerald-400 hover:to-emerald-500 hover:shadow-[0_4px_16px_rgba(16,185,129,0.4)]"
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
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 bg-gradient-to-b from-rose-500/10 to-rose-500/5 px-3 text-[12px] font-bold text-rose-400 transition-all hover:from-rose-500/15 hover:to-rose-500/10 hover:border-rose-500/30 shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  title="Export timesheet data as PDF report"
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                  <span>PDF Report</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 px-3 text-[12px] font-bold text-emerald-400 transition-all hover:from-emerald-500/15 hover:to-emerald-500/10 hover:border-emerald-500/30 shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                  title="Export timesheet data as Excel spreadsheet"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>Excel</span>
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
        <div className="space-y-5 pb-16 animate-fadeIn">
          {/* Project metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Total Projects"
              value={projectMetrics.total}
              icon={FolderOpen}
              accentClass="bg-gradient-to-r from-slate-400 to-slate-500"
              iconClassName="bg-slate-500/10 text-slate-300 ring-slate-500/15"
              secondaryText="All registered projects"
            />
            <MetricCard
              label="In Progress"
              value={projectMetrics.inProgress}
              icon={ArrowUpRight}
              accentClass="bg-gradient-to-r from-emerald-500 to-emerald-400"
              iconClassName="bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
              secondaryText="Currently active"
            />
            <MetricCard
              label="Completed"
              value={projectMetrics.completed}
              icon={CheckCircle2}
              accentClass="bg-gradient-to-r from-teal-500 to-teal-400"
              iconClassName="bg-teal-500/10 text-teal-400 ring-teal-500/20"
              secondaryText="Successfully delivered"
            />
          </div>

          {/* Search & filters toolbar */}
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#161922] to-[#13161f] p-3.5 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 sm:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects, clients, tech nodes…"
                    className="h-9 w-full rounded-lg border border-white/10 bg-[#0d0f15] pl-9 pr-8 text-sm font-semibold text-slate-200 outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-[#0d0f15] focus:ring-2 focus:ring-emerald-500/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all shadow-[0_1px_3px_rgba(0,0,0,0.2)] ${
                    showFilters || activeFiltersCount > 0
                      ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/15 to-emerald-500/10 text-emerald-400'
                      : 'border-white/10 bg-gradient-to-b from-[#0d0f15] to-[#0a0c11] text-slate-300 hover:from-white/[0.06] hover:to-white/[0.03]'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-black text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-xs font-semibold text-slate-400 tabular-nums">
                  <span className="font-bold text-slate-100">{filteredProjects.length}</span>
                  <span className="text-slate-500"> / {projects.length}</span>
                </p>

                <div className="flex rounded-lg border border-white/10 bg-[#111319] p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`rounded-md p-2 transition-all ${
                      viewMode === 'grid'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-450 hover:text-slate-200'
                    }`}
                    title="Grid layout"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`rounded-md p-2 transition-all ${
                      viewMode === 'list'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-455 hover:text-slate-200'
                    }`}
                    title="List layout"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {showFilters && (
              <div className="mt-3 border-t border-white/5 pt-3 animate-fadeIn">
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
                  <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2.5">
                    <p className="text-xs font-semibold text-slate-450">
                      {activeFiltersCount} filter{activeFiltersCount === 1 ? '' : 's'} active
                    </p>
                    <button
                      onClick={clearProjectsFilters}
                      className="text-xs font-bold text-emerald-450 hover:text-emerald-350 transition-colors"
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
            <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#161922] shadow-[0_2px_12px_-3px_rgba(0,0,0,0.35)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-[#0e1119]">
                      <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-500">
                        Project Details
                      </th>
                      <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-500">
                        Client
                      </th>
                      <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-500">
                        Technology Node
                      </th>
                      <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-500">
                        Access Control
                      </th>
                      <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-500">
                        Visibility Scope
                      </th>
                      <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-500">
                        Status
                      </th>
                      <th className="px-5 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-500">
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
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
              <span className="text-[11px] font-semibold text-slate-500">
                Showing {indexOfFirstProject + 1}–{Math.min(indexOfLastProject, filteredProjects.length)} of {filteredProjects.length} projects
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={projectsCurrentPage === 1}
                  onClick={() => setProjectsCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-white/[0.08] bg-[#161922] px-3 text-[11px] font-bold text-slate-400 transition-all hover:bg-white/[0.04] hover:text-slate-200 disabled:opacity-40 disabled:pointer-events-none"
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
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'border border-white/[0.06] bg-[#161922] text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={projectsCurrentPage === totalProjectsPages}
                  onClick={() => setProjectsCurrentPage((p) => Math.min(totalProjectsPages, p + 1))}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-white/[0.08] bg-[#161922] px-3 text-[11px] font-bold text-slate-400 transition-all hover:bg-white/[0.04] hover:text-slate-200 disabled:opacity-40 disabled:pointer-events-none"
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
        <div className="space-y-5 pb-16 animate-fadeIn">
          {/* Timesheets filter toolbar */}
          <div className="rounded-xl border border-white/[0.06] bg-[#161922] p-3.5 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-2 xl:grid-cols-[minmax(11rem,1.4fr)_auto_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(7.5rem,0.9fr)_auto]">
                <div className="relative min-w-0 md:col-span-2 xl:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={tsSearch}
                    onChange={(e) => setTsSearch(e.target.value)}
                    placeholder="Search employees, projects…"
                    className="h-9 w-full rounded-lg border border-white/10 bg-[#111319] pl-9 pr-8 text-sm font-semibold text-slate-200 outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-[#111319]/80 focus:ring-2 focus:ring-emerald-500/10"
                  />
                  {tsSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => setTsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
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
                  <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-[#111319] px-3 text-xs font-semibold text-slate-350">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-bold text-slate-100 tabular-nums">{filteredTimesheets.length}</span>
                      <span className="text-slate-500">logs</span>
                    </span>
                    <span className="h-3 w-px bg-white/10" />
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Auto-refresh
                    </span>
                  </span>
                  {hasActiveTimesheetFilters && (
                    <button
                      type="button"
                      onClick={clearTimesheetFilters}
                      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-[#111319] px-2.5 text-xs font-bold text-slate-350 transition-colors hover:bg-white/[0.04] hover:text-white"
                      title="Reset filters"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {hasActiveTimesheetFilters && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Active</span>

                {tsSearch.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#111319] px-2 py-1 text-xs font-semibold text-slate-300">
                    Search: &quot;{tsSearch}&quot;
                    <button
                      type="button"
                      onClick={() => setTsSearch('')}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}

                {tsEmployeeFilters.map((empName) => (
                  <span
                    key={empName}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400"
                  >
                    {empName}
                    <button
                      type="button"
                      onClick={() => setTsEmployeeFilters(tsEmployeeFilters.filter((name) => name !== empName))}
                      className="text-emerald-555 text-emerald-400 hover:text-emerald-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {tsProjectFilters.map((proj) => (
                  <span
                    key={proj}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#111319] px-2 py-1 text-xs font-semibold text-slate-300"
                  >
                    {proj}
                    <button
                      type="button"
                      onClick={() => setTsProjectFilters(tsProjectFilters.filter((p) => p !== proj))}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {tsStatusFilters.map((status) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-400"
                  >
                    {status}
                    <button
                      type="button"
                      onClick={() => setTsStatusFilters(tsStatusFilters.filter((s) => s !== status))}
                      className="text-blue-500/70 hover:text-blue-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={clearTimesheetFilters}
                  className="ml-auto text-xs font-bold text-emerald-450 hover:text-emerald-350"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Analytics panels */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#161922] to-[#13161f] p-5 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]">
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <h3 className="type-card-label-caps flex items-center gap-2 text-emerald-400 font-extrabold">
                  <span className="h-3.5 w-1 shrink-0 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  Aggregated Hours by Project
                </h3>
                {derivedHoursByProject.length > 0 && (
                  <span className="text-xs text-slate-400 font-mono font-bold">
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
                          const cardBg = isGreaterThanAverage ? 'bg-[#4aaf7d]' : 'bg-[#a78bfa]'
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
                <div className="flex h-60 items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-[#0d0f15] text-sm font-semibold text-slate-500 sm:h-64 shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]">
                  No data logs available in the chosen dates.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#161922] to-[#13161f] p-5 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]">
              <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <h3 className="flex items-center gap-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  Aggregated Hours by Employee
                </h3>
                {derivedLeaderboardData.length > 0 && (
                  <span className="text-sm font-bold text-slate-400 tabular-nums">
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
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#161922] to-[#13161f] shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)]">
            <div className="max-h-[min(32rem,70vh)] overflow-auto timesheet-panel-scroll">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-white/[0.1] bg-gradient-to-b from-[#0e1119] to-[#0b0d12] shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">Employee</th>
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">Project</th>
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">Login Time</th>
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">Logout Time</th>
                    <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-400">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-sm">
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
                        className="group transition-colors hover:bg-white/[0.03] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
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
                              <p className="truncate font-bold text-slate-100 leading-tight">
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
                            <p className="flex items-center gap-1 font-bold text-slate-200 transition-colors group-hover/btn:text-emerald-450">
                              <span className="truncate">{t.project}</span>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 text-emerald-500 transition-all group-hover/btn:opacity-100" />
                            </p>
                          </button>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <p className="font-semibold text-slate-300">{formatDateTime(t.loginTime)}</p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-3.5">
                          <p className="font-semibold text-slate-300">
                            {t.logoutTime ? formatDateTime(t.logoutTime) : '—'}
                          </p>
                        </td>

                        <td className="px-5 py-3.5">
                          {t.logoutTime ? (
                            <span className="inline-flex rounded-lg border border-white/[0.12] bg-gradient-to-b from-[#0d0f15] to-[#0a0c11] px-2.5 py-1 text-slate-200 font-mono text-xs font-bold shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]">
                              {formatAdminDuration(hours)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 px-2.5 py-1 text-emerald-400 font-mono text-xs font-bold shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              {formatAdminDuration(hours)} (Live)
                            </span>
                          )}
                          {t.autoCheckedOut && (
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                              Auto Checked-Out
                            </p>
                          )}
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
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
              <span className="text-[11px] font-semibold text-slate-500">
                Showing {indexOfFirstTimesheet + 1}–{Math.min(indexOfLastTimesheet, filteredTimesheets.length)} of {filteredTimesheets.length} logs
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={timesheetsCurrentPage === 1}
                  onClick={() => setTimesheetsCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-white/[0.08] bg-[#161922] px-3 text-[11px] font-bold text-slate-400 transition-all hover:bg-white/[0.04] hover:text-slate-200 disabled:opacity-40 disabled:pointer-events-none"
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
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'border border-white/[0.06] bg-[#161922] text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={timesheetsCurrentPage === totalTimesheetsPages}
                  onClick={() => setTimesheetsCurrentPage((p) => Math.min(totalTimesheetsPages, p + 1))}
                  className="inline-flex h-7 items-center justify-center rounded-lg border border-white/[0.08] bg-[#161922] px-3 text-[11px] font-bold text-slate-400 transition-all hover:bg-white/[0.04] hover:text-slate-200 disabled:opacity-40 disabled:pointer-events-none"
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
        theme="dark"
      >
        <form onSubmit={handleSaveProject} className="space-y-4 pt-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Project Name"
              placeholder="e.g. Project Apollo"
              value={form.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
              required
              theme="dark"
            />
            <Input
              label="Client Name"
              placeholder="e.g. Globex Electronics"
              value={form.client}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, client: e.target.value })}
              required
              theme="dark"
            />
          </div>

          <div className="w-full">
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Technology Node
            </label>
            <Input
              label=""
              placeholder="e.g. 7nm, 28nm, 5nm"
              value={form.technologyNode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value
                // Allow typing numbers followed by optional 'nm'
                // This regex allows: "7", "7n", "7nm", "28", "28nm", etc.
                if (value === '' || /^\d+n?m?$/.test(value)) {
                  setForm({ ...form, technologyNode: value })
                }
              }}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                const value = e.target.value.trim()
                // Auto-append 'nm' if user only typed numbers
                if (value && /^\d+$/.test(value)) {
                  setForm({ ...form, technologyNode: value + 'nm' })
                }
              }}
              required
              theme="dark"
            />
            <p className="mt-1 text-[10px] font-semibold text-slate-500">
              Format: [number]nm (e.g., 7nm, 28nm, 5nm)
            </p>
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
            theme="dark"
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
            theme="dark"
          />

          {/* Conditional private security rules */}
          {form.accessType === 'private' && (
            <div className="animate-fadeIn">
              <CheckboxList
                label="Allowed Users"
                items={employees.map((e) => `${e.firstName} ${e.lastName || ''}`.trim())}
                selected={form.visibleUsers}
                onChange={(next) => setForm({ ...form, visibleUsers: next })}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Project Description
            </label>
            <textarea
              placeholder="Provide a detailed scope of this project, goals, and standard specifications..."
              value={form.description}
              onChange={(e) => {
                const newValue = e.target.value
                setForm({ ...form, description: enforceMaxWords(newValue) })
              }}
              rows={4}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#111319] p-3 text-xs text-white outline-none transition-all placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 leading-relaxed"
              style={{ 
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}
              required
            />
            <p
              className={`mt-1 text-right text-[11px] font-semibold ${
                countWords(form.description) >= MAX_PROJECT_DESCRIPTION_WORDS
                  ? 'text-amber-500'
                  : 'text-slate-500'
              }`}
            >
              {countWords(form.description)} / {MAX_PROJECT_DESCRIPTION_WORDS} words
            </p>
          </div>

          {modalMode === 'edit' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Project Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Completed' | 'Cancelled' })}
                className="w-full rounded-xl border border-white/10 bg-[#111319] p-2.5 text-xs text-white outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="Active">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-white/5 pt-4 mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              disabled={loading}
              className="rounded-xl font-bold py-2 px-4 border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
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
          theme="dark"
        />
      )}

      {/* Archived Projects Browser Modal */}
      <ArchivedProjectsModal
        isOpen={archivedModalOpen}
        onClose={() => setArchivedModalOpen(false)}
        onRefreshActiveProjects={refreshAllData}
      />
      </div>
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#111319] py-14 px-6">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]">
        <FolderOpen className="h-5 w-5 text-slate-500" />
      </div>
      <p className="text-center text-sm font-semibold text-slate-400">{message}</p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-4 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 hover:bg-emerald-500/15 py-2 px-4 rounded-lg border border-emerald-500/20"
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
    <Modal isOpen={isOpen} title="" onClose={onClose} size="md" theme="dark">
      {/* Sleek icon header */}
      <div className="-mt-10 mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-md">
          <Archive className="h-4 w-4 text-white" />
        </div>
        <h3 className="text-sm font-black text-white leading-tight">Archive Project</h3>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-slate-300 font-bold leading-relaxed">
          Are you sure you want to archive project <strong className="text-white font-extrabold">"{projectName}"</strong>?
        </p>
        <p className="text-xs text-slate-400 font-semibold leading-relaxed">
          This will safely move the project and its complete history (assigned tasks and timesheet logs) to separate archived storage. Active dashboards stay clean. You can restore the project at any time.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="rounded-xl font-bold py-2 px-4 text-xs h-9 border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
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

