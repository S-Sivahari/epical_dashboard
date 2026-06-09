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
    <div className="metal-routing-layout flex min-h-0 flex-1 overflow-hidden">
      <aside className="metal-routing-sidebar flex w-60 shrink-0 flex-col border-r border-border bg-white">
        <div className="shrink-0 border-b border-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CircuitBoard className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-ink">Metal Routing</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
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
      <div className="metal-routing-content flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f8faf8]">
        {children}
      </div>
    </div>
  )
}
