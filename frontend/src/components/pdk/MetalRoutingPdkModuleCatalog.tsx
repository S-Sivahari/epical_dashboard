import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Search,
} from 'lucide-react'
import {
  MetalRoutingCardGridSkeleton,
  MetalRoutingEmptyState,
} from '@components/pdk/MetalRoutingSkeleton'
import { MetalRoutingViewToggle, type MetalRoutingViewMode } from '@components/pdk/MetalRoutingViewToggle'
import type { PdkModule } from '@/types/pdkMetalRouting'
import { metalRoutingListRowStyle } from '@/utils/metalRoutingCardTheme'
import { stringToHue, stringToHueColor } from '@/utils/stringColor'

const PAGE_SIZE = 9

type SortKey = 'name-asc' | 'name-desc' | 'node-asc' | 'metals-desc'

export function getPdkModuleNodeLabel(module: PdkModule): string {
  const node = module.technologyNode?.trim()
  return node || 'N/A'
}

export function hasValidTechnologyNode(module: PdkModule): boolean {
  const node = module.technologyNode?.trim()
  if (!node) return false
  return node.toLowerCase() !== 'n/a'
}

export function filterValidPdkModules(modules: PdkModule[]): PdkModule[] {
  return modules.filter(hasValidTechnologyNode)
}

function isRecentModule(module: PdkModule): boolean {
  if (!module.createdAt) return false
  const created = new Date(module.createdAt)
  if (Number.isNaN(created.getTime())) return false
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  return created.getTime() >= thirtyDaysAgo
}

export function getPdkModuleCardTheme(seed: string) {
  const hue = stringToHue(seed)
  return {
    accent: stringToHueColor(seed),
    bgStart: `hsl(${hue} 82% 96%)`,
    border: `hsl(${hue} 52% 84%)`,
    iconBg: `hsl(${hue} 72% 92%)`,
    iconColor: `hsl(${hue} 48% 36%)`,
    chipNodeBg: `hsl(${hue} 68% 92%)`,
    chipNodeText: `hsl(${hue} 42% 32%)`,
    chipMetalsBg: `hsl(${hue} 55% 88%)`,
    chipMetalsText: `hsl(${hue} 38% 28%)`,
  }
}

function sparklineBars(seed: string, count = 7): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973
  }
  return Array.from({ length: count }, (_, i) => {
    const v = (hash + i * 137) % 100
    return 28 + (v % 72)
  })
}

export function PdkModuleNodeFilter({
  value,
  onChange,
  modules,
}: {
  value: string
  onChange: (value: string) => void
  modules: PdkModule[]
}) {
  const nodeOptions = useMemo(() => {
    const nodes = new Set<string>()
    modules.forEach((mod) => nodes.add(getPdkModuleNodeLabel(mod)))
    return ['all', ...Array.from(nodes).sort()]
  }, [modules])

  return (
    <div className="relative">
      <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <select
        className="metal-routing-toolbar-select pl-8"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter by technology node"
      >
        {nodeOptions.map((node) => (
          <option key={node} value={node}>
            {node === 'all' ? 'All nodes' : node}
          </option>
        ))}
      </select>
    </div>
  )
}

