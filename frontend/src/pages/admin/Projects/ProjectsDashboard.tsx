import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Briefcase, ChevronDown, ClipboardList, Eye, Globe, Lock, Search } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { DataTable, type Column } from '@components/tables/DataTable'
import { PaginationBar } from '@components/tables/Pagination'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { ROUTES } from '@constants/routes'
import api from '@/services/api'
import { cn } from '@/utils/cn'
import { stringToHueColor, stringToHueHoverBg } from '@/utils/stringColor'
import type { AdminProjectRow, ProjectChecklistStatus, ProjectChecklistSummary } from '@/types/projectWorkspace'
import { ChecklistManagementModal } from './ChecklistManagementModal'
import {
  AssignChecklistModal,
  ProjectChecklistImportExport,
} from './ProjectChecklistImportExport'
import './adminProjects.css'

type SortKey =
  | 'name'
  | 'client'
  | 'accessType'
  | 'teamLead'
  | 'checklistName'
  | 'checklistCompletionPercentage'
  | 'checklistLastUpdated'
  | 'completionPercentage'

type ChecklistFilter = 'all' | ProjectChecklistStatus

function checklistBadgeVariant(status?: ProjectChecklistStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'Applied') return 'success'
  if (status === 'Partial') return 'warning'
  return 'neutral'
}

