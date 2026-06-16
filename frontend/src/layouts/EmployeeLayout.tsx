import { AppLayout } from '@components/employee/layout/AppLayout'
import { AppToastProvider } from '@components/employee/shared/ToastProvider'
import { useNotificationRouteSync } from '@hooks/useNotificationRouteSync'

export function EmployeeLayout() {
  useNotificationRouteSync()

  return (
    <AppToastProvider>
      <AppLayout />
    </AppToastProvider>
  )
}
