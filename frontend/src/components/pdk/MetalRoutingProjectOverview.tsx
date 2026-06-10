import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  Filter,
  FolderKanban,
  Layers,
  Search,
} from 'lucide-react'
import { MetalRoutingProjectCards } from '@components/pdk/MetalRoutingProjectCards'
import {
  MetalRoutingPill,
  MetalRoutingTableSkeleton,
} from '@components/pdk/MetalRoutingSkeleton'
import { MetalRoutingViewToggle, type MetalRoutingViewMode } from '@components/pdk/MetalRoutingViewToggle'
import type { DashboardProject, PdkModule } from '@/types/pdkMetalRouting'
import {
  dashboardStatusVariant,
  formatRelativeUpdated,
  getProjectCode,
} from '@/utils/metalRoutingProjectDisplay'
import { cn } from '@/utils/cn'

const PAGE_SIZE = 10
const GRID_PAGE_SIZE = 9

type OverviewColumn =
  | 'project'
  | 'client'
  | 'techNode'
  | 'status'
  | 'assignedPdk'
  | 'lastUpdated'

type SortKey = OverviewColumn
type SortDir = 'asc' | 'desc'

const COLUMN_DEFS: { key: OverviewColumn; label: string; sortable: boolean; hideable: boolean }[] = [
  { key: 'project', label: 'Project', sortable: true, hideable: false },
  { key: 'client', label: 'Client', sortable: true, hideable: true },
  { key: 'techNode', label: 'Tech Node', sortable: true, hideable: true },
  { key: 'status', label: 'Status', sortable: true, hideable: true },
  { key: 'assignedPdk', label: 'Assigned PDK', sortable: true, hideable: true },
  { key: 'lastUpdated', label: 'Last Updated', sortable: true, hideable: true },
]

const DEFAULT_VISIBLE_COLUMNS: Record<OverviewColumn, boolean> = {
  project: true,
  client: true,
  techNode: true,
  status: true,
  assignedPdk: true,
  lastUpdated: true,
}

function SortHeaderButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: SortDir
  onClick: () => void
}) {
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <button type="button" className="metal-routing-overview-sort" onClick={onClick}>
      <span>{label}</span>
      <Icon className={cn('h-3.5 w-3.5', active && 'is-active')} aria-hidden />
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = dashboardStatusVariant(status)
  return (
    <MetalRoutingPill tone={tone} className="metal-routing-overview-status-pill">
      <span className={cn('metal-routing-overview-status-pill__dot', `is-${tone}`)} aria-hidden />
      {status}
    </MetalRoutingPill>
  )
}

function compareProjects(a: DashboardProject, b: DashboardProject, key: SortKey): number {
  switch (key) {
    case 'project':
      return a.projectName.localeCompare(b.projectName)
    case 'client':
      return a.clientName.localeCompare(b.clientName)
    case 'techNode':
      return a.technologyNode.localeCompare(b.technologyNode)
    case 'status':
      return a.status.localeCompare(b.status)
    case 'assignedPdk':
      return (a.pdkModuleName ?? '').localeCompare(b.pdkModuleName ?? '')
    case 'lastUpdated': {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return aTime - bTime
    }
    default:
      return 0
  }
}

