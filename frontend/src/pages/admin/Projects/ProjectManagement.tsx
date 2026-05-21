import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { SelectField } from '@components/forms/SelectField'
import { Modal } from '@components/ui/Modal'
import { toast } from 'sonner'
import {
  Clock,
  Users,
  Search,
  Check,
  X,
  Edit2,
  Trash2,
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
  AlertCircle,
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

/* ================================================================
   TYPE DEFINITIONS
   ================================================================ */
interface Project {
  id: string
  name: string
  client: string
  technologyNode: string
  accessType: 'public' | 'private'
  status: 'Active' | 'Completed'
  description: string
  visibleUsers: string[]
  assignedTeamName?: string
}

interface TimesheetLog {
  id: string
  employeeId: string
  employeeName: string
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
  }
  status: 'Approved' | 'Pending' | 'Rejected'
  billable: boolean
  task: string
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

const SEED_PROJECTS: Project[] = [
  {
    id: 'P-1001',
    name: 'Project Atlas',
    client: 'Acme Corp',
    technologyNode: '14nm FinFET',
    accessType: 'private',
    status: 'Active',
    description:
      'Next-generation low-power microprocessor layout design and verification pipeline for mobile SoC applications.',
    visibleUsers: ['Asha Menon', 'Rahul Verma', 'Kiran Rao'],
    assignedTeamName: 'Design Team',
  },
  {
    id: 'P-1002',
    name: 'Project Beacon',
    client: 'Globex Electronics',
    technologyNode: '28nm',
    accessType: 'public',
    status: 'Active',
    description:
      'High-speed analog-to-digital converter interface and clock distribution tree for automotive radar systems.',
    visibleUsers: [],
  },
  {
    id: 'P-1003',
    name: 'Project Phoenix',
    client: 'Initech Systems',
    technologyNode: '65nm',
    accessType: 'private',
    status: 'Active',
    description:
      'Legacy chip retrofit and radiation hardening for aerospace telemetry sensors with full MIL-STD compliance.',
    visibleUsers: ['Amit Patel', 'Vikram Singh'],
    assignedTeamName: 'R&D Team',
  },
  {
    id: 'P-1004',
    name: 'Project Apollo',
    client: 'Internal',
    technologyNode: '180nm',
    accessType: 'public',
    status: 'Completed',
    description:
      'Standard cell library characterization and physical design rule verification for internal PDK release.',
    visibleUsers: [],
  },
  {
    id: 'P-1005',
    name: 'Project Horizon',
    client: 'Umbrella Corp',
    technologyNode: '28nm',
    accessType: 'private',
    status: 'Active',
    description:
      'Low-latency packet routing engine for high-performance memory interfaces supporting DDR5 bandwidth targets.',
    visibleUsers: ['Priya Das', 'Asha Menon', 'Meera Nair'],
    assignedTeamName: 'Hardware Team',
  },
  {
    id: 'P-1006',
    name: 'Project Titan',
    client: 'Acme Corp',
    technologyNode: '7nm',
    accessType: 'private',
    status: 'Active',
    description:
      'Server-class GPU compute tile with advanced power delivery network and thermal-aware floorplanning.',
    visibleUsers: ['Asha Menon', 'Sneha Iyer', 'Vikram Singh', 'Kiran Rao', 'Rahul Verma', 'Amit Patel'],
    assignedTeamName: 'Design Team',
  },
  {
    id: 'P-1007',
    name: 'Project Orion',
    client: 'Globex Electronics',
    technologyNode: '14nm FinFET',
    accessType: 'public',
    status: 'Completed',
    description:
      'Multi-channel SerDes transceiver IP qualification and silicon bring-up validation suite.',
    visibleUsers: [],
  },
]

const SEED_TIMESHEETS: TimesheetLog[] = [
  {
    id: 'T-1',
    employeeId: 'E-1001',
    employeeName: 'Asha Menon',
    project: 'Project Atlas',
    client: 'Acme Corp',
    technologyNode: '14nm FinFET',
    date: '2026-05-21',
    loginTime: '2026-05-21T09:00:00',
    logoutTime: '2026-05-21T17:00:00',
    status: 'Approved',
    billable: true,
    task: 'Critical path routing design and simulation checks.',
  },
  {
    id: 'T-2',
    employeeId: 'E-1002',
    employeeName: 'Rahul Verma',
    project: 'Project Beacon',
    client: 'Globex Electronics',
    technologyNode: '28nm',
    date: '2026-05-21',
    loginTime: '2026-05-21T08:30:00',
    status: 'Pending',
    billable: true,
    task: 'Physical DRC check execution and report compiling.',
  },
  {
    id: 'T-3',
    employeeId: 'E-1003',
    employeeName: 'Meera Nair',
    project: 'Project Horizon',
    client: 'Umbrella Corp',
    technologyNode: '28nm',
    date: '2026-05-20',
    loginTime: '2026-05-20T09:00:00',
    logoutTime: '2026-05-20T18:30:00',
    status: 'Pending',
    billable: true,
    task: 'Clock tree floorplanning and pin connection verification.',
    correctionRequest: {
      requestedLogin: '2026-05-20T09:00:00',
      requestedLogout: '2026-05-20T17:00:00',
      reason: 'Logged extra 1.5 hours by mistake after team sync.',
    },
  },
  {
    id: 'T-4',
    employeeId: 'E-1004',
    employeeName: 'Amit Patel',
    project: 'Project Phoenix',
    client: 'Initech Systems',
    technologyNode: '65nm',
    date: '2026-05-19',
    loginTime: '2026-05-19T08:00:00',
    logoutTime: '2026-05-19T18:00:00',
    status: 'Pending',
    billable: true,
    task: 'Pre-simulation reviews for radiation hardened cell placement.',
  },
  {
    id: 'T-5',
    employeeId: 'E-1005',
    employeeName: 'Priya Das',
    project: 'Project Horizon',
    client: 'Umbrella Corp',
    technologyNode: '28nm',
    date: '2026-05-18',
    loginTime: '2026-05-18T09:30:00',
    logoutTime: '2026-05-18T18:00:00',
    status: 'Approved',
    billable: false,
    task: 'Weekly cross-team hardware architecture sync meeting.',
  },
  {
    id: 'T-6',
    employeeId: 'E-1001',
    employeeName: 'Asha Menon',
    project: 'Project Atlas',
    client: 'Acme Corp',
    technologyNode: '14nm FinFET',
    date: '2026-05-15',
    loginTime: '2026-05-15T09:00:00',
    logoutTime: '2026-05-15T17:00:00',
    status: 'Approved',
    billable: true,
    task: 'LVS rule violation diagnostics and cell resizing.',
  },
  {
    id: 'T-7',
    employeeId: 'E-1002',
    employeeName: 'Rahul Verma',
    project: 'Project Beacon',
    client: 'Globex Electronics',
    technologyNode: '28nm',
    date: '2026-05-12',
    loginTime: '2026-05-12T09:00:00',
    logoutTime: '2026-05-12T16:00:00',
    status: 'Approved',
    billable: true,
    task: 'Block level logical synthesis runs and area report logs.',
  },
  {
    id: 'T-8',
    employeeId: 'E-1006',
    employeeName: 'Kiran Rao',
    project: 'Project Titan',
    client: 'Acme Corp',
    technologyNode: '7nm',
    date: '2026-05-21',
    loginTime: '2026-05-21T08:00:00',
    logoutTime: '2026-05-21T18:00:00',
    status: 'Approved',
    billable: true,
    task: 'Power delivery network IR drop simulation and grid analysis.',
  },
  {
    id: 'T-9',
    employeeId: 'E-1007',
    employeeName: 'Sneha Iyer',
    project: 'Project Titan',
    client: 'Acme Corp',
    technologyNode: '7nm',
    date: '2026-05-20',
    loginTime: '2026-05-20T09:00:00',
    logoutTime: '2026-05-20T15:30:00',
    status: 'Pending',
    billable: true,
    task: 'Formal equivalence checking on resynthesized netlist.',
  },
  {
    id: 'T-10',
    employeeId: 'E-1004',
    employeeName: 'Amit Patel',
    project: 'Project Phoenix',
    client: 'Initech Systems',
    technologyNode: '65nm',
    date: '2026-05-05',
    loginTime: '2026-05-05T09:00:00',
    logoutTime: '2026-05-05T13:00:00',
    status: 'Rejected',
    billable: false,
    task: 'Database script recoveries and structural verification checks.',
  },
  {
    id: 'T-11',
    employeeId: 'E-1001',
    employeeName: 'Asha Menon',
    project: 'Project Apollo',
    client: 'Internal',
    technologyNode: '180nm',
    date: '2026-04-25',
    loginTime: '2026-04-25T09:00:00',
    logoutTime: '2026-04-25T17:00:00',
    status: 'Approved',
    billable: true,
    task: 'Library characterization modeling configuration.',
  },
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
   HELPER – Hours Calculation
   ================================================================ */
const calculateHours = (login: string, logout?: string): number | null => {
  if (!logout) return null
  const loginDate = new Date(login)
  const logoutDate = new Date(logout)
  if (isNaN(loginDate.getTime()) || isNaN(logoutDate.getTime())) return 0
  const diffMs = logoutDate.getTime() - loginDate.getTime()
  return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
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
   COMPONENT – Searchable Team Input Suggestions
   ================================================================ */
function SearchableTeamInput({
  value,
  onChange,
  teams,
}: {
  value: string
  onChange: (val: string) => void
  teams: string[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const filtered = teams.filter((t) =>
    t.toLowerCase().includes(value.toLowerCase())
  )

  return (
    <div ref={ref} className="relative">
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        Assigned Team Name
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Type or select team..."
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onChange(t)
                setOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      )}
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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date('2026-05-01'))
  const [tempStart, setTempStart] = useState<string | null>(startDate)
  const [tempEnd, setTempEnd] = useState<string | null>(endDate)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => {
    setOpen(false)
    setTempStart(startDate)
    setTempEnd(endDate)
  })

  // Synchronize temp state with parent properties when open toggles
  useEffect(() => {
    if (open) {
      setTempStart(startDate)
      setTempEnd(endDate)
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
        // Set end to sunday of this week
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

  const handleDayClick = (dateStr: string) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr)
      setTempEnd(null)
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr)
      } else {
        setTempEnd(dateStr)
        onChange(tempStart, dateStr, 'Custom')
        setOpen(false)
      }
    }
  }

  // Calendar cells generation
  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDayIndex = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const prevDaysInMonth = new Date(year, month, 0).getDate()

    const cells: { day: number; dateString: string; isCurrentMonth: boolean }[] = []

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = prevDaysInMonth - i
      const prevM = month === 0 ? 11 : month - 1
      const prevY = month === 0 ? year - 1 : year
      const dateString = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      cells.push({ day, dateString, isCurrentMonth: false })
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      cells.push({ day: i, dateString, isCurrentMonth: true })
    }

    // Next month filler days (fill to 42 cells)
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
        <CalendarIcon className="h-4 w-4 text-emerald-600" />
        {preset === 'Custom'
          ? `${formatDate(startDate)} – ${formatDate(endDate)}`
          : `${preset} (${formatDate(startDate)} – ${formatDate(endDate)})`}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex flex-col md:flex-row gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl animate-fadeIn min-w-[500px]">
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
                const isWithinRange =
                  tempStart && tempEnd && cell.dateString > tempStart && cell.dateString < tempEnd
                const isCurrentMonth = cell.isCurrentMonth

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => isCurrentMonth && handleDayClick(cell.dateString)}
                    className={`
                      h-7 w-7 rounded-lg flex items-center justify-center font-semibold transition-all
                      ${!isCurrentMonth ? 'text-slate-300 pointer-events-none' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'}
                      ${isSelectedStart ? 'bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white shadow-sm' : ''}
                      ${isSelectedEnd ? 'bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white shadow-sm' : ''}
                      ${isWithinRange ? 'bg-emerald-50 text-emerald-800 rounded-none' : ''}
                    `}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>
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
  onComplete,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  onComplete: () => void
}) {
  const isCompleted = project.status === 'Completed'

  // Visibility/scope summary
  const visibilitySummary =
    project.accessType === 'private'
      ? `${project.visibleUsers.length} Users · ${project.assignedTeamName || 'No Team'}`
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
          <div className="flex items-center gap-1.5">
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

        <p className="mt-3.5 text-xs text-slate-500 line-clamp-3 leading-relaxed">
          {project.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-150 px-2 py-0.5 text-[10px] font-bold text-slate-500 font-mono">
            <Cpu className="h-2.5 w-2.5 text-slate-400" />
            {project.technologyNode}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-150 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            <Users className="h-2.5 w-2.5 text-slate-400" />
            {visibilitySummary}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3.5">
        <div>
          {isCompleted ? (
            <Badge variant="neutral" className="bg-slate-100 text-slate-600 border border-slate-200 py-0.5 px-2 text-[10px]">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
            </Badge>
          ) : (
            <Badge variant="success" className="py-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px]">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Edit Project"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete Project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {!isCompleted && (
            <button
              onClick={onComplete}
              className="ml-1 rounded-xl border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:border-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
            >
              Mark Completed
            </button>
          )}
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
  onComplete,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  onComplete: () => void
}) {
  const isCompleted = project.status === 'Completed'

  const visibilitySummary =
    project.accessType === 'private'
      ? `Private · ${project.visibleUsers.length} Users · ${project.assignedTeamName || 'No Team'}`
      : 'Public · All Members'

  return (
    <tr className="group transition-colors hover:bg-slate-50/50">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-extrabold text-xs">
            {project.name.charAt(project.name.indexOf(' ') + 1) || project.name[0]}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-slate-700 truncate">{project.name}</p>
            <p className="text-[11px] text-slate-400 truncate max-w-[240px]" title={project.description}>
              {project.description}
            </p>
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
      <td className="px-5 py-3.5 text-slate-500 font-semibold">{visibilitySummary}</td>
      <td className="px-5 py-3.5">
        {isCompleted ? (
          <Badge variant="neutral" className="bg-slate-100 text-slate-600 border border-slate-200 py-0.5 px-2">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
          </Badge>
        ) : (
          <Badge variant="success" className="py-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-100">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </Badge>
        )}
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Edit Project"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete Project"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {!isCompleted && (
            <button
              onClick={onComplete}
              className="ml-1 rounded-xl border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:border-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
            >
              Mark Completed
            </button>
          )}
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
                  className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full rounded-full transition-all duration-500"
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
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS)
  const [timesheets, setTimesheets] = useState<TimesheetLog[]>(SEED_TIMESHEETS)

  // ── Projects Filter & Layout States ─────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClient, setFilterClient] = useState('all')
  const [filterProjectName, setFilterProjectName] = useState('all')
  const [filterTeam, setFilterTeam] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAccess, setFilterAccess] = useState('all')
  const [filterTechNode, setFilterTechNode] = useState('all')

  // ── Project Modal States ────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)

  const emptyForm = {
    name: '',
    client: '',
    technologyNode: '',
    accessType: 'public' as 'public' | 'private',
    description: '',
    status: 'Active' as 'Active' | 'Completed',
    visibleUsers: [] as string[],
    assignedTeamName: '',
  }
  const [form, setForm] = useState(emptyForm)

  // ── Timesheets Date Range Picker States ─────────────────────
  const [datePreset, setDatePreset] = useState<string>('This Month')
  const [tsStartDate, setTsStartDate] = useState('2026-05-01')
  const [tsEndDate, setTsEndDate] = useState('2026-05-31')

  // ── Timesheets Filters States ───────────────────────────────
  const [tsSearch, setTsSearch] = useState('')
  const [tsEmployeeFilter, setTsEmployeeFilter] = useState('all')
  const [tsProjectFilter, setTsProjectFilter] = useState('all')
  const [tsTeamFilter, setTsTeamFilter] = useState('all')
  const [tsStatusFilter, setTsStatusFilter] = useState('all')

  // ── Timesheet Modal States (Admin Override / Edit) ──────────
  const [tsModalOpen, setTsModalOpen] = useState(false)
  const [tsModalMode, setTsModalMode] = useState<'create' | 'edit'>('create')
  const [editingTsId, setEditingTsId] = useState<string | null>(null)

  const [tsForm, setTsForm] = useState({
    employeeId: 'E-1001',
    projectName: '',
    loginTime: '2026-05-21T09:00',
    logoutTime: '2026-05-21T17:00',
    hasLogoutTime: true,
    billable: true,
    status: 'Pending' as 'Approved' | 'Pending' | 'Rejected',
    task: '',
  })

  // ── Derived Client / Project Lists for Filter Options ──────────
  const uniqueClients = useMemo(() => {
    return [...new Set(projects.map((p) => p.client))].sort()
  }, [projects])

  const uniqueProjectNames = useMemo(() => {
    return [...new Set(projects.map((p) => p.name))].sort()
  }, [projects])

  const uniqueTechNodes = useMemo(() => {
    return [...new Set(projects.map((p) => p.technologyNode))].sort()
  }, [projects])

  const uniqueTeams = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => {
      if (p.assignedTeamName) set.add(p.assignedTeamName)
    })
    return [...set].sort()
  }, [projects])

  // ── Projects Tab Filter Implementation ──────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filterClient !== 'all') count++
    if (filterProjectName !== 'all') count++
    if (filterTeam !== 'all') count++
    if (filterStatus !== 'all') count++
    if (filterAccess !== 'all') count++
    if (filterTechNode !== 'all') count++
    return count
  }, [filterClient, filterProjectName, filterTeam, filterStatus, filterAccess, filterTechNode])

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const query = searchQuery.toLowerCase()
      const matchSearch =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.client.toLowerCase().includes(query) ||
        p.technologyNode.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)

      const matchClient = filterClient === 'all' || p.client === filterClient
      const matchProjectName = filterProjectName === 'all' || p.name === filterProjectName
      const matchStatus = filterStatus === 'all' || p.status === filterStatus
      const matchAccess = filterAccess === 'all' || p.accessType === filterAccess
      const matchTechNode = filterTechNode === 'all' || p.technologyNode === filterTechNode
      const matchTeam = filterTeam === 'all' || p.assignedTeamName === filterTeam

      return matchSearch && matchClient && matchProjectName && matchStatus && matchAccess && matchTechNode && matchTeam
    })
  }, [projects, searchQuery, filterClient, filterProjectName, filterStatus, filterAccess, filterTechNode, filterTeam])

  // ── Projects Tab Metrics Calculation ─────────────────────────
  const projectMetrics = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter((p) => p.status === 'Active').length,
      completed: projects.filter((p) => p.status === 'Completed').length,
      private: projects.filter((p) => p.accessType === 'private').length,
    }
  }, [projects])

  // ── Projects State Handlers ──────────────────────────────────
  const openCreateProject = useCallback(() => {
    setModalMode('create')
    setForm(emptyForm)
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
      status: p.status,
      visibleUsers: [...p.visibleUsers],
      assignedTeamName: p.assignedTeamName || '',
    })
    setModalOpen(true)
  }, [])

  const handleSaveProject = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!form.name.trim() || !form.client.trim() || !form.technologyNode.trim()) {
        toast.error('Please specify Project Name, Client, and Technology Node.')
        return
      }

      if (modalMode === 'create') {
        const newProj: Project = {
          id: `P-${Date.now()}`,
          name: form.name.trim(),
          client: form.client.trim(),
          technologyNode: form.technologyNode.trim(),
          accessType: form.accessType,
          status: form.status,
          description: form.description.trim(),
          visibleUsers: form.accessType === 'private' ? form.visibleUsers : [],
          assignedTeamName: form.accessType === 'private' ? form.assignedTeamName.trim() : undefined,
        }
        setProjects((prev) => [newProj, ...prev])
        toast.success(`Project "${newProj.name}" created successfully.`)
      } else {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? {
                  ...p,
                  name: form.name.trim(),
                  client: form.client.trim(),
                  technologyNode: form.technologyNode.trim(),
                  accessType: form.accessType,
                  status: form.status,
                  description: form.description.trim(),
                  visibleUsers: form.accessType === 'private' ? form.visibleUsers : [],
                  assignedTeamName: form.accessType === 'private' ? form.assignedTeamName.trim() : undefined,
                }
              : p
          )
        )
        toast.success('Project details updated successfully.')
      }
      setModalOpen(false)
    },
    [form, modalMode, editingId]
  )

  const handleDeleteProject = useCallback((p: Project) => {
    if (!window.confirm(`Are you sure you want to delete project "${p.name}"?`)) return
    setProjects((prev) => prev.filter((x) => x.id !== p.id))
    setTimesheets((prev) => prev.filter((t) => t.project !== p.name))
    toast.success(`Project "${p.name}" and its associated logs have been deleted.`)
  }, [])

  const handleMarkProjectCompleted = useCallback((p: Project) => {
    setProjects((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, status: 'Completed' as const } : x))
    )
    toast.success(`Project "${p.name}" is now marked as Completed.`)
  }, [])

  const clearProjectsFilters = useCallback(() => {
    setSearchQuery('')
    setFilterClient('all')
    setFilterProjectName('all')
    setFilterTeam('all')
    setFilterStatus('all')
    setFilterAccess('all')
    setFilterTechNode('all')
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
      // Date verification range
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

      const matchEmployee = tsEmployeeFilter === 'all' || t.employeeName === tsEmployeeFilter
      const matchProject = tsProjectFilter === 'all' || t.project === tsProjectFilter
      const matchStatus = tsStatusFilter === 'all' || t.status === tsStatusFilter
      const matchTeam = tsTeamFilter === 'all' || getEmployeeTeam(t.employeeName) === tsTeamFilter

      return matchSearch && matchEmployee && matchProject && matchStatus && matchTeam
    })
  }, [timesheets, tsStartDate, tsEndDate, tsSearch, tsEmployeeFilter, tsProjectFilter, tsStatusFilter, tsTeamFilter, getEmployeeTeam])

  // ── Timesheets Tab Metrics Calculation ──────────────────────
  const timesheetMetrics = useMemo(() => {
    let totalHours = 0
    let overtimeHours = 0
    let pendingHours = 0

    // Daily hours tracking per employee for overtime calculation
    const dailyAccumulator: Record<string, number> = {}

    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime) || 0
      totalHours += hours

      if (t.status === 'Pending') {
        pendingHours += hours
      }

      if (t.logoutTime) {
        const key = `${t.employeeId}_${t.date}`
        dailyAccumulator[key] = (dailyAccumulator[key] || 0) + hours
      }
    })

    Object.values(dailyAccumulator).forEach((dailySum) => {
      overtimeHours += Math.max(0, dailySum - 8)
    })

    const uniqueEmployeesCount = new Set(filteredTimesheets.map((t) => t.employeeId)).size

    return {
      total: Math.round(totalHours * 10) / 10,
      overtime: Math.round(overtimeHours * 10) / 10,
      pending: Math.round(pendingHours * 10) / 10,
      activeEmployees: uniqueEmployeesCount,
    }
  }, [filteredTimesheets])

  // ── Recharts Chart Data Processing ──────────────────────────
  const chartHoursByProject = useMemo(() => {
    const mapping: Record<string, number> = {}
    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime) || 0
      mapping[t.project] = (mapping[t.project] || 0) + hours
    })
    return Object.entries(mapping)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
  }, [filteredTimesheets])

  const leaderboardData = useMemo(() => {
    const mapping: Record<string, number> = {}
    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime) || 0
      mapping[t.employeeName] = (mapping[t.employeeName] || 0) + hours
    })
    return Object.entries(mapping)
      .map(([name, hours]) => {
        const emp = MOCK_EMPLOYEES.find((e) => e.name === name)
        return {
          name,
          dept: emp?.department || 'R&D',
          hours: Math.round(hours * 10) / 10,
          hue: emp?.hue || 200,
        }
      })
      .sort((a, b) => b.hours - a.hours)
  }, [filteredTimesheets])

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
    aoa.push(['Overtime Hours (Daily > 8.0)', `${timesheetMetrics.overtime} hrs`])
    aoa.push(['Pending Approvals Hours', `${timesheetMetrics.pending} hrs`])
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
      'Billable Status',
      'Approval Status',
      'Correction Requested',
      'Task Details',
    ])

    // Table Data Rows
    filteredTimesheets.forEach((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime)
      const correctionDesc = t.correctionRequest
        ? `Req Login: ${formatDateTime(t.correctionRequest.requestedLogin)}, Req Logout: ${formatDateTime(t.correctionRequest.requestedLogout)}. Reason: "${t.correctionRequest.reason}"`
        : 'None'

      aoa.push([
        t.employeeName,
        t.employeeId,
        t.project,
        t.client,
        t.technologyNode,
        formatDateTime(t.loginTime),
        t.logoutTime ? formatDateTime(t.logoutTime) : 'Session Incomplete',
        hours !== null ? hours : 'Session Incomplete',
        t.billable ? 'Billable' : 'Non-Billable',
        t.status,
        correctionDesc,
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
      { wch: 15 }, // Billable Status
      { wch: 15 }, // Approval Status
      { wch: 35 }, // Correction Requested
      { wch: 40 }, // Task Details
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timesheets')

    XLSX.writeFile(workbook, `Timesheet_Audit_Report_${tsStartDate}_to_${tsEndDate}.xlsx`)
    toast.success('Excel spreadsheet generated and downloaded successfully.')
  }, [filteredTimesheets, tsStartDate, tsEndDate, timesheetMetrics])

  const handleExportPDF = useCallback(() => {
    if (!filteredTimesheets.length) {
      toast.error('No timesheet data available to export.')
      return
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
    const pageWidth = doc.internal.pageSize.width || 842
    const pageHeight = doc.internal.pageSize.height || 595

    // Document header title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(16, 185, 129) // emerald-500
    doc.text('EPICAL LAYOUTS PVT LTD', pageWidth / 2, 40, { align: 'center' })

    doc.setFontSize(12)
    doc.setTextColor(30, 41, 59) // slate-800
    doc.text('Timesheet System Administration Audit Report', pageWidth / 2, 60, { align: 'center' })

    // Date/Time metadata
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139) // slate-500
    doc.text(`Period Range: ${tsStartDate} to ${tsEndDate}`, 40, 80)
    doc.text(`Generated Timestamp: ${new Date().toLocaleString()}`, pageWidth - 40, 80, { align: 'right' })

    // Header divider line
    doc.setDrawColor(226, 232, 240)
    doc.line(40, 90, pageWidth - 40, 90)

    const tableHeaders = [
      'Employee',
      'Project',
      'Login Time',
      'Logout Time',
      'Total Hours',
      'Status',
      'Corrections',
    ]

    const tableRows = filteredTimesheets.map((t) => {
      const hours = calculateHours(t.loginTime, t.logoutTime)
      const correctionSummary = t.correctionRequest
        ? `Requested Login: ${formatDateTime(t.correctionRequest.requestedLogin)}\nRequested Logout: ${formatDateTime(t.correctionRequest.requestedLogout)}\nReason: "${t.correctionRequest.reason}"`
        : 'No request pending'

      return [
        `${t.employeeName} (${t.employeeId})`,
        `${t.project} (${t.client} - ${t.technologyNode})`,
        formatDateTime(t.loginTime),
        t.logoutTime ? formatDateTime(t.logoutTime) : 'Session Incomplete',
        hours !== null ? `${hours.toFixed(1)} hrs` : 'Session Incomplete',
        t.status,
        correctionSummary,
      ]
    })

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: 105,
      styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak' },
      headStyles: { fillColor: [16, 185, 129], fontStyle: 'bold' },
      theme: 'grid',
      margin: { left: 40, right: 40, bottom: 40 },
    })

    // Double-pass page number footer
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 40, pageHeight - 20, { align: 'right' })
      doc.text('Confidential - Internal Administrative Records', 40, pageHeight - 20)
    }

    doc.save(`Timesheet_Audit_Report_${tsStartDate}_to_${tsEndDate}.pdf`)
    toast.success('PDF report exported successfully.')
  }, [filteredTimesheets, tsStartDate, tsEndDate])

  // ── Timesheets CRUD Handlers ────────────────────────────────
  const openCreateTimesheet = useCallback(() => {
    setTsModalMode('create')
    setEditingTsId(null)
    const activeProjects = projects.filter((p) => p.status === 'Active')

    setTsForm({
      employeeId: MOCK_EMPLOYEES[0].id,
      projectName: activeProjects[0]?.name || projects[0]?.name || '',
      loginTime: '2026-05-21T09:00',
      logoutTime: '2026-05-21T17:00',
      hasLogoutTime: true,
      billable: true,
      status: 'Pending',
      task: '',
    })
    setTsModalOpen(true)
  }, [projects])

  const openEditTimesheet = useCallback((log: TimesheetLog) => {
    setTsModalMode('edit')
    setEditingTsId(log.id)
    const emp = MOCK_EMPLOYEES.find((e) => e.name === log.employeeName)

    const toDatetimeLocal = (isoString?: string) => {
      if (!isoString) return ''
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return ''
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    setTsForm({
      employeeId: emp?.id || 'E-1001',
      projectName: log.project,
      loginTime: toDatetimeLocal(log.loginTime),
      logoutTime: toDatetimeLocal(log.logoutTime),
      hasLogoutTime: !!log.logoutTime,
      billable: log.billable,
      status: log.status,
      task: log.task,
    })
    setTsModalOpen(true)
  }, [])

  const handleSaveTimesheet = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      if (!tsForm.projectName || !tsForm.task.trim()) {
        toast.error('Please select a project and provide a task description.')
        return
      }

      const emp = MOCK_EMPLOYEES.find((x) => x.id === tsForm.employeeId)
      const proj = projects.find((x) => x.name === tsForm.projectName)

      if (!emp || !proj) {
        toast.error('Internal mapping error: could not resolve selected employee or project.')
        return
      }

      const loginISO = new Date(tsForm.loginTime).toISOString()
      const logoutISO = tsForm.hasLogoutTime ? new Date(tsForm.logoutTime).toISOString() : undefined

      if (logoutISO && logoutISO < loginISO) {
        toast.error('Logout time cannot be earlier than login time.')
        return
      }

      if (tsModalMode === 'create') {
        const newLog: TimesheetLog = {
          id: `T-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          project: proj.name,
          client: proj.client,
          technologyNode: proj.technologyNode,
          date: tsForm.loginTime.split('T')[0],
          loginTime: loginISO,
          logoutTime: logoutISO,
          status: 'Pending',
          billable: tsForm.billable,
          task: tsForm.task.trim(),
        }
        setTimesheets((prev) => [newLog, ...prev])
        toast.success(`Session logged successfully for ${emp.name}.`)
      } else {
        setTimesheets((prev) =>
          prev.map((t) =>
            t.id === editingTsId
              ? {
                  ...t,
                  employeeId: emp.id,
                  employeeName: emp.name,
                  project: proj.name,
                  client: proj.client,
                  technologyNode: proj.technologyNode,
                  date: tsForm.loginTime.split('T')[0],
                  loginTime: loginISO,
                  logoutTime: logoutISO,
                  billable: tsForm.billable,
                  status: tsForm.status,
                  task: tsForm.task.trim(),
                }
              : t
          )
        )
        toast.success('Timesheet log override details updated.')
      }

      setTsModalOpen(false)
    },
    [tsForm, tsModalMode, editingTsId, projects]
  )

  const handleApproveCorrection = useCallback((logId: string) => {
    setTimesheets((prev) =>
      prev.map((t) => {
        if (t.id === logId && t.correctionRequest) {
          return {
            ...t,
            loginTime: t.correctionRequest.requestedLogin,
            logoutTime: t.correctionRequest.requestedLogout,
            status: 'Approved' as const,
            correctionRequest: undefined,
          }
        }
        return t
      })
    )
    toast.success('Correction request approved and hours recalculated.')
  }, [])

  const handleRejectCorrection = useCallback((logId: string) => {
    setTimesheets((prev) =>
      prev.map((t) => {
        if (t.id === logId) {
          return {
            ...t,
            correctionRequest: undefined,
          }
        }
        return t
      })
    )
    toast.error('Correction request has been rejected.')
  }, [])

  const handleApproveLogStatus = useCallback((logId: string) => {
    setTimesheets((prev) =>
      prev.map((t) => (t.id === logId ? { ...t, status: 'Approved' as const } : t))
    )
    toast.success('Timesheet log approved.')
  }, [])

  const handleDeleteTimesheet = useCallback((logId: string) => {
    if (!window.confirm('Are you sure you want to delete this timesheet log?')) return
    setTimesheets((prev) => prev.filter((t) => t.id !== logId))
    toast.success('Timesheet log deleted successfully.')
  }, [])

  const clearTimesheetFilters = useCallback(() => {
    setTsSearch('')
    setTsEmployeeFilter('all')
    setTsProjectFilter('all')
    setTsTeamFilter('all')
    setTsStatusFilter('all')
  }, [])

  return (
    <PageWrapper>
      {/* ── Page Header (Linear Clean Style) ───────────────── */}
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Admin Dashboard' }, { label: 'Projects & Timesheets' }]} />
          <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-slate-800">
            Projects &amp; Timesheets Manager
          </h1>
          <p className="text-sm font-medium text-slate-400">
            Enterprise dashboard to review system projects, access visibility lists, and track employee hours.
          </p>
        </div>

        {/* Header CTA Trigger */}
        <div className="flex items-center gap-3">
          {activeTab === 'projects' ? (
            <Button
              onClick={openCreateProject}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-sm rounded-xl py-2 px-4 flex items-center gap-1.5 focus:ring-4 focus:ring-emerald-500/10 border-0"
            >
              <Plus className="h-4 w-4" /> Create Project
            </Button>
          ) : (
            <Button
              onClick={openCreateTimesheet}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-sm rounded-xl py-2 px-4 flex items-center gap-1.5 focus:ring-4 focus:ring-emerald-500/10 border-0"
            >
              <Plus className="h-4 w-4" /> Add Manual Override
            </Button>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Projects"
              value={projectMetrics.total}
              icon={FolderOpen}
              accentClass="bg-slate-500"
            />
            <MetricCard
              label="Active Projects"
              value={projectMetrics.active}
              icon={ArrowUpRight}
              accentClass="bg-emerald-600"
              secondaryText="Ongoing developments"
            />
            <MetricCard
              label="Completed Projects"
              value={projectMetrics.completed}
              icon={CheckCircle2}
              accentClass="bg-teal-500"
              secondaryText="Archived cleanly"
            />
            <MetricCard
              label="Private Projects"
              value={projectMetrics.private}
              icon={Lock}
              accentClass="bg-amber-500"
              secondaryText="Restricted scopes"
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
                  <SelectField
                    label="Client Name"
                    id="pf-client"
                    value={filterClient}
                    onChange={(e) => setFilterClient(e.target.value)}
                    options={[
                      { value: 'all', label: 'All Clients' },
                      ...uniqueClients.map((c) => ({ value: c, label: c })),
                    ]}
                  />

                  <SelectField
                    label="Project Name"
                    id="pf-proj-name"
                    value={filterProjectName}
                    onChange={(e) => setFilterProjectName(e.target.value)}
                    options={[
                      { value: 'all', label: 'All Projects' },
                      ...uniqueProjectNames.map((n) => ({ value: n, label: n })),
                    ]}
                  />

                  <SelectField
                    label="Assigned Team"
                    id="pf-team"
                    value={filterTeam}
                    onChange={(e) => setFilterTeam(e.target.value)}
                    options={[
                      { value: 'all', label: 'All Teams' },
                      ...uniqueTeams.map((t) => ({ value: t, label: t })),
                    ]}
                  />

                  <SelectField
                    label="Project Status"
                    id="pf-status"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    options={[
                      { value: 'all', label: 'All Statuses' },
                      { value: 'Active', label: 'Active' },
                      { value: 'Completed', label: 'Completed' },
                    ]}
                  />

                  <SelectField
                    label="Access Control"
                    id="pf-access"
                    value={filterAccess}
                    onChange={(e) => setFilterAccess(e.target.value)}
                    options={[
                      { value: 'all', label: 'All Access' },
                      { value: 'public', label: 'Public' },
                      { value: 'private', label: 'Private' },
                    ]}
                  />

                  <SelectField
                    label="Tech Node"
                    id="pf-node"
                    value={filterTechNode}
                    onChange={(e) => setFilterTechNode(e.target.value)}
                    options={[
                      { value: 'all', label: 'All Nodes' },
                      ...uniqueTechNodes.map((n) => ({ value: n, label: n })),
                    ]}
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
                      onComplete={() => handleMarkProjectCompleted(p)}
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
                        onComplete={() => handleMarkProjectCompleted(p)}
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
           TAB 2 – TIMESHEETS
           ================================================================ */}
      {activeTab === 'timesheets' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Action Row (Picker & Export) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Custom Date Range Picker */}
            <CustomDateRangePicker
              startDate={tsStartDate}
              endDate={tsEndDate}
              preset={datePreset}
              onChange={handleDateRangeChange}
            />

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

          {/* Timesheet Summary Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Hours"
              value={`${timesheetMetrics.total}h`}
              icon={Clock}
              accentClass="bg-slate-500"
            />
            <MetricCard
              label="Overtime Hours"
              value={`${timesheetMetrics.overtime}h`}
              icon={TrendingUp}
              accentClass="bg-emerald-600"
              secondaryText="Daily sum logged > 8.0h"
            />
            <MetricCard
              label="Pending Approvals"
              value={`${timesheetMetrics.pending}h`}
              icon={UserCheck}
              accentClass="bg-amber-500"
              secondaryText="Needs review"
            />
            <MetricCard
              label="Active Employees"
              value={timesheetMetrics.activeEmployees}
              icon={Users}
              accentClass="bg-sky-500"
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
                    <BarChart data={chartHoursByProject} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
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
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={38} fill="url(#emeraldGrad)" />
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

          {/* Advanced Filter Bar for Log Records */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-emerald-600" /> Review Time Logs Filters
            </h3>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
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

              <select
                value={tsEmployeeFilter}
                onChange={(e) => setTsEmployeeFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
                <option value="all">All Employees</option>
                {MOCK_EMPLOYEES.map((e) => (
                  <option key={e.id} value={e.name}>
                    {e.name}
                  </option>
                ))}
              </select>

              <select
                value={tsProjectFilter}
                onChange={(e) => setTsProjectFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={tsTeamFilter}
                onChange={(e) => setTsTeamFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
                <option value="all">All Teams</option>
                {MOCK_TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={tsStatusFilter}
                onChange={(e) => setTsStatusFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
                <option value="all">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {(tsSearch || tsEmployeeFilter !== 'all' || tsProjectFilter !== 'all' || tsTeamFilter !== 'all' || tsStatusFilter !== 'all') && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={clearTimesheetFilters}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  Clear Timesheet Filters
                </button>
              </div>
            )}
          </div>

          {/* Timesheet Data Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Project Details</th>
                    <th className="px-5 py-3.5">Login Time</th>
                    <th className="px-5 py-3.5">Logout Time</th>
                    <th className="px-5 py-3.5">Total Hours</th>
                    <th className="px-5 py-3.5 min-w-[260px]">Correction / Task Details</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTimesheets.map((t) => {
                    const empInfo = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId)
                    const isPending = t.status === 'Pending'
                    const hours = calculateHours(t.loginTime, t.logoutTime)

                    return (
                      <tr key={t.id} className="group hover:bg-slate-50/40 transition-colors">
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
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-700 leading-tight">{t.project}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{t.client}</p>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-600 whitespace-nowrap">
                          {formatDateTime(t.loginTime)}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-600 whitespace-nowrap">
                          {t.logoutTime ? (
                            formatDateTime(t.logoutTime)
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                              <AlertCircle className="h-3 w-3" /> Incomplete
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {hours !== null ? (
                            <div>
                              <span className="font-black text-slate-700 tracking-tight tabular-nums">
                                {hours.toFixed(1)}h
                              </span>
                              <p className="text-[9px] font-extrabold uppercase mt-0.5 text-slate-400">
                                {t.billable ? 'Billable' : 'Non-Bill'}
                              </p>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                              Session Incomplete
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 max-w-[280px]">
                          <p className="text-slate-500 font-medium line-clamp-1" title={t.task}>
                            {t.task}
                          </p>
                          {t.correctionRequest && (
                            <div className="mt-1.5 p-2 rounded-xl bg-amber-50 border border-amber-100 text-[10px] text-slate-700 shadow-sm animate-fadeIn">
                              <p className="font-black text-amber-800 uppercase tracking-wider text-[9px] mb-1">
                                Correction Requested:
                              </p>
                              <p>
                                <span className="font-semibold text-slate-500">Login:</span>{' '}
                                {formatDateTime(t.correctionRequest.requestedLogin)}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-500">Logout:</span>{' '}
                                {formatDateTime(t.correctionRequest.requestedLogout)}
                              </p>
                              <p className="italic text-slate-500 mt-1 border-t border-amber-200/50 pt-1">
                                "{t.correctionRequest.reason}"
                              </p>
                              <div className="flex gap-1.5 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleApproveCorrection(t.id)}
                                  className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold transition-colors"
                                >
                                  <Check className="h-2.5 w-2.5" /> Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectCorrection(t.id)}
                                  className="flex items-center gap-1 px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-bold transition-colors"
                                >
                                  <X className="h-2.5 w-2.5" /> Reject
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {t.status === 'Approved' && (
                            <Badge variant="success" className="py-0.5 px-2 bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Approved
                            </Badge>
                          )}
                          {t.status === 'Pending' && (
                            <Badge variant="warning" className="py-0.5 px-2 bg-amber-50 text-amber-700 border border-amber-100">
                              Pending
                            </Badge>
                          )}
                          {t.status === 'Rejected' && (
                            <Badge variant="danger" className="py-0.5 px-2 bg-rose-50 text-rose-700 border border-rose-100">
                              Rejected
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => openEditTimesheet(t)}
                              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              title="Edit Log"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {/* Approve Log Button */}
                            {isPending && !t.correctionRequest ? (
                              <button
                                onClick={() => handleApproveLogStatus(t.id)}
                                className="rounded-lg bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                title="Approve Log"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            ) : null}

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteTimesheet(t.id)}
                              className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Log"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredTimesheets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 font-medium">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Technology Node"
              placeholder="e.g. 7nm FinFET, 28nm FD-SOI"
              value={form.technologyNode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, technologyNode: e.target.value })}
              required
            />

            <SelectField
              label="Project Status"
              id="m-proj-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Completed' })}
              options={[
                { value: 'Active', label: 'Active (Ongoing Development)' },
                { value: 'Completed', label: 'Completed (Archived)' },
              ]}
            />
          </div>

          <SelectField
            label="Access Control Configuration"
            id="m-proj-access"
            value={form.accessType}
            onChange={(e) =>
              setForm({ ...form, accessType: e.target.value as 'public' | 'private' })
            }
            options={[
              { value: 'public', label: 'Public — Visible system-wide to all employees' },
              { value: 'private', label: 'Private — Access restricted specifically by user/team' },
            ]}
          />

          {/* Conditional private security rules */}
          {form.accessType === 'private' && (
            <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 animate-fadeIn">
              <CheckboxList
                label="Allowed Users"
                items={MOCK_EMPLOYEES.map((e) => e.name)}
                selected={form.visibleUsers}
                onChange={(next) => setForm({ ...form, visibleUsers: next })}
              />

              <SearchableTeamInput
                value={form.assignedTeamName}
                onChange={(val) => setForm({ ...form, assignedTeamName: val })}
                teams={MOCK_TEAMS}
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

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              className="rounded-xl font-bold py-2 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-2 px-4 border-0"
            >
              {modalMode === 'create' ? 'Create Project' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── CREATE / EDIT TIMESHEET OVERRIDE MODAL ──────────────────── */}
      <Modal
        isOpen={tsModalOpen}
        title={tsModalMode === 'create' ? 'Add Timesheet Manual Override' : 'Edit Timesheet Log'}
        onClose={() => setTsModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleSaveTimesheet} className="space-y-4 pt-1">
          <SelectField
            label="Log Employee"
            id="m-ts-emp"
            value={tsForm.employeeId}
            onChange={(e) => setTsForm({ ...tsForm, employeeId: e.target.value })}
            options={MOCK_EMPLOYEES.map((e) => ({ value: e.id, label: `${e.name} (${e.department})` }))}
          />

          <SelectField
            label="Assigned Project"
            id="m-ts-proj"
            value={tsForm.projectName}
            onChange={(e) => setTsForm({ ...tsForm, projectName: e.target.value })}
            options={projects.map((p) => ({ value: p.name, label: `${p.name} (${p.client} - ${p.technologyNode})` }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="datetime-local"
              label="Login Time"
              value={tsForm.loginTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTsForm({ ...tsForm, loginTime: e.target.value })}
              required
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Logout Time
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    id="has-logout-chk"
                    checked={tsForm.hasLogoutTime}
                    onChange={(e) => setTsForm({ ...tsForm, hasLogoutTime: e.target.checked })}
                    className="h-3 w-3 rounded text-emerald-600 focus:ring-emerald-500/20"
                  />
                  <label htmlFor="has-logout-chk" className="text-[10px] font-bold text-slate-400 cursor-pointer uppercase select-none">
                    Complete Session
                  </label>
                </div>
              </div>
              <input
                type="datetime-local"
                value={tsForm.logoutTime}
                disabled={!tsForm.hasLogoutTime}
                onChange={(e) => setTsForm({ ...tsForm, logoutTime: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-50 disabled:bg-slate-50"
                required={tsForm.hasLogoutTime}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 items-center pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="m-ts-bill"
                checked={tsForm.billable}
                onChange={(e) => setTsForm({ ...tsForm, billable: e.target.checked })}
                className="h-4 w-4 rounded border-slate-350 text-emerald-600 focus:ring-emerald-500/20"
              />
              <label htmlFor="m-ts-bill" className="text-xs font-bold text-slate-600 cursor-pointer uppercase tracking-wider select-none">
                Billable to Client
              </label>
            </div>

            {tsModalMode === 'edit' && (
              <SelectField
                label="Approval Status"
                id="m-ts-status"
                value={tsForm.status}
                onChange={(e) => setTsForm({ ...tsForm, status: e.target.value as 'Approved' | 'Pending' | 'Rejected' })}
                options={[
                  { value: 'Pending', label: 'Pending Approval' },
                  { value: 'Approved', label: 'Approved' },
                  { value: 'Rejected', label: 'Rejected' },
                ]}
              />
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Task Work Description / override notes
            </label>
            <textarea
              placeholder="Describe tasks and details logged by override..."
              value={tsForm.task}
              onChange={(e) => setTsForm({ ...tsForm, task: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              required
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTsModalOpen(false)}
              className="rounded-xl font-bold py-2 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-2 px-4 border-0"
            >
              {tsModalMode === 'create' ? 'Log Override' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
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
