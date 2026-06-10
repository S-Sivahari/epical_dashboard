import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
} from 'lucide-react'
import { Button } from '@components/ui/Button'
import { MetalRoutingProjectCards } from '@components/pdk/MetalRoutingProjectCards'
import {
  MetalRoutingPill,
  MetalRoutingTableSkeleton,
} from '@components/pdk/MetalRoutingSkeleton'
import { MetalRoutingViewToggle, type MetalRoutingViewMode } from '@components/pdk/MetalRoutingViewToggle'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import {
  cellRoutingDisplayStatus,
  formatRelativeUpdated,
  getProjectCode,
} from '@/utils/metalRoutingProjectDisplay'
import { cn } from '@/utils/cn'

const PAGE_SIZE_OPTIONS = [8, 10, 20] as const
const GRID_PAGE_SIZE = 9

type SortKey = 'name-asc' | 'name-desc' | 'updated-desc'

export function MetalRoutingCellRoutingProjectTable({
  projects,
  loading,
  search,
  statusFilter,
  onOpenRouting,
}: {
  projects: DashboardProject[]
  loading?: boolean
  search: string
  statusFilter: string
  onOpenRouting: (projectId: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('name-asc')
  const [viewMode, setViewMode] = useState<MetalRoutingViewMode>('list')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, viewMode])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let items = projects.filter((project) => {
      const matchesFilter =
        statusFilter === 'all'
        || (statusFilter === 'unassigned' && !project.pdkModuleId)
        || (statusFilter !== 'unassigned' && project.status === statusFilter)
      if (!matchesFilter) return false
      if (!query) return true
      return (
        project.projectName.toLowerCase().includes(query)
        || project.clientName.toLowerCase().includes(query)
        || (project.projectCode ?? '').toLowerCase().includes(query)
        || project.technologyNode.toLowerCase().includes(query)
        || (project.pdkModuleName ?? '').toLowerCase().includes(query)
      )
    })

    items = [...items].sort((a, b) => {
      if (sortKey === 'name-desc') return b.projectName.localeCompare(a.projectName)
      if (sortKey === 'updated-desc') {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      }
      return a.projectName.localeCompare(b.projectName)
    })

    return items
  }, [projects, search, statusFilter, sortKey])

  const effectivePageSize = viewMode === 'grid' ? GRID_PAGE_SIZE : pageSize
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1
  const rangeEnd = Math.min(currentPage * effectivePageSize, filtered.length)

  return (
    <section className="metal-routing-overview-card metal-routing-cell-routing-table">
      <div className="metal-routing-overview-toolbar">
        <h2 className="metal-routing-section-title">Projects</h2>
        <MetalRoutingViewToggle
          value={viewMode}
          onChange={(mode) => {
            setViewMode(mode)
            setPage(1)
          }}
        />
      </div>

      {viewMode === 'grid' ? (
        <div className="metal-routing-project-grid-wrap">
          <MetalRoutingProjectCards
            variant="cell-routing"
            projects={pageItems}
            startIndex={(currentPage - 1) * effectivePageSize}
            loading={loading}
            onOpenRouting={onOpenRouting}
          />
        </div>
      ) : (
      <div className="metal-routing-overview-table-wrap">
        <table className="metal-routing-overview-table metal-routing-cell-routing-table__grid">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="metal-routing-table-sort-btn"
                  onClick={() =>
                    setSortKey((k) => (k === 'name-asc' ? 'name-desc' : 'name-asc'))
                  }
                >
                  Project
                  <ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                </button>
              </th>
              <th>Client</th>
              <th>Tech Node</th>
              <th>Assigned PDK</th>
              <th>Status</th>
              <th>Updated</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <MetalRoutingTableSkeleton rows={6} />
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="metal-routing-overview-empty">
                  No projects match your search.
                </td>
              </tr>
            ) : (
              pageItems.map((project, index) => {
                const status = cellRoutingDisplayStatus(project)
                const globalIndex = (currentPage - 1) * effectivePageSize + index
                return (
                  <tr key={project.id}>
                    <td>
                      <div className="font-medium text-ink">{project.projectName}</div>
                      <div className="text-xs text-muted">
                        {getProjectCode(project, globalIndex)}
                      </div>
                    </td>
                    <td className="text-muted">{project.clientName}</td>
                    <td>{project.technologyNode}</td>
                    <td>
                      {project.pdkModuleName ? (
                        <span className="metal-routing-assigned-pdk">{project.pdkModuleName}</span>
                      ) : (
                        <span className="metal-routing-unassigned-pdk">— Not assigned —</span>
                      )}
                    </td>
                    <td>
                      <MetalRoutingPill tone={status.variant}>{status.label}</MetalRoutingPill>
                    </td>
                    <td className="whitespace-nowrap text-muted">
                      {formatRelativeUpdated(project.updatedAt)}
                    </td>
                    <td className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        icon={<ExternalLink className="h-3.5 w-3.5" />}
                        onClick={() => onOpenRouting(project.id)}
                      >
                        Open Routing
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      <footer className="metal-routing-overview-footer metal-routing-cell-routing-footer">
        <p className="text-sm text-muted">
          Showing {rangeStart} to {rangeEnd} of {filtered.length} project
          {filtered.length === 1 ? '' : 's'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-1">
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

        {viewMode === 'list' ? (
          <label className="metal-routing-page-size">
            <span className="text-sm text-muted">Show</span>
            <select
              className="metal-routing-toolbar-select"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                setPage(1)
              }}
              aria-label="Projects per page"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted">per page</span>
          </label>
        ) : (
          <span aria-hidden />
        )}
      </footer>
    </section>
  )
}

export function CellRoutingStatusFilter({
  value,
  onChange,
  projects,
}: {
  value: string
  onChange: (value: string) => void
  projects: DashboardProject[]
}) {
  const statuses = useMemo(() => {
    const set = new Set(projects.map((p) => p.status).filter(Boolean))
    return ['all', 'unassigned', ...Array.from(set)]
  }, [projects])

  return (
    <div className="relative">
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <select
        className="metal-routing-toolbar-select pl-8"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter projects"
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status === 'all'
              ? 'All projects'
              : status === 'unassigned'
                ? 'Unassigned PDK'
                : status}
          </option>
        ))}
      </select>
    </div>
  )
}
