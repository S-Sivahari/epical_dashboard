import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { CircuitBoard, FolderKanban, LayoutGrid, Layers } from 'lucide-react'
import { cn } from '@/utils/cn'

const NAV = [
  { to: 'dashboard', label: 'Dashboard', icon: LayoutGrid, end: false },
  { to: 'pdk-modules', label: 'PDK Modules', icon: Layers, end: false },
  { to: 'cell-routing', label: 'Cell Routing', icon: FolderKanban, end: true },
] as const

export function MetalRoutingLayout({ basePath, children }: { basePath: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <CircuitBoard className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-ink">Metal Routing</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={`${basePath}/${to}`}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-ui',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted hover:bg-surface hover:text-ink',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
