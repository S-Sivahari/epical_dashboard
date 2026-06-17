import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Briefcase, Eye, Globe, Lock, Search } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
import { DataTable, type Column } from '@components/tables/DataTable'
import { PaginationBar } from '@components/tables/Pagination'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { ROUTES } from '@constants/routes'
import { isProjectAnalysisAdminPath } from './projectPortal'
import { fetchMyAssignedProjects } from '@/services/employeeProjectService'
import api from '@/services/api'
import { useProjectPortal } from './projectPortal'
import { cn } from '@/utils/cn'
import { stringToHueColor, stringToHueHoverBg } from '@/utils/stringColor'
import type { AdminProjectRow } from '@/types/projectWorkspace'
import './adminProjects.css'

type SortKey =
  | 'name'
  | 'client'
  | 'accessType'
  | 'teamLead'
  | 'completionPercentage'

export function ProjectsDashboard() {
  const { isEmployee, inProjectAnalysis, projectWorkspacePath } = useProjectPortal()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const [projects, setProjects] = useState<AdminProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, sortColumn, sortDirection])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q) ||
        (p.teamLead || '').toLowerCase().includes(q)

      return matchesSearch
    })
  }, [projects, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sortDirection === 'asc' ? 1 : -1

    list.sort((a, b) => {
      if (sortColumn === 'completionPercentage') {
        const aVal = a.completionPercentage ?? 0
        const bVal = b.completionPercentage ?? 0
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
        header: 'Project',
        sortable: true,
        render: (p) => (
          <Link
            to={projectWorkspacePath(p.id)}
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
                placeholder="Search by project, client, or team lead…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search projects"
              />
            </div>
          </div>

          <section className="employee-directory-table-section admin-projects-table-section">
            <DataTable
              className="employee-list-table employee-directory-table admin-projects-directory-table"
              columns={columns}
              data={paginated}
              loading={loading}
              fillRows={inProjectAnalysis && !loading && paginated.length > 0}
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
    </PageWrapper>
  )
}
