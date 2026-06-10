import { useMemo, useState } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  MoreHorizontal,
  Search,
} from 'lucide-react'
import {
  MetalRoutingCardGridSkeleton,
  MetalRoutingEmptyState,
} from '@components/pdk/MetalRoutingSkeleton'
import { MetalRoutingViewToggle, type MetalRoutingViewMode } from '@components/pdk/MetalRoutingViewToggle'
import type { PdkModule } from '@/types/pdkMetalRouting'

const PAGE_SIZE = 9

type SortKey = 'name-asc' | 'name-desc' | 'node-asc' | 'metals-desc'

function isRecentModule(module: PdkModule): boolean {
  if (!module.createdAt) return false
  const created = new Date(module.createdAt)
  if (Number.isNaN(created.getTime())) return false
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  return created.getTime() >= thirtyDaysAgo
}

export function MetalRoutingPdkModuleCatalog({
  modules,
  loading,
  onOpenModule,
}: {
  modules: PdkModule[]
  loading?: boolean
  onOpenModule: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [nodeFilter, setNodeFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('name-asc')
  const [viewMode, setViewMode] = useState<MetalRoutingViewMode>('grid')
  const [page, setPage] = useState(1)

  const nodeOptions = useMemo(() => {
    const nodes = new Set<string>()
    modules.forEach((mod) => {
      const node = mod.technologyNode?.trim()
      nodes.add(node ? node : 'N/A')
    })
    return ['all', ...Array.from(nodes).sort()]
  }, [modules])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let items = modules.filter((mod) => {
      const nodeLabel = mod.technologyNode?.trim() || 'N/A'
      const matchesNode = nodeFilter === 'all' || nodeLabel === nodeFilter
      if (!matchesNode) return false
      if (!query) return true
      return (
        mod.name.toLowerCase().includes(query)
        || nodeLabel.toLowerCase().includes(query)
        || mod.notes?.toLowerCase().includes(query)
      )
    })

    items = [...items].sort((a, b) => {
      switch (sortKey) {
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'node-asc':
          return (a.technologyNode || 'N/A').localeCompare(b.technologyNode || 'N/A')
        case 'metals-desc':
          return b.metals.length - a.metals.length
        default:
          return a.name.localeCompare(b.name)
      }
    })

    return items
  }, [modules, search, nodeFilter, sortKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length)

  return (
    <section className="metal-routing-overview-card metal-routing-pdk-catalog">
      <div className="metal-routing-pdk-toolbar">
        <label className="metal-routing-search-field metal-routing-pdk-search">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="Search modules..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </label>
        <div className="metal-routing-pdk-toolbar-actions">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <select
              className="metal-routing-toolbar-select pl-8"
              value={nodeFilter}
              onChange={(e) => {
                setNodeFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Filter by technology node"
            >
              {nodeOptions.map((node) => (
                <option key={node} value={node}>
                  {node === 'all' ? 'All nodes' : node}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <select
              className="metal-routing-toolbar-select pl-8"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Sort modules"
            >
              <option value="name-asc">Sort by name (A–Z)</option>
              <option value="name-desc">Sort by name (Z–A)</option>
              <option value="node-asc">Sort by tech node</option>
              <option value="metals-desc">Sort by metal count</option>
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

      {loading ? (
        <MetalRoutingCardGridSkeleton count={6} />
      ) : pageItems.length === 0 ? (
        <MetalRoutingEmptyState
          icon={Layers}
          title="No modules found"
          description="Try a different search term or filter."
        />
      ) : viewMode === 'grid' ? (
        <div className="metal-routing-pdk-grid">
          {pageItems.map((mod) => (
            <PdkModuleCard key={mod._id} module={mod} onOpen={() => onOpenModule(mod._id)} />
          ))}
        </div>
      ) : (
        <div className="metal-routing-pdk-list">
          {pageItems.map((mod) => (
            <PdkModuleListRow key={mod._id} module={mod} onOpen={() => onOpenModule(mod._id)} />
          ))}
        </div>
      )}

      <footer className="metal-routing-overview-footer">
        <p className="text-sm text-muted">
          Showing {rangeStart} to {rangeEnd} of {filtered.length} module{filtered.length === 1 ? '' : 's'}
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
          <button type="button" className="metal-routing-page-btn is-active" aria-current="page">
            {currentPage}
          </button>
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

function PdkModuleCard({ module, onOpen }: { module: PdkModule; onOpen: () => void }) {
  const nodeLabel = module.technologyNode?.trim() || 'N/A'
  const metalLabel = `${module.metals.length} metal${module.metals.length === 1 ? '' : 's'}`

  return (
    <button type="button" className="metal-routing-pdk-card" onClick={onOpen}>
      <span className="metal-routing-pdk-card__menu" aria-hidden>
        <MoreHorizontal className="h-4 w-4" />
      </span>
      <div className="metal-routing-pdk-card__body">
        <span className="metal-routing-pdk-card__icon" aria-hidden>
          <Layers className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{module.name}</p>
        </div>
      </div>
      <div className="metal-routing-pdk-card__chips">
        <span className="metal-routing-meta-chip">{nodeLabel}</span>
        <span className="metal-routing-meta-chip">{metalLabel}</span>
      </div>
      <div className="metal-routing-pdk-card__footer">
        <span className="text-sm text-muted">View module details</span>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </div>
    </button>
  )
}

function PdkModuleListRow({ module, onOpen }: { module: PdkModule; onOpen: () => void }) {
  const nodeLabel = module.technologyNode?.trim() || 'N/A'

  return (
    <button type="button" className="metal-routing-pdk-list-row" onClick={onOpen}>
      <span className="metal-routing-pdk-card__icon" aria-hidden>
        <Layers className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-semibold text-ink">{module.name}</p>
        <p className="truncate text-sm text-muted">{nodeLabel}</p>
      </div>
      <span className="hidden text-sm text-muted sm:inline">
        {module.metals.length} metal type{module.metals.length === 1 ? '' : 's'}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
    </button>
  )
}

export function buildPdkModuleStats(modules: PdkModule[]) {
  const totalMetalTypes = modules.reduce((sum, mod) => sum + mod.metals.length, 0)
  const modulesWithNa = modules.filter((mod) => !mod.technologyNode?.trim()).length
  const recentlyAdded = modules.filter(isRecentModule).length

  return { totalMetalTypes, modulesWithNa, recentlyAdded }
}
