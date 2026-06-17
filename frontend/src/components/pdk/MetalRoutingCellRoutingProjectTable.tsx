import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  MetalRoutingCardGridSkeleton,
  MetalRoutingEmptyState,
} from '@components/pdk/MetalRoutingSkeleton'
import {
  MetalRoutingProjectCards,
  MetalRoutingProjectListRows,
} from '@components/pdk/MetalRoutingProjectCards'
import { MetalRoutingViewToggle, type MetalRoutingViewMode } from '@components/pdk/MetalRoutingViewToggle'
import { SignalAnalysisProjectRows } from '@components/pdk/SignalAnalysisProjectRows'
import type { DashboardProject } from '@/types/pdkMetalRouting'
import {
  cellRoutingStatusFilterLabel,
  isProjectPdkAssigned,
  matchesCellRoutingProjectSearch,
  matchesCellRoutingStatusFilter,
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
  hideTechnology,
  hideToolbarTitle,
  pdkModulesHref,
  layoutVariant = 'default',
  onSearchChange,
  onStatusFilterChange,
  onOpenRouting,
}: {
  projects: DashboardProject[]
  loading?: boolean
  search: string
  statusFilter: string
  hideTechnology?: boolean
  hideToolbarTitle?: boolean
  pdkModulesHref?: string
  layoutVariant?: 'default' | 'premium'
  onSearchChange: (value: string) => void
  onStatusFilterChange: (value: string) => void
  onOpenRouting: (projectId: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('name-asc')
  const [viewMode, setViewMode] = useState<MetalRoutingViewMode>('list')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10)

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, viewMode, sortKey])

  const filtered = useMemo(() => {
    let items = projects.filter((project) => {
      return (
        matchesCellRoutingStatusFilter(project, statusFilter)
        && matchesCellRoutingProjectSearch(project, search, hideTechnology)
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
  }, [projects, search, statusFilter, sortKey, hideTechnology])

  const effectivePageSize = viewMode === 'grid' ? GRID_PAGE_SIZE : pageSize
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize))

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1
  const rangeEnd = Math.min(currentPage * effectivePageSize, filtered.length)

  const isPremium = layoutVariant === 'premium'

  return (
    <section
      className={cn(
        'metal-routing-overview-card metal-routing-cell-routing-table metal-routing-signal-projects-card',
        isPremium && 'signal-analysis-panel',
      )}
    >
      <div
        className={cn(
          'metal-routing-signal-projects-toolbar metal-routing-overview-toolbar metal-routing-pdk-modules-toolbar',
          isPremium && 'signal-analysis-panel__command',
        )}
      >
        {!hideToolbarTitle && !isPremium ? (
          <h2 className="metal-routing-signal-projects-toolbar__title">Projects</h2>
        ) : null}
        <label
          className={cn(
            'metal-routing-search-field metal-routing-signal-projects-toolbar__search',
            isPremium && 'signal-analysis-panel__search',
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
        <div
          className={cn(
            'metal-routing-signal-projects-toolbar__controls metal-routing-overview-controls metal-routing-pdk-modules-toolbar__controls',
            isPremium && 'signal-analysis-panel__controls',
          )}
        >
          {pdkModulesHref ? (
            <Link
              to={pdkModulesHref}
              className="metal-routing-signal-projects-header__cta metal-routing-pdk-modules-cta shrink-0"
            >
              <Layers className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              PDK Modules
            </Link>
          ) : null}
          <CellRoutingStatusFilter
            value={statusFilter}
            onChange={onStatusFilterChange}
            projects={projects}
          />
          <div className="metal-routing-signal-projects-sort">
            <ArrowUpDown className="metal-routing-signal-projects-sort__icon" aria-hidden />
            <select
              className="metal-routing-toolbar-select metal-routing-signal-projects-sort__select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort projects"
            >
              <option value="name-asc">Sort by name (A–Z)</option>
              <option value="name-desc">Sort by name (Z–A)</option>
              <option value="updated-desc">Sort by recently updated</option>
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

      <div
        className={cn(
          'metal-routing-cell-routing-body',
          isPremium && 'signal-analysis-panel__body',
        )}
      >
        {loading ? (
          isPremium ? (
            <SignalAnalysisProjectRows
              projects={[]}
              loading
              hideTechnology={hideTechnology}
              onOpenRouting={onOpenRouting}
            />
          ) : (
            <MetalRoutingCardGridSkeleton count={6} />
          )
        ) : pageItems.length === 0 ? (
          <MetalRoutingEmptyState
            title="No projects found"
            description="Try adjusting your search or filter criteria."
          />
        ) : viewMode === 'grid' ? (
          <div className="metal-routing-project-grid-wrap">
            <MetalRoutingProjectCards
              variant="cell-routing"
              projects={pageItems}
              startIndex={(currentPage - 1) * effectivePageSize}
              hideTechnology={hideTechnology}
              onOpenRouting={onOpenRouting}
            />
          </div>
        ) : isPremium ? (
          <SignalAnalysisProjectRows
            projects={pageItems}
            startIndex={(currentPage - 1) * effectivePageSize}
            hideTechnology={hideTechnology}
            onOpenRouting={onOpenRouting}
          />
        ) : (
          <MetalRoutingProjectListRows
            projects={pageItems}
            startIndex={(currentPage - 1) * effectivePageSize}
            hideTechnology={hideTechnology}
            onOpenRouting={onOpenRouting}
          />
        )}
      </div>

      <footer
        className={cn(
          'metal-routing-overview-footer metal-routing-cell-routing-footer metal-routing-signal-projects-footer',
          isPremium && 'signal-analysis-panel__footer',
        )}
      >
        <p className="metal-routing-signal-projects-footer__count">
          Showing {rangeStart} to {rangeEnd} of {filtered.length} project
          {filtered.length === 1 ? '' : 's'}
        </p>

        <div className="metal-routing-signal-projects-pagination">
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

        {viewMode === 'list' ? (
          <label className="metal-routing-page-size metal-routing-signal-projects-footer__size">
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
    const statusSet = new Set<string>()
    projects.forEach((project) => {
      if (!isProjectPdkAssigned(project)) return
      const status = project.status?.trim()
      if (status) statusSet.add(status)
    })
    return ['all', 'assigned', 'unassigned', ...Array.from(statusSet).sort((a, b) => a.localeCompare(b))]
  }, [projects])

  return (
    <div className="metal-routing-signal-projects-filter relative">
      <Filter className="metal-routing-signal-projects-filter__icon" aria-hidden />
      <select
        className="metal-routing-toolbar-select metal-routing-signal-projects-filter__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter projects"
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {cellRoutingStatusFilterLabel(status)}
          </option>
        ))}
      </select>
    </div>
  )
}
