import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { CircuitBoard, CircleHelp, FolderKanban, LayoutGrid, Layers } from 'lucide-react'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'

const NAV = [
  { to: 'dashboard', label: 'Dashboard', icon: LayoutGrid, end: false },
  { to: 'pdk-modules', label: 'PDK Modules', icon: Layers, end: false },
  { to: 'cell-routing', label: 'Cell Routing', icon: FolderKanban, end: true },
] as const

export function MetalRoutingLayout({ basePath, children }: { basePath: string; children: ReactNode }) {
  const helpHref = basePath.startsWith('/admin') ? ROUTES.HELP : `${basePath}/dashboard`

  return (
    <div className="metal-routing-layout">
      <aside className="metal-routing-sidebar" aria-label="Metal Routing navigation">
        <div className="metal-routing-sidebar__brand">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CircuitBoard className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-ink">Metal Routing</p>
            <p className="truncate text-[11px] leading-tight text-muted">PDK &amp; cell analysis</p>
          </div>
        </div>
        <nav className="metal-routing-sidebar__nav">
          <p className="metal-routing-sidebar__section-label">Navigation</p>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={`${basePath}/${to}`}
              end={end}
              className={({ isActive }) =>
                cn('metal-routing-sidebar__link', isActive && 'is-active')
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="metal-routing-sidebar__help">
          <CircleHelp className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Need help?</p>
            <a href={helpHref} className="text-xs text-primary hover:underline">
              View documentation
            </a>
          </div>
        </div>
      </aside>
      <div className="metal-routing-content">{children}</div>
    </div>
  )
}
