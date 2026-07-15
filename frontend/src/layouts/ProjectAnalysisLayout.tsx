import { useMemo } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Briefcase, CircuitBoard, NotebookPen } from 'lucide-react'
import { CompanyLogo } from '@components/auth/CompanyLogo'
import { ROUTES } from '@constants/routes'
import { useAuthStore } from '@store/authStore'
import { useEmployeeNotesAccess } from '@hooks/useEmployeeNotesAccess'
import { canAccessProjectAnalysis } from '@/utils/projectAnalysisAccess'
import { cn } from '@/utils/cn'

function resolveProjectAnalysisBase(pathname: string): string {
  if (pathname.startsWith(ROUTES.EMPLOYEE_PROJECT_ANALYSIS)) {
    return ROUTES.EMPLOYEE_PROJECT_ANALYSIS
  }
  return ROUTES.PROJECT_ANALYSIS
}

export function ProjectAnalysisLayout() {
  const { pathname } = useLocation()
  const isHydrated = useAuthStore((s) => s.isHydrated)
  const role = useAuthStore((s) => s.role)
  const allowed = useMemo(() => canAccessProjectAnalysis(role), [role])
  const { showNotesNav } = useEmployeeNotesAccess()
  const base = resolveProjectAnalysisBase(pathname)
  const isEmployeePortal = base === ROUTES.EMPLOYEE_PROJECT_ANALYSIS

  const tabs = useMemo(() => {
    const signalPath =
      base === ROUTES.EMPLOYEE_PROJECT_ANALYSIS
        ? ROUTES.EMPLOYEE_PROJECT_ANALYSIS_SIGNAL
        : ROUTES.PROJECT_ANALYSIS_SIGNAL

    const items = [
      {
        to: `${base}/projects`,
        label: 'Projects',
        icon: Briefcase,
        end: true,
      },
      {
        to: signalPath,
        label: 'Signal Analysis',
        icon: CircuitBoard,
        end: false,
      },
    ]

    if (!isEmployeePortal) {
      items.push({
        to: ROUTES.PROJECT_ANALYSIS_NOTES,
        label: 'Daily Notes',
        icon: NotebookPen,
        end: false,
      })
    } else if (showNotesNav) {
      items.push({
        to: ROUTES.EMPLOYEE_PROJECT_ANALYSIS_NOTES,
        label: 'Daily Notes',
        icon: NotebookPen,
        end: false,
      })
    }

    return items
  }, [base, isEmployeePortal, showNotesNav])

  if (!isHydrated) {
    return null
  }

  if (!allowed) {
    return <Navigate to={role === 'employee' ? '/employee/timesheet' : ROUTES.DASHBOARD} replace />
  }

  return (
    <div className="project-analysis-layout flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="project-analysis-layout__header pm-cmd-bar shrink-0">
        <div className="pm-cmd-bar__decor" aria-hidden>
          <span className="pm-cmd-bar__facets pm-cmd-bar__facets--right" />
          <span className="pm-cmd-bar__grid pm-cmd-bar__grid--right" />
        </div>

        <div className="pm-cmd-bar__slashes" aria-hidden>
          <span className="pm-cmd-bar__slash pm-cmd-bar__slash--forest" />
          <span className="pm-cmd-bar__slash pm-cmd-bar__slash--mint" />
          <span className="pm-cmd-bar__slash-accent pm-cmd-bar__slash-accent--top" />
          <span className="pm-cmd-bar__slash-accent pm-cmd-bar__slash-accent--bottom" />
        </div>

        <div className="pm-cmd-bar__brand project-analysis-layout__brand">
          <div className="pm-cmd-bar__logo-slot">
            <CompanyLogo
              className="project-analysis-layout__brand-logo pm-cmd-bar__logo"
              alt="Epical Layouts"
            />
          </div>
          <p className="project-analysis-layout__brand-title">Project Management</p>
        </div>

        <div className="pm-cmd-bar__rail" aria-hidden />

        <nav
          className="pm-cmd-bar__tail project-analysis-layout__nav-cluster"
          aria-label="Project Management sections"
        >
          <div className="project-analysis-layout__tabs">
            {tabs.map((tab) => {
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
