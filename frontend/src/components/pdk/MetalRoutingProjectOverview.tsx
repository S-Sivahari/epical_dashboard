import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  FolderKanban,
  Search,
} from 'lucide-react'
import { MetalRoutingProjectCards, MetalRoutingProjectListRows } from '@components/pdk/MetalRoutingProjectCards'
import { MetalRoutingCardGridSkeleton, MetalRoutingEmptyState } from '@components/pdk/MetalRoutingSkeleton'
import { MetalRoutingViewToggle, type MetalRoutingViewMode } from '@components/pdk/MetalRoutingViewToggle'
import type { DashboardProject, PdkModule } from '@/types/pdkMetalRouting'
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
  const [sortKey, setSortKey] = useState<OverviewColumn>('project')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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
      let result = 0
      switch (sortKey) {
        case 'project':
          result = a.projectName.localeCompare(b.projectName)
          break
        case 'client':
          result = a.clientName.localeCompare(b.clientName)
          break
        case 'techNode':
          result = a.technologyNode.localeCompare(b.technologyNode)
          break
        case 'status':
          result = a.status.localeCompare(b.status)
          break
        case 'assignedPdk':
          result = (a.pdkModuleName ?? '').localeCompare(b.pdkModuleName ?? '')
          break
        case 'lastUpdated': {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
          result = aTime - bTime
          break
        }
        default:
          break
      }
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

          <div className="relative">
            <select
              className="metal-routing-toolbar-select"
              value={`${sortKey}-${sortDir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split('-') as [OverviewColumn, 'asc' | 'desc']
                setSortKey(key)
                setSortDir(dir)
              }}
              aria-label="Sort projects"
            >
              <option value="project-asc">Sort by name (A–Z)</option>
              <option value="project-desc">Sort by name (Z–A)</option>
              <option value="client-asc">Sort by client (A–Z)</option>
              <option value="status-asc">Sort by status</option>
              <option value="lastUpdated-desc">Sort by recently updated</option>
            </select>
          </div>

          <MetalRoutingViewToggle
            value={viewMode}
            onChange={(mode) => {
              setViewMode(mode)
              setPage(1)
            }}
          />
        </div>
      </div>

      <div className="metal-routing-overview-body">
        {loading ? (
          <MetalRoutingCardGridSkeleton count={6} />
        ) : pageItems.length === 0 ? (
          <MetalRoutingEmptyState
            title="No projects found"
            description="Try adjusting your search or filter criteria."
          />
        ) : viewMode === 'grid' ? (
          <div className="metal-routing-project-grid-wrap">
            <MetalRoutingProjectCards
              variant="dashboard"
              projects={pageItems}
              startIndex={(currentPage - 1) * pageSize}
              pdkModules={pdkModules}
              savingId={savingId}
              selectedProjectId={selectedProjectId}
              onSelectProject={onSelectProject}
              onAssignPdk={onAssignPdk}
            />
          </div>
        ) : (
          <MetalRoutingProjectListRows
            variant="dashboard"
            projects={pageItems}
            startIndex={(currentPage - 1) * pageSize}
            pdkModules={pdkModules}
            savingId={savingId}
            selectedProjectId={selectedProjectId}
            onSelectProject={onSelectProject}
            onAssignPdk={onAssignPdk}
          />
        )}
      </div>

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
