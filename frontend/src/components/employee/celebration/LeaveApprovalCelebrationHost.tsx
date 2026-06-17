import { CelebrationParticles } from '@components/employee/celebration/CelebrationParticles'
import { LeaveApprovalNotification } from '@components/employee/celebration/LeaveApprovalNotification'
import { useLeaveApprovalCelebration } from '@hooks/useLeaveApprovalCelebration'

export function LeaveApprovalCelebrationHost() {
  const { activeCelebration, particlesActive, particleVariant, dismissCelebration } =
    useLeaveApprovalCelebration()

  return (
    <>
      <CelebrationParticles active={particlesActive} variant={particleVariant} />
      <LeaveApprovalNotification
        open={Boolean(activeCelebration)}
        variant={activeCelebration?.variant ?? 'approved'}
        title={activeCelebration?.title}
        message={activeCelebration?.message}
        onDismiss={dismissCelebration}
      />
    </>
  )
}
