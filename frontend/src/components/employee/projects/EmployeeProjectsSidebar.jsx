import { NavLink, useLocation } from 'react-router-dom'
import { ClipboardCheck, FolderKanban, LayoutDashboard } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'

const NAV_ITEMS = [
  { id: 'dashboard', to: '/employee/projects', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { id: 'projects', to: '/employee/projects/my-projects', label: 'My Projects', icon: FolderKanban },
  { id: 'reviews', to: '/employee/projects/reviews', label: 'Requested Reviews', icon: ClipboardCheck },
]

function isProjectDetailPath(pathname) {
  const section = pathname.split('/')[3]
  return Boolean(section && section !== 'my-projects' && section !== 'reviews')
}

export function EmployeeProjectsSidebar({ pendingReviewCount = 0 }) {
  const location = useLocation()
  const onProjectDetail = isProjectDetailPath(location.pathname)

  return (
    <aside className="emp-wf-projects-sidebar" aria-label="Projects navigation">
      <div className="emp-wf-projects-sidebar-head">
        <p className="emp-wf-projects-sidebar-eyebrow">Workspace</p>
        <h2 className="emp-wf-projects-sidebar-title">Projects</h2>
      </div>

      <nav className="emp-wf-projects-sidebar-nav">
        {NAV_ITEMS.map(({ id, to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'emp-wf-projects-sidebar-link',
                (isActive || (id === 'projects' && onProjectDetail)) && 'is-active',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="emp-wf-projects-sidebar-link-label">{label}</span>
            {id === 'reviews' && pendingReviewCount > 0 ? (
              <span className="emp-wf-projects-sidebar-badge">{pendingReviewCount}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
