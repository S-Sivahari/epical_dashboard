import { CelebrationParticles } from '@components/employee/celebration/CelebrationParticles'
import { LeaveApprovalNotification } from '@components/employee/celebration/LeaveApprovalNotification'
import { useLeaveApprovalCelebration } from '@hooks/useLeaveApprovalCelebration'

export function LeaveApprovalCelebrationHost() {
  const { activeCelebration, particlesActive, dismissCelebration } = useLeaveApprovalCelebration()

  return (
    <>
      <CelebrationParticles active={particlesActive} />
      <LeaveApprovalNotification
        open={Boolean(activeCelebration)}
        title={activeCelebration?.title}
        message={activeCelebration?.message}
        onDismiss={dismissCelebration}
      />
    </>
  )
}
