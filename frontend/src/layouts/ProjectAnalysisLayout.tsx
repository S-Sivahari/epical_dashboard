import { useMemo } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Briefcase, CircuitBoard, NotebookPen } from 'lucide-react'
import { ROUTES } from '@constants/routes'
import { consumeProjectAnalysisAccess } from '@/utils/projectAnalysisAccess'
import { cn } from '@/utils/cn'

const TABS = [
  {
    to: `${ROUTES.PROJECT_ANALYSIS}/projects`,
    label: 'Projects',
    icon: Briefcase,
    end: true,
  },
  {
    to: `${ROUTES.PROJECT_ANALYSIS}/signal-analysis`,
    label: 'Signal Analysis',
    icon: CircuitBoard,
    end: false,
  },
  {
    to: ROUTES.PROJECT_ANALYSIS_NOTES,
    label: 'Daily Notes',
    icon: NotebookPen,
    end: false,
  },
] as const

function activeSectionLabel(pathname: string): string {
  if (pathname.startsWith(ROUTES.PROJECT_ANALYSIS_NOTES)) return 'Daily Notes'
  if (pathname.startsWith(ROUTES.PROJECT_ANALYSIS_SIGNAL)) return 'Signal Analysis'
  return 'Projects'
}

export function ProjectAnalysisLayout() {
  const { pathname } = useLocation()
  const allowed = useMemo(() => consumeProjectAnalysisAccess(), [])
  const sectionLabel = activeSectionLabel(pathname)

  if (!allowed) {
    return <Navigate to={ROUTES.TIMESHEET} replace />
  }

  return (
    <div className="project-analysis-layout flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="project-analysis-layout__header shrink-0">
        <p className="project-analysis-layout__brand-title">Project Management</p>

        <nav
          className="project-analysis-layout__nav-cluster"
          aria-label="Project Management sections"
        >
          <p className="project-analysis-layout__section-title">{sectionLabel}</p>
          <div className="project-analysis-layout__tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn('project-analysis-layout__tab', isActive && 'is-active')
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span>{tab.label}</span>
                </NavLink>
              )
            })}
          </div>
        </nav>
      </header>

      <div className="project-analysis-layout__content min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
