import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { Modal } from '@components/ui/Modal'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { ProjectTasksModal } from '@components/modals/ProjectTasksModal'
import { ProjectAuditTrailModal } from '@components/modals/ProjectAuditTrailModal'
import { ArchivedProjectsModal } from '@components/modals/ArchivedProjectsModal'
import { toast } from 'sonner'
import {
  Clock,
  Users,
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
  UserCheck,
  TrendingUp,
  Sliders,
  FileText,
  Edit2,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatDate } from '@/utils/formatDate'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import api from '@/services/api'
import { getEmployees } from '@/services/employeeService'
import type { Employee } from '@/types'

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
}

/* ================================================================
   MOCK DATA
   ================================================================ */
const MOCK_EMPLOYEES = [
  { id: 'E-1001', name: 'Asha Menon', department: 'Design', hue: 155 },
  { id: 'E-1002', name: 'Rahul Verma', department: 'Verification', hue: 210 },
  { id: 'E-1003', name: 'Meera Nair', department: 'Hardware', hue: 335 },
  { id: 'E-1004', name: 'Amit Patel', department: 'R&D', hue: 35 },
  { id: 'E-1005', name: 'Priya Das', department: 'Operations', hue: 270 },
  { id: 'E-1006', name: 'Kiran Rao', department: 'Design', hue: 190 },
  { id: 'E-1007', name: 'Sneha Iyer', department: 'Verification', hue: 10 },
  { id: 'E-1008', name: 'Vikram Singh', department: 'R&D', hue: 60 },
]

const MOCK_TEAMS = [
  'Design Team',
  'Verification Team',
  'R&D Team',
  'Hardware Team',
  'Operations Team',
]


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
        dept: emp?.department ?? '—',
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

