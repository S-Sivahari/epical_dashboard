import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageWrapper } from '@components/layout/PageWrapper'
import { getNotesAccess } from '@/services/notesService'
import { AdminNotesPage } from '@/pages/admin/Notes/AdminNotesPage'

export function EmployeeNotesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    void getNotesAccess()
      .then((access) => setAllowed(access.canAccessToday))
      .catch(() => setAllowed(false))
  }, [])

  if (allowed === null) {
    return (
      <PageWrapper fillViewport className="admin-hub-page-wrap relative z-10 max-w-none !px-0 !py-0 font-body">
        <div className="flex min-h-[12rem] items-center justify-center text-sm text-slate-500">
          Loading Daily Notes…
        </div>
      </PageWrapper>
    )
  }

  if (!allowed) {
    return <Navigate to="/employee" replace />
  }

  return <AdminNotesPage variant="employee" />
}

export default EmployeeNotesPage
