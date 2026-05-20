import { AppLayout } from '@components/employee/layout/AppLayout'
import { AppToastProvider } from '@components/employee/shared/ToastProvider'

export function EmployeeLayout() {
  return (
    <AppToastProvider>
      <AppLayout />
    </AppToastProvider>
  )
}