export function ProjectsDashboard() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const [projects, setProjects] = useState<AdminProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [checklistFilter, setChecklistFilter] = useState<ChecklistFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortColumn, setSortColumn] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [manageOpen, setManageOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<AdminProjectRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<AdminProjectRow[]>('/projects?syncCompletion=true')
      setProjects(Array.isArray(data) ? data : [])
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, sortColumn, sortDirection, checklistFilter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        (p.teamLead || '').toLowerCase().includes(q) ||
        (p.checklistName || '').toLowerCase().includes(q)

      const status = p.checklistStatus || 'Not Applied'
      const matchesFilter =
        checklistFilter === 'all' || status === checklistFilter

      return matchesSearch && matchesFilter
    })
  }, [projects, search, checklistFilter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sortDirection === 'asc' ? 1 : -1

    list.sort((a, b) => {
      if (sortColumn === 'checklistCompletionPercentage' || sortColumn === 'completionPercentage') {
        const aVal = a[sortColumn] ?? 0
        const bVal = b[sortColumn] ?? 0
        return (aVal - bVal) * dir
      }
      if (sortColumn === 'checklistLastUpdated') {
        const aTime = a.checklistLastUpdated ? new Date(a.checklistLastUpdated).getTime() : 0
        const bTime = b.checklistLastUpdated ? new Date(b.checklistLastUpdated).getTime() : 0
        return (aTime - bTime) * dir
      }
      const aVal = String(
        sortColumn === 'checklistName' ? a.checklistName ?? '' : a[sortColumn as keyof AdminProjectRow] ?? '',
      ).toLowerCase()
      const bVal = String(
        sortColumn === 'checklistName' ? b.checklistName ?? '' : b[sortColumn as keyof AdminProjectRow] ?? '',
      ).toLowerCase()
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
        header: 'Project',
        sortable: true,
        render: (p) => (
          <Link
            to={ROUTES.PROJECT_WORKSPACE(p.id)}
            className="employee-directory-employee-link group flex items-center gap-3"
          >
            <Avatar name={p.name} size="sm" color={stringToHueColor(p.id)} />
            <div className="min-w-0">
              <p className="truncate font-semibold capitalize text-[#1a4712] transition-colors group-hover:text-[#266b1c]">
                {p.name}
              </p>
            </div>
          </Link>
        ),
      },
      {
        key: 'client',
        header: 'Client',
        sortable: true,
        className: 'min-w-[10rem]',
        render: (p) => (
          <span className="text-slate-700">{p.client || <span className="text-slate-400">—</span>}</span>
        ),
      },
      {
        key: 'accessType',
        header: 'Type',
        sortable: true,
        render: (p) => (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold',
              p.accessType === 'public'
                ? 'border-sky-200 bg-sky-50 text-sky-800'
                : 'border-violet-200 bg-violet-50 text-violet-800',
            )}
          >
            {p.accessType === 'public' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
            {p.accessType === 'public' ? 'Public' : 'Private'}
          </span>
        ),
      },
      {
        key: 'teamLead',
        header: 'Team lead',
        sortable: true,
        className: 'min-w-[11rem]',
        render: (p) => (
          <span className="text-slate-700">{p.teamLead || <span className="text-slate-400">—</span>}</span>
        ),
      },
      {
        key: 'checklistName',
        header: 'Checklist',
        sortable: true,
        className: 'min-w-[11rem]',
        render: (p) => {
          const status = p.checklistStatus || 'Not Applied'
          return (
            <button
              type="button"
              className="admin-projects-checklist-cell text-left"
              onClick={(e) => {
                e.stopPropagation()
                setAssignTarget(p)
              }}
              title="Click to assign or change checklist"
            >
              <p className="truncate font-semibold text-slate-800">
                {p.checklistName || <span className="font-normal text-slate-400">Not assigned</span>}
              </p>
              <Badge
                variant={checklistBadgeVariant(status)}
                className="admin-projects-checklist-badge mt-1 px-2 py-0.5 text-[0.6875rem] font-semibold"
              >
                {status}
              </Badge>
            </button>
          )
        },
      },
      {
        key: 'completionPercentage',
        header: 'Progress',
        sortable: true,
        render: (p) => {
          const progress = p.completionPercentage ?? 0
          return (
            <Badge
              variant={progress >= 75 ? 'success' : progress >= 40 ? 'info' : 'neutral'}
              className="employee-directory-status-badge px-3 py-1 font-semibold"
            >
              {progress}%
            </Badge>
          )
        },
      },
      {
        key: 'ops' as const,
        header: 'Open workspace',
        className: 'w-24 text-right',
        render: (p) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <Link
              to={ROUTES.PROJECT_WORKSPACE(p.id)}
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
    [],
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

  const handleChecklistAssigned = (projectId: string, summary: ProjectChecklistSummary) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              checklistName: summary.checklistName,
              checklistStatus: summary.status as ProjectChecklistStatus,
              checklistCompletionPercentage: summary.completionPercentage,
              checklistLastUpdated: summary.lastUpdated,
              checklistTotalCells: summary.totalCells,
              checklistAppliedCells: summary.appliedCells,
            }
          : p,
      ),
    )
    void load()
  }

  if (tab) {
    return <Navigate to={`${ROUTES.TIMESHEET}?${searchParams.toString()}`} replace />
  }

  return (
    <PageWrapper
      fillViewport
      className="admin-hub-page-wrap admin-projects-page relative z-10 max-w-none !px-0 !py-0 font-body"
    >
      <div className="crewiq-dashboard admin-projects-view admin-projects-directory-view relative flex h-full min-h-0 flex-1 flex-col">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-projects-shell relative z-10">
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

          <div className="admin-projects-toolbar">
            <div className="admin-projects-search-wrap">
              <Search className="h-4 w-4" aria-hidden />
              <input
                type="search"
                placeholder="Search by project, client, checklist, or team lead…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search projects"
              />
            </div>

            <div className="admin-projects-toolbar-select-wrap">
              <select
                className="admin-projects-toolbar-select"
                value={checklistFilter}
                onChange={(e) => setChecklistFilter(e.target.value as ChecklistFilter)}
                aria-label="Filter by checklist status"
              >
                <option value="all">All checklist statuses</option>
                <option value="Applied">Applied</option>
                <option value="Partial">Partial</option>
                <option value="Not Applied">Not Applied</option>
              </select>
              <ChevronDown className="admin-projects-toolbar-select-icon" aria-hidden />
            </div>

            <button
              type="button"
              className="admin-projects-toolbar-btn"
              onClick={() => setManageOpen(true)}
            >
              <ClipboardList className="h-4 w-4" />
              Manage checklists
            </button>

            <ProjectChecklistImportExport onImported={() => void load()} />
          </div>

          <section className="employee-directory-table-section admin-projects-table-section">
            <DataTable
              className="employee-list-table employee-directory-table admin-projects-directory-table"
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
                <div className="py-12 text-center">
                  <p className="text-sm font-semibold text-slate-600">No projects found.</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Try a different search or create a project from Timesheets.
                  </p>
                </div>
              }
            />

            {!loading && sorted.length > 0 ? (
              <div className="employee-directory-pagination">
                <PaginationBar
                  total={sorted.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[10, 20, 50]}
                  itemLabel="projects"
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <ChecklistManagementModal isOpen={manageOpen} onClose={() => setManageOpen(false)} onChanged={() => void load()} />

      {assignTarget ? (
        <AssignChecklistModal
          isOpen={Boolean(assignTarget)}
          projectId={assignTarget.id}
          projectName={assignTarget.name}
          onClose={() => setAssignTarget(null)}
          onAssigned={(summary) => {
            handleChecklistAssigned(assignTarget.id, summary)
            setAssignTarget(null)
          }}
        />
      ) : null}
    </PageWrapper>
  )
}