export function MetalRoutingProjectOverview({
  projects,
  pdkModules,
  loading,
  savingId,
  selectedProjectId,
  onSelectProject,
  onAssignPdk,
}: {
  projects: DashboardProject[]
  pdkModules: PdkModule[]
  loading?: boolean
  savingId: string | null
  selectedProjectId?: string | null
  onSelectProject?: (projectId: string) => void
  onAssignPdk: (projectId: string, pdkModuleId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<MetalRoutingViewMode>('list')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('project')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS)

  const statuses = useMemo(() => {
    const set = new Set(projects.map((p) => p.status).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [projects])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      if (!matchesStatus) return false
      if (!query) return true
      return (
        project.projectName.toLowerCase().includes(query)
        || project.clientName.toLowerCase().includes(query)
        || (project.projectCode ?? '').toLowerCase().includes(query)
        || project.technologyNode.toLowerCase().includes(query)
        || (project.pdkModuleName ?? '').toLowerCase().includes(query)
      )
    })
  }, [projects, search, statusFilter])

  const sorted = useMemo(() => {
    const rows = [...filtered]
    rows.sort((a, b) => {
      const result = compareProjects(a, b, sortKey)
      return sortDir === 'asc' ? result : -result
    })
    return rows
  }, [filtered, sortKey, sortDir])

  const pageSize = viewMode === 'grid' ? GRID_PAGE_SIZE : PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, sorted.length)

  const visibleColumnDefs = COLUMN_DEFS.filter((col) => visibleColumns[col.key])
  const hideableColumns = COLUMN_DEFS.filter((col) => col.hideable)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'lastUpdated' ? 'desc' : 'asc')
    }
  }

  const toggleColumn = (key: OverviewColumn) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="metal-routing-overview-card">
      <div className="metal-routing-overview-toolbar">
        <div className="metal-routing-overview-toolbar__title">
          <span className="metal-routing-overview-toolbar__icon" aria-hidden>
            <FolderKanban className="h-5 w-5" />
          </span>
          <h2 className="metal-routing-overview-toolbar__heading">Project Overview</h2>
        </div>

        <label className="metal-routing-search-field metal-routing-overview-toolbar__search">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </label>

        <div className="metal-routing-overview-controls">
          <div className="metal-routing-overview-filter">
            <Filter className="metal-routing-overview-filter__icon" aria-hidden />
            <select
              className="metal-routing-toolbar-select metal-routing-overview-filter__select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Filter by status"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All statuses' : status}
                </option>
              ))}
            </select>
            <ChevronDown className="metal-routing-overview-filter__chevron" aria-hidden />
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="metal-routing-toolbar-btn">
                <Columns3 className="h-4 w-4" aria-hidden />
                Columns
                <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="metal-routing-overview-columns-menu" sideOffset={6} align="end">
                {hideableColumns.map((col) => (
                  <DropdownMenu.CheckboxItem
                    key={col.key}
                    className="metal-routing-overview-columns-menu__item"
                    checked={visibleColumns[col.key]}
                    onCheckedChange={() => toggleColumn(col.key)}
                  >
                    {col.label}
                  </DropdownMenu.CheckboxItem>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <MetalRoutingViewToggle
            value={viewMode}
            onChange={(mode) => {
              setViewMode(mode)
              setPage(1)
            }}
          />
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="metal-routing-project-grid-wrap">
          <MetalRoutingProjectCards
            variant="dashboard"
            projects={pageItems}
            startIndex={(currentPage - 1) * pageSize}
            loading={loading}
            pdkModules={pdkModules}
            savingId={savingId}
            selectedProjectId={selectedProjectId}
            onSelectProject={onSelectProject}
            onAssignPdk={onAssignPdk}
          />
        </div>
      ) : (
        <div className="metal-routing-overview-table-wrap">
          <table className="metal-routing-overview-table">
            <thead>
              <tr>
                {visibleColumnDefs.map((col) => (
                  <th key={col.key}>
                    {col.sortable ? (
                      <SortHeaderButton
                        label={col.label}
                        active={sortKey === col.key}
                        direction={sortDir}
                        onClick={() => toggleSort(col.key)}
                      />
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumnDefs.length} className="p-0">
                    <MetalRoutingTableSkeleton rows={6} />
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnDefs.length} className="metal-routing-overview-empty">
                    No projects match your search.
                  </td>
                </tr>
              ) : (
                pageItems.map((project, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index
                  const projectCode = getProjectCode(project, globalIndex)

                  return (
                    <tr
                      key={project.id}
                      className={cn(
                        onSelectProject && 'is-clickable',
                        selectedProjectId === project.id && 'is-selected',
                      )}
                      onClick={() => onSelectProject?.(project.id)}
                    >
                      {visibleColumns.project ? (
                        <td>
                          <div className="metal-routing-overview-project">
                            <span className="metal-routing-overview-project__icon" aria-hidden>
                              <Layers className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="metal-routing-overview-project__name">{project.projectName}</div>
                              <div className="metal-routing-overview-project__code">{projectCode}</div>
                            </div>
                          </div>
                        </td>
                      ) : null}
                      {visibleColumns.client ? (
                        <td className="metal-routing-overview-cell-muted">{project.clientName}</td>
                      ) : null}
                      {visibleColumns.techNode ? (
                        <td className="metal-routing-overview-cell">{project.technologyNode}</td>
                      ) : null}
                      {visibleColumns.status ? (
                        <td>
                          <StatusBadge status={project.status} />
                        </td>
                      ) : null}
                      {visibleColumns.assignedPdk ? (
                        <td>
                          <select
                            className="metal-routing-pdk-select"
                            value={project.pdkModuleId ?? ''}
                            disabled={savingId === project.id || pdkModules.length === 0}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation()
                              onAssignPdk(project.id, e.target.value)
                            }}
                            aria-label={`Assign PDK for ${project.projectName}`}
                          >
                            <option value="">— Not assigned —</option>
                            {pdkModules.map((mod) => (
                              <option key={mod._id} value={mod._id}>
                                {mod.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      {visibleColumns.lastUpdated ? (
                        <td>
                          <span className="metal-routing-overview-updated">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {formatRelativeUpdated(project.updatedAt)}
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <footer className="metal-routing-overview-footer">
        <p className="metal-routing-overview-footer__count">
          Showing {rangeStart} to {rangeEnd} of {sorted.length} project{sorted.length === 1 ? '' : 's'}
        </p>
        <div className="metal-routing-overview-pagination">
          <button
            type="button"
            className="metal-routing-page-btn metal-routing-page-btn--nav"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
            .map((n, idx, arr) => {
              const prev = arr[idx - 1]
              const showEllipsis = prev != null && n - prev > 1
              return (
                <span key={n} className="flex items-center gap-1">
                  {showEllipsis ? <span className="px-1 text-muted">…</span> : null}
                  <button
                    type="button"
                    className={cn('metal-routing-page-btn', currentPage === n && 'is-active')}
                    onClick={() => setPage(n)}
                    aria-current={currentPage === n ? 'page' : undefined}
                  >
                    {n}
                  </button>
                </span>
              )
            })}
          <button
            type="button"
            className="metal-routing-page-btn metal-routing-page-btn--nav"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </footer>
    </section>
  )
}
