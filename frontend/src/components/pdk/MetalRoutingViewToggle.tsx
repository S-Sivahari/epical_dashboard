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
  const toggleView = () => {
    onChange(value === 'grid' ? 'list' : 'grid')
  }

  return (
    <div className="metal-routing-view-toggle" role="group" aria-label="View mode">
      <button
        type="button"
        className={cn(value === 'grid' && 'is-active', value !== 'grid' && 'is-inactive')}
        onClick={value === 'grid' ? toggleView : undefined}
        aria-label="Card view"
        aria-pressed={value === 'grid'}
        tabIndex={value === 'grid' ? 0 : -1}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(value === 'list' && 'is-active', value !== 'list' && 'is-inactive')}
        onClick={value === 'list' ? toggleView : undefined}
        aria-label="List view"
        aria-pressed={value === 'list'}
        tabIndex={value === 'list' ? 0 : -1}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  )
}
