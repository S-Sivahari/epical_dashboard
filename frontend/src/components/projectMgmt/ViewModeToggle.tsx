import { LayoutGrid, Table2 } from 'lucide-react'
import { cn } from '@/utils/cn'

export type ViewMode = 'cards' | 'table'

export function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('cards')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
          mode === 'cards' ? 'bg-primary text-white' : 'text-muted hover:text-ink'
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Cards
      </button>
      <button
        type="button"
        onClick={() => onChange('table')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
          mode === 'table' ? 'bg-primary text-white' : 'text-muted hover:text-ink'
        )}
      >
        <Table2 className="h-3.5 w-3.5" />
        Table
      </button>
    </div>
  )
}
