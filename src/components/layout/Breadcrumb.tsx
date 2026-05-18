import { ChevronRight, Home } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex flex-wrap items-center gap-1 text-sm text-muted', className)}>
      <Link to="/dashboard" className="inline-flex items-center gap-1 hover:text-ink">
        <Home className="h-4 w-4" />
        Home
      </Link>
      {items.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-border" />
          {c.to ? (
            <Link to={c.to} className="hover:text-ink">
              {c.label}
            </Link>
          ) : (
            <span className="font-medium text-ink">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
