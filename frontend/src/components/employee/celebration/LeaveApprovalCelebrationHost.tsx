import { CelebrationParticles } from '@components/employee/celebration/CelebrationParticles'
import { LeaveApprovedHelicopter } from '@components/employee/celebration/LeaveApprovedHelicopter'
import { LeaveApprovalNotification } from '@components/employee/celebration/LeaveApprovalNotification'
import { useLeaveApprovalCelebration } from '@hooks/useLeaveApprovalCelebration'

export function LeaveApprovalCelebrationHost() {
  const { activeCelebration, particlesActive, particleVariant, dismissCelebration } =
    useLeaveApprovalCelebration()

  const isApproved = particleVariant === 'approved'

  return (
    <>
      {isApproved ? (
        <LeaveApprovedHelicopter active={particlesActive} />
      ) : (
        <CelebrationParticles active={particlesActive} variant={particleVariant} />
      )}
      <LeaveApprovalNotification
        open={Boolean(activeCelebration) && !isApproved}
        variant={activeCelebration?.variant ?? 'approved'}
        title={activeCelebration?.title}
        message={activeCelebration?.message}
        onDismiss={dismissCelebration}
      />
    </>
  )
}