export function MetalRoutingPdkModuleCatalog({
  modules,
  loading,
  search,
  nodeFilter,
  onSearchChange,
  onNodeFilterChange,
  onOpenModule,
}: {
  modules: PdkModule[]
  loading?: boolean
  search: string
  nodeFilter: string
  onSearchChange: (value: string) => void
  onNodeFilterChange: (value: string) => void
  onOpenModule: (id: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('name-asc')
  const [viewMode, setViewMode] = useState<MetalRoutingViewMode>('list')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [search, nodeFilter, viewMode])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let items = modules.filter((mod) => {
      const nodeLabel = getPdkModuleNodeLabel(mod)
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
          return getPdkModuleNodeLabel(a).localeCompare(getPdkModuleNodeLabel(b))
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
    <section className="metal-routing-overview-card metal-routing-pdk-catalog metal-routing-cell-routing-table metal-routing-pdk-catalog-panel">
      <div className="metal-routing-overview-toolbar metal-routing-pdk-modules-toolbar">
        <h2 className="metal-routing-section-title">Modules</h2>
        <div className="metal-routing-overview-controls metal-routing-pdk-modules-toolbar__controls">
          <label className="metal-routing-search-field metal-routing-pdk-modules-toolbar__search">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <input
              type="search"
              placeholder="Search modules..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </label>
          <PdkModuleNodeFilter
            value={nodeFilter}
            onChange={onNodeFilterChange}
            modules={modules}
          />
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

      <div className="metal-routing-pdk-catalog-body">
        {loading ? (
          <MetalRoutingCardGridSkeleton count={6} />
        ) : pageItems.length === 0 ? (
          <MetalRoutingEmptyState
            icon={Layers}
            title="No modules found"
            description={
              modules.length === 0
                ? 'Create or import a PDK module to get started.'
                : 'Try a different search term or filter.'
            }
          />
        ) : viewMode === 'grid' ? (
          <div className="metal-routing-project-grid-wrap">
            <div className="metal-routing-pdk-grid">
              {pageItems.map((mod) => (
                <PdkModuleCard key={mod._id} module={mod} onOpen={() => onOpenModule(mod._id)} />
              ))}
            </div>
          </div>
        ) : (
          <div className="metal-routing-pdk-list">
            {pageItems.map((mod) => (
              <PdkModuleListRow key={mod._id} module={mod} onOpen={() => onOpenModule(mod._id)} />
            ))}
          </div>
        )}
      </div>

      <footer className="metal-routing-overview-footer metal-routing-cell-routing-footer metal-routing-pdk-catalog-footer">
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

function pdkModuleListRowStyle(seed: string): CSSProperties {
  const theme = getPdkModuleCardTheme(seed)
  return {
    ...metalRoutingListRowStyle(seed),
    '--pdk-chip-node-bg': theme.chipNodeBg,
    '--pdk-chip-node-text': theme.chipNodeText,
    '--pdk-chip-metals-bg': theme.chipMetalsBg,
    '--pdk-chip-metals-text': theme.chipMetalsText,
    borderColor: theme.border,
  } as CSSProperties
}

function moduleCardStyle(seed: string): CSSProperties {
  const theme = getPdkModuleCardTheme(seed)
  return {
    '--pdk-card-accent': theme.accent,
    '--pdk-card-icon-bg': theme.iconBg,
    '--pdk-card-icon-color': theme.iconColor,
    '--pdk-chip-node-bg': theme.chipNodeBg,
    '--pdk-chip-node-text': theme.chipNodeText,
    '--pdk-chip-metals-bg': theme.chipMetalsBg,
    '--pdk-chip-metals-text': theme.chipMetalsText,
    background: `linear-gradient(135deg, ${theme.bgStart} 0%, #ffffff 78%)`,
    borderColor: theme.border,
  } as CSSProperties
}

function ModuleSparkline({ moduleId, accent }: { moduleId: string; accent: string }) {
  const bars = sparklineBars(moduleId)
  const max = Math.max(...bars, 1)

  return (
    <svg className="metal-routing-pdk-card__sparkline" viewBox="0 0 72 36" aria-hidden>
      {bars.map((value, i) => {
        const barHeight = (value / max) * 28
        const x = i * 10 + 2
        const y = 32 - barHeight
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={6}
            height={barHeight}
            rx={2}
            fill={accent}
            opacity={0.35 + (value / max) * 0.45}
          />
        )
      })}
    </svg>
  )
}

function PdkModuleCard({ module, onOpen }: { module: PdkModule; onOpen: () => void }) {
  const seed = module._id || module.name
  const theme = getPdkModuleCardTheme(seed)
  const nodeLabel = getPdkModuleNodeLabel(module)
  const metalLabel = `${module.metals.length} metal${module.metals.length === 1 ? '' : 's'}`
  const isNaNode = nodeLabel === 'N/A'

  return (
    <button
      type="button"
      className="metal-routing-pdk-card metal-routing-pdk-card--colorful"
      onClick={onOpen}
      style={moduleCardStyle(seed)}
    >
      <span className="metal-routing-pdk-card__accent" aria-hidden />
      <div className="metal-routing-pdk-card__body">
        <span className="metal-routing-pdk-card__icon" aria-hidden>
          <Layers className="h-4 w-4" />
        </span>
        <div className="metal-routing-pdk-card__main">
          <p className="metal-routing-pdk-card__title">{module.name}</p>
          <ModuleSparkline moduleId={module._id} accent={theme.accent} />
        </div>
      </div>
      <div className="metal-routing-pdk-card__chips">
        <span
          className={
            isNaNode
              ? 'metal-routing-meta-chip metal-routing-meta-chip--na'
              : 'metal-routing-meta-chip metal-routing-meta-chip--node-themed'
          }
        >
          {nodeLabel}
        </span>
        <span className="metal-routing-meta-chip metal-routing-meta-chip--metals-themed">{metalLabel}</span>
      </div>
      <div className="metal-routing-pdk-card__footer">
        <span>View module details</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </div>
    </button>
  )
}

function PdkModuleListRow({ module, onOpen }: { module: PdkModule; onOpen: () => void }) {
  const seed = module._id || module.name
  const nodeLabel = getPdkModuleNodeLabel(module)
  const isNaNode = nodeLabel === 'N/A'

  return (
    <button
      type="button"
      className="metal-routing-pdk-list-row metal-routing-pdk-list-row--colorful"
      onClick={onOpen}
      style={pdkModuleListRowStyle(seed)}
    >
      <span className="metal-routing-pdk-list-row__accent" aria-hidden />
      <span className="metal-routing-pdk-card__icon" aria-hidden>
        <Layers className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="metal-routing-pdk-list-row__name">{module.name}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span
            className={
              isNaNode
                ? 'metal-routing-meta-chip metal-routing-meta-chip--na'
                : 'metal-routing-meta-chip metal-routing-meta-chip--node-themed'
            }
          >
            {nodeLabel}
          </span>
          <span className="metal-routing-meta-chip metal-routing-meta-chip--metals-themed">
            {module.metals.length} metal{module.metals.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
      <ChevronRight className="metal-routing-pdk-list-row__chevron h-4 w-4 shrink-0" aria-hidden />
    </button>
  )
}

export function buildPdkModuleStats(modules: PdkModule[]) {
  const totalMetalTypes = modules.reduce((sum, mod) => sum + mod.metals.length, 0)
  const modulesWithNa = modules.filter((mod) => getPdkModuleNodeLabel(mod) === 'N/A').length
  const recentlyAdded = modules.filter(isRecentModule).length

  return {
    totalModules: modules.length,
    totalMetalTypes,
    modulesWithNa,
    recentlyAdded,
  }
}