/** Simplified operational status for the Timesheets log view (read-only). */
const getTimesheetWorkflowStatus = (
  t: Pick<TimesheetLog, 'logoutTime' | 'taskStatus' | 'status' | 'requestStatus'>
): 'Completed' | 'In Progress' => {
  const isCompleted =
    !!t.logoutTime &&
    t.taskStatus === 'Completed' &&
    t.status === 'Approved' &&
    t.requestStatus !== 'Pending Review' &&
    t.requestStatus !== 'Rejected'
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
  secondaryText,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  accentClass: string
  secondaryText?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <div className={`absolute inset-x-0 top-0 h-[4px] ${accentClass}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-slate-800 tracking-tight">
            {value}
          </p>
          {secondaryText && (
            <p className="mt-1 text-xs text-slate-400 font-medium">{secondaryText}</p>
          )}
        </div>
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentClass} bg-opacity-10 transition-all duration-300 group-hover:scale-105`}
        >
          <Icon className="h-5 w-5" />
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
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <CalendarIcon className="h-4 w-4 text-emerald-650" />
        {preset === 'Custom' && startDate === endDate
          ? formatDate(startDate)
          : preset === 'Custom'
            ? `${formatDate(startDate)} – ${formatDate(endDate)}`
            : `${preset} (${formatDate(startDate)} – ${formatDate(endDate)})`}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
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
    <div className="flex -space-x-2.5 overflow-hidden">
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold shadow-sm ring-1 ring-slate-200/30"
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
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[9px] font-black text-slate-750 shadow-sm ring-1 ring-slate-200/30">
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
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-xs font-bold outline-none transition-all ${
          open || selected.length > 0
            ? 'border-emerald-500 text-slate-700 ring-4 ring-emerald-500/10'
            : 'border-slate-250 text-slate-600 hover:border-slate-300'
        }`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
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
function ProjectCard({
  project,
  onEdit,
  onDelete,
  onTasks,
  onStatusChange,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  onTasks: () => void
  onStatusChange: (status: 'Active' | 'Completed' | 'Cancelled') => void
}) {
  const isCompleted = project.status === 'Completed'
  const isCancelled = project.status === 'Cancelled'
  const isRejected = project.status === 'Rejected'
  const isActive = project.status === 'Active'

  // Visibility/scope summary
  const visibilitySummary =
    project.accessType === 'private'
      ? `${project.visibleUsers.length} Users · Lead: ${project.teamLead || 'Not assigned'}`
      : 'All Members'

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 animate-fadeIn">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-xs">
              {project.name.charAt(project.name.indexOf(' ') + 1) || project.name[0]}
            </span>
            <div>
              <h3 className="font-bold text-slate-700 leading-snug group-hover:text-emerald-700 transition-colors">
                {project.name}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Client: {project.client}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {isCancelled ? (
              <Badge variant="danger" className="py-0.5 px-2 bg-rose-50 text-rose-700 border border-rose-100 text-[10px]">
                <X className="mr-1 h-3 w-3" /> Cancelled
              </Badge>
            ) : isRejected ? (
              <Badge variant="danger" className="py-0.5 px-2 bg-rose-50 text-rose-700 border border-rose-100 text-[10px]">
                <X className="mr-1 h-3 w-3" /> Rejected
              </Badge>
            ) : isCompleted ? (
              <Badge variant="neutral" className="bg-slate-100 text-slate-600 border border-slate-200 py-0.5 px-2 text-[10px]">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
              </Badge>
            ) : (
              <Badge variant="info" className="py-0.5 px-2 bg-blue-50 text-blue-700 border border-blue-100 text-[10px]">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                In Progress
              </Badge>
            )}
            {project.accessType === 'private' ? (
              <Badge variant="warning" className="py-0.5 px-2 bg-amber-50 text-amber-700 border border-amber-100 text-[10px]">
                <Lock className="mr-1 h-3 w-3 text-amber-500" /> Private
              </Badge>
            ) : (
              <Badge variant="info" className="py-0.5 px-2 bg-sky-50 text-sky-700 border border-sky-100 text-[10px]">
                <Globe className="mr-1 h-3 w-3 text-sky-500" /> Public
              </Badge>
            )}
          </div>
        </div>

        <p className="mt-2 text-[10px] font-semibold text-slate-400">
          Visibility Scope: {visibilitySummary}
        </p>

        {/* Access controls & Team Layout Redesign */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-50 pt-3">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-150 px-2 py-0.5 text-[10px] font-bold text-slate-500 font-mono">
              <Cpu className="h-2.5 w-2.5 text-slate-400" />
              {project.technologyNode}
            </span>
            {project.accessType === 'private' && project.teamLead && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50/50 border border-emerald-100/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <UserCheck className="h-2.5 w-2.5 text-emerald-500" />
                Lead: {project.teamLead}
              </span>
            )}
          </div>
          {project.accessType === 'private' && project.visibleUsers.length > 0 && (
            <AvatarGroup users={project.visibleUsers} max={3} />
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end border-t border-slate-100 pt-3.5">
        <div className="flex items-center gap-1">
          {isActive && (
            <>
              <button
                onClick={() => onStatusChange('Completed')}
                className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Mark as Completed"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onStatusChange('Cancelled')}
                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Cancel Project"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Edit Project"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="Archive Project"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   COMPONENT – Project Card List Row View
   ================================================================ */
function ProjectListRow({
  project,
  onEdit,
  onDelete,
  onTasks,
  onStatusChange,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  onTasks: () => void
  onStatusChange: (status: 'Active' | 'Completed' | 'Cancelled') => void
}) {
  const isCompleted = project.status === 'Completed'
  const isCancelled = project.status === 'Cancelled'
  const isRejected = project.status === 'Rejected'
  const isActive = project.status === 'Active'

  return (
    <tr className="group transition-colors hover:bg-slate-50/50">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-xs">
            {project.name.charAt(project.name.indexOf(' ') + 1) || project.name[0]}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-slate-700 truncate">{project.name}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-slate-500 font-medium">{project.client}</td>
      <td className="px-5 py-3.5">
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-150 px-2 py-0.5 text-[10px] font-bold text-slate-500 font-mono">
          <Cpu className="h-2.5 w-2.5 text-slate-400" />
          {project.technologyNode}
        </span>
      </td>
      <td className="px-5 py-3.5">
        {project.accessType === 'private' ? (
          <Badge variant="warning" className="py-0.5 px-2 bg-amber-50 text-amber-700 border border-amber-100">
            <Lock className="mr-1 h-3 w-3 text-amber-500" /> Private
          </Badge>
        ) : (
          <Badge variant="info" className="py-0.5 px-2 bg-sky-50 text-sky-700 border border-sky-100">
            <Globe className="mr-1 h-3 w-3 text-sky-500" /> Public
          </Badge>
        )}
      </td>
      <td className="px-5 py-3.5">
        {project.accessType === 'private' ? (
          <div className="flex items-center gap-2">
            {project.teamLead && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-100">
                Lead: {project.teamLead}
              </span>
            )}
            <AvatarGroup users={project.visibleUsers} max={3} />
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">All Members (Public)</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        {isCancelled ? (
          <Badge variant="danger" className="py-0.5 px-2 bg-rose-50 text-rose-700 border border-rose-100">
            <X className="mr-1 h-3 w-3" /> Cancelled
          </Badge>
        ) : isRejected ? (
          <Badge variant="danger" className="py-0.5 px-2 bg-rose-50 text-rose-700 border border-rose-100">
            <X className="mr-1 h-3 w-3" /> Rejected
          </Badge>
        ) : isCompleted ? (
          <Badge variant="neutral" className="bg-slate-100 text-slate-600 border border-slate-200 py-0.5 px-2">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
          </Badge>
        ) : (
          <Badge variant="info" className="py-0.5 px-2 bg-blue-50 text-blue-700 border border-blue-100">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            In Progress
          </Badge>
        )}
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {isActive && (
            <>
              <button
                onClick={() => onStatusChange('Completed')}
                className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Mark as Completed"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onStatusChange('Cancelled')}
                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Cancel Project"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Edit Project"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="Archive Project"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ================================================================
   COMPONENT – Employee Leaderboard / Progress Layout
   ================================================================ */
function EmployeeLeaderboard({
  data,
}: {
  data: { name: string; dept: string; hours: number; hue: number }[]
}) {
  const maxHours = data.length > 0 ? Math.max(...data.map((d) => d.hours)) : 0

  return (
    <div className="space-y-3.5">
      {data.map((item, idx) => {
        const percent = maxHours > 0 ? (item.hours / maxHours) * 100 : 0
        const isTop = idx < 3
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span
              className={`w-5 text-xs font-bold text-center ${
                isTop ? 'text-emerald-600 font-extrabold' : 'text-slate-400'
              }`}
            >
              #{idx + 1}
            </span>
            <Avatar name={item.name} size="sm" color={`hsl(${item.hue},55%,45%)`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="truncate">
                  {item.name}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">({item.dept})</span>
                </span>
                <span className="tabular-nums font-extrabold text-slate-800">{item.hours.toFixed(1)} hrs</span>
              </div>
              <div className="mt-1 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-400 to-emerald-650 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>
        )
      })}
      {data.length === 0 && (
        <p className="text-center text-slate-400 text-xs py-8">No hours logged in this period.</p>
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
  const [chartHoursByProject, setChartHoursByProject] = useState<{ name: string; hours: number }[]>([])
  const [leaderboardData, setLeaderboardData] = useState<{ name: string; dept: string; hours: number; hue: number }[]>([])
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

  // ── Project Modal States ────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])

  // ── Project Tasks Modal States ───────────────────────────────
  const [tasksModalOpen, setTasksModalOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProjectName, setSelectedProjectName] = useState<string>('')

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

  const handleBarClick = useCallback((data: any) => {
    if (!data) return
    
    // Check if clicked directly on Bar or through BarChart activePayload
    let pId = data.projectId || (data.payload && data.payload.projectId)
    let pName = data.name || (data.payload && data.payload.name)

    if (!pId && data.activePayload && data.activePayload[0]) {
      const payload = data.activePayload[0].payload
      pId = payload.projectId
      pName = payload.name
    }

    if (pId) {
      openAuditTrail(pId, pName)
    } else if (pName) {
      const found = allProjects.find(p => p.name === pName)
      if (found) {
        openAuditTrail(found.id, found.name)
      } else {
        toast.error(`Could not find project: ${pName}`)
      }
    }
  }, [allProjects, openAuditTrail])

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
  const [tsTeamFilters, setTsTeamFilters] = useState<string[]>([])
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
      const [logsRes, chartRes, leaderboardRes] = await Promise.all([
        api.get('/timesheets', { params }),
        api.get('/timesheets/hours-by-project', { params }),
        api.get('/timesheets/employee-hours', { params }),
      ])
      setTimesheets(logsRes.data)
      setChartHoursByProject(chartRes.data)
      setLeaderboardData(leaderboardRes.data)
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

  const getTeamLeadDepartment = useCallback((teamLeadName?: string) => {
    if (!teamLeadName) return undefined
    const emp = employees.find((e) => {
      const fullName = `${e.firstName} ${e.lastName || ''}`.trim()
      return fullName === teamLeadName
    })
    return emp ? `${emp.department} Team` : undefined
  }, [employees])

  const teamFilterOptions = useMemo(() => [...MOCK_TEAMS], [])

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

  const openProjectTasks = useCallback((p: Project) => {
    setSelectedProjectId(p.id)
    setSelectedProjectName(p.name)
    setTasksModalOpen(true)
  }, [])

  const handleUpdateProjectStatus = useCallback(
    async (projectId: string, newStatus: 'Active' | 'Completed' | 'Cancelled') => {
      try {
        const project = allProjects.find((p) => p.id === projectId)
        if (!project) {
          toast.error('Project not found.')
          return
        }

        await api.put(`/projects/${projectId}`, {
          name: project.name,
          client: project.client,
          technologyNode: project.technologyNode,
          accessType: project.accessType,
          description: project.description,
          status: newStatus,
          visibleUsers: project.visibleUsers,
          teamLead: project.teamLead,
        })

        setAllProjects((prev) =>
          prev.map((p) =>
            p.id === projectId ? { ...p, status: newStatus } : p
          )
        )

        const statusText = newStatus === 'Completed' ? 'marked as completed' : newStatus === 'Cancelled' ? 'cancelled' : 'updated'
        toast.success(`Project ${statusText} successfully.`)

        await refreshAllData()
      } catch (err: any) {
        console.error('Status update error:', err)
        toast.error(err.response?.data?.error || 'Failed to update project status.')
        await refreshAllData()
      }
    },
    [allProjects, refreshAllData]
  )

  const handleSaveProject = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!form.name.trim() || !form.client.trim() || !form.technologyNode.trim()) {
        toast.error('Please specify Project Name, Client, and Technology Node.')
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

  // Mapper helper to link employee department to logical teams for filtering
  const getEmployeeTeam = useCallback((empName: string): string => {
    const emp = MOCK_EMPLOYEES.find((e) => e.name === empName)
    if (!emp) return 'Design Team'
    return `${emp.department} Team`
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
      const workflowStatus = getTimesheetWorkflowStatus(t)
      const matchStatus = matchesMultiFilter(tsStatusFilters, workflowStatus)
      const matchTeam = matchesMultiFilter(tsTeamFilters, getEmployeeTeam(t.employeeName))

      return matchSearch && matchEmployee && matchProject && matchStatus && matchTeam
    })
  }, [
    timesheets,
    tsStartDate,
    tsEndDate,
    tsSearch,
    tsEmployeeFilters,
    tsProjectFilters,
    tsStatusFilters,
    tsTeamFilters,
    getEmployeeTeam,
  ])

  // ── Timesheets Tab Metrics Calculation ──────────────────────
  const timesheetMetrics = useMemo(() => {
    let totalHours = 0
    let overtimeHours = 0

    const dailyAccumulator: Record<string, number> = {}

    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours) || 0
      totalHours += hours

      if (t.logoutTime) {
        const key = `${t.employeeId}_${t.date}`
        dailyAccumulator[key] = (dailyAccumulator[key] || 0) + hours
      }
    })

    Object.values(dailyAccumulator).forEach((dailySum) => {
      overtimeHours += Math.max(0, dailySum - 8)
    })

    const pendingApprovalsCount = timesheets.filter(
      (t) => t.status === 'Pending' || t.requestStatus === 'Pending Review'
    ).length

    const uniqueEmployeesCount = new Set(filteredTimesheets.map((t) => t.employeeId)).size

    return {
      total: Math.round(totalHours * 10) / 10,
      overtime: Math.round(overtimeHours * 10) / 10,
      pending: pendingApprovalsCount,
      activeEmployees: uniqueEmployeesCount,
    }
  }, [filteredTimesheets, timesheets])

  // ── Recharts Chart Data and Leaderboard are managed via server-side aggregation state ──

  // ── Export Implementations (Excel / PDF) ─────────────────────
  const handleExportExcel = useCallback(() => {
    if (!filteredTimesheets.length) {
      toast.error('No timesheet data available to export.')
      return
    }

    const aoa: any[][] = []

    // Branding Title & Metadata Header
    aoa.push(['EPICAL LAYOUTS PVT LTD'])
    aoa.push(['Enterprise Timesheet Audit & Review Report'])
    aoa.push([`Reporting Date Range: ${tsStartDate} to ${tsEndDate}`])
    aoa.push([`Generated On: ${new Date().toLocaleString()}`])
    aoa.push([])

    // Metrics Summary Card representation in Excel
    aoa.push(['ANALYTICS SUMMARY'])
    aoa.push(['Total Hours Logged', `${timesheetMetrics.total} hrs`])
    aoa.push(['Pending Approvals Count', timesheetMetrics.pending])
    aoa.push(['Active Employees Count', timesheetMetrics.activeEmployees])
    aoa.push([])

    // Table Data Headers
    aoa.push([
      'Employee Name',
      'Employee ID',
      'Project',
      'Client',
      'Technology Node',
      'Login Date Time',
      'Logout Date Time',
      'Total Hours',
      'Status',
      'Admin Notes',
      'Task Details',
    ])

    // Table Data Rows
    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours)
      const notes = t.adminNotes || 'None'

      aoa.push([
        t.employeeName,
        t.employeeId,
        t.project,
        t.client,
        t.technologyNode,
        formatDateTime(t.loginTime),
        t.logoutTime ? formatDateTime(t.logoutTime) : '—',
        hours !== null ? hours : '—',
        getTimesheetWorkflowStatus(t),
        notes,
        t.task,
      ])
    })

    const worksheet = XLSX.utils.aoa_to_sheet(aoa)

    // Set professional column widths
    worksheet['!cols'] = [
      { wch: 18 }, // Employee Name
      { wch: 12 }, // Employee ID
      { wch: 18 }, // Project
      { wch: 18 }, // Client
      { wch: 15 }, // Tech Node
      { wch: 24 }, // Login Date Time
      { wch: 24 }, // Logout Date Time
      { wch: 15 }, // Total Hours
      { wch: 14 }, // Status
      { wch: 20 }, // Admin Notes
      { wch: 40 }, // Task Details
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheet Logs')

    XLSX.writeFile(workbook, `Timesheet_Audit_Report_${tsStartDate}_to_${tsEndDate}.xlsx`)
    toast.success('Excel spreadsheet generated and downloaded successfully.')
  }, [filteredTimesheets, tsStartDate, tsEndDate, timesheetMetrics])

  const handleExportPDF = useCallback(() => {
    if (!filteredTimesheets.length) {
      toast.error('No timesheet data available to export.')
      return
    }

    const { hoursByProject, leaderboard } = buildTimesheetExportAnalytics(filteredTimesheets)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
    const pageWidth = doc.internal.pageSize.width || 842
    const pageHeight = doc.internal.pageSize.height || 595
    const marginX = 40
    const contentWidth = pageWidth - marginX * 2

    const tableTheme = {
      styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' as const },
      headStyles: { fillColor: [16, 185, 129] as [number, number, number], fontStyle: 'bold' as const, textColor: [255, 255, 255] as [number, number, number] },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
      theme: 'grid' as const,
      margin: { left: marginX, right: marginX, bottom: 36 },
    }

    const getTableEndY = () => {
      const last = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      return last?.finalY ?? marginX
    }

    const addSectionTitle = (title: string, y: number) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(30, 41, 59)
      doc.text(title, marginX, y)
      return y + 14
    }

    // Document header title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(16, 185, 129)
    doc.text('EPICAL LAYOUTS PVT LTD', pageWidth / 2, 40, { align: 'center' })

    doc.setFontSize(12)
    doc.setTextColor(30, 41, 59)
    doc.text('Timesheet System Administration Audit Report', pageWidth / 2, 60, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`Period Range: ${tsStartDate} to ${tsEndDate}`, marginX, 80)
    doc.text(`Generated Timestamp: ${new Date().toLocaleString()}`, pageWidth - marginX, 80, { align: 'right' })
    doc.text(`Filtered Records: ${filteredTimesheets.length}`, pageWidth / 2, 80, { align: 'center' })

    doc.setDrawColor(226, 232, 240)
    doc.line(marginX, 90, pageWidth - marginX, 90)

    // Summary metrics (matches dashboard cards)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(marginX, 95, contentWidth, 52, 6, 6, 'FD')

    const metricCols = [marginX + 12, marginX + contentWidth * 0.35, marginX + contentWidth * 0.65]
    const metricLabels = ['TOTAL HOURS', 'PENDING APPROVALS', 'ACTIVE EMPLOYEES']
    const metricValues = [
      `${timesheetMetrics.total.toFixed(1)} hrs`,
      String(timesheetMetrics.pending),
      String(timesheetMetrics.activeEmployees),
    ]
    const metricColors: [number, number, number][] = [
      [16, 185, 129],
      [245, 158, 11],
      [30, 41, 59],
    ]

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    metricLabels.forEach((label, i) => doc.text(label, metricCols[i], 114))

    doc.setFontSize(13)
    metricValues.forEach((val, i) => {
      doc.setTextColor(...metricColors[i])
      doc.text(val, metricCols[i], 134)
    })

    let cursorY = addSectionTitle('Analytics Overview', 158)

    // Hours by project
    cursorY = addSectionTitle('Aggregated Hours by Project', cursorY)
    autoTable(doc, {
      ...tableTheme,
      head: [['Project', 'Total Hours', '% of Total']],
      body:
        hoursByProject.length > 0
          ? hoursByProject.map((p) => {
              const pct =
                timesheetMetrics.total > 0
                  ? `${((p.hours / timesheetMetrics.total) * 100).toFixed(1)}%`
                  : '—'
              return [p.name, `${p.hours.toFixed(1)} hrs`, pct]
            })
          : [['No project hours in selected range', '—', '—']],
      startY: cursorY,
      columnStyles: { 0: { cellWidth: 280 }, 1: { cellWidth: 90, halign: 'right' }, 2: { cellWidth: 70, halign: 'right' } },
    })
    cursorY = getTableEndY() + 20

    // Employee leaderboard
    cursorY = addSectionTitle('Employee-wise Hours Leaderboard', cursorY)
    const topHours = leaderboard[0]?.hours ?? 0
    autoTable(doc, {
      ...tableTheme,
      head: [['Rank', 'Employee', 'Department', 'Total Hours', '% of Top']],
      body:
        leaderboard.length > 0
          ? leaderboard.map((e, idx) => {
              const pctTop = topHours > 0 ? `${((e.hours / topHours) * 100).toFixed(0)}%` : '—'
              return [String(idx + 1), e.name, e.dept, `${e.hours.toFixed(1)} hrs`, pctTop]
            })
          : [['—', 'No employee hours in selected range', '—', '—', '—']],
      startY: cursorY,
      columnStyles: {
        0: { cellWidth: 36, halign: 'center' },
        1: { cellWidth: 160 },
        2: { cellWidth: 100 },
        3: { cellWidth: 80, halign: 'right' },
        4: { cellWidth: 60, halign: 'right' },
      },
    })
    cursorY = getTableEndY() + 24

    // Detailed time logs
    cursorY = addSectionTitle('Detailed Time Logs', cursorY)

    const tableHeaders = [
      'Employee',
      'Project',
      'Login Time',
      'Logout Time',
      'Total Hours',
      'Status',
      'Date',
    ]

    const tableRows = filteredTimesheets.map((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours)
      return [
        `${t.employeeName} (${t.employeeId})`,
        `${t.project}\n(${t.client} · ${t.technologyNode})`,
        formatDateTime(t.loginTime),
        t.logoutTime ? formatDateTime(t.logoutTime) : '—',
        hours !== null ? `${hours.toFixed(1)} hrs` : '—',
        getTimesheetWorkflowStatus(t),
        t.date,
      ]
    })

    autoTable(doc, {
      ...tableTheme,
      head: [tableHeaders],
      body: tableRows,
      startY: cursorY,
      styles: { ...tableTheme.styles, cellPadding: 5 },
    })

    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - marginX, pageHeight - 20, { align: 'right' })
      doc.text('Confidential - Internal Administrative Records', marginX, pageHeight - 20)
    }

    doc.save(`Timesheet_Audit_Report_${tsStartDate}_to_${tsEndDate}.pdf`)
    toast.success('PDF report exported successfully.')
  }, [filteredTimesheets, tsStartDate, tsEndDate, timesheetMetrics])

  const clearTimesheetFilters = useCallback(() => {
    setTsSearch('')
    setTsEmployeeFilters([])
    setTsProjectFilters([])
    setTsTeamFilters([])
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

  const hasActiveTimesheetFilters =
    tsSearch.trim().length > 0 ||
    tsEmployeeFilters.length > 0 ||
    tsProjectFilters.length > 0 ||
    tsTeamFilters.length > 0 ||
    tsStatusFilters.length > 0


  return (
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
              >
                <Archive className="h-4 w-4 text-slate-500" /> Archived Projects
              </Button>
              <Button
                onClick={openCreateProject}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-sm rounded-xl py-2 px-4 flex items-center gap-1.5 focus:ring-4 focus:ring-emerald-500/10 border-0"
              >
                <Plus className="h-4 w-4" /> Create Project
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Redesigned Smooth Tab Bar ────────────────────── */}
      <div className="sticky top-0 z-30 -mx-4 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-100 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 mb-6">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1.5 max-w-xs shadow-inner">
          {[
            { key: 'projects' as const, label: 'Projects', icon: FolderOpen, count: filteredProjects.length },
            { key: 'timesheets' as const, label: 'Timesheets', icon: Clock, count: filteredTimesheets.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-3.5 text-xs font-bold transition-all duration-300 ${
                activeTab === tab.key
                  ? 'bg-white text-emerald-600 shadow-md scale-102 border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              <span
                className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-black transition-colors duration-300 ${
                  activeTab === tab.key ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================
           TAB 1 – PROJECTS
           ================================================================ */}
      {activeTab === 'projects' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Analytics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Total Projects"
              value={projectMetrics.total}
              icon={FolderOpen}
              accentClass="bg-slate-500"
            />
            <MetricCard
              label="In Progress Projects"
              value={projectMetrics.inProgress}
              icon={ArrowUpRight}
              accentClass="bg-emerald-600"
            />
            <MetricCard
              label="Completed Projects"
              value={projectMetrics.completed}
              icon={CheckCircle2}
              accentClass="bg-teal-500"
            />
          </div>

          {/* Action Toolbar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search + Filter toggle */}
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[240px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, client, tech node, scope..."
                    className="h-10 w-full rounded-xl border border-slate-250 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border h-10 px-3.5 text-xs font-bold transition-all ${
                    showFilters || activeFiltersCount > 0
                      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-600'
                      : 'border-slate-250 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Advanced Filters
                  {activeFiltersCount > 0 && (
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Layout controls */}
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Matches: {filteredProjects.length} / {projects.length}
                </span>

                <div className="flex rounded-xl border border-slate-250 bg-white p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`rounded-lg p-1.5 transition-all ${
                      viewMode === 'grid'
                        ? 'bg-emerald-50 text-emerald-600 shadow-sm border border-slate-200/40'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Grid layout"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`rounded-lg p-1.5 transition-all ${
                      viewMode === 'list'
                        ? 'bg-emerald-50 text-emerald-600 shadow-sm border border-slate-200/40'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                    title="List layout"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Sliding Advanced Filters Panel */}
            {showFilters && (
              <div className="mt-4 border-t border-slate-100 pt-4 animate-fadeIn">
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
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-semibold text-slate-400">
                      Applied Filters: {activeFiltersCount} filters currently active
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
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProjects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onEdit={() => openEditProject(p)}
                      onDelete={() => handleDeleteProject(p)}
                      onTasks={() => openProjectTasks(p)}
                      onStatusChange={(status) => handleUpdateProjectStatus(p.id, status)}
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
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Project Details
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Client
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Technology Node
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Access Control
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Visibility Scope
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredProjects.map((p) => (
                      <ProjectListRow
                        key={p.id}
                        project={p}
                        onEdit={() => openEditProject(p)}
                        onDelete={() => handleDeleteProject(p)}
                        onTasks={() => openProjectTasks(p)}
                        onStatusChange={(status) => handleUpdateProjectStatus(p.id, status)}
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
        </div>
      )}

      {/* ================================================================
           TAB 2 – TIMESHEETS (Manage Timesheets / Review Time Logs)
           ================================================================ */}
      {activeTab === 'timesheets' && (
        <div className="space-y-6 animate-fadeIn">
          {/* UNIFIED FILTERS SECTION AT TOP */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-600" /> Filter
            </h3>

            {/* Filters and Actions Layout */}
            <div className="flex flex-col gap-3">
              {/* First Row: Date, Search, Employee, Project */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Date Range Picker */}
                <CustomDateRangePicker
                  startDate={tsStartDate}
                  endDate={tsEndDate}
                  preset={datePreset}
                  onChange={handleDateRangeChange}
                />

                {/* Search Box */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={tsSearch}
                    onChange={(e) => setTsSearch(e.target.value)}
                    placeholder="Search task details..."
                    className="h-10 w-full rounded-xl border border-slate-250 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                {/* Employee Filter */}
                <FilterCheckboxGroup
                  label="Employee"
                  placeholder="All Employees"
                  compact
                  options={tsEmployeeFilterOptions}
                  selected={tsEmployeeFilters}
                  onChange={setTsEmployeeFilters}
                />

                {/* Project Filter */}
                <FilterCheckboxGroup
                  label="Project"
                  placeholder="All Projects"
                  compact
                  options={tsProjectFilterOptions}
                  selected={tsProjectFilters}
                  onChange={setTsProjectFilters}
                />
              </div>

              {/* Second Row: Team, Status, and Action Buttons */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:items-center">
                <div className="grid gap-3 sm:grid-cols-2 flex-1">
                  {/* Team Filter */}
                  <FilterCheckboxGroup
                    label="Team"
                    placeholder="All Teams"
                    compact
                    options={MOCK_TEAMS.map((t) => ({ value: t, label: t }))}
                    selected={tsTeamFilters}
                    onChange={setTsTeamFilters}
                  />

                  {/* Status Filter */}
                  <FilterCheckboxGroup
                    label="Status"
                    placeholder="All Statuses"
                    compact
                    options={[
                      { value: 'Completed', label: 'Completed' },
                      { value: 'In Progress', label: 'In Progress' },
                    ]}
                    selected={tsStatusFilters}
                    onChange={setTsStatusFilters}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center gap-3">
                  {hasActiveTimesheetFilters && (
                    <button
                      onClick={clearTimesheetFilters}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors whitespace-nowrap"
                    >
                      Clear Filters
                    </button>
                  )}
                  
                  {/* Document Export Buttons */}
                  <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <button
                      onClick={handleExportPDF}
                      className="flex items-center gap-1.5 border-r border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                    >
                      <FileDown className="h-4 w-4 text-rose-500" /> PDF Report
                    </button>
                    <button
                      onClick={handleExportExcel}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel Spreadsheet
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timesheet Summary Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Total Hours"
              value={`${timesheetMetrics.total}h`}
              icon={Clock}
              accentClass="bg-slate-500"
            />
            <MetricCard
              label="Pending Approvals"
              value={timesheetMetrics.pending}
              icon={UserCheck}
              accentClass="bg-amber-500"
              secondaryText="Requires action"
            />
            <MetricCard
              label="Active Employees"
              value={timesheetMetrics.activeEmployees}
              icon={Users}
              accentClass="bg-sky-505 bg-sky-500"
              secondaryText="Working on projects"
            />
          </div>

          {/* Analytics Visual Redesign Section */}
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Hours by Project Recharts Bar Chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                <span className="h-3.5 w-1.5 rounded-full bg-emerald-500" /> Aggregated Hours by Project
              </h3>
              {chartHoursByProject.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartHoursByProject} margin={{ top: 5, right: 5, left: -25, bottom: 5 }} onClick={handleBarClick}>
                      <defs>
                        <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#047857" stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#f8fafc" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11, fontWeight: 600 }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={38} fill="url(#emeraldGrad)" className="cursor-pointer" onClick={handleBarClick} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-semibold">
                  No data logs available in the chosen dates.
                </div>
              )}
            </div>

            {/* Custom SaaS Leaderboard for Employee Hours */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                <span className="h-3.5 w-1.5 rounded-full bg-emerald-500" /> Employee-wise Hours Leaderboard
              </h3>
              <div className="h-64 overflow-y-auto pr-1">
                <EmployeeLeaderboard data={leaderboardData} />
              </div>
            </div>
          </div>

          {/* Timesheet Data Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Project</th>
                    <th className="px-5 py-3.5">Login Time</th>
                    <th className="px-5 py-3.5">Logout Time</th>
                    <th className="px-5 py-3.5">Total Hours</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTimesheets.map((t) => {
                    const empInfo = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId)
                    const hours = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours)

                    return (
                      <tr key={t.id} className="group hover:bg-slate-50/40 transition-colors">
                        {/* Employee Column */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={t.employeeName}
                              size="sm"
                              color={empInfo ? `hsl(${empInfo.hue},55%,45%)` : '#10b981'}
                            />
                            <div>
                              <p className="font-bold text-slate-700 leading-tight">{t.employeeName}</p>
                              <p className="text-[10px] text-slate-400 font-bold font-mono">{t.employeeId}</p>
                            </div>
                          </div>
                        </td>

                        {/* Project Details Column */}
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
                            className="group/btn text-left focus:outline-none block"
                          >
                            <p className="font-bold text-slate-700 group-hover/btn:text-emerald-600 transition-colors leading-tight flex items-center gap-1">
                              {t.project}
                              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-all transform translate-y-0.5 group-hover/btn:translate-y-0 group-hover/btn:translate-x-0.5 text-emerald-500 shrink-0" />
                            </p>
                          </button>
                          {/* Only project name is rendered */}
                        </td>

                        {/* Login Time Column */}
                        <td className="px-5 py-3.5 font-semibold text-slate-600 whitespace-nowrap">
                          {formatDateTime(t.loginTime)}
                        </td>

                        {/* Logout Time Column */}
                        <td className="px-5 py-3.5 font-semibold text-slate-600 whitespace-nowrap">
                          {t.logoutTime ? formatDateTime(t.logoutTime) : '—'}
                        </td>

                        {/* Total Hours Column */}
                        <td className="px-5 py-3.5 font-black text-slate-700 tracking-tight tabular-nums">
                          {hours !== null ? `${hours.toFixed(1)}h` : '—'}
                        </td>

                        {/* Status Column */}
                        <td className="px-5 py-3.5">
                          {getTimesheetWorkflowStatus(t) === 'Completed' ? (
                            <Badge variant="success" className="py-0.5 px-2.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
                            </Badge>
                          ) : (
                            <Badge variant="info" className="py-0.5 px-2.5 bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold">
                              In Progress
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {filteredTimesheets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400 font-medium">
                        No individual logs correspond to selected range and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              required
            />
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

      {/* Project Tasks Modal */}
      {selectedProjectId && (
        <ProjectTasksModal
          isOpen={tasksModalOpen}
          onClose={() => {
            setTasksModalOpen(false)
            setSelectedProjectId(null)
            setSelectedProjectName('')
          }}
          projectId={selectedProjectId}
          projectName={selectedProjectName}
          onRefresh={refreshAllData}
        />
      )}

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
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-250 py-16 bg-white p-6 shadow-sm">
      <FolderOpen className="h-12 w-12 text-slate-350 mb-3 animate-pulse" />
      <p className="text-sm text-slate-500 font-bold text-center">{message}</p>
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

function ProjectArchiveConfirmModal({
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
