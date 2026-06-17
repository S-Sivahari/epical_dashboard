import { AppLayout } from '@components/employee/layout/AppLayout'
import { LeaveApprovalCelebrationHost } from '@components/employee/celebration/LeaveApprovalCelebrationHost'
import { AppToastProvider } from '@components/employee/shared/ToastProvider'
import { useNotificationRouteSync } from '@hooks/useNotificationRouteSync'

export function EmployeeLayout() {
  useNotificationRouteSync()

  return (
    <AppToastProvider>
      <LeaveApprovalCelebrationHost />
      <AppLayout />
    </AppToastProvider>
  )
}
