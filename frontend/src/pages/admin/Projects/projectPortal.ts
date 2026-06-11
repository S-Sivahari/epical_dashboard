import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'

export type ProjectPortal = 'admin' | 'employee'

export function getProjectPortalFromPath(pathname: string): ProjectPortal {
  return pathname.startsWith('/employee/projects') ? 'employee' : 'admin'
}

export function useProjectPortal() {
  const { pathname } = useLocation()

  return useMemo(() => {
    const portal = getProjectPortalFromPath(pathname)
    const isEmployee = portal === 'employee'

    return {
      portal,
      isEmployee,
      projectsListPath: isEmployee ? ROUTES.EMPLOYEE_PROJECTS : ROUTES.PROJECTS,
      projectWorkspacePath: isEmployee ? ROUTES.EMPLOYEE_PROJECT_WORKSPACE : ROUTES.PROJECT_WORKSPACE,
      projectCellPath: isEmployee ? ROUTES.EMPLOYEE_PROJECT_CELL : ROUTES.PROJECT_CELL,
    }
  }, [pathname])
}
