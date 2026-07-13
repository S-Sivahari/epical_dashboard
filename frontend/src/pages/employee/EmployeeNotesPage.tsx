import { Navigate } from 'react-router-dom'
import { PageWrapper } from '@components/layout/PageWrapper'
import { ROUTES } from '@/constants/routes'
import { useEmployeeNotesAccess } from '@/hooks/useEmployeeNotesAccess'
import { AdminNotesPage } from '@/pages/admin/Notes/AdminNotesPage'

export function EmployeeNotesPage() {
  const { access, loading } = useEmployeeNotesAccess()
  const allowed = access?.canAccessToday ?? false

  if (loading) {
    return (
      <PageWrapper fillViewport className="admin-hub-page-wrap relative z-10 max-w-none !px-0 !py-0 font-body">
        <div className="flex min-h-[12rem] items-center justify-center text-sm text-slate-500">
          Loading Daily Notes…
        </div>
      </PageWrapper>
    )
  }

  if (!allowed) {
    return <Navigate to={ROUTES.EMPLOYEE_PROJECT_ANALYSIS_PROJECTS} replace />
  }

  return <AdminNotesPage variant="employee" />
}

export default EmployeeNotesPage
