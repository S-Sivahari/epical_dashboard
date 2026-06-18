import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Briefcase, ChevronDown, Eye, Globe, Lock, Search, X } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { DataTable, type Column } from '@components/tables/DataTable'
import { PaginationBar } from '@components/tables/Pagination'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { UiTooltip } from '@components/ui/Tooltip'
import { ROUTES } from '@constants/routes'
import { isProjectAnalysisAdminPath } from './projectPortal'
import { fetchMyAssignedProjects } from '@/services/employeeProjectService'
import api from '@/services/api'
import { useProjectPortal } from './projectPortal'
import { cn } from '@/utils/cn'
import { stringToHueColor, stringToHueHoverBg } from '@/utils/stringColor'
import type { AdminProjectRow, ProjectAnalysisStatus } from '@/types/projectWorkspace'
import './adminProjects.css'

type DisplayStatus = ProjectAnalysisStatus

type SortKey =
  | 'name'
  | 'client'
  | 'accessType'
  | 'teamLead'
  | 'analysisStatus'
  | 'completionPercentage'

type ProgressFilter = 'all' | 'not_started' | 'in_progress' | 'completed'

const FILTER_SELECT_CLASS =
  'admin-projects-filter-select admin-projects-filter-select--directory w-full min-w-0 cursor-pointer appearance-none pl-3 pr-9 font-medium'

const STATUS_SORT_ORDER: Record<DisplayStatus, number> = {
  'Not Started': 0,
  'In Progress': 1,
  Completed: 2,
}

function getProjectAnalysisStatus(project: AdminProjectRow): ProjectAnalysisStatus {
  if (project.analysisStatus) return project.analysisStatus

  const pct = project.completionPercentage ?? 0
  if (project.status === 'Completed' || pct >= 100) return 'Completed'
  if (pct <= 0) return 'Not Started'
  return 'In Progress'
}

function statusChipClass(status: DisplayStatus): string {
  if (status === 'Completed') return 'is-completed'
  if (status === 'In Progress') return 'is-in-progress'
  return 'is-not-started'
}

function matchesProgressFilter(pct: number, filter: ProgressFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'not_started') return pct <= 0
  if (filter === 'completed') return pct >= 100
  return pct > 0 && pct < 100
}

function TruncateText({ text, className }: { text: string; className?: string }) {
  if (!text) return <span className="text-slate-400">—</span>
  return (
    <UiTooltip content={text}>
      <span className={cn('block truncate', className)}>{text}</span>
    </UiTooltip>
  )
}

