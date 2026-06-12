import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'

export type ProjectPortal = 'admin' | 'employee'

export function isProjectAnalysisAdminPath(pathname: string): boolean {
  return pathname.startsWith(ROUTES.PROJECT_ANALYSIS)
}

export function getProjectPortalFromPath(pathname: string): ProjectPortal {
  return pathname.startsWith('/employee/projects') ? 'employee' : 'admin'
}

export function useProjectPortal() {
  const { pathname } = useLocation()

  return useMemo(() => {
    const portal = getProjectPortalFromPath(pathname)
    const isEmployee = portal === 'employee'
    const inProjectAnalysis = !isEmployee && isProjectAnalysisAdminPath(pathname)

    return {
      portal,
      isEmployee,
      inProjectAnalysis,
      projectsListPath: isEmployee
        ? ROUTES.EMPLOYEE_PROJECTS
        : inProjectAnalysis
          ? ROUTES.PROJECT_ANALYSIS_PROJECTS
          : ROUTES.PROJECTS,
      projectWorkspacePath: isEmployee
        ? ROUTES.EMPLOYEE_PROJECT_WORKSPACE
        : inProjectAnalysis
          ? ROUTES.PROJECT_ANALYSIS_PROJECT_WORKSPACE
          : ROUTES.PROJECT_WORKSPACE,
      projectCellPath: isEmployee
        ? ROUTES.EMPLOYEE_PROJECT_CELL
        : inProjectAnalysis
          ? ROUTES.PROJECT_ANALYSIS_PROJECT_CELL
          : ROUTES.PROJECT_CELL,
    }
  }, [pathname])
}
