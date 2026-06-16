import { useEffect, useMemo } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { Briefcase, CircuitBoard, NotebookPen } from 'lucide-react'
import { ROUTES } from '@constants/routes'
import {
  clearProjectAnalysisSession,
  consumeProjectAnalysisAccess,
} from '@/utils/projectAnalysisAccess'
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
    label: 'Notes',
    icon: NotebookPen,
    end: false,
  },
] as const

export function ProjectAnalysisLayout() {
  const allowed = useMemo(() => consumeProjectAnalysisAccess(), [])

  useEffect(() => {
    return () => clearProjectAnalysisSession()
  }, [])

  if (!allowed) {
    return <Navigate to={ROUTES.TIMESHEET} replace />
  }

  return (
    <div className="project-analysis-layout flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="project-analysis-layout__header shrink-0">
        <div className="project-analysis-layout__brand">
          
          <div className="min-w-0">
            <p className="project-analysis-layout__brand-title">Project Analysis</p>
            
          </div>
        </div>

        <nav className="project-analysis-layout__tabs" aria-label="Project Analysis sections">
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
        </nav>
      </header>

      <div className="project-analysis-layout__content min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