export function ProjectsDashboard() {
  const { isEmployee, inProjectAnalysis, projectWorkspacePath } = useProjectPortal()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const [projects, setProjects] = useState<AdminProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterProject, setFilterProject] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [filterType, setFilterType] = useState<'all' | 'public' | 'private'>('all')
  const [filterTeamLead, setFilterTeamLead] = useState('all')
  const [filterProgress, setFilterProgress] = useState<ProgressFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [sortColumn, setSortColumn] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (isEmployee) {
        const data = await fetchMyAssignedProjects()
        setProjects(Array.isArray(data) ? (data as unknown as AdminProjectRow[]) : [])
      } else {
        const { data } = await api.get<AdminProjectRow[]>('/projects?syncCompletion=true')
        setProjects(Array.isArray(data) ? data : [])
      }
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [isEmployee])

  useEffect(() => {
    void load()
  }, [load])

  const filterOptions = useMemo(() => {
    const projectOptions = [...projects]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, name: p.name }))

    const clients = Array.from(new Set(projects.map((p) => p.client).filter(Boolean))).sort()
    const teamLeads = Array.from(new Set(projects.map((p) => p.teamLead).filter(Boolean))).sort()

    return { projectOptions, clients, teamLeads }
  }, [projects])

  const hasActiveFilters =
    search.trim().length > 0 ||
    filterProject !== 'all' ||
    filterClient !== 'all' ||
    filterType !== 'all' ||
    filterTeamLead !== 'all' ||
    filterProgress !== 'all'

  const clearFilters = () => {
    setSearch('')
    setFilterProject('all')
    setFilterClient('all')
    setFilterType('all')
    setFilterTeamLead('all')
    setFilterProgress('all')
  }

  useEffect(() => {
    setPage(1)
  }, [
    search,
    filterProject,
    filterClient,
    filterType,
    filterTeamLead,
    filterProgress,
    pageSize,
    sortColumn,
    sortDirection,
  ])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      const pct = p.completionPercentage ?? 0
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        (p.teamLead || '').toLowerCase().includes(q)

      const matchesProject = filterProject === 'all' || p.id === filterProject
      const matchesClient = filterClient === 'all' || p.client === filterClient
      const matchesType = filterType === 'all' || p.accessType === filterType
      const matchesTeamLead = filterTeamLead === 'all' || (p.teamLead || '') === filterTeamLead
      const matchesProgress = matchesProgressFilter(pct, filterProgress)

      return (
        matchesSearch &&
        matchesProject &&
        matchesClient &&
        matchesType &&
        matchesTeamLead &&
        matchesProgress
      )
    })
  }, [
    projects,
    search,
    filterProject,
    filterClient,
    filterType,
    filterTeamLead,
    filterProgress,
  ])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sortDirection === 'asc' ? 1 : -1

    list.sort((a, b) => {
      if (sortColumn === 'completionPercentage') {
        const aVal = a.completionPercentage ?? 0
        const bVal = b.completionPercentage ?? 0
        return (aVal - bVal) * dir
      }
      if (sortColumn === 'analysisStatus') {
        const aVal = STATUS_SORT_ORDER[getProjectAnalysisStatus(a)]
        const bVal = STATUS_SORT_ORDER[getProjectAnalysisStatus(b)]
        return (aVal - bVal) * dir
      }
      const aVal = String(a[sortColumn as keyof AdminProjectRow] ?? '').toLowerCase()
      const bVal = String(b[sortColumn as keyof AdminProjectRow] ?? '').toLowerCase()
      return aVal.localeCompare(bVal) * dir
    })

    return list
  }, [filtered, sortColumn, sortDirection])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  const columns: Column<AdminProjectRow>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Project Name',
        sortable: true,
        className: 'admin-projects-col-project max-w-0',
        render: (p) => (
          <Link
            to={projectWorkspacePath(p.id)}
            className="employee-directory-employee-link group flex min-w-0 items-center gap-2"
          >
            <Avatar name={p.name} size="sm" color={stringToHueColor(p.id)} />
            <div className="min-w-0 flex-1">
              <p
                className="truncate font-semibold capitalize text-[#0f172a] transition-colors group-hover:text-[#06C033]"
                title={p.name}
              >
                {p.name}
              </p>
            </div>
          </Link>
        ),
      },
      {
        key: 'client',
        header: 'Client Name',
        sortable: true,
        className: 'admin-projects-col-client max-w-0',
        render: (p) => <TruncateText text={p.client} className="text-slate-700" />,
      },
      {
        key: 'accessType',
        header: 'Type',
        sortable: true,
        className: 'admin-projects-col-type',
        render: (p) => (
          <span
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold',
              p.accessType === 'public'
                ? 'border-sky-200 bg-sky-50 text-sky-800'
                : 'border-violet-200 bg-violet-50 text-violet-800',
            )}
          >
            {p.accessType === 'public' ? <Globe className="h-3 w-3 shrink-0" /> : <Lock className="h-3 w-3 shrink-0" />}
            <span className="truncate">{p.accessType === 'public' ? 'Public' : 'Private'}</span>
          </span>
        ),
      },
      {
        key: 'teamLead',
        header: 'Team lead',
        sortable: true,
        className: 'admin-projects-col-team-lead max-w-0',
        render: (p) => <TruncateText text={p.teamLead || ''} className="text-slate-700" />,
      },
      {
        key: 'analysisStatus',
        header: 'Status',
        sortable: true,
        className: 'admin-projects-col-status',
        render: (p) => {
          const status = getProjectAnalysisStatus(p)
          return (
            <span
              className={cn('admin-projects-status-chip whitespace-nowrap', statusChipClass(status))}
            >
              {status}
            </span>
          )
        },
      },
      {
        key: 'completionPercentage',
        header: 'Progress',
        sortable: true,
        className: 'admin-projects-col-progress',
        render: (p) => {
          const progress = p.completionPercentage ?? 0
          return (
            <Badge
              variant={progress >= 75 ? 'success' : progress >= 40 ? 'info' : 'neutral'}
              className="employee-directory-status-badge whitespace-nowrap px-2 py-0.5 text-[0.6875rem] font-semibold"
            >
              {progress}%
            </Badge>
          )
        },
      },
      {
        key: 'ops' as const,
        header: 'Open Workspace',
        className: 'admin-projects-col-action text-center',
        render: (p) => (
          <div
            className="flex items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <Link
              to={projectWorkspacePath(p.id)}
              className="employee-directory-action-btn"
              title="Open workspace"
              aria-label={`Open workspace for ${p.name}`}
            >
              <Eye className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        ),
      },
    ],
    [projectWorkspacePath],
  )

  const handleSort = (key: string) => {
    const col = key as SortKey
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  if (tab) {
    const base = isProjectAnalysisAdminPath(pathname)
      ? ROUTES.PROJECT_ANALYSIS_PROJECTS
      : ROUTES.TIMESHEET
    return <Navigate to={`${base}?${searchParams.toString()}`} replace />
  }

  return (
    <PageWrapper
      fillViewport
      className="admin-hub-page-wrap admin-projects-page relative z-10 max-w-none !px-0 !py-0 font-body"
    >
      <div className="crewiq-dashboard admin-projects-view admin-projects-directory-view admin-projects-directory-view--modern relative flex h-full min-h-0 flex-1 flex-col">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-projects-shell relative z-10">
          {!inProjectAnalysis ? (
            <header className="admin-projects-head">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                  <Briefcase className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h1 className="admin-projects-head-title">Projects</h1>
                </div>
              </div>
            </header>
          ) : null}

          <div className="admin-projects-filter-toolbar admin-projects-filter-toolbar--directory">
            <div className="admin-projects-filter-toolbar__search-row">
              <div className="admin-projects-filter-search-wrap">
                <Search className="admin-projects-filter-search-icon" strokeWidth={2} aria-hidden />
                <input
                  type="search"
                  placeholder="Search by project, client, or team lead…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="admin-projects-filter-search-input admin-projects-filter-search-input--directory"
                  aria-label="Search projects"
                />
                {search ? (
                  <button
                    type="button"
                    className="admin-projects-filter-search-clear"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  className="admin-projects-filter-clear-btn"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="admin-projects-filter-toolbar__filters-row">
              <div className="admin-projects-filter-select-wrap">
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className={FILTER_SELECT_CLASS}
                  aria-label="Filter by project"
                >
                  <option value="all">All projects</option>
                  {filterOptions.projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
              </div>

              <div className="admin-projects-filter-select-wrap">
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className={FILTER_SELECT_CLASS}
                  aria-label="Filter by client"
                >
                  <option value="all">All clients</option>
                  {filterOptions.clients.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
                <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
              </div>

              <div className="admin-projects-filter-select-wrap">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'public' | 'private')}
                  className={FILTER_SELECT_CLASS}
                  aria-label="Filter by type"
                >
                  <option value="all">All types</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
              </div>

              <div className="admin-projects-filter-select-wrap">
                <select
                  value={filterTeamLead}
                  onChange={(e) => setFilterTeamLead(e.target.value)}
                  className={FILTER_SELECT_CLASS}
                  aria-label="Filter by team lead"
                >
                  <option value="all">All team leads</option>
                  {filterOptions.teamLeads.map((lead) => (
                    <option key={lead} value={lead}>
                      {lead}
                    </option>
                  ))}
                </select>
                <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
              </div>

              <div className="admin-projects-filter-select-wrap">
                <select
                  value={filterProgress}
                  onChange={(e) => setFilterProgress(e.target.value as ProgressFilter)}
                  className={FILTER_SELECT_CLASS}
                  aria-label="Filter by progress"
                >
                  <option value="all">All progress</option>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
                <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
              </div>
            </div>
          </div>

          <section className="employee-directory-table-section admin-projects-table-section admin-projects-table-section--modern">
            <DataTable
              className="employee-list-table employee-directory-table admin-projects-directory-table admin-projects-directory-table--modern"
              columns={columns}
              data={paginated}
              loading={loading}
              brandHeader
              striped
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              getRowStyle={(p) =>
                p.id ? ({ '--row-hover-bg': stringToHueHoverBg(p.id) } as React.CSSProperties) : undefined
              }
              empty={
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-slate-600">No projects found.</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {hasActiveFilters
                      ? 'Try adjusting your filters or search terms.'
                      : 'Create a project from Timesheets to get started.'}
                  </p>
                </div>
              }
            />

            {!loading && sorted.length > 0 ? (
              <div className="employee-directory-pagination admin-projects-directory-pagination">
                <PaginationBar
                  total={sorted.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[15, 25, 50]}
                  itemLabel="projects"
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </PageWrapper>
  )
}
