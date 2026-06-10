import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/utils/cn'

export type MetalRoutingViewMode = 'grid' | 'list'

export function MetalRoutingViewToggle({
  value,
  onChange,
}: {
  value: MetalRoutingViewMode
  onChange: (mode: MetalRoutingViewMode) => void
}) {
  return (
    <div className="metal-routing-view-toggle" role="group" aria-label="View mode">
      <button
        type="button"
        className={cn(value === 'grid' && 'is-active')}
        onClick={() => onChange('grid')}
        aria-label="Card view"
        aria-pressed={value === 'grid'}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(value === 'list' && 'is-active')}
        onClick={() => onChange('list')}
        aria-label="List view"
        aria-pressed={value === 'list'}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  )
}
