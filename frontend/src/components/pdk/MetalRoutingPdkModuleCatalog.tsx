import { useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import * as Select from '@radix-ui/react-select'
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react'
import {
  MetalRoutingCardGridSkeleton,
  MetalRoutingEmptyState,
} from '@components/pdk/MetalRoutingSkeleton'
import { MetalRoutingViewToggle, type MetalRoutingViewMode } from '@components/pdk/MetalRoutingViewToggle'
import { Button } from '@components/ui/Button'
import { PdkListRowScales } from '@components/pdk/PdkListRowScales'
import type { PdkModule } from '@/types/pdkMetalRouting'
import { cn } from '@/utils/cn'
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

export function isRecentModule(module: PdkModule): boolean {
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

export function getPdkModuleNodeFilterLabel(node: string): string {
  return node === 'all' ? 'All nodes' : node
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
    return [
      'all',
      ...Array.from(nodes).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    ]
  }, [modules])

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className="metal-routing-toolbar-select metal-routing-signal-projects-filter__select metal-routing-signal-projects-filter__trigger"
        aria-label="Filter by technology node"
      >
        <Filter className="metal-routing-signal-projects-filter__icon" aria-hidden />
        <span className="metal-routing-signal-projects-filter__label">
          <Select.Value />
        </span>
        <ChevronDown className="metal-routing-signal-projects-filter__chevron" aria-hidden />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="metal-routing-signal-projects-filter__menu"
          position="popper"
          sideOffset={4}
          align="start"
        >
          <Select.Viewport className="metal-routing-signal-projects-filter__viewport">
            {nodeOptions.map((node) => (
              <Select.Item
                key={node}
                value={node}
                className="metal-routing-signal-projects-filter__item"
              >
                <Select.ItemText>{getPdkModuleNodeFilterLabel(node)}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name-asc', label: 'Sort by name (A–Z)' },
  { value: 'name-desc', label: 'Sort by name (Z–A)' },
  { value: 'node-asc', label: 'Sort by tech node' },
  { value: 'metals-desc', label: 'Sort by metal count' },
]

function PdkModuleSortSelect({
  value,
  onChange,
}: {
  value: SortKey
  onChange: (value: SortKey) => void
}) {
  return (
    <Select.Root value={value} onValueChange={(next) => onChange(next as SortKey)}>
      <Select.Trigger
        className="metal-routing-toolbar-select metal-routing-signal-projects-sort__select metal-routing-signal-projects-filter__trigger"
        aria-label="Sort modules"
      >
        <ArrowUpDown className="metal-routing-signal-projects-filter__icon" aria-hidden />
        <span className="metal-routing-signal-projects-filter__label">
          <Select.Value />
        </span>
        <ChevronDown className="metal-routing-signal-projects-filter__chevron" aria-hidden />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="metal-routing-signal-projects-filter__menu"
          position="popper"
          sideOffset={4}
          align="start"
        >
          <Select.Viewport className="metal-routing-signal-projects-filter__viewport">
            {SORT_OPTIONS.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="metal-routing-signal-projects-filter__item"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
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
  onEditModule,
  onDeleteModule,
  highlightedModuleId = null,
  onHighlightModule,
}: {
  modules: PdkModule[]
  loading?: boolean
  search: string
  nodeFilter: string
  onSearchChange: (value: string) => void
  onNodeFilterChange: (value: string) => void
  onOpenModule: (id: string) => void
  onEditModule?: (id: string) => void
  onDeleteModule?: (id: string) => void
  highlightedModuleId?: string | null
  onHighlightModule?: (id: string) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('name-asc')
  const [viewMode, setViewMode] = useState<MetalRoutingViewMode>('grid')
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
          <PdkModuleSortSelect value={sortKey} onChange={setSortKey} />
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
                <PdkModuleCard
                  key={mod._id}
                  module={mod}
                  isHighlighted={highlightedModuleId === mod._id}
                  onHighlight={() => onHighlightModule?.(mod._id)}
                  onOpen={() => onOpenModule(mod._id)}
                  onEdit={() => onEditModule?.(mod._id)}
                  onDelete={() => onDeleteModule?.(mod._id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="metal-routing-pdk-list">
            {pageItems.map((mod) => (
              <PdkModuleListRow
                key={mod._id}
                module={mod}
                isHighlighted={highlightedModuleId === mod._id}
                onHighlight={() => onHighlightModule?.(mod._id)}
                onOpen={() => onOpenModule(mod._id)}
                onEdit={() => onEditModule?.(mod._id)}
                onDelete={() => onDeleteModule?.(mod._id)}
              />
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
  const hue = stringToHue(seed)
  return {
    '--pdk-card-accent': theme.accent,
    '--pdk-card-icon-bg': theme.iconBg,
    '--pdk-card-icon-color': theme.iconColor,
    '--pdk-card-icon-bg-hover': `hsl(${hue} 68% 91%)`,
    '--pdk-card-icon-color-hover': `hsl(${hue} 44% 32%)`,
    borderColor: theme.border,
  } as CSSProperties
}

function PdkModuleTile({
  module,
  isHighlighted,
  onHighlight,
  onOpen,
  onEdit,
  onDelete,
  layout,
}: {
  module: PdkModule
  isHighlighted?: boolean
  onHighlight?: () => void
  onOpen: () => void
  onEdit?: () => void
  onDelete?: () => void
  layout: 'list' | 'grid'
}) {
  const seed = module._id || module.name
  const className = cn(
    'metal-routing-pdk-list-row metal-routing-pdk-list-row--colorful metal-routing-pdk-list-row--module',
    layout === 'grid' && 'metal-routing-pdk-module-grid-tile',
    isHighlighted && 'is-selected',
  )
  const sharedProps = {
    className,
    style: pdkModuleListRowStyle(seed),
    role: 'button' as const,
    tabIndex: 0,
    onClick: onHighlight,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onHighlight?.()
      }
    },
  }

  const content = (
    <>
      <PdkListRowScales />
      <span className="metal-routing-pdk-list-row__accent" aria-hidden />
      <span className="metal-routing-pdk-card__icon" aria-hidden>
        <Layers className="h-4 w-4" />
      </span>
      <p className="metal-routing-pdk-list-row__name metal-routing-pdk-list-row__name--inline">
        {module.name}
      </p>
      <div className="metal-routing-pdk-list-row__actions">
        {onEdit ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="metal-routing-pdk-list-row__action shrink-0"
            aria-label={`Edit ${module.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="metal-routing-pdk-list-row__action shrink-0 text-red-600 hover:text-red-700"
            aria-label={`Delete ${module.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="metal-routing-pdk-list-row__view shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          View
        </Button>
      </div>
    </>
  )

  if (layout === 'grid') {
    return <article {...sharedProps}>{content}</article>
  }

  return <div {...sharedProps}>{content}</div>
}

function PdkModuleCard({
  module,
  isHighlighted,
  onHighlight,
  onOpen,
  onEdit,
  onDelete,
}: {
  module: PdkModule
  isHighlighted?: boolean
  onHighlight?: () => void
  onOpen: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <PdkModuleTile
      module={module}
      isHighlighted={isHighlighted}
      onHighlight={onHighlight}
      onOpen={onOpen}
      onEdit={onEdit}
      onDelete={onDelete}
      layout="grid"
    />
  )
}

function PdkModuleListRow({
  module,
  isHighlighted,
  onHighlight,
  onOpen,
  onEdit,
  onDelete,
}: {
  module: PdkModule
  isHighlighted?: boolean
  onHighlight?: () => void
  onOpen: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <PdkModuleTile
      module={module}
      isHighlighted={isHighlighted}
      onHighlight={onHighlight}
      onOpen={onOpen}
      onEdit={onEdit}
      onDelete={onDelete}
      layout="list"
    />
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
