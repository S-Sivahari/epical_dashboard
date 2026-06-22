import { Navigate, useLocation } from 'react-router-dom'
import { ROUTES } from '@constants/routes'

/** Preserve bookmarks for /employee/projects/* under project-analysis. */
export function EmployeeProjectsLegacyRedirect() {
  const { pathname, search, hash } = useLocation()
  const suffix = pathname.replace(/^\/employee\/projects\/?/, '')

  if (!suffix || suffix === 'my-projects') {
    return <Navigate to={`${ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECTS}${search}${hash}`} replace />
  }

  if (suffix === 'reviews') {
    return <Navigate to={`${ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECTS}${search}${hash}`} replace />
  }

  const cellMatch = suffix.match(/^([^/]+)\/cells\/([^/]+)$/)
  if (cellMatch) {
    const [, projectId, cellId] = cellMatch
    return (
      <Navigate
        to={`${ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECT_CELL(projectId, cellId)}${search}${hash}`}
        replace
      />
    )
  }

  const projectMatch = suffix.match(/^([^/]+)$/)
  if (projectMatch) {
    const [, projectId] = projectMatch
    return (
      <Navigate
        to={`${ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECT_WORKSPACE(projectId)}${search}${hash}`}
        replace
      />
    )
  }

  return <Navigate to={`${ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECTS}${search}${hash}`} replace />
}
