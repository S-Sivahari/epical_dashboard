import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Briefcase, ClipboardCheck, Eye, Search } from 'lucide-react'
import { DataTable } from '@components/tables/DataTable'
import { PaginationBar } from '@components/tables/Pagination'
import { Avatar } from '@components/ui/Avatar'
import { Badge } from '@components/ui/Badge'
import { cn } from '@/utils/cn'
import { stringToHueColor, stringToHueHoverBg } from '@/utils/stringColor'

function isTeamLead(role) {
  const normalized = String(role || '').trim().toLowerCase()
  return normalized === 'lead' || normalized === 'team lead'
}

function formatRole(role) {
  return isTeamLead(role) ? 'Team Lead' : 'Member'
}

export default function EmployeeProjectsDashboard() {
  const { projects, workspacesById, loading, pendingReviewCount = 0 } = useOutletContext()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortColumn, setSortColumn] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, sortColumn, sortDirection])

  const rows = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        completionPercentage: workspacesById[project.id]?.project?.completionPercentage ?? 0,
        assignedCells: workspacesById[project.id]?.stats?.assignedToMe ?? 0,
      })),
    [projects, workspacesById],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((project) => {
      if (!q) return true
      return (
        project.name.toLowerCase().includes(q) ||
        (project.client || '').toLowerCase().includes(q) ||
        (project.technologyNode || '').toLowerCase().includes(q) ||
        formatRole(project.assignmentRole).toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const dir = sortDirection === 'asc' ? 1 : -1

    list.sort((a, b) => {
      if (sortColumn === 'completionPercentage' || sortColumn === 'assignedCells' || sortColumn === 'myHours') {
        const aVal = a[sortColumn] ?? 0
        const bVal = b[sortColumn] ?? 0
        return (aVal - bVal) * dir
      }
      const aVal = String(a[sortColumn] ?? '').toLowerCase()
      const bVal = String(b[sortColumn] ?? '').toLowerCase()
      return aVal.localeCompare(bVal) * dir
    })

    return list
  }, [filtered, sortColumn, sortDirection])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Project',
        sortable: true,
        render: (project) => (
          <Link
            to={`/employee/projects/${project.id}`}
            className="employee-directory-employee-link group flex items-center gap-3"
          >
            <Avatar name={project.name} size="sm" color={stringToHueColor(project.id)} />
            <div className="min-w-0">
              <p className="truncate font-semibold capitalize text-[#1a4712] transition-colors group-hover:text-[#266b1c]">
                {project.name}
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
        render: (project) => (
          <span className="text-slate-700">{project.client || <span className="text-slate-400">—</span>}</span>
        ),
      },
      {
        key: 'technologyNode',
        header: 'Node',
        sortable: true,
        className: 'min-w-[8rem]',
        render: (project) => (
          <span className="text-slate-700">
            {project.technologyNode || <span className="text-slate-400">—</span>}
          </span>
        ),
      },
      {
        key: 'assignmentRole',
        header: 'Role',
        sortable: true,
        render: (project) => (
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
              isTeamLead(project.assignmentRole)
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-50 text-slate-700',
            )}
          >
            {formatRole(project.assignmentRole)}
          </span>
        ),
      },
      {
        key: 'assignedCells',
        header: 'Your cells',
        sortable: true,
        render: (project) => (
          <span className="text-slate-700 tabular-nums">{project.assignedCells}</span>
        ),
      },
      {
        key: 'completionPercentage',
        header: 'Progress',
        sortable: true,
        render: (project) => {
          const progress = project.completionPercentage ?? 0
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
        key: 'ops',
        header: 'Open workspace',
        className: 'w-24 text-right',
        render: (project) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
            role="presentation"
          >
            <Link
              to={`/employee/projects/${project.id}`}
              className="employee-directory-action-btn"
              title="Open workspace"
              aria-label={`Open workspace for ${project.name}`}
            >
              <Eye className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        ),
      },
    ],
    [],
  )

  const handleSort = (key) => {
    if (sortColumn === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(key)
      setSortDirection('asc')
    }
  }

  return (
    <div className="admin-projects-shell relative z-10 flex min-h-0 flex-1 flex-col">
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
            placeholder="Search by project, client, or node…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search projects"
          />
        </div>
        <Link
          to="/employee/projects/reviews"
          className="admin-projects-employee-reviews-link"
        >
          <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden />
          Requested reviews
          {pendingReviewCount > 0 ? (
            <span className="admin-projects-employee-reviews-badge">{pendingReviewCount}</span>
          ) : null}
        </Link>
      </div>

      <section className="employee-directory-table-section admin-projects-table-section">
        <DataTable
          className="employee-list-table employee-directory-table admin-projects-directory-table"
          columns={columns}
          data={paginated}
          loading={loading && !projects.length}
          brandHeader
          striped
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          getRowStyle={(project) =>
            project.id ? ({ '--row-hover-bg': stringToHueHoverBg(project.id) }) : undefined
          }
          empty={
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-600">No assigned projects found.</p>
              <p className="mt-1 text-xs text-slate-400">
                Projects assigned to you will appear here.
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
  )
}
