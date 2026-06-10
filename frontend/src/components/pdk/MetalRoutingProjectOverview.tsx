import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'
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
      )
    })
  }, [projects, search, statusFilter])

  const pageSize = viewMode === 'grid' ? GRID_PAGE_SIZE : PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length)

  return (
    <section className="metal-routing-overview-card">
      <div className="metal-routing-overview-toolbar">
        <h2 className="metal-routing-section-title">Project Overview</h2>
        <div className="metal-routing-overview-controls">
          <label className="metal-routing-search-field">
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
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <select
              className="metal-routing-toolbar-select pl-8"
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
          </div>
          <button type="button" className="metal-routing-toolbar-btn" disabled>
            Columns
            <ChevronDown className="h-4 w-4 opacity-60" />
          </button>
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
              <th>Project</th>
              <th>Client</th>
              <th>Tech Node</th>
              <th>Status</th>
              <th>Assigned PDK</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <MetalRoutingTableSkeleton rows={6} />
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="metal-routing-overview-empty">
                  No projects match your search.
                </td>
              </tr>
            ) : (
              pageItems.map((project, index) => (
                <tr
                  key={project.id}
                  className={cn(
                    onSelectProject && 'cursor-pointer',
                    selectedProjectId === project.id && 'is-selected',
                  )}
                  onClick={() => onSelectProject?.(project.id)}
                >
                  <td>
                    <div className="font-medium text-ink">{project.projectName}</div>
                    <div className="text-xs text-muted">
                      {getProjectCode(project, (currentPage - 1) * pageSize + index)}
                    </div>
                  </td>
                  <td className="text-muted">{project.clientName}</td>
                  <td>{project.technologyNode}</td>
                  <td>
                    <MetalRoutingPill tone={dashboardStatusVariant(project.status)}>
                      {project.status}
                    </MetalRoutingPill>
                  </td>
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
                  <td className="whitespace-nowrap text-muted">
                    {formatRelativeUpdated(project.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      <footer className="metal-routing-overview-footer">
        <p className="text-sm text-muted">
          Showing {rangeStart} to {rangeEnd} of {filtered.length} project{filtered.length === 1 ? '' : 's'}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="metal-routing-page-btn"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
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
                  >
                    {n}
                  </button>
                </span>
              )
            })}
          <button
            type="button"
            className="metal-routing-page-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  )
}
