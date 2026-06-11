import { NavLink, Outlet, useParams } from 'react-router-dom'

import { Activity, ArrowLeft, CircuitBoard, Layers } from 'lucide-react'

import { cn } from '@/utils/cn'



const NAV = [

  { to: 'pdk-selection', label: 'PDK Selection', icon: Layers },

  { to: 'signal-analysis', label: 'Signal Analysis', icon: Activity, end: false },

] as const



export function ProjectSignalAnalysisLayout({ basePath }: { basePath: string }) {

  const { projectId = '' } = useParams()



  return (

    <div className="metal-routing-layout">

      <aside className="metal-routing-sidebar" aria-label="Signal Analysis navigation">

        <div className="metal-routing-sidebar__brand">

          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">

            <CircuitBoard className="h-4 w-4" />

          </span>

          <div className="min-w-0">

            <p className="truncate text-sm font-semibold leading-tight text-ink">Signal Analysis</p>

            <p className="truncate text-[11px] leading-tight text-muted">Project workspace</p>

          </div>

        </div>

        <nav className="metal-routing-sidebar__nav">

          <NavLink

            to={basePath}

            end

            className="metal-routing-sidebar__link mb-1"

          >

            <ArrowLeft className="h-4 w-4 shrink-0 opacity-80" aria-hidden />

            <span className="truncate">All projects</span>

          </NavLink>

          <p className="metal-routing-sidebar__section-label">Project</p>

          {NAV.map(({ to, label, icon: Icon, end }) => (

            <NavLink

              key={to}

              to={`${basePath}/projects/${projectId}/${to}`}

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

      </aside>

      <div className="metal-routing-content"><Outlet /></div>

    </div>

  )

}


