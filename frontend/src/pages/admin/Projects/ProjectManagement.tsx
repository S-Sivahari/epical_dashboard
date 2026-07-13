import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useDebounce } from '@/hooks/useDebounce'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { Modal } from '@components/ui/Modal'
import { ConfirmModal } from '@components/modals/ConfirmModal'

import { ProjectAuditTrailModal } from '@components/modals/ProjectAuditTrailModal'
import { Spinner } from '@components/ui/Spinner'
import { toast } from 'sonner'
import { stringToHue, stringToHueColor } from '@/utils/stringColor'
import { Analytics } from '@pages/admin/Analytics/Analytics'
import { ProjectAnalysisLaunchButton } from '@components/admin/ProjectAnalysisLaunchButton'
import {
  BarChart3,
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
  RefreshCw,
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
import { timesheetReportFileName } from '@/utils/exportFileName'
import api from '@/services/api'
import { getEmployees } from '@/services/employeeService'
import { filterAllocatableEmployees } from '@/utils/employeeView'
import { useEmployeeStore } from '@store/employeeStore'
import type { Employee } from '@/types'
import { cn } from '@/utils/cn'
import { formatDurationFromMs, formatWorkedDuration, resolveDisplayWorkedMs, formatBreakDisplayLabel, isDefaultBreakDeduction } from '@/utils/durationFormat'
import { getVisiblePageNumbers } from '@hooks/usePagination'
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

interface ArchivedProjectSummary {
  id: string
  originalProjectId: string
  name: string
  client: string
  technologyNode: string
  accessType: 'public' | 'private'
  status: 'Active' | 'Completed' | 'Rejected'
  description: string
  visibleUsers: string[]
  teamLead?: string
  completedTasks: number
  totalTasks: number
  completionPercentage: number
  archivedAt: string
  originalCreatedAt: string
  tasksCount: number
  timesheetsCount: number
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
  workedMs?: number
  displayWorkedMs?: number
  breakMs?: number
  totalPausedMs?: number
  autoCheckedOut?: boolean
}

interface WorkSessionLog {
  id: string
  employeeId: string
  employeeName: string
  projectId?: string
  project: string
  projects: string[]
  date: string
  loginTime: string
  logoutTime?: string
  breakMs: number
  displayBreakMs: number
  displayWorkedMs: number
  defaultBreakDeductedMs?: number
  workDayType: 'half_day' | 'full_day' | null
  sessionStatus: string
  autoCheckedOut: boolean
}



/* ================================================================
   HELPER – Hours Calculation (with Overridden Hours respect)
   ================================================================ */
const calculateHours = (
  login: string,
  logout?: string,
  overriddenHours?: number,
  totalHours?: number,
  totalPausedMs?: number,
  workedMs?: number,
  displayWorkedMs?: number,
): number | null => {
  if (!logout) return null
  const ms =
    typeof displayWorkedMs === 'number' && displayWorkedMs >= 0
      ? displayWorkedMs
      : resolveDisplayWorkedMs({
          workedMs,
          overriddenHours,
          totalHours,
          loginTime: login,
          logoutTime: logout,
          totalPausedMs,
        })
  return ms / (1000 * 60 * 60)
}

function formatAdminWorkedDuration(t: TimesheetLog): string {
  if (!t.logoutTime) return '—'
  if (typeof t.displayWorkedMs === 'number' && t.displayWorkedMs >= 0) {
    return formatDurationFromMs(t.displayWorkedMs)
  }
  return formatWorkedDuration({
    workedMs: t.workedMs,
    overriddenHours: t.overriddenHours,
    totalHours: t.totalHours,
    loginTime: t.loginTime,
    logoutTime: t.logoutTime,
    totalPausedMs: t.totalPausedMs,
    autoCheckedOut: t.autoCheckedOut,
  })
}

function formatBreakTime(session: Pick<WorkSessionLog, 'breakMs' | 'displayBreakMs' | 'defaultBreakDeductedMs'>): string {
  const actualMs = session.breakMs ?? 0
  const displayMs =
    typeof session.displayBreakMs === 'number' && session.displayBreakMs > 0
      ? session.displayBreakMs
      : actualMs
  const isDefault = isDefaultBreakDeduction({
    breakMs: actualMs,
    defaultBreakDeductedMs: session.defaultBreakDeductedMs,
    displayBreakMs: displayMs,
  })
  return formatBreakDisplayLabel(displayMs, { isDefault })
}

function formatWorkSessionDuration(session: Pick<WorkSessionLog, 'displayWorkedMs' | 'logoutTime'>): string {
  if (typeof session.displayWorkedMs === 'number' && session.displayWorkedMs >= 0) {
    return formatDurationFromMs(session.displayWorkedMs)
  }
  if (!session.logoutTime) return 'In progress'
  return '—'
}

type WorkSessionDayGroupMeta = {
  groupKey: string
  isMultiSessionDay: boolean
  isFirstInDayGroup: boolean
  isLastInDayGroup: boolean
  dayGroupSize: number
  dayGroupIndex: number
  dayTotalWorkedMs: number
  dayTotalBreakMs: number
}

type WorkSessionWithGroup = WorkSessionLog & { dayGroup: WorkSessionDayGroupMeta }

function sortWorkSessionsByEmployee(
  sessions: WorkSessionLog[],
  employees: Employee[],
): WorkSessionLog[] {
  return [...sessions].sort((a, b) => {
    const aKey = resolveTimesheetEmployeeKey(a, employees)
    const bKey = resolveTimesheetEmployeeKey(b, employees)
    const nameCmp = aKey.name.localeCompare(bKey.name, undefined, { sensitivity: 'base' })
    if (nameCmp !== 0) return nameCmp
    const dateCmp = String(a.date || '').localeCompare(String(b.date || ''))
    if (dateCmp !== 0) return dateCmp
    return new Date(a.loginTime).getTime() - new Date(b.loginTime).getTime()
  })
}

function attachWorkSessionDayGroups(
  sessions: WorkSessionLog[],
  employees: Employee[],
): WorkSessionWithGroup[] {
  const sorted = sortWorkSessionsByEmployee(sessions, employees)
  const groupSizes = new Map<string, number>()
  const groupWorked = new Map<string, number>()
  const groupBreak = new Map<string, number>()

  for (const session of sorted) {
    const { key } = resolveTimesheetEmployeeKey(session, employees)
    const groupKey = `${key}::${session.date}`
    groupSizes.set(groupKey, (groupSizes.get(groupKey) || 0) + 1)

    const worked =
      typeof session.displayWorkedMs === 'number' && session.displayWorkedMs >= 0
        ? session.displayWorkedMs
        : 0
    const breakMs =
      typeof session.displayBreakMs === 'number' && session.displayBreakMs > 0
        ? session.displayBreakMs
        : session.breakMs || 0
    groupWorked.set(groupKey, (groupWorked.get(groupKey) || 0) + worked)
    groupBreak.set(groupKey, (groupBreak.get(groupKey) || 0) + breakMs)
  }

  const seen = new Map<string, number>()
  return sorted.map((session) => {
    const { key } = resolveTimesheetEmployeeKey(session, employees)
    const groupKey = `${key}::${session.date}`
    const dayGroupSize = groupSizes.get(groupKey) || 1
    const dayGroupIndex = seen.get(groupKey) || 0
    seen.set(groupKey, dayGroupIndex + 1)
    return {
      ...session,
      dayGroup: {
        groupKey,
        isMultiSessionDay: dayGroupSize > 1,
        isFirstInDayGroup: dayGroupIndex === 0,
        isLastInDayGroup: dayGroupIndex === dayGroupSize - 1,
        dayGroupSize,
        dayGroupIndex,
        dayTotalWorkedMs: groupWorked.get(groupKey) || 0,
        dayTotalBreakMs: groupBreak.get(groupKey) || 0,
      },
    }
  })
}

function formatDayGroupTotals(dayGroup: WorkSessionDayGroupMeta): string {
  const worked = formatDurationFromMs(dayGroup.dayTotalWorkedMs)
  const brk = formatDurationFromMs(dayGroup.dayTotalBreakMs)
  return `${worked} / ${brk} brk`
}

function employeeDisplayName(e: Employee): string {
  return `${e.firstName} ${e.lastName || ''}`.trim()
}

function allEmployeeDisplayNames(employees: Employee[]): string[] {
  return employees.map(employeeDisplayName)
}

/** Stable HR employee id for grouping exports — survives name/profile edits. */
function resolveTimesheetEmployeeKey(
  log: Pick<TimesheetLog, 'employeeId' | 'employeeName'>,
  employees: Employee[],
): { key: string; name: string; dept: string } {
  const emp = employees.find(
    (e) =>
      e.id === log.employeeId ||
      e.employeeId === log.employeeId ||
      employeeDisplayName(e) === log.employeeName,
  )
  const key = emp?.employeeId || log.employeeId || log.employeeName
  return {
    key,
    name: emp ? employeeDisplayName(emp) : log.employeeName,
    dept: emp?.department ?? '—',
  }
}

/** Hours-by-project and employee leaderboard from filtered logs (export/PDF). */
function buildTimesheetExportAnalytics(logs: TimesheetLog[], employees: Employee[]) {
  const byProject: Record<string, number> = {}
  const byEmployee: Record<string, { name: string; dept: string; hours: number }> = {}

  logs.forEach((t) => {
    const hours = calculateHours(
      t.loginTime,
      t.logoutTime,
      t.overriddenHours,
      t.totalHours,
      t.totalPausedMs,
      t.workedMs,
      t.displayWorkedMs
    ) || 0
    byProject[t.project] = (byProject[t.project] || 0) + hours

    const { key, name, dept } = resolveTimesheetEmployeeKey(t, employees)
    const existing = byEmployee[key]
    if (existing) {
      existing.hours += hours
    } else {
      byEmployee[key] = { name, dept, hours }
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

/** Timezone-safe YYYY-MM-DD for local calendar dates (no UTC shift). */
const formatLocalDateString = (d: Date = new Date()): string => {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const isTodayTimesheetRange = (start: string, end: string, preset: string): boolean => {
  const today = formatLocalDateString()
  return preset === 'Today' && start === today && end === today
}

const TIMESHEET_AGGREGATED_SCROLL_THRESHOLD = {
  projects: 6,
  employees: 5,
} as const


/* ================================================================
   COMPONENT – Custom Date Range Picker (Linear/SaaS Style)
   ================================================================ */
interface DateRangePickerProps {
  startDate: string
  endDate: string
  preset: string
  onChange: (start: string, end: string, preset: string) => void
  size?: 'md' | 'lg'
}

const QUICK_DATE_PRESETS = [
  'Today',
  'Yesterday',
  'This Week',
  'Last Week',
  'Past Two Weeks',
  'This Month',
  'Last Month',
  'This Year',
  'Last Year',
] as const

function CustomDateRangePicker({ startDate, endDate, preset, onChange, size = 'md' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(startDate || new Date().toISOString().split('T')[0]),
  )
  const [draftStart, setDraftStart] = useState(startDate)
  const [draftEnd, setDraftEnd] = useState(endDate)
  const [draftPreset, setDraftPreset] = useState(preset)
  const [activeField, setActiveField] = useState<'start' | 'end'>('start')
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [calendarPosition, setCalendarPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const updateCalendarPosition = useCallback(() => {
    if (!containerRef.current || !calendarRef.current || !open) return

    const rect = containerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const padding = 12
    const gap = 8
    const maxPopoverHeight = viewportHeight - padding * 2

    const calendarEl = calendarRef.current
    calendarEl.style.maxHeight = `${maxPopoverHeight}px`

    const calendarHeight = Math.min(calendarEl.offsetHeight, maxPopoverHeight)
    const calendarWidth = calendarEl.offsetWidth || Math.min(700, viewportWidth - padding * 2)

    let top = rect.bottom + gap
    let left = rect.left

    if (top + calendarHeight > viewportHeight - padding) {
      const aboveTop = rect.top - calendarHeight - gap
      if (aboveTop >= padding) {
        top = aboveTop
      } else {
        top = Math.max(padding, viewportHeight - calendarHeight - padding)
      }
    }

    top = Math.max(padding, Math.min(top, viewportHeight - calendarHeight - padding))

    if (left < padding) {
      left = padding
    }

    if (left + calendarWidth > viewportWidth - padding) {
      left = Math.max(padding, viewportWidth - calendarWidth - padding)
    }

    setCalendarPosition({ top, left })
  }, [open])

  useEffect(() => {
    if (!open || !calendarRef.current) return

    const observer = new ResizeObserver(() => {
      updateCalendarPosition()
    })
    observer.observe(calendarRef.current)
    return () => observer.disconnect()
  }, [open, updateCalendarPosition])

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => updateCalendarPosition())
      window.addEventListener('scroll', updateCalendarPosition, true)
      window.addEventListener('resize', updateCalendarPosition)
      return () => {
        cancelAnimationFrame(frame)
        window.removeEventListener('scroll', updateCalendarPosition, true)
        window.removeEventListener('resize', updateCalendarPosition)
      }
    }
  }, [open, updateCalendarPosition])

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      const isClickInsideContainer = containerRef.current?.contains(target)
      const isClickInsideCalendar = calendarRef.current?.contains(target)

      if (!isClickInsideContainer && !isClickInsideCalendar) {
        setOpen(false)
        setDraftStart(startDate)
        setDraftEnd(endDate)
        setDraftPreset(preset)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, startDate, endDate, preset])

  useEffect(() => {
    if (open) {
      setDraftStart(startDate)
      setDraftEnd(endDate)
      setDraftPreset(preset)
      setActiveField('start')
      setCurrentMonth(new Date(startDate || new Date().toISOString().split('T')[0]))
    }
  }, [open, startDate, endDate, preset])

  const getPresetDates = (selectedPreset: string): { start: string; end: string } => {
    const today = new Date()
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
    setDraftStart(start)
    setDraftEnd(end)
    setDraftPreset(p)
    onChange(start, end, p)
    setOpen(false)
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDayClick = (dateStr: string) => {
    setDraftPreset('Custom')

    if (activeField === 'start') {
      if (draftEnd && dateStr > draftEnd) {
        setDraftStart(draftEnd)
        setDraftEnd(dateStr)
      } else {
        setDraftStart(dateStr)
      }
      setActiveField('end')
      return
    }

    setDraftEnd(dateStr)
    if (draftStart && dateStr < draftStart) {
      setDraftStart(dateStr)
      setDraftEnd(draftStart)
    }
  }

  const handleApply = () => {
    if (!draftStart || !draftEnd) {
      toast.error('Select both start and end dates')
      return
    }

    const start = draftStart <= draftEnd ? draftStart : draftEnd
    const end = draftStart <= draftEnd ? draftEnd : draftStart
    onChange(start, end, 'Custom')
    setOpen(false)
  }

  const rangeStart = draftStart && draftEnd ? (draftStart <= draftEnd ? draftStart : draftEnd) : draftStart
  const rangeEnd = draftStart && draftEnd ? (draftStart <= draftEnd ? draftEnd : draftStart) : draftEnd

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

  const isLarge = size === 'lg'

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`projects-date-trigger inline-flex max-w-full items-center gap-2 rounded-lg border font-bold text-[var(--emerald-dark)] shadow-sm transition-colors whitespace-nowrap ${
          isLarge ? 'h-11 px-3 text-sm' : 'h-9 px-2.5 text-xs'
        }`}
      >
        <CalendarIcon className={`text-[var(--emerald-dark)] flex-shrink-0 ${isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'}`} />
        <span className={`truncate max-w-xs leading-tight ${isLarge ? 'text-sm' : 'text-xs'}`}>
          {preset === 'Custom' && startDate === endDate
            ? `${formatDate(startDate)}`
            : preset === 'Custom'
              ? `${formatDate(startDate)} – ${formatDate(endDate)}`
              : `${preset} (${formatDate(startDate)} – ${formatDate(endDate)})`}
        </span>
        <ChevronDown className={`text-[var(--emerald-dark)]/70 flex-shrink-0 ${isLarge ? 'h-4 w-4' : 'h-3 w-3'}`} />
      </button>

      {open && createPortal(
        <div
          className="projects-date-calendar-portal fixed inset-0 z-[10000]"
          style={{ pointerEvents: 'none' }}
        >
          <div
            ref={calendarRef}
            className="projects-date-calendar date-range-popover absolute flex w-[94vw] flex-col gap-0 rounded-2xl shadow-2xl sm:w-auto sm:min-w-[700px] md:flex-row"
            style={{
              top: `${calendarPosition.top}px`,
              left: `${calendarPosition.left}px`,
              pointerEvents: 'auto',
            }}
          >
            <div className="projects-date-calendar-main flex min-h-0 flex-1 select-none flex-col">
              <div className="projects-date-calendar-body">
              <div className="projects-date-fields">
                <button
                  type="button"
                  onClick={() => setActiveField('start')}
                  className={cn(
                    'projects-date-field',
                    activeField === 'start' && 'projects-date-field-active',
                  )}
                >
                  <span className="projects-date-field-label">Start Date</span>
                  <span className="projects-date-field-value">
                    {draftStart ? formatDate(draftStart) : 'Select date'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveField('end')}
                  className={cn(
                    'projects-date-field',
                    activeField === 'end' && 'projects-date-field-active',
                  )}
                >
                  <span className="projects-date-field-label">End Date</span>
                  <span className="projects-date-field-value">
                    {draftEnd ? formatDate(draftEnd) : 'Select date'}
                  </span>
                </button>
              </div>

              <div className="projects-date-calendar-header">
                <button type="button" onClick={handlePrevMonth} className="projects-date-nav-btn" aria-label="Previous month">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="date-range-month-title type-calendar-month">
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" onClick={handleNextMonth} className="projects-date-nav-btn" aria-label="Next month">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="projects-date-weekdays type-calendar-weekday">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="projects-date-grid">
                {calendarCells.map((cell, idx) => {
                  const isRangeStart = rangeStart && cell.dateString === rangeStart
                  const isRangeEnd = rangeEnd && cell.dateString === rangeEnd
                  const isSingleDay = rangeStart && rangeEnd && rangeStart === rangeEnd && cell.dateString === rangeStart
                  const isWithinRange =
                    rangeStart &&
                    rangeEnd &&
                    rangeStart !== rangeEnd &&
                    cell.dateString > rangeStart &&
                    cell.dateString < rangeEnd
                  const isActiveTarget =
                    (activeField === 'start' && cell.dateString === draftStart) ||
                    (activeField === 'end' && cell.dateString === draftEnd)

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDayClick(cell.dateString)}
                      className={cn(
                        'projects-date-day',
                        cell.isCurrentMonth ? 'projects-date-day-current' : 'projects-date-day-muted',
                        (isSingleDay || isRangeStart || isRangeEnd) && 'projects-date-day-selected',
                        isWithinRange && 'projects-date-day-in-range',
                        isActiveTarget && 'projects-date-day-focus',
                      )}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>
              </div>

              <div className="projects-date-actions">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setDraftStart(startDate)
                    setDraftEnd(endDate)
                    setDraftPreset(preset)
                  }}
                  className="projects-date-action-btn projects-date-action-btn--ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="projects-date-action-btn projects-date-action-btn--primary"
                >
                  Apply Filter
                </button>
              </div>
            </div>

            <div className="projects-date-divider hidden md:block" />

            <div className="projects-date-presets">
              <p className="type-card-label-caps">Quick Presets</p>
              {QUICK_DATE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetClick(p)}
                  className={cn(
                    'projects-date-preset',
                    draftPreset === p && 'projects-date-preset-active',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
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
  size = 'md',
}: {
  label: string
  placeholder: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  compact?: boolean
  size?: 'md' | 'lg'
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

  const isLarge = size === 'lg'

  return (
    <div ref={rootRef} className="relative">
      {!compact && (
        <span className={`mb-1 block font-bold uppercase tracking-wider text-slate-600 ${isLarge ? 'text-xs' : 'text-[10px]'}`}>
          {label}
        </span>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-[var(--bg-card)] text-left font-bold outline-none transition-all ${
          isLarge ? 'h-11 px-3 text-sm' : 'h-9 px-2.5 text-xs'
        } ${
          open || selected.length > 0
            ? 'border-[rgba(38,107,28,0.35)] text-ink ring-4 ring-[rgba(38,107,28,0.12)]'
            : 'border-border text-slate-700 hover:border-white/20'
        }`}
      >
        <span className={`truncate ${isLarge ? 'text-sm' : 'text-xs'}`}>{summary}</span>
        <ChevronDown
          className={`shrink-0 text-slate-700 transition-transform ${isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'} ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={`absolute left-0 right-0 z-50 mt-1 min-w-full rounded-xl border border-border bg-[var(--bg-card)] shadow-2xl ${isLarge ? 'p-3' : 'p-2'}`}
        >
          <div className={`mb-2 flex items-center justify-between gap-2 border-b border-border ${isLarge ? 'pb-2.5' : 'pb-2'}`}>
            <span className={`font-bold uppercase tracking-wider text-slate-700 ${isLarge ? 'text-xs' : 'text-[10px]'}`}>{label}</span>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onChange(options.map((o) => o.value))}
                className={`font-bold text-[var(--emerald-dark)] hover:text-[var(--green-600)] ${isLarge ? 'text-xs' : 'text-[10px]'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className={`font-bold text-slate-700 hover:text-ink ${isLarge ? 'text-xs' : 'text-[10px]'}`}
              >
                Clear
              </button>
            </div>
          </div>
          <div className={`space-y-0.5 overflow-y-auto pr-0.5 ${isLarge ? 'max-h-64' : 'max-h-48'}`}>
            {options.length === 0 ? (
              <p className={`px-2 py-2 font-semibold text-slate-700 ${isLarge ? 'text-sm' : 'text-xs'}`}>No options</p>
            ) : (
              options.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 text-ink transition-colors hover:bg-emerald-50/50 ${isLarge ? 'py-2 text-sm' : 'py-1.5 text-xs'}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className={`shrink-0 rounded border-border bg-[var(--bg-input)] accent-[var(--emerald-dark)] ${isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
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
      <div className="rounded-xl border border-border bg-[var(--bg-input)] p-2 max-h-24 overflow-y-auto space-y-0.5">
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
    : 'None assigned'

  const projectInitial =
    project.name.charAt(project.name.indexOf(' ') + 1) || project.name.charAt(0)

  const statusLabel = isCancelled
    ? 'Cancelled'
    : isRejected
      ? 'Rejected'
      : isCompleted
        ? 'Completed'
        : 'In Progress'

  let ringColor = 'border-blue-500 ring-blue-500/20 text-blue-700 bg-blue-50'
  let badgeColor = 'bg-blue-100 text-blue-700 border-blue-200'
  if (isCompleted) {
    ringColor = 'border-emerald-600 ring-emerald-500/20 text-emerald-700 bg-emerald-50'
    badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200'
  } else if (isCancelled || isRejected) {
    ringColor = 'border-red-500 ring-red-500/20 text-red-700 bg-red-50'
    badgeColor = 'bg-red-100 text-red-700 border-red-200'
  }

  const hue = stringToHue(project.id || project.name)
  const startColor = `hsl(${hue} 75% 95%)`
  const borderColor = `hsl(${hue} 50% 86%)`

  return (
    <div
      className="projects-card group flex min-w-0 flex-col gap-4 rounded-2xl border p-5 shadow-[0_4px_15px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] animate-fadeIn"
      style={{
        background: `linear-gradient(135deg, ${startColor} 0%, #ffffff 100%)`,
        borderColor,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 ring-4 ${ringColor}`}
          >
            <span className="text-xl font-bold">{projectInitial}</span>
          </div>
          <span
            className={`max-w-[6.5rem] whitespace-nowrap rounded-full border px-2.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider ${badgeColor}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="flex shrink-0 items-start gap-1 pt-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            title="Edit Project"
            aria-label="Edit Project"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-amber-50 hover:text-amber-600"
            title="Archive Project"
            aria-label="Archive Project"
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-base font-bold leading-snug text-slate-800 transition-colors group-hover:text-emerald-700">
          {project.name}
        </h3>
        <p className="mt-1 truncate text-xs leading-relaxed text-slate-500">{project.client}</p>
      </div>

      {project.description && (
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{project.description}</p>
      )}

      <div className="flex flex-col gap-2 border-b border-slate-100/60 pb-4">
        <div className="flex w-full min-w-0 items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
          {project.accessType === 'private' ? (
            <Lock className="mr-1.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          ) : (
            <Globe className="mr-1.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          )}
          <span className="min-w-0 truncate">{project.accessType === 'private' ? 'Private' : 'Public'}</span>
        </div>
        <div className="flex w-full min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
          <Cpu className="mr-1.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="min-w-0 truncate font-mono" title={project.technologyNode}>
            {project.technologyNode}
          </span>
        </div>
      </div>

      <div className="project-members-section grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2.5 text-xs text-slate-600">
        <span className="shrink-0 font-bold leading-relaxed text-slate-400">Lead:</span>
        <span className="min-w-0 break-words font-medium leading-relaxed text-slate-700">{leadName}</span>
        <span className="shrink-0 font-bold leading-relaxed text-slate-400">Members:</span>
        <span className="min-w-0 break-words font-medium leading-relaxed text-slate-700">
          {membersText}
          {memberCount > 0 && (
            <span className="ml-1 font-semibold text-slate-400">({memberCount})</span>
          )}
        </span>
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
    <tr className={cn('projects-list-row group transition-colors border-b border-border hover:bg-emerald-50/50', isCompleted ? 'bg-emerald-50/60' : '')}>
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
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-start gap-2">
            <span className="font-semibold text-slate-455 w-20 shrink-0">Lead:</span>
            <span className="font-bold text-slate-700 flex-1 break-words">{project.teamLead || 'Not assigned'}</span>
          </div>
          <div className="flex items-start gap-2 text-slate-600">
            <span className="font-semibold text-slate-455 w-20 shrink-0">Members:</span>
            <span className="flex-1 break-words leading-relaxed" title={project.visibleUsers.join(' • ')}>
              {project.visibleUsers.length > 0 
                ? project.visibleUsers.slice(0, 2).join(' • ') + (project.visibleUsers.length > 2 ? ` • +${project.visibleUsers.length - 2} more` : '')
                : 'None'
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
    <div className="space-y-3.5">
      {sortedData.map((item, idx) => {
        const percent = maxHours > 0 ? (item.hours / maxHours) * 100 : 0
        const hue = item.hue ?? Math.round((idx * 137.5) % 360)

        const frontBg = '#2f6b4f'
        const topBg = '#3d8a66'
        const sideBg = '#245c40'
        const depth = 6 // px depth of the 3D extrusion

        return (
          <div
            key={item.name}
            className="group rounded-lg border border-transparent px-3 py-3 transition-all hover:border-border hover:bg-emerald-50/50"
          >
            <div className="flex items-center gap-3">
              <Avatar name={item.name} size="md" color={`hsl(${hue},55%,45%)`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-base font-bold text-ink group-hover:text-[var(--emerald-dark)] font-display">
                    {item.name}
                  </p>
                  <span className="type-metric-inline shrink-0 text-base text-ink">
                    {item.hours.toFixed(1)}
                    <span className="ml-0.5 text-xs font-semibold text-slate-450">h</span>
                  </span>
                </div>
                {/* 3D Bar — matches PDF report style */}
                <div className="relative mt-2 w-full" style={{ height: 16 + depth }}>
                  {/* Track / background */}
                  <div
                    className="absolute rounded-[3px]"
                    style={{
                      left: 0,
                      top: depth,
                      width: '100%',
                      height: 16,
                      background: 'rgba(0,0,0,0.04)',
                    }}
                  />
                  {percent > 0 && (
                    <>
                      {/* Front face */}
                      <div
                        className="absolute rounded-[3px] transition-all duration-500 ease-out"
                        style={{
                          left: 0,
                          top: depth,
                          width: `${percent}%`,
                          height: 16,
                          background: frontBg,
                          boxShadow: '0 2px 6px rgba(47, 107, 79, 0.35)',
                        }}
                      />
                      {/* Top face (parallelogram via clip-path) */}
                      <div
                        className="absolute transition-all duration-500 ease-out"
                        style={{
                          left: 0,
                          top: 0,
                          width: `calc(${percent}% + ${depth}px)`,
                          height: depth,
                          background: topBg,
                          clipPath: `polygon(${depth}px 0%, 100% 0%, calc(100% - ${depth}px) 100%, 0% 100%)`,
                        }}
                      />
                      {/* Right side face (parallelogram via clip-path) */}
                      <div
                        className="absolute transition-all duration-500 ease-out"
                        style={{
                          left: `${percent}%`,
                          top: 0,
                          width: depth,
                          height: 16 + depth,
                          background: sideBg,
                          clipPath: `polygon(${depth}px 0%, ${depth}px ${depth}px, 0% 100%, 0% ${depth}px)`,
                        }}
                      />
                    </>
                  )}
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
   COMPONENT – Compact pagination (ellipsis for large page counts)
   ================================================================ */
function ProjectsPaginationBar({
  currentPage,
  totalPages,
  rangeStart,
  rangeEnd,
  totalItems,
  itemLabel,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  totalItems: number
  itemLabel: string
  onPageChange: (page: number) => void
}) {
  const visiblePages = getVisiblePageNumbers(currentPage, totalPages)

  return (
    <div className="projects-pagination-bar flex flex-wrap items-center justify-between gap-3">
      <span className="text-[11px] font-semibold text-slate-600">
        Showing {rangeStart}–{rangeEnd} of {totalItems} {itemLabel}
      </span>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-[var(--bg-card)] px-3 text-[11px] font-bold text-slate-700 transition-all hover:bg-emerald-50/60 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          Previous
        </button>
        {visiblePages.map((pageNum, index) => {
          const prevPage = visiblePages[index - 1]
          const showEllipsis = prevPage != null && pageNum - prevPage > 1

          return (
            <span key={pageNum} className="inline-flex items-center gap-1.5">
              {showEllipsis ? (
                <span
                  className="inline-flex h-7 min-w-7 items-center justify-center px-0.5 text-[11px] font-bold text-slate-400"
                  aria-hidden
                >
                  …
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px] font-black transition-all',
                  currentPage === pageNum
                    ? 'admin-projects-green-solid shadow-sm'
                    : 'border border-border bg-[var(--bg-card)] text-slate-700 hover:bg-emerald-50/60 hover:text-ink',
                )}
                aria-label={`Page ${pageNum}`}
                aria-current={currentPage === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </button>
            </span>
          )
        })}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-[var(--bg-card)] px-3 text-[11px] font-bold text-slate-700 transition-all hover:bg-emerald-50/60 hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

/* ================================================================
   COMPONENT – Archived Project Card (matches ProjectCard layout)
   ================================================================ */
const ArchivedProjectCard = memo(function ArchivedProjectCard({
  project,
  onRestore,
  restoring,
}: {
  project: ArchivedProjectSummary
  onRestore: () => void
  restoring: boolean
}) {
  const isCompleted = project.status === 'Completed'
  const isRejected = project.status === 'Rejected'
  const leadName = project.teamLead || 'Not assigned'
  const memberCount = project.visibleUsers.length
  const maxVisibleNames = 3
  const visibleNames = project.visibleUsers.slice(0, maxVisibleNames)
  const remainingCount = memberCount - maxVisibleNames
  const membersText =
    memberCount > 0
      ? visibleNames.join(' • ') + (remainingCount > 0 ? ` • +${remainingCount} more` : '')
      : 'None assigned'
  const projectInitial = project.name.charAt(project.name.indexOf(' ') + 1) || project.name.charAt(0)
  const statusLabel = isRejected ? 'Rejected' : isCompleted ? 'Completed' : 'In Progress'
  let ringColor = 'border-blue-500 ring-blue-500/20 text-blue-700 bg-blue-50'
  let badgeColor = 'bg-blue-100 text-blue-700 border-blue-200'
  if (isCompleted) {
    ringColor = 'border-emerald-600 ring-emerald-500/20 text-emerald-700 bg-emerald-50'
    badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200'
  } else if (isRejected) {
    ringColor = 'border-red-500 ring-red-500/20 text-red-700 bg-red-50'
    badgeColor = 'bg-red-100 text-red-700 border-red-200'
  }
  const hue = stringToHue(project.id || project.name)
  const startColor = `hsl(${hue} 75% 95%)`
  const borderColor = `hsl(${hue} 50% 86%)`
  const archivedLabel = new Date(project.archivedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div
      className="projects-card group flex min-w-0 flex-col gap-4 rounded-2xl border p-5 shadow-[0_4px_15px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] animate-fadeIn"
      style={{
        background: `linear-gradient(135deg, ${startColor} 0%, #ffffff 100%)`,
        borderColor,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 ring-4 ${ringColor}`}>
            <span className="text-xl font-bold">{projectInitial}</span>
          </div>
          <span className={`max-w-[6.5rem] whitespace-nowrap rounded-full border px-2.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider ${badgeColor}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-start pt-1">
          <button
            type="button"
            onClick={onRestore}
            disabled={restoring}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-50 px-3 text-xs font-bold text-[var(--emerald-dark)] transition-colors hover:bg-emerald-100/80 disabled:opacity-60"
            title="Restore Project"
          >
            <RefreshCw className={cn('h-4 w-4', restoring && 'animate-spin')} />
            Restore
          </button>
        </div>
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-base font-bold leading-snug text-slate-800 group-hover:text-emerald-700">{project.name}</h3>
        <p className="mt-1 truncate text-xs text-slate-500">{project.client}</p>
      </div>
      {project.description ? <p className="line-clamp-2 text-xs text-slate-600">{project.description}</p> : null}
      <div className="flex flex-col gap-2 border-b border-slate-100/60 pb-4">
        <div className="flex min-w-0 items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
          {project.accessType === 'private' ? <Lock className="mr-1.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> : <Globe className="mr-1.5 h-3.5 w-3.5 shrink-0 text-slate-500" />}
          <span className="truncate">{project.accessType === 'private' ? 'Private' : 'Public'}</span>
        </div>
        <div className="flex min-w-0 items-center rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
          <Cpu className="mr-1.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="truncate font-mono">{project.technologyNode}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-slate-600">
        <div className="rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Tasks</p>
          <p className="mt-0.5 tabular-nums">{project.tasksCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Logs</p>
          <p className="mt-0.5 tabular-nums">{project.timesheetsCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Archived</p>
          <p className="mt-0.5 truncate" title={archivedLabel}>{archivedLabel}</p>
        </div>
      </div>
      <div className="project-members-section grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-xs text-slate-600">
        <span className="font-bold text-slate-400">Lead:</span>
        <span className="break-words font-medium text-slate-700">{leadName}</span>
        <span className="font-bold text-slate-400">Members:</span>
        <span className="break-words font-medium text-slate-700">
          {membersText}
          {memberCount > 0 ? <span className="ml-1 text-slate-400">({memberCount})</span> : null}
        </span>
      </div>
    </div>
  )
})

const ArchivedProjectListRow = memo(function ArchivedProjectListRow({
  project,
  onRestore,
  restoring,
}: {
  project: ArchivedProjectSummary
  onRestore: () => void
  restoring: boolean
}) {
  const isCompleted = project.status === 'Completed'
  const isRejected = project.status === 'Rejected'
  const projectInitial = project.name.charAt(project.name.indexOf(' ') + 1) || project.name.charAt(0)
  const archivedLabel = new Date(project.archivedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <tr className={cn('projects-list-row group border-b border-border transition-colors hover:bg-emerald-50/50', isCompleted ? 'bg-emerald-50/60' : '')}>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--emerald-surface)] text-sm font-extrabold text-[var(--emerald-dark)] ring-1 ring-[rgba(38,107,28,0.22)]">{projectInitial}</span>
          <p className="truncate text-sm font-bold text-ink group-hover:text-[var(--emerald-dark)]">{project.name}</p>
        </div>
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-slate-800">{project.client}</td>
      <td className="px-5 py-4 font-mono text-sm">{project.technologyNode}</td>
      <td className="px-5 py-4 tabular-nums text-sm">{project.tasksCount}</td>
      <td className="px-5 py-4 tabular-nums text-sm">{project.timesheetsCount}</td>
      <td className="px-5 py-4 text-sm text-slate-600">{archivedLabel}</td>
      <td className="px-5 py-4">
        {isRejected ? (
          <Badge variant="neutral">Rejected</Badge>
        ) : isCompleted ? (
          <Badge variant="success"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Completed</Badge>
        ) : (
          <Badge variant="info">In Progress</Badge>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        <button type="button" onClick={onRestore} disabled={restoring} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-50 px-3 text-xs font-bold text-[var(--emerald-dark)] hover:bg-emerald-100/80 disabled:opacity-60">
          <RefreshCw className={cn('h-4 w-4', restoring && 'animate-spin')} />
          Restore
        </button>
      </td>
    </tr>
  )
})

/* ================================================================
   COMPONENT – Archived Projects (inline workspace view)
   ================================================================ */
function ArchivedProjectsPanel({
  archivedProjects,
  loading,
  restoringId,
  onRestore,
}: {
  archivedProjects: ArchivedProjectSummary[]
  loading: boolean
  restoringId: string | null
  onRestore: (id: string, name: string) => Promise<void>
}) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  const sortedList = useMemo(
    () =>
      [...archivedProjects].sort(
        (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime(),
      ),
    [archivedProjects],
  )

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sortedList
    return sortedList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        (p.teamLead || '').toLowerCase().includes(q) ||
        p.technologyNode.toLowerCase().includes(q),
    )
  }, [sortedList, searchQuery])

  return (
    <div className="projects-directory-section animate-fadeIn">
      <div className="projects-directory-header">
        <div className="projects-directory-header-title">
          <h2 className="projects-directory-table-title">Archived Projects</h2>
          <p className="projects-directory-table-subtitle">
            {filteredList.length} archived project{filteredList.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="projects-directory-header-controls">
          <div className="projects-directory-search-group">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--emerald-dark)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search archived projects…"
                className="admin-field projects-search-input w-full pl-9 pr-8 font-medium text-ink shadow-sm"
              />
              {searchQuery ? (
                <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-md p-0.5 text-slate-700 hover:bg-white/60 hover:text-ink">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="projects-directory-view-toggle projects-view-toggle shrink-0">
            <button type="button" onClick={() => setViewMode('grid')} className={`rounded-md p-2 transition-all ${viewMode === 'grid' ? 'admin-projects-green-solid shadow-sm' : 'text-slate-600 hover:text-ink'}`} title="Grid view" aria-label="Grid view">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setViewMode('list')} className={`rounded-md p-2 transition-all ${viewMode === 'list' ? 'admin-projects-green-solid shadow-sm' : 'text-slate-600 hover:text-ink'}`} title="List view" aria-label="List view">
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="projects-directory-scroll">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner className="text-[var(--emerald-dark)]" />
            <p className="mt-3 text-sm font-medium text-slate-500">Loading archived projects…</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-16 text-center">
            <Archive className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-base font-bold text-slate-700">{searchQuery ? 'No archived projects match your search.' : 'No archived projects found'}</p>
            <p className="mt-1 max-w-sm px-4 text-sm font-medium text-slate-500">Projects you archive from the active workspace will appear here.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="projects-grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredList.map((p) => (
              <ArchivedProjectCard key={p.id} project={p} restoring={restoringId === p.id} onRestore={() => void onRestore(p.id, p.name)} />
            ))}
          </div>
        ) : (
          <div className="projects-table-shell">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-20 bg-white">
                  <tr className="border-b border-border bg-white shadow-sm">
                    <th className="bg-white px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Project</th>
                    <th className="bg-white px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Client</th>
                    <th className="bg-white px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Tech Node</th>
                    <th className="bg-white px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Tasks</th>
                    <th className="bg-white px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Timesheets</th>
                    <th className="bg-white px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Archived</th>
                    <th className="bg-white px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Status</th>
                    <th className="bg-white px-5 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredList.map((p) => (
                    <ArchivedProjectListRow key={p.id} project={p} restoring={restoringId === p.id} onRestore={() => void onRestore(p.id, p.name)} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   MAIN DASHBOARD COMPONENT
   ================================================================ */
type ProjectsWorkspaceTab = 'projects' | 'timesheets' | 'analytics' | 'archived'

export function ProjectManagement() {
  const [searchParams, setSearchParams] = useSearchParams()
  // ── Core State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ProjectsWorkspaceTab>('projects')

  const setWorkspaceTab = useCallback(
    (tab: ProjectsWorkspaceTab) => {
      setActiveTab(tab)
      const next = new URLSearchParams(searchParams)
      if (tab === 'projects') next.delete('tab')
      else next.set('tab', tab)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (
      tab === 'analytics' ||
      tab === 'timesheets' ||
      tab === 'projects' ||
      tab === 'archived'
    ) {
      setActiveTab(tab)
    }
  }, [searchParams])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [timesheets, setTimesheets] = useState<TimesheetLog[]>([])
  const [workSessions, setWorkSessions] = useState<WorkSessionLog[]>([])
  const [loading, setLoading] = useState(false)
  const [timesheetsLoading, setTimesheetsLoading] = useState(false)

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
  const projectsPerPage = 12

  // ── Timesheets Pagination States ────────────────────────────
  const [timesheetsCurrentPage, setTimesheetsCurrentPage] = useState(1)
  const timesheetsPerPage = 10

  // ── Project Modal States ────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const employeesRevision = useEmployeeStore((s) => s.employeesRevision)

  // ── Project Audit Trail Modal States ────────────────────────────
  const [auditTrailModalOpen, setAuditTrailModalOpen] = useState(false)
  const [selectedAuditProjectId, setSelectedAuditProjectId] = useState<string | null>(null)
  const [selectedAuditProjectName, setSelectedAuditProjectName] = useState<string>('')

  // ── Project Archiving & Delete Confirmation States ──────────────
  const [archiveConfirmStep, setArchiveConfirmStep] = useState<0 | 1 | 2>(0)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [archivedProjects, setArchivedProjects] = useState<ArchivedProjectSummary[]>([])
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [restoringArchivedId, setRestoringArchivedId] = useState<string | null>(null)

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

  const allocatableEmployees = useMemo(() => filterAllocatableEmployees(employees), [employees])
  const allEmployeeNames = useMemo(() => allEmployeeDisplayNames(allocatableEmployees), [allocatableEmployees])

  useEffect(() => {
    if (!modalOpen || form.accessType !== 'public' || allEmployeeNames.length === 0) return
    setForm((prev) => {
      if (prev.accessType !== 'public') return prev
      const allSelected =
        prev.visibleUsers.length === allEmployeeNames.length &&
        allEmployeeNames.every((name) => prev.visibleUsers.includes(name))
      if (allSelected) return prev
      return { ...prev, visibleUsers: allEmployeeNames }
    })
  }, [modalOpen, form.accessType, allEmployeeNames])

  // ── Timesheets Date Range Picker States ─────────────────────
  const todayDate = formatLocalDateString()
  const [datePreset, setDatePreset] = useState<string>('Today')
  const [tsStartDate, setTsStartDate] = useState(todayDate)
  const [tsEndDate, setTsEndDate] = useState(todayDate)

  // ── Timesheets Filters States ───────────────────────────────
  const [tsSearch, setTsSearch] = useState('')
  const debouncedTsSearch = useDebounce(tsSearch, 350)
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

  const fetchArchivedProjects = useCallback(async () => {
    setLoadingArchived(true)
    try {
      const res = await api.get('/projects/archived')
      setArchivedProjects(res.data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load archived projects.')
    } finally {
      setLoadingArchived(false)
    }
  }, [])

  const fetchTimesheetsData = useCallback(async () => {
    const params: Record<string, string> = {
      from: tsStartDate,
      to: tsEndDate,
    }
    if (debouncedTsSearch.trim()) params.search = debouncedTsSearch.trim()

    setTimesheetsLoading(true)
    try {
      const [logsRes, sessionsRes] = await Promise.all([
        api.get('/timesheets', { params }),
        api.get('/timesheets/work-sessions', { params }),
      ])
      setTimesheets(logsRes.data)
      setWorkSessions(sessionsRes.data)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load timesheet data.')
    } finally {
      setTimesheetsLoading(false)
    }
  }, [tsStartDate, tsEndDate, debouncedTsSearch])

  const refreshAllData = useCallback(async () => {
    await Promise.all([fetchProjects(), fetchTimesheetsData(), fetchArchivedProjects()])
  }, [fetchProjects, fetchTimesheetsData, fetchArchivedProjects])

  const handleRestoreArchivedProject = useCallback(
    async (id: string, name: string) => {
      if (
        !window.confirm(
          `Restore "${name}"? It will return to the active projects list with its archived history.`,
        )
      ) {
        return
      }
      setRestoringArchivedId(id)
      try {
        await api.post(`/projects/archived/${id}/restore`)
        await Promise.all([fetchArchivedProjects(), fetchProjects()])
        toast.success(`Restored "${name}" successfully.`)
      } catch (err: unknown) {
        console.error(err)
        const message =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : undefined
        toast.error(message || 'Failed to restore project.')
      } finally {
        setRestoringArchivedId(null)
      }
    },
    [fetchArchivedProjects, fetchProjects],
  )

  useEffect(() => {
    fetchProjects()
    fetchEmployees()
    void fetchArchivedProjects()
  }, [fetchProjects, fetchEmployees, fetchArchivedProjects, employeesRevision])

  useEffect(() => {
    if (activeTab === 'archived') {
      void fetchArchivedProjects()
    }
  }, [activeTab, fetchArchivedProjects])

  useEffect(() => {
    if (activeTab !== 'timesheets' && activeTab !== 'analytics') return
    void fetchTimesheetsData()
  }, [activeTab, fetchTimesheetsData])

  useEffect(() => {
    if (activeTab !== 'timesheets' && activeTab !== 'analytics') return undefined
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchTimesheetsData()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [activeTab, fetchTimesheetsData])

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

  const projectEmployeeFilterOptions = useMemo(() => {
    return uniqueEmployees.map((empName) => {
      const emp = employees.find((e) => employeeDisplayName(e) === empName)
      const label = emp?.employeeId ? `${empName} (${emp.employeeId})` : empName
      return { value: empName, label }
    })
  }, [uniqueEmployees, employees])



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
    setForm({ ...emptyForm })
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
      visibleUsers:
        p.accessType === 'public' ? allEmployeeDisplayNames(allocatableEmployees) : [...p.visibleUsers],
      teamLead: p.teamLead || '',
      status: (p.status === 'Rejected' ? 'Cancelled' : p.status) as 'Active' | 'Completed' | 'Cancelled',
    })
    setModalOpen(true)
  }, [allocatableEmployees])

  const handleSaveProject = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!form.name.trim() || !form.client.trim()) {
        toast.error('Please specify Project Name and Client.')
        return
      }
      if (!form.description.trim()) {
        toast.error('Project description is required.')
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
            visibleUsers: form.visibleUsers,
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
            visibleUsers: form.visibleUsers,
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

  const handleDeleteProject = useCallback((p: Project) => {
    setProjectToDelete(p)
    setArchiveConfirmStep(1)
  }, [])

  const closeArchiveConfirm = useCallback(() => {
    setArchiveConfirmStep(0)
    setProjectToDelete(null)
  }, [])

  const handleArchiveFirstConfirm = useCallback(() => {
    setArchiveConfirmStep(2)
  }, [])

  const handleConfirmArchive = useCallback(async () => {
    if (!projectToDelete || !projectToDelete.id) {
      toast.error('Invalid project. Please try again.')
      return
    }

    setArchiveConfirmStep(0)
    setLoading(true)
    const pName = projectToDelete.name
    const projectId = projectToDelete.id

    try {
      const response = await api.post(`/projects/${projectId}/archive`)

      if (response.status === 200) {
        setTsProjectFilters((prev) => prev.filter((n) => n !== pName))
        setProjectToDelete(null)

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
    const emp = employees.find((e) => employeeDisplayName(e) === empName)
    if (!emp) return 'Design Team'
    return `${emp.department} Team`
  }, [employees])

  // ── Work sessions filtering (one row per check-in / check-out) ──
  const filteredWorkSessions = useMemo(() => {
    const filtered = workSessions.filter((s) => {
      const logDate = new Date(s.date)
      const startDate = new Date(tsStartDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(tsEndDate)
      endDate.setHours(23, 59, 59, 999)

      if (logDate < startDate || logDate > endDate) return false

      const query = tsSearch.toLowerCase()
      const matchSearch =
        !query ||
        s.employeeName.toLowerCase().includes(query) ||
        s.project.toLowerCase().includes(query) ||
        s.projects.some((p) => p.toLowerCase().includes(query))

      const matchEmployee = matchesMultiFilter(tsEmployeeFilters, s.employeeName)
      const matchProject =
        matchesMultiFilter(tsProjectFilters, s.project) ||
        s.projects.some((p) => matchesMultiFilter(tsProjectFilters, p))

      return matchSearch && matchEmployee && matchProject
    })
    return attachWorkSessionDayGroups(filtered, employees)
  }, [
    workSessions,
    tsStartDate,
    tsEndDate,
    tsSearch,
    tsEmployeeFilters,
    tsProjectFilters,
    employees,
  ])

  // ── Timesheets Filtering Implementation (task logs for analytics) ──
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
        t.totalPausedMs,
      t.workedMs,
      t.displayWorkedMs
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
        t.totalPausedMs,
      t.workedMs,
      t.displayWorkedMs
      ) || 0
      const { key, name, dept } = resolveTimesheetEmployeeKey(t, employees)
      const empInfo = employees.find(
        (e) => e.employeeId === key || e.id === key || employeeDisplayName(e) === name,
      )
      const employeeColorKey = key || name
      if (empMap[key]) {
        empMap[key].hours += hours
      } else {
        empMap[key] = {
          name,
          dept,
          hours,
          hue: (empInfo as any)?.hue ?? stringToHue(employeeColorKey),
        }
      }
    })
    return Object.values(empMap)
      .map(e => ({ ...e, hours: Math.round(e.hours * 10) / 10 }))
  }, [filteredTimesheets, employees])

  // ── Work sessions pagination ─────────────────────────────────
  const totalTimesheetsPages = Math.ceil(filteredWorkSessions.length / timesheetsPerPage)
  const indexOfLastTimesheet = timesheetsCurrentPage * timesheetsPerPage
  const indexOfFirstTimesheet = indexOfLastTimesheet - timesheetsPerPage
  const currentTimesheets = filteredWorkSessions.slice(indexOfFirstTimesheet, indexOfLastTimesheet)

  /** Page-local rowspan so one ] bracket covers every visible session in a multi-session day. */
  const currentTimesheetDayLayout = useMemo(() => {
    type LayoutCell = {
      isMulti: boolean
      showSpanCell: boolean
      rowSpan: number
      dayGroup: WorkSessionDayGroupMeta | null
    }
    const layout: LayoutCell[] = currentTimesheets.map(() => ({
      isMulti: false,
      showSpanCell: false,
      rowSpan: 1,
      dayGroup: null,
    }))

    let i = 0
    while (i < currentTimesheets.length) {
      const session = currentTimesheets[i]
      if (!session.dayGroup.isMultiSessionDay) {
        i += 1
        continue
      }
      const groupKey = session.dayGroup.groupKey
      let end = i + 1
      while (
        end < currentTimesheets.length &&
        currentTimesheets[end].dayGroup.groupKey === groupKey &&
        currentTimesheets[end].dayGroup.isMultiSessionDay
      ) {
        end += 1
      }
      const rowSpan = end - i
      layout[i] = {
        isMulti: true,
        showSpanCell: true,
        rowSpan,
        dayGroup: session.dayGroup,
      }
      for (let k = i + 1; k < end; k += 1) {
        layout[k] = {
          isMulti: true,
          showSpanCell: false,
          rowSpan: 0,
          dayGroup: session.dayGroup,
        }
      }
      i = end
    }
    return layout
  }, [currentTimesheets])

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

    const { hoursByProject, leaderboard } = buildTimesheetExportAnalytics(filteredTimesheets, employees)
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
      const h = calculateHours(t.loginTime, t.logoutTime, t.overriddenHours, t.totalHours, t.totalPausedMs, t.workedMs, t.displayWorkedMs) || 0
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
    sheet.getCell(currentRow, 6).value = 'Break'
    sheet.getCell(currentRow, 7).value = 'Worked'
    sheet.getCell(currentRow, 8).value = 'Day Group'
    sheet.getCell(currentRow, 9).value = 'Day Total (Worked / Break)'
    styleTableHeader(currentRow, 9, 'FF0284C7') // Sky-600
    currentRow++

    filteredWorkSessions.forEach((s, idx) => {
      const { key, name } = resolveTimesheetEmployeeKey(s, employees)
      const projectLabel =
        s.project && s.project !== '—'
          ? s.project
          : s.projects?.length === 1
            ? s.projects[0]
            : s.projects?.length > 1
              ? 'Multiple'
              : '—'
      sheet.getCell(currentRow, 1).value = name
      sheet.getCell(currentRow, 2).value = key
      sheet.getCell(currentRow, 3).value = projectLabel
      sheet.getCell(currentRow, 4).value = formatDateTime(s.loginTime)
      sheet.getCell(currentRow, 5).value = s.logoutTime ? formatDateTime(s.logoutTime) : '—'
      sheet.getCell(currentRow, 6).value = formatBreakTime(s)
      sheet.getCell(currentRow, 7).value = formatWorkSessionDuration(s)
      sheet.getCell(currentRow, 8).value = s.dayGroup.isMultiSessionDay
        ? `] ${s.dayGroup.dayGroupIndex + 1}/${s.dayGroup.dayGroupSize}`
        : ''
      sheet.getCell(currentRow, 9).value =
        s.dayGroup.isMultiSessionDay && s.dayGroup.isLastInDayGroup
          ? formatDayGroupTotals(s.dayGroup)
          : ''

      styleDataRow(currentRow, 9, idx % 2 === 0, [
        'left',
        'center',
        'left',
        'center',
        'center',
        'center',
        'center',
        'center',
        'left',
      ])
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
    downloadExcelBuffer(buffer, timesheetReportFileName(tsStartDate, tsEndDate, 'xlsx'))
  }, [filteredTimesheets, filteredWorkSessions, tsStartDate, tsEndDate, employees])

  const handleExportPDF = useCallback(async () => {
    if (!filteredTimesheets.length) {
      toast.error('No timesheet data available to export.')
      return
    }

    const { hoursByProject, leaderboard } = buildTimesheetExportAnalytics(filteredTimesheets, employees)
    
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

    const tableHeaders = ['Employee', 'Project', 'Login Time', 'Logout Time', 'Break', 'Duration', 'Day Total']

    const tableRows = filteredWorkSessions.map((s) => {
      const { key, name } = resolveTimesheetEmployeeKey(s, employees)
      const projectLabel =
        s.project && s.project !== '—'
          ? s.project
          : s.projects?.length === 1
            ? s.projects[0]
            : s.projects?.length > 1
              ? 'Multiple'
              : '—'
      const dayMarker = s.dayGroup.isMultiSessionDay
        ? s.dayGroup.isLastInDayGroup
          ? ']'
          : '|'
        : ''
      return [
        `${dayMarker ? `${dayMarker} ` : ''}${name} (${key})`,
        projectLabel,
        formatDateTime(s.loginTime),
        s.logoutTime ? formatDateTime(s.logoutTime) : '—',
        formatBreakTime(s),
        formatWorkSessionDuration(s),
        s.dayGroup.isMultiSessionDay && s.dayGroup.isLastInDayGroup
          ? formatDayGroupTotals(s.dayGroup)
          : '',
      ]
    })

    autoTable(doc, {
      ...tableTheme,
      head: [tableHeaders],
      body: tableRows,
      startY: cursorY,
      styles: { ...tableTheme.styles, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.22 },
        1: { cellWidth: contentWidth * 0.16 },
        2: { cellWidth: contentWidth * 0.15 },
        3: { cellWidth: contentWidth * 0.15 },
        4: { cellWidth: contentWidth * 0.08, halign: 'right' },
        5: { cellWidth: contentWidth * 0.08, halign: 'right' },
        6: { cellWidth: contentWidth * 0.16, halign: 'left' },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return
        const session = filteredWorkSessions[data.row.index]
        if (!session?.dayGroup.isMultiSessionDay) return
        data.cell.styles.fillColor = [236, 253, 245]
        if (data.column.index === 0 && session.dayGroup.isLastInDayGroup) {
          data.cell.styles.fontStyle = 'bold'
        }
        if (data.column.index === 6 && session.dayGroup.isLastInDayGroup) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = [22, 101, 52]
        }
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

    doc.save(timesheetReportFileName(tsStartDate, tsEndDate, 'pdf'))
  }, [filteredTimesheets, filteredWorkSessions, tsStartDate, tsEndDate, employees])

  const clearTimesheetFilters = useCallback(() => {
    const today = formatLocalDateString()
    setTsSearch('')
    setTsEmployeeFilters([])
    setTsProjectFilters([])
    setTsStatusFilters([])
    setTsStartDate(today)
    setTsEndDate(today)
    setDatePreset('Today')
  }, [])

  const tsEmployeeFilterOptions = useMemo(() => {
    const names = new Set<string>()
    employees.forEach((e) => names.add(employeeDisplayName(e)))
    timesheets.forEach((t) => {
      if (t.employeeName) names.add(t.employeeName)
    })
    workSessions.forEach((s) => {
      if (s.employeeName) names.add(s.employeeName)
    })
    return [...names].sort().map((name) => ({ value: name, label: name }))
  }, [timesheets, workSessions, employees])

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
    !isTodayTimesheetRange(tsStartDate, tsEndDate, datePreset) ||
    tsSearch.trim().length > 0 ||
    tsEmployeeFilters.length > 0 ||
    tsProjectFilters.length > 0 ||
    tsStatusFilters.length > 0

  return (
    <div className="crewiq-dashboard admin-projects-view">
      <div className="crewiq-dash-bg" aria-hidden />
      <PageWrapper
        fillViewport
        className="projects-page-wrapper relative z-10 py-3 font-body !max-w-none w-full !px-4 lg:!px-8"
      >
        <div className="projects-shell animate-fadeIn">
          
          {/* Hero — matches Leave Management hub header */}
          <div className="projects-hero-section mb-6">
            <div className="projects-hero-top">
              <div className="min-w-0">
                <h1 className="projects-hero-heading font-display">Projects & Timesheets</h1>
              </div>

              <nav className="projects-hero-tab-rail" aria-label="Project actions">
                {activeTab !== 'analytics' && activeTab !== 'archived' ? (
                  <button
                    type="button"
                    onClick={openCreateProject}
                    className="projects-hero-tab-btn projects-hero-tab-btn--primary"
                  >
                    <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    <span>Create Project</span>
                  </button>
                ) : null}

                <ProjectAnalysisLaunchButton className="projects-hero-tab-btn projects-hero-tab-btn--secondary" />
              </nav>
            </div>
          </div>

      {/* ================================================================
           TAB 1 – PROJECTS
           ================================================================ */}
      <div className="projects-body-grid">
        {/* Left Sidebar with Navigation and Filters */}
        <aside className="projects-sidebar projects-sidebar--with-footer flex flex-col">
          <div className="projects-sidebar__body flex flex-1 flex-col space-y-4">
          <div>
            {/* Navigation List */}
            <div className="sidebar-nav-list">
              <button
                type="button"
                onClick={() => setWorkspaceTab('projects')}
                className={`sidebar-nav-item ${activeTab === 'projects' ? 'active' : ''}`}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="flex-1 text-left">Projects</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('timesheets')}
                className={`sidebar-nav-item ${activeTab === 'timesheets' ? 'active' : ''}`}
              >
                <Clock className="h-4 w-4" />
                <span className="flex-1 text-left">Timesheets</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('analytics')}
                className={`sidebar-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="flex-1 text-left">Analytics</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('archived')}
                className={`sidebar-nav-item ${activeTab === 'archived' ? 'active' : ''}`}
              >
                <Archive className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Archived</span>
              </button>
            </div>
          </div>

          {activeTab === 'projects' ? (
            <div className="projects-sidebar-stats">
              <div className="projects-hero-stat-card projects-sidebar-stat-card">
                <div className="projects-hero-stat-head">
                  <span className="projects-hero-stat-dot projects-hero-stat-dot--progress" />
                  <span className="projects-hero-stat-label">In Progress</span>
                </div>
                <span className="projects-hero-stat-value projects-hero-stat-value--progress">
                  {projectMetrics.inProgress}
                </span>
              </div>

              <div className="projects-hero-stat-card projects-sidebar-stat-card">
                <div className="projects-hero-stat-head">
                  <span className="projects-hero-stat-dot projects-hero-stat-dot--completed" />
                  <span className="projects-hero-stat-label">Completed</span>
                </div>
                <span className="projects-hero-stat-value projects-hero-stat-value--completed">
                  {projectMetrics.completed}
                </span>
              </div>

              <div className="projects-hero-stat-card projects-sidebar-stat-card">
                <div className="projects-hero-stat-head">
                  <span className="projects-hero-stat-dot projects-hero-stat-dot--cancelled" />
                  <span className="projects-hero-stat-label">Cancelled</span>
                </div>
                <span className="projects-hero-stat-value projects-hero-stat-value--cancelled">
                  {projectMetrics.cancelled}
                </span>
              </div>
            </div>
          ) : null}
          </div>
        </aside>

        {/* Unified main content panel */}
        <div className="projects-main-panel">
          {activeTab === 'analytics' ? (
            <div className="projects-tab-panel projects-analytics-embed animate-fadeIn">
              <div className="projects-tab-scroll">
                <Analytics embedded />
              </div>
            </div>
          ) : activeTab === 'archived' ? (
            <ArchivedProjectsPanel
              archivedProjects={archivedProjects}
              loading={loadingArchived}
              restoringId={restoringArchivedId}
              onRestore={handleRestoreArchivedProject}
            />
          ) : activeTab === 'projects' ? (
            <div className="projects-directory-section animate-fadeIn">
              <div className="projects-directory-header">
                <div className="projects-directory-header-title">
                  <h2 className="projects-directory-table-title projects-directory-table-title--main">Project Directory</h2>
                  <p className="projects-directory-table-subtitle">
                    {filteredProjects.length} project{filteredProjects.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="projects-directory-header-controls">
                  <div className="projects-directory-search-group">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--emerald-dark)]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search projects, clients…"
                        className="admin-field projects-search-input w-full pl-9 pr-8 font-medium text-ink shadow-sm"
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-md p-0.5 text-slate-700 hover:bg-white/60 hover:text-ink"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowFilters(!showFilters)}
                      aria-label="Filters"
                      title="Filters"
                      className={`projects-directory-filters-btn inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border transition-all ${
                        showFilters || activeFiltersCount > 0
                          ? 'border-[rgba(38,107,28,0.35)] bg-white/80 text-[var(--emerald-dark)]'
                          : 'border-[rgba(38,107,28,0.2)] bg-white/50 text-slate-800 hover:bg-white/70'
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {activeFiltersCount > 0 ? (
                        <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--emerald-dark)] px-1 text-[10px] font-bold leading-none text-white">
                          {activeFiltersCount}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  <div className="projects-directory-view-toggle projects-view-toggle shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`rounded-md p-2 transition-all ${
                        viewMode === 'grid' ? 'admin-projects-green-solid shadow-sm' : 'text-slate-600 hover:text-ink'
                      }`}
                      title="Grid view"
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`rounded-md p-2 transition-all ${
                        viewMode === 'list' ? 'admin-projects-green-solid shadow-sm' : 'text-slate-600 hover:text-ink'
                      }`}
                      title="List view"
                      aria-label="List view"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {showFilters ? (
                <div className="projects-directory-filters rounded-lg border border-[rgba(38,107,28,0.15)] bg-white/55 p-3 animate-fadeIn">
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
                      options={projectEmployeeFilterOptions}
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
                        type="button"
                        onClick={clearProjectsFilters}
                        className="projects-directory-filters-reset shrink-0 whitespace-nowrap text-xs font-bold text-[var(--emerald-dark)] transition-colors hover:text-[var(--green-600)]"
                      >
                        Reset All Filters
                      </button>
                    ) : null}
                  </div>
                ) : null}

              <div className="projects-directory-scroll">
              {viewMode === 'grid' ? (
                <>
                  {filteredProjects.length > 0 ? (
                    <div className="projects-grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 xl:grid-cols-3">
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
                      <thead className="sticky top-0 z-20 bg-white">
                        <tr className="border-b border-border bg-white shadow-sm">
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600 bg-white">
                            Project Details
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600 bg-white">
                            Client
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600 bg-white">
                            Technology Node
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600 bg-white">
                            Access Control
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600 bg-white">
                            Visibility Scope
                          </th>
                          <th className="px-5 py-3 text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600 bg-white">
                            Status
                          </th>
                          <th className="px-5 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.07em] text-slate-600 bg-white">
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

              </div>

              {/* Projects Pagination Controls */}
              {totalProjectsPages > 1 && (
                <ProjectsPaginationBar
                  currentPage={projectsCurrentPage}
                  totalPages={totalProjectsPages}
                  rangeStart={indexOfFirstProject + 1}
                  rangeEnd={Math.min(indexOfLastProject, filteredProjects.length)}
                  totalItems={filteredProjects.length}
                  itemLabel="projects"
                  onPageChange={setProjectsCurrentPage}
                />
              )}
            </div>
          ) : (
            <div className="projects-tab-panel animate-fadeIn">
              <div className="projects-tab-scroll space-y-5">
              <div className="border-b border-border pb-3">
                <div className="projects-timesheet-toolbar flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[12rem] flex-1 max-w-[22rem]">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[var(--emerald-dark)]" />
                    <input
                      type="text"
                      value={tsSearch}
                      onChange={(e) => setTsSearch(e.target.value)}
                      placeholder="Search logs…"
                      className="admin-field projects-search-input h-11 w-full pl-10 pr-9 text-sm font-medium text-ink shadow-sm"
                    />
                    {tsSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => setTsSearch('')}
                        className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-md p-0.5 text-slate-700 hover:bg-emerald-50/50 hover:text-ink"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="relative shrink-0">
                    <CustomDateRangePicker
                      startDate={tsStartDate}
                      endDate={tsEndDate}
                      preset={datePreset}
                      onChange={handleDateRangeChange}
                      size="lg"
                    />
                  </div>

                  <div className="relative min-w-[11rem] flex-1 max-w-[15rem]">
                    <FilterCheckboxGroup
                      label="Employee"
                      placeholder="All Employees"
                      compact
                      size="lg"
                      options={tsEmployeeFilterOptions}
                      selected={tsEmployeeFilters}
                      onChange={setTsEmployeeFilters}
                    />
                  </div>

                  <div className="relative min-w-[11rem] flex-1 max-w-[15rem]">
                    <FilterCheckboxGroup
                      label="Project"
                      placeholder="All Projects"
                      compact
                      size="lg"
                      options={tsProjectFilterOptions}
                      selected={tsProjectFilters}
                      onChange={setTsProjectFilters}
                    />
                  </div>

                  <div className="relative min-w-[10rem] flex-1 max-w-[13rem]">
                    <FilterCheckboxGroup
                      label="Status"
                      placeholder="All Statuses"
                      compact
                      size="lg"
                      options={tsStatusFilterOptions}
                      selected={tsStatusFilters}
                      onChange={setTsStatusFilters}
                    />
                  </div>

                  {hasActiveTimesheetFilters ? (
                    <button
                      type="button"
                      onClick={clearTimesheetFilters}
                      className="shrink-0 whitespace-nowrap px-1 text-sm font-bold text-[var(--emerald-dark)] transition-colors hover:text-[var(--green-600)]"
                    >
                      Reset
                    </button>
                  ) : null}

                  <div className="flex w-full shrink-0 items-center justify-end gap-2.5 sm:ml-auto sm:w-auto">
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="inline-flex h-11 min-w-[9.75rem] shrink-0 flex-row items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[rgba(38,107,28,0.25)] bg-white px-4 text-sm font-bold text-[var(--emerald-dark)] transition-all hover:bg-emerald-50"
                    >
                      <FileSpreadsheet className="h-4 w-4 shrink-0" />
                      <span>Export Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="inline-flex h-11 min-w-[9.75rem] shrink-0 flex-row items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 px-4 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md"
                    >
                      <FileDown className="h-4 w-4 shrink-0" />
                      <span>PDF Report</span>
                    </button>
                  </div>
                </div>
              </div>

          {/* Analytics panels */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="projects-analytics-card">
              <div className="projects-analytics-head mb-0 flex items-center justify-between gap-2 border-b-0 pb-0 rounded-t-2xl">
                <h3 className="flex items-center gap-2 font-display text-[0.9375rem] font-extrabold text-white">
                  <span className="h-3.5 w-1 shrink-0 rounded-full bg-white/85" />
                  Aggregated Hours by Project
                </h3>
                {derivedHoursByProject.length > 0 && (
                  <span className="text-sm font-mono font-bold text-white/90">
                    {derivedHoursByProject.length} project{derivedHoursByProject.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="projects-analytics-body">
              {derivedHoursByProject.length > 0 ? (
                <div
                  className={cn(
                    'timesheet-panel-scroll pr-0.5',
                    derivedHoursByProject.length > TIMESHEET_AGGREGATED_SCROLL_THRESHOLD.projects &&
                      'max-h-[22rem] overflow-auto',
                  )}
                >
                  <ProjectHoursHoverCardProvider>
                    <div
                      className={
                        derivedHoursByProject.length > 9
                          ? 'grid w-max min-w-full gap-3 p-0.5'
                          : 'grid w-full grid-cols-2 gap-3 sm:grid-cols-3'
                      }
                      style={
                        derivedHoursByProject.length > 9
                          ? {
                              gridTemplateRows: 'repeat(3, minmax(5.75rem, auto))',
                              gridAutoFlow: 'column',
                              gridAutoColumns: 'minmax(9rem, 10.5rem)',
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
                          const cardBg = 'bg-[#2f6b4f]'
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
                <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-[rgba(38,107,28,0.2)] bg-white/60 px-4 py-8 text-base font-semibold text-slate-600">
                  No data logs available in the chosen dates.
                </div>
              )}
              </div>
            </div>

            <div className="projects-analytics-card">
              <div className="projects-analytics-head mb-0 flex items-center justify-between gap-2 border-b-0 pb-0 rounded-t-2xl">
                <h3 className="flex items-center gap-2 font-display text-[0.9375rem] font-extrabold text-white">
                  <span className="h-3.5 w-1 shrink-0 rounded-full bg-white/85" />
                  Aggregated Hours by Employee
                </h3>
                {derivedLeaderboardData.length > 0 && (
                  <span className="text-sm font-mono font-bold text-white/90">
                    {derivedLeaderboardData.length} employee{derivedLeaderboardData.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="projects-analytics-body">
              <div
                className={cn(
                  'timesheet-panel-scroll pr-0.5',
                  derivedLeaderboardData.length > TIMESHEET_AGGREGATED_SCROLL_THRESHOLD.employees &&
                    'max-h-[22rem] overflow-y-auto',
                )}
              >
                <EmployeeLeaderboard data={derivedLeaderboardData} />
              </div>
              </div>
            </div>
          </div>

          {/* Timesheet log table */}
          <div className="projects-ts-table-wrap">
            <div className="overflow-x-auto timesheet-panel-scroll">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[rgba(38,107,28,0.12)]">
                    <th className="w-8 px-2 py-3.5 font-bold" aria-label="Day group" />
                    <th className="px-5 py-3.5 font-bold">Employee</th>
                    <th className="px-5 py-3.5 font-bold">Project</th>
                    <th className="px-5 py-3.5 font-bold">Login Time</th>
                    <th className="px-5 py-3.5 font-bold">Logout Time</th>
                    <th className="px-5 py-3.5 font-bold">Break Time</th>
                    <th className="px-5 py-3.5 font-bold">Duration</th>
                    <th className="px-5 py-3.5 font-bold">Day Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-base">
                  {timesheetsLoading && currentTimesheets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-600">
                        <Spinner className="mx-auto text-[var(--emerald-dark)]" />
                        <p className="mt-3 text-sm font-medium">Loading timesheet logs…</p>
                      </td>
                    </tr>
                  ) : null}
                  {currentTimesheets.map((t, rowIndex) => {
                    const { key: displayEmployeeId, name: displayEmployeeName } =
                      resolveTimesheetEmployeeKey(t, employees)
                    const empInfo = employees.find(
                      (e) =>
                        e.id === t.employeeId ||
                        e.employeeId === t.employeeId ||
                        e.employeeId === displayEmployeeId ||
                        employeeDisplayName(e) === displayEmployeeName,
                    )
                    const employeeColorKey =
                      empInfo?.id || empInfo?.employeeId || displayEmployeeId || displayEmployeeName
                    const dayLayout = currentTimesheetDayLayout[rowIndex]
                    const projectLabel =
                      t.project && t.project !== '—'
                        ? t.project
                        : t.projects?.length === 1
                          ? t.projects[0]
                          : t.projects?.length > 1
                            ? 'Multiple'
                            : '—'

                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          'group transition-colors',
                          dayLayout?.isMulti && 'ts-day-group-row',
                        )}
                      >
                        {dayLayout?.showSpanCell ? (
                          <td
                            rowSpan={dayLayout.rowSpan}
                            className="ts-day-group-bracket-cell"
                          >
                            <span className="ts-day-group-bracket-bar" aria-hidden />
                          </td>
                        ) : dayLayout?.isMulti ? null : (
                          <td className="w-8 px-2 py-0" />
                        )}

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={displayEmployeeName}
                              size="md"
                              color={stringToHueColor(employeeColorKey)}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-base font-bold text-ink leading-tight">
                                {displayEmployeeName}
                              </p>
                              <p className="text-xs font-semibold text-slate-600 font-mono">
                                {displayEmployeeId}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {projectLabel === '—' ? (
                            <span className="text-base font-semibold text-slate-400">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (t.projectId) {
                                  openAuditTrail(t.projectId, projectLabel)
                                } else {
                                  const found = allProjects.find((p) => p.name === projectLabel)
                                  if (found) {
                                    openAuditTrail(found.id, found.name)
                                  } else {
                                    toast.error(`Could not find project: ${projectLabel}`)
                                  }
                                }
                              }}
                              className="group/btn block max-w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(38,107,28,0.22)] rounded-md"
                            >
                              <p className="flex items-center gap-1 text-base font-bold text-ink transition-colors group-hover/btn:text-[var(--emerald-dark)]">
                                <span className="truncate">{projectLabel}</span>
                                <ArrowUpRight className="h-4 w-4 shrink-0 opacity-0 text-[var(--emerald-dark)] transition-all group-hover/btn:opacity-100" />
                              </p>
                            </button>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="text-base font-semibold text-slate-800">{formatDateTime(t.loginTime)}</p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <p
                            className={cn(
                              'text-base font-semibold',
                              t.logoutTime ? 'text-slate-800' : 'text-emerald-700',
                            )}
                          >
                            {t.logoutTime ? formatDateTime(t.logoutTime) : 'In progress'}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="inline-flex rounded-lg border border-border bg-[var(--bg-input)] px-3 py-1.5 font-mono text-sm font-bold text-slate-800">
                            {formatBreakTime(t)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-lg border border-border bg-[var(--bg-input)] px-3 py-1.5 text-ink font-mono text-sm font-bold">
                            {formatWorkSessionDuration(t)}
                          </span>
                          {t.autoCheckedOut && (
                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
                              Auto Checked-Out
                            </p>
                          )}
                        </td>

                        {dayLayout?.showSpanCell ? (
                          <td
                            rowSpan={dayLayout.rowSpan}
                            className="ts-day-group-total-cell whitespace-nowrap px-5 py-4 align-middle"
                          >
                            <div className="ts-day-group-total">
                              <p className="font-mono text-sm font-bold text-ink">
                                {formatDurationFromMs(dayLayout.dayGroup?.dayTotalWorkedMs || 0)}
                              </p>
                              <p className="text-[11px] font-semibold text-slate-500">
                                Break {formatDurationFromMs(dayLayout.dayGroup?.dayTotalBreakMs || 0)}
                              </p>
                            </div>
                          </td>
                        ) : dayLayout?.isMulti ? null : (
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="text-slate-300">—</span>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {filteredWorkSessions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm font-semibold text-slate-600">
                        No work sessions correspond to selected range and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalTimesheetsPages > 1 && (
            <ProjectsPaginationBar
              currentPage={timesheetsCurrentPage}
              totalPages={totalTimesheetsPages}
              rangeStart={indexOfFirstTimesheet + 1}
              rangeEnd={Math.min(indexOfLastTimesheet, filteredWorkSessions.length)}
              totalItems={filteredWorkSessions.length}
              itemLabel="sessions"
              onPageChange={setTimesheetsCurrentPage}
            />
          )}
              </div>
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
        className={cn(
          'max-h-none overflow-y-visible p-5 [&>div:first-child]:mb-3',
          modalMode === 'create' && 'projects-create-project-modal',
        )}
      >
        <form onSubmit={handleSaveProject} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Technology Node"
              placeholder="e.g. 7nm"
              value={form.technologyNode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, technologyNode: e.target.value })
              }
            />
            <SelectField
              label="Team Lead"
              id="m-proj-team-lead"
              value={form.teamLead}
              onChange={(e) => setForm({ ...form, teamLead: e.target.value })}
              options={[
                { value: '', label: 'Select team lead...' },
                ...allocatableEmployees.map((e) => ({
                  value: employeeDisplayName(e),
                  label: employeeDisplayName(e) + ` (${e.department})`,
                })),
              ]}
            />
          </div>

          <SelectField
            label="Access Control"
            id="m-proj-access"
            value={form.accessType}
            onChange={(e) => {
              const accessType = e.target.value as 'public' | 'private'
              setForm({
                ...form,
                accessType,
                visibleUsers: accessType === 'public' ? allEmployeeNames : [],
              })
            }}
            options={[
              { value: 'public', label: 'Public — all members can access' },
              { value: 'private', label: 'Private — restricted to allotted members' },
            ]}
          />

          <CheckboxList
            label="Allotted Members"
            items={allEmployeeNames}
            selected={form.visibleUsers}
            onChange={(next) => setForm({ ...form, visibleUsers: next })}
          />

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700">
              Project Description
            </label>
            <textarea
              placeholder="Project scope, goals, and specifications..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-border bg-[var(--bg-input)] p-2.5 text-xs text-ink outline-none transition-all placeholder:text-slate-600 focus:border-[var(--emerald-dark)] focus:ring-2 focus:ring-[rgba(38,107,28,0.15)]"
              required
            />
          </div>

          {modalMode === 'edit' && (
            <SelectField
              label="Project Status"
              id="m-proj-status"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as 'Active' | 'Completed' | 'Cancelled' })
              }
              options={[
                { value: 'Active', label: 'In Progress' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Cancelled', label: 'Cancelled' },
              ]}
            />
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-3">
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

      {/* Project Archive — step 1 confirmation */}
      {projectToDelete && archiveConfirmStep === 1 ? (
        <ConfirmModal
          isOpen
          title="Archive Project"
          description={`Archive "${projectToDelete.name}"? The project and its history (tasks and timesheets) will move to Archived Projects. You can restore it later.`}
          confirmLabel="Continue"
          onClose={closeArchiveConfirm}
          onConfirm={handleArchiveFirstConfirm}
        />
      ) : null}

      {/* Project Archive — step 2 final confirmation */}
      {projectToDelete && archiveConfirmStep === 2 ? (
        <ConfirmModal
          isOpen
          title="Confirm Archive"
          description={`This is your final confirmation. Archive "${projectToDelete.name}" now? This cannot be undone from the active projects list.`}
          confirmLabel="Yes, Archive Project"
          danger
          onClose={closeArchiveConfirm}
          onConfirm={handleConfirmArchive}
        />
      ) : null}

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

