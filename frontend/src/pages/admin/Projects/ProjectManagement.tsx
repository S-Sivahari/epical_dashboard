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
  Calendar,
  LayoutGrid,
  List,
  Plus,
  Lock,
  Globe,
  FileSpreadsheet,
  ChevronDown,
  Cpu,
  FolderOpen,
  Eye,
  EyeOff,
  MoreVertical,
  CheckCircle2,
  SlidersHorizontal,
  ArrowUpRight,
  UserCheck,
  TrendingUp,
  Sliders,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { formatDate } from '@/utils/formatDate'

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
  visibleTeams: string[]
}

interface TimesheetLog {
  id: string
  employeeId: string
  employeeName: string
  project: string
  client: string
  technologyNode: string
  date: string
  hours: number
  task: string
  status: 'Approved' | 'Pending' | 'Rejected'
  billable: boolean
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
    visibleTeams: ['Design Team', 'Verification Team'],
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
    visibleTeams: [],
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
    visibleTeams: ['R&D Team'],
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
    visibleTeams: [],
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
    visibleTeams: ['Hardware Team', 'Operations Team'],
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
    visibleTeams: ['Design Team', 'Verification Team', 'R&D Team'],
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
    visibleTeams: [],
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
    hours: 8,
    task: 'Critical path routing design and simulation checks.',
    status: 'Approved',
    billable: true,
  },
  {
    id: 'T-2',
    employeeId: 'E-1002',
    employeeName: 'Rahul Verma',
    project: 'Project Beacon',
    client: 'Globex Electronics',
    technologyNode: '28nm',
    date: '2026-05-21',
    hours: 6,
    task: 'Physical DRC check execution and report compiling.',
    status: 'Pending',
    billable: true,
  },
  {
    id: 'T-3',
    employeeId: 'E-1003',
    employeeName: 'Meera Nair',
    project: 'Project Horizon',
    client: 'Umbrella Corp',
    technologyNode: '28nm',
    date: '2026-05-20',
    hours: 9.5,
    task: 'Clock tree floorplanning and pin connection verification.',
    status: 'Approved',
    billable: true,
  },
  {
    id: 'T-4',
    employeeId: 'E-1004',
    employeeName: 'Amit Patel',
    project: 'Project Phoenix',
    client: 'Initech Systems',
    technologyNode: '65nm',
    date: '2026-05-19',
    hours: 7,
    task: 'Pre-simulation reviews for radiation hardened cell placement.',
    status: 'Pending',
    billable: true,
  },
  {
    id: 'T-5',
    employeeId: 'E-1005',
    employeeName: 'Priya Das',
    project: 'Project Horizon',
    client: 'Umbrella Corp',
    technologyNode: '28nm',
    date: '2026-05-18',
    hours: 10,
    task: 'Weekly cross-team hardware architecture sync meeting.',
    status: 'Approved',
    billable: false,
  },
  {
    id: 'T-6',
    employeeId: 'E-1001',
    employeeName: 'Asha Menon',
    project: 'Project Atlas',
    client: 'Acme Corp',
    technologyNode: '14nm FinFET',
    date: '2026-05-15',
    hours: 8,
    task: 'LVS rule violation diagnostics and cell resizing.',
    status: 'Approved',
    billable: true,
  },
  {
    id: 'T-7',
    employeeId: 'E-1002',
    employeeName: 'Rahul Verma',
    project: 'Project Beacon',
    client: 'Globex Electronics',
    technologyNode: '28nm',
    date: '2026-05-12',
    hours: 7,
    task: 'Block level logical synthesis runs and area report logs.',
    status: 'Approved',
    billable: true,
  },
  {
    id: 'T-8',
    employeeId: 'E-1006',
    employeeName: 'Kiran Rao',
    project: 'Project Titan',
    client: 'Acme Corp',
    technologyNode: '7nm',
    date: '2026-05-21',
    hours: 8,
    task: 'Power delivery network IR drop simulation and grid analysis.',
    status: 'Approved',
    billable: true,
  },
  {
    id: 'T-9',
    employeeId: 'E-1007',
    employeeName: 'Sneha Iyer',
    project: 'Project Titan',
    client: 'Acme Corp',
    technologyNode: '7nm',
    date: '2026-05-20',
    hours: 6.5,
    task: 'Formal equivalence checking on resynthesized netlist.',
    status: 'Pending',
    billable: true,
  },
  {
    id: 'T-10',
    employeeId: 'E-1004',
    employeeName: 'Amit Patel',
    project: 'Project Phoenix',
    client: 'Initech Systems',
    technologyNode: '65nm',
    date: '2026-05-05',
    hours: 4,
    task: 'Database script recoveries and structural verification checks.',
    status: 'Rejected',
    billable: false,
  },
  {
    id: 'T-11',
    employeeId: 'E-1001',
    employeeName: 'Asha Menon',
    project: 'Project Apollo',
    client: 'Internal',
    technologyNode: '180nm',
    date: '2026-04-25',
    hours: 8,
    task: 'Library characterization modeling configuration.',
    status: 'Approved',
    billable: true,
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
   COMPONENT – Metric Card
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
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      {/* Sleek top colored line */}
      <div className={`absolute inset-x-0 top-0 h-[4px] ${accentClass}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tabular-nums text-slate-800 tracking-tight">
            {value}
          </p>
          {secondaryText && (
            <p className="mt-1 text-xs text-slate-500 font-medium">{secondaryText}</p>
          )}
        </div>
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accentClass} bg-opacity-10 transition-all duration-300 group-hover:scale-110`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}

/* ================================================================
   COMPONENT – Project Card (Grid View)
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside(menuRef, () => setMenuOpen(false))

  const isCompleted = project.status === 'Completed'

  const visibilitySummary =
    project.accessType === 'private'
      ? `Private · ${project.visibleUsers.length} Members · ${project.visibleTeams.length} Teams`
      : 'Public · All Members'

  // HSL customized border accent
  const accentColors = [
    'border-l-teal-500',
    'border-l-indigo-500',
    'border-l-violet-500',
    'border-l-amber-500',
    'border-l-rose-500',
    'border-l-sky-500',
    'border-l-pink-500',
  ]
  const colorIdx =
    project.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % accentColors.length

  return (
    <div
      className={`group/card relative flex flex-col rounded-2xl border border-slate-200 border-l-[4px] ${accentColors[colorIdx]} bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${isCompleted ? 'bg-slate-50/50 opacity-90' : ''}`}
    >
      {/* Header Badge Row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {isCompleted ? (
            <Badge variant="neutral" className="shrink-0 bg-slate-100 text-slate-600 border border-slate-200 py-0.5 px-2">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
            </Badge>
          ) : (
            <Badge variant="success" className="shrink-0 py-0.5 px-2">
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </Badge>
          )}

          {project.accessType === 'private' ? (
            <Badge variant="warning" className="shrink-0 py-0.5 px-2">
              <Lock className="mr-1 h-3 w-3 text-amber-500" /> Private
            </Badge>
          ) : (
            <Badge variant="info" className="shrink-0 py-0.5 px-2">
              <Globe className="mr-1 h-3 w-3 text-sky-500" /> Public
            </Badge>
          )}
        </div>

        {/* Kebab dropdown */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl animate-fadeIn">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onEdit()
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5 text-slate-400" /> Edit Project
              </button>
              {!isCompleted && (
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onComplete()
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Complete Project
                </button>
              )}
              <hr className="my-1 border-slate-100" />
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" /> Delete Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="flex-1 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
          {project.client}
        </p>
        <h3 className="font-display text-base font-extrabold text-slate-800 leading-snug group-hover/card:text-indigo-600 transition-colors">
          {project.name}
        </h3>

        {/* Tech Node Chip */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-150 px-2 py-0.5 text-[10px] font-bold text-slate-500 font-mono">
            <Cpu className="h-2.5 w-2.5 text-slate-400" />
            {project.technologyNode}
          </span>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500 line-clamp-2">
          {project.description}
        </p>
      </div>

      {/* Footer (Visibility & Quick Hover Actions) */}
      <div className="mt-auto border-t border-slate-100 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          {project.accessType === 'private' ? (
            <EyeOff className="h-3 w-3 text-amber-500" />
          ) : (
            <Eye className="h-3 w-3 text-sky-500" />
          )}
          <span className="truncate max-w-[160px]" title={visibilitySummary}>
            {visibilitySummary}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            title="Edit Project"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {!isCompleted && (
            <button
              onClick={onComplete}
              className="rounded-lg p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Mark Completed"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   COMPONENT – Checkbox List (for modal)
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
              className="h-3.5 w-3.5 rounded border-slate-350 text-indigo-600 focus:ring-indigo-500/20"
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
    visibleTeams: [] as string[],
  }
  const [form, setForm] = useState(emptyForm)

  // ── Timesheets Date Range Picker States ─────────────────────
  const [datePreset, setDatePreset] = useState<string>('This Month')
  const [tsStartDate, setTsStartDate] = useState('2026-05-01')
  const [tsEndDate, setTsEndDate] = useState('2026-05-31')
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const dateRef = useRef<HTMLDivElement>(null)
  useClickOutside(dateRef, () => setDatePickerOpen(false))

  const [customStart, setCustomStart] = useState('2026-05-01')
  const [customEnd, setCustomEnd] = useState('2026-05-31')

  // ── Timesheets Filters States ───────────────────────────────
  const [tsSearch, setTsSearch] = useState('')
  const [tsEmployeeFilter, setTsEmployeeFilter] = useState('all')
  const [tsProjectFilter, setTsProjectFilter] = useState('all')
  const [tsTeamFilter, setTsTeamFilter] = useState('all')
  const [tsStatusFilter, setTsStatusFilter] = useState('all')

  // ── Timesheet Modal States ──────────────────────────────────
  const [tsModalOpen, setTsModalOpen] = useState(false)
  const [tsModalMode, setTsModalMode] = useState<'create' | 'edit'>('create')
  const [editingTsId, setEditingTsId] = useState<string | null>(null)
  
  const emptyTsForm = {
    employeeId: 'E-1001',
    projectName: '',
    date: '2026-05-21',
    hours: '8',
    task: '',
    billable: true,
    status: 'Pending' as 'Approved' | 'Pending' | 'Rejected',
  }
  const [tsForm, setTsForm] = useState(emptyTsForm)

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
    projects.forEach((p) => p.visibleTeams.forEach((t) => set.add(t)))
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
      // Full search matching
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
      
      const matchTeam =
        filterTeam === 'all' || p.visibleTeams.includes(filterTeam)

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
      visibleTeams: [...p.visibleTeams],
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
          visibleTeams: form.accessType === 'private' ? form.visibleTeams : [],
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
                  visibleTeams: form.accessType === 'private' ? form.visibleTeams : [],
                }
              : p,
          ),
        )
        toast.success('Project details updated successfully.')
      }
      setModalOpen(false)
    },
    [form, modalMode, editingId],
  )

  const handleDeleteProject = useCallback((p: Project) => {
    if (!window.confirm(`Are you sure you want to delete project "${p.name}"?`)) return
    setProjects((prev) => prev.filter((x) => x.id !== p.id))
    // Also cleanup logs if necessary
    setTimesheets((prev) => prev.filter((t) => t.project !== p.name))
    toast.success(`Project "${p.name}" and its associated logs have been deleted.`)
  }, [])

  const handleMarkProjectCompleted = useCallback((p: Project) => {
    setProjects((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, status: 'Completed' as const } : x)),
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

  // ── Timesheets Helpers & Filter Implementation ──────────────
  const applyDatePreset = useCallback((preset: string) => {
    setDatePreset(preset)
    // Anchoring logs context near May 2026 to fit mockup seed dates
    if (preset === 'Today') {
      setTsStartDate('2026-05-21')
      setTsEndDate('2026-05-21')
    } else if (preset === 'This Week') {
      setTsStartDate('2026-05-18') // Mon
      setTsEndDate('2026-05-24') // Sun
    } else if (preset === 'This Month') {
      setTsStartDate('2026-05-01')
      setTsEndDate('2026-05-31')
    } else if (preset === 'Last 30 Days') {
      setTsStartDate('2026-04-21')
      setTsEndDate('2026-05-21')
    }
    setDatePickerOpen(false)
  }, [])

  // Mapper helper to link employee department to logical teams for filtering
  const getEmployeeTeam = useCallback((empName: string): string => {
    const emp = MOCK_EMPLOYEES.find((e) => e.name === empName)
    if (!emp) return 'Design Team'
    return `${emp.department} Team`
  }, [])

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter((t) => {
      // Date verification
      const logDate = new Date(t.date)
      const startDate = new Date(tsStartDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(tsEndDate)
      endDate.setHours(23, 59, 59, 999)

      if (logDate < startDate || logDate > endDate) return false

      // Search queries matching
      const query = tsSearch.toLowerCase()
      const matchSearch =
        !query ||
        t.employeeName.toLowerCase().includes(query) ||
        t.project.toLowerCase().includes(query) ||
        t.task.toLowerCase().includes(query)

      const matchEmployee = tsEmployeeFilter === 'all' || t.employeeName === tsEmployeeFilter
      const matchProject = tsProjectFilter === 'all' || t.project === tsProjectFilter
      const matchStatus = tsStatusFilter === 'all' || t.status === tsStatusFilter

      // Team mapping logic: match logs with employees in that team department
      const matchTeam =
        tsTeamFilter === 'all' || getEmployeeTeam(t.employeeName) === tsTeamFilter

      return matchSearch && matchEmployee && matchProject && matchStatus && matchTeam
    })
  }, [timesheets, tsStartDate, tsEndDate, tsSearch, tsEmployeeFilter, tsProjectFilter, tsStatusFilter, tsTeamFilter, getEmployeeTeam])

  // ── Timesheets Tab Metrics Calculation ──────────────────────
  const timesheetMetrics = useMemo(() => {
    const totalHours = filteredTimesheets.reduce((acc, t) => acc + t.hours, 0)
    
    // Dynamic Overtime Hours Calculation (Daily hours logged > 8.0)
    const overtimeHours = filteredTimesheets.reduce(
      (acc, t) => acc + Math.max(0, t.hours - 8),
      0,
    )

    const pendingApprovals = filteredTimesheets
      .filter((t) => t.status === 'Pending')
      .reduce((acc, t) => acc + t.hours, 0)

    const uniqueEmployeesCount = new Set(filteredTimesheets.map((t) => t.employeeId)).size

    return {
      total: totalHours,
      overtime: overtimeHours,
      pending: pendingApprovals,
      activeEmployees: uniqueEmployeesCount,
    }
  }, [filteredTimesheets])

  // ── Recharts Chart Data Processing ──────────────────────────
  const chartHoursByProject = useMemo(() => {
    const mapping: Record<string, number> = {}
    filteredTimesheets.forEach((t) => {
      mapping[t.project] = (mapping[t.project] || 0) + t.hours
    })
    return Object.entries(mapping)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
  }, [filteredTimesheets])

  const chartHoursByEmployee = useMemo(() => {
    const mapping: Record<string, number> = {}
    filteredTimesheets.forEach((t) => {
      mapping[t.employeeName] = (mapping[t.employeeName] || 0) + t.hours
    })
    return Object.entries(mapping)
      .map(([name, hours]) => ({ name: name.split(' ')[0], hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
  }, [filteredTimesheets])

  // ── Export Triggers (Excel / PDF Simulation) ──────────────────
  const handleExport = useCallback(
    (format: 'excel' | 'pdf') => {
      if (!filteredTimesheets.length) {
        toast.error('There is no timesheet data available to export in the selected range.')
        return
      }

      let content = ''
      let fileExtension = ''
      
      if (format === 'excel') {
        fileExtension = 'csv'
        content =
          'Employee Name,Employee ID,Project,Client,Technology Node,Task Performed,Date,Hours Logged,Billable Status,Approval Status\n' +
          filteredTimesheets
            .map(
              (t) =>
                `"${t.employeeName}","${t.employeeId}","${t.project}","${t.client}","${t.technologyNode}","${t.task.replace(/"/g, '""')}","${t.date}",${t.hours},"${t.billable ? 'Billable' : 'Non-Billable'}","${t.status}"`,
            )
            .join('\n')
      } else {
        fileExtension = 'txt'
        const header = `========================================================================\n` +
                       `                      ENTERPRISE TIMESHEET EXPORT                       \n` +
                       `========================================================================\n` +
                       `Reporting Period: ${tsStartDate} to ${tsEndDate}\n` +
                       `Generated On: 21 May 2026\n` +
                       `------------------------------------------------------------------------\n` +
                       `METRIC OVERVIEW:\n` +
                       `  - Total Hours Logged: ${timesheetMetrics.total}h\n` +
                       `  - Overtime Hours: ${timesheetMetrics.overtime}h\n` +
                       `  - Pending Approvals: ${timesheetMetrics.pending}h\n` +
                       `  - Active Employees: ${timesheetMetrics.activeEmployees}\n` +
                       `------------------------------------------------------------------------\n\n`
        
        const logs = filteredTimesheets
          .map(
            (t, index) =>
              `${String(index + 1).padStart(3, '0')}. Employee: ${t.employeeName.padEnd(20)} | Date: ${t.date} | Hours: ${t.hours}h | Status: ${t.status.padEnd(10)}\n` +
              `     Project:  ${t.project} (${t.client} - ${t.technologyNode})\n` +
              `     Task:     "${t.task}"\n`
          )
          .join('\n')
        
        content = header + logs
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
      const element = document.createElement('a')
      element.href = URL.createObjectURL(blob)
      element.download = `timesheet_report_${datePreset.replace(/\s+/g, '_').toLowerCase()}_${tsStartDate}_to_${tsEndDate}.${fileExtension}`
      element.click()
      toast.success(`Timesheet report successfully exported as ${format.toUpperCase()}!`)
    },
    [filteredTimesheets, tsStartDate, tsEndDate, timesheetMetrics, datePreset],
  )

  // ── Timesheets CRUD Handlers ────────────────────────────────
  const openCreateTimesheet = useCallback(() => {
    setTsModalMode('create')
    setEditingTsId(null)
    const activeProjects = projects.filter((p) => p.status === 'Active')
    setTsForm({
      employeeId: MOCK_EMPLOYEES[0].id,
      projectName: activeProjects[0]?.name || projects[0]?.name || '',
      date: '2026-05-21',
      hours: '8.0',
      task: '',
      billable: true,
      status: 'Pending',
    })
    setTsModalOpen(true)
  }, [projects])

  const openEditTimesheet = useCallback((log: TimesheetLog) => {
    setTsModalMode('edit')
    setEditingTsId(log.id)
    const emp = MOCK_EMPLOYEES.find((e) => e.name === log.employeeName)
    setTsForm({
      employeeId: emp?.id || 'E-1001',
      projectName: log.project,
      date: log.date,
      hours: String(log.hours),
      task: log.task,
      billable: log.billable,
      status: log.status,
    })
    setTsModalOpen(true)
  }, [])

  const handleSaveTimesheet = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      
      const parsedHours = parseFloat(tsForm.hours)
      if (isNaN(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
        toast.error('Please enter a valid amount of logged hours (between 0.5 and 24 hours).')
        return
      }
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

      if (tsModalMode === 'create') {
        const newLog: TimesheetLog = {
          id: `T-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          project: proj.name,
          client: proj.client,
          technologyNode: proj.technologyNode,
          date: tsForm.date,
          hours: parsedHours,
          task: tsForm.task.trim(),
          status: 'Pending',
          billable: tsForm.billable,
        }
        setTimesheets((prev) => [newLog, ...prev])
        toast.success(`Logged ${newLog.hours}h for "${newLog.employeeName}" on "${newLog.project}".`)
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
                  date: tsForm.date,
                  hours: parsedHours,
                  task: tsForm.task.trim(),
                  billable: tsForm.billable,
                  status: tsForm.status,
                }
              : t,
          ),
        )
        toast.success('Timesheet log successfully updated.')
      }

      setTsModalOpen(false)
    },
    [tsForm, tsModalMode, editingTsId, projects],
  )

  const handleApproveTimesheet = useCallback((logId: string) => {
    setTimesheets((prev) =>
      prev.map((t) => (t.id === logId ? { ...t, status: 'Approved' as const } : t)),
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

  /* ================================================================
     RENDER VIEW
     ================================================================ */
  return (
    <PageWrapper>
      {/* ── PAGE HEADER (Jira/Linear Clean Style) ───────────────── */}
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
        
        {/* Main Action Trigger */}
        <div className="flex items-center gap-3">
          {activeTab === 'projects' ? (
            <Button
              onClick={openCreateProject}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-sm rounded-xl py-2 px-4 flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Create Project
            </Button>
          ) : (
            <Button
              onClick={openCreateTimesheet}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-sm rounded-xl py-2 px-4 flex items-center gap-1.5"
            >
              <Clock className="h-4 w-4" /> Log Timesheet Hours
            </Button>
          )}
        </div>
      </div>

      {/* ── SMOOTH TAB BAR WITH COUNTER BADGES ────────────────────── */}
      <div className="sticky top-0 z-30 -mx-4 bg-white/90 backdrop-blur-md px-4 py-3 border-b border-slate-100 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 mb-6">
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
                  ? 'bg-white text-indigo-600 shadow-md scale-102 border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              <span
                className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-black transition-colors duration-300 ${
                  activeTab === tab.key ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'
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
          {/* ── Analytics Metric Row ──────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Projects"
              value={projectMetrics.total}
              icon={FolderOpen}
              accentClass="bg-indigo-600"
            />
            <MetricCard
              label="Active Projects"
              value={projectMetrics.active}
              icon={ArrowUpRight}
              accentClass="bg-teal-500"
              secondaryText="Development active"
            />
            <MetricCard
              label="Completed Projects"
              value={projectMetrics.completed}
              icon={CheckCircle2}
              accentClass="bg-slate-500"
              secondaryText="Archived cleanly"
            />
            <MetricCard
              label="Private Projects"
              value={projectMetrics.private}
              icon={Lock}
              accentClass="bg-amber-500"
              secondaryText="Restricted scope"
            />
          </div>

          {/* ── Toolbar Action Bar ────────────────────────────── */}
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
                    className="h-10 w-full rounded-xl border border-slate-250 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
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
                      ? 'border-indigo-200 bg-indigo-50/50 text-indigo-600'
                      : 'border-slate-250 bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Advanced Filters
                  {activeFiltersCount > 0 && (
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>

              {/* View Toggle + Stats indicator */}
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Matches: {filteredProjects.length} / {projects.length}
                </span>
                
                <div className="flex rounded-xl border border-slate-250 bg-white p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`rounded-lg p-1.5 transition-all ${
                      viewMode === 'grid'
                        ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-slate-200/40'
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
                        ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-slate-200/40'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                    title="List layout"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Sliding Filters Panel ───────────────────────── */}
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
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── GRID VIEW PRESENTATION ───────────────────────── */}
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
            /* ── LIST VIEW TABLE PRESENTATION ───────────────────── */
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
                    {filteredProjects.map((p) => {
                      const completed = p.status === 'Completed'
                      return (
                        <tr key={p.id} className="group transition-colors hover:bg-slate-50/50">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-extrabold text-xs">
                                {p.name.charAt(p.name.indexOf(' ') + 1) || p.name[0]}
                              </span>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-700 truncate">{p.name}</p>
                                <p className="text-[11px] text-slate-400 truncate max-w-[200px]" title={p.description}>
                                  {p.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-medium">{p.client}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-150 px-2 py-0.5 text-[10px] font-bold text-slate-500 font-mono">
                              <Cpu className="h-2.5 w-2.5 text-slate-400" />
                              {p.technologyNode}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {p.accessType === 'private' ? (
                              <Badge variant="warning" className="py-0.5 px-2">
                                <Lock className="mr-1 h-3 w-3 text-amber-500" /> Private
                              </Badge>
                            ) : (
                              <Badge variant="info" className="py-0.5 px-2">
                                <Globe className="mr-1 h-3 w-3 text-sky-500" /> Public
                              </Badge>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 font-semibold">
                            {p.accessType === 'private'
                              ? `${p.visibleUsers.length} Users · ${p.visibleTeams.length} Teams`
                              : 'All Members'}
                          </td>
                          <td className="px-5 py-3.5">
                            {completed ? (
                              <Badge variant="neutral" className="bg-slate-100 text-slate-600 border border-slate-200 py-0.5 px-2">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
                              </Badge>
                            ) : (
                              <Badge variant="success" className="py-0.5 px-2">
                                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Active
                              </Badge>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditProject(p)}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                title="Edit Project"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteProject(p)}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete Project"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {!completed && (
                                <button
                                  onClick={() => handleMarkProjectCompleted(p)}
                                  className="ml-1 rounded-xl border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:border-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                                >
                                  Mark Completed
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
          {/* ── Date Range Presets & Exports ──────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div ref={dateRef} className="relative">
              <button
                onClick={() => setDatePickerOpen(!datePickerOpen)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <Calendar className="h-4 w-4 text-slate-400" />
                {datePreset}: {formatDate(tsStartDate)} – {formatDate(tsEndDate)}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {datePickerOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-250 bg-white p-4 shadow-xl animate-fadeIn">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {['Today', 'This Week', 'This Month', 'Last 30 Days'].map((p) => (
                      <button
                        key={p}
                        onClick={() => applyDatePreset(p)}
                        className={`rounded-xl border py-1.5 text-[10px] font-bold transition-all ${
                          datePreset === p
                            ? 'border-indigo-500 bg-indigo-50/50 text-indigo-600'
                            : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Custom Date Range
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Start Date</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 p-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">End Date</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 p-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl"
                    onClick={() => {
                      setTsStartDate(customStart)
                      setTsEndDate(customEnd)
                      setDatePreset('Custom')
                      setDatePickerOpen(false)
                    }}
                  >
                    Apply Custom Range
                  </Button>
                </div>
              )}
            </div>

            {/* Export buttons */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => handleExport('pdf')}
                className="flex items-center gap-1.5 border-r border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <FileDown className="h-4 w-4 text-rose-500" /> PDF Document
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Excel spreadsheet
              </button>
            </div>
          </div>

          {/* ── Analytics Metric Row ──────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Hours"
              value={`${timesheetMetrics.total}h`}
              icon={Clock}
              accentClass="bg-indigo-600"
            />
            <MetricCard
              label="Overtime Hours"
              value={`${timesheetMetrics.overtime}h`}
              icon={TrendingUp}
              accentClass="bg-teal-500"
              secondaryText="Daily hours > 8.0"
            />
            <MetricCard
              label="Pending Approvals"
              value={`${timesheetMetrics.pending}h`}
              icon={UserCheck}
              accentClass="bg-amber-500"
              secondaryText="Verification required"
            />
            <MetricCard
              label="Active Employees"
              value={timesheetMetrics.activeEmployees}
              icon={Users}
              accentClass="bg-violet-500"
              secondaryText="Logging this range"
            />
          </div>

          {/* ── Advanced Visual Recharts Graph ────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                <span className="h-3.5 w-1.5 rounded-full bg-teal-500" /> Aggregated Hours by Project
              </h3>
              {chartHoursByProject.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartHoursByProject} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid stroke="#f8fafc" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11, fontWeight: 600 }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={45}>
                        {chartHoursByProject.map((_, i) => (
                          <Cell key={i} fill={['#6366f1', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9'][i % 6]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-semibold">
                  No data logs available in the chosen dates.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                <span className="h-3.5 w-1.5 rounded-full bg-indigo-500" /> Employee-wise Hours
              </h3>
              {chartHoursByEmployee.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartHoursByEmployee} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                      <CartesianGrid stroke="#f8fafc" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} width={65} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 11, fontWeight: 600 }} />
                      <Bar dataKey="hours" radius={[0, 6, 6, 0]} fill="#6366f1" maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 font-semibold">
                  No data logs available in the chosen dates.
                </div>
              )}
            </div>
          </div>

          {/* ── Advanced Logs Filtering Controls ─────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-500" /> Filter Log Records
            </h3>
            
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={tsSearch}
                  onChange={(e) => setTsSearch(e.target.value)}
                  placeholder="Search task or keywords..."
                  className="h-10 w-full rounded-xl border border-slate-250 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <select
                value={tsEmployeeFilter}
                onChange={(e) => setTsEmployeeFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                className="h-10 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                className="h-10 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                className="h-10 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Clear Timesheet Filters
                </button>
              </div>
            )}
          </div>

          {/* ── TIMESHEET DATA TABLE ──────────────────────────── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Project Details</th>
                    <th className="px-5 py-3.5">Technology</th>
                    <th className="px-5 py-3.5 max-w-[220px]">Task Performed</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Hours</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTimesheets.map((t) => {
                    const empInfo = MOCK_EMPLOYEES.find((e) => e.id === t.employeeId)
                    const isPending = t.status === 'Pending'

                    return (
                      <tr key={t.id} className="group hover:bg-slate-50/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={t.employeeName}
                              size="sm"
                              color={empInfo ? `hsl(${empInfo.hue},55%,45%)` : '#6366f1'}
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
                        <td className="px-5 py-3.5">
                          <span className="rounded-lg bg-slate-50 border border-slate-150 px-2 py-0.5 text-[10px] font-bold font-mono text-slate-500">
                            {t.technologyNode}
                          </span>
                        </td>
                        <td
                          className="px-5 py-3.5 max-w-[220px] truncate text-slate-500 font-medium"
                          title={t.task}
                        >
                          {t.task}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-600 whitespace-nowrap">
                          {formatDate(t.date, 'dd MMM yyyy')}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-black text-slate-700 tracking-tight tabular-nums">{t.hours.toFixed(1)}h</span>
                          <p className="text-[9px] font-extrabold uppercase mt-0.5 text-slate-400">
                            {t.billable ? 'Billable' : 'Non-Bill'}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          {t.status === 'Approved' && (
                            <Badge variant="success" className="py-0.5 px-2">
                              Approved
                            </Badge>
                          )}
                          {t.status === 'Pending' && (
                            <Badge variant="warning" className="py-0.5 px-2">
                              Pending
                            </Badge>
                          )}
                          {t.status === 'Rejected' && (
                            <Badge variant="danger" className="py-0.5 px-2">
                              Rejected
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            {/* Inline Edit */}
                            <button
                              onClick={() => openEditTimesheet(t)}
                              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              title="Edit Log"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {/* Inline Approve */}
                            {isPending ? (
                              <button
                                onClick={() => handleApproveTimesheet(t.id)}
                                className="rounded-lg bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                title="Approve Log"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            ) : null}

                            {/* Inline Delete */}
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
           MODALS (Sleek Clean Forms)
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
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Client Name"
              placeholder="e.g. Globex Electronics"
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              required
            />
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Technology Node"
              placeholder="e.g. 7nm FinFET, 28nm FD-SOI"
              value={form.technologyNode}
              onChange={(e) => setForm({ ...form, technologyNode: e.target.value })}
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

          {/* Conditional Security visibility rules */}
          {form.accessType === 'private' && (
            <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 animate-fadeIn">
              <CheckboxList
                label="Allowed Users"
                items={MOCK_EMPLOYEES.map((e) => e.name)}
                selected={form.visibleUsers}
                onChange={(next) => setForm({ ...form, visibleUsers: next })}
              />
              <CheckboxList
                label="Allowed Teams"
                items={MOCK_TEAMS}
                selected={form.visibleTeams}
                onChange={(next) => setForm({ ...form, visibleTeams: next })}
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
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-2 px-4"
            >
              {modalMode === 'create' ? 'Create Project' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── CREATE / EDIT TIMESHEET MODAL ──────────────────── */}
      <Modal
        isOpen={tsModalOpen}
        title={tsModalMode === 'create' ? 'Log New Timesheet Hours' : 'Edit Timesheet Log'}
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
              type="date"
              label="Work Date"
              value={tsForm.date}
              onChange={(e) => setTsForm({ ...tsForm, date: e.target.value })}
              required
            />
            
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              label="Hours Logged"
              value={tsForm.hours}
              onChange={(e) => setTsForm({ ...tsForm, hours: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 items-center pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="m-ts-bill"
                checked={tsForm.billable}
                onChange={(e) => setTsForm({ ...tsForm, billable: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
              />
              <label htmlFor="m-ts-bill" className="text-xs font-bold text-slate-600 cursor-pointer uppercase tracking-wider">
                Billable to Client
              </label>
            </div>

            {/* Render status edit if we are editing logs */}
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
              Task Work Description
            </label>
            <textarea
              placeholder="Describe the tasks, technical progress, and work accomplished during this duration..."
              value={tsForm.task}
              onChange={(e) => setTsForm({ ...tsForm, task: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl py-2 px-4"
            >
              {tsModalMode === 'create' ? 'Log Hours' : 'Save Changes'}
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
          className="mt-3 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100/70 py-2 px-4 rounded-xl border border-indigo-200/40 shadow-sm"
        >
          Reset Applied Filters
        </button>
      )}
    </div>
  )
}
