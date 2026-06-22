import { useEffect, useState } from 'react'
import type { CelebrationVariant } from '@components/employee/celebration/CelebrationParticles'
import { cn } from '@/utils/cn'
import { HELICOPTER_FLY_DURATION_MS, playHelicopterSound, stopHelicopterSound } from '@utils/helicopterSound'
import './celebration.css'

type LeaveHelicopterFlyoverProps = {
  active: boolean
  variant: CelebrationVariant
}

const BANNER_COPY: Record<CelebrationVariant, string> = {
  approved: 'Leave Approved',
  rejected: 'Leave Rejected',
}

export function LeaveHelicopterFlyover({ active, variant }: LeaveHelicopterFlyoverProps) {
  const [visible, setVisible] = useState(false)
  const isRejected = variant === 'rejected'

  useEffect(() => {
    if (!active) {
      setVisible(false)
      stopHelicopterSound()
      return undefined
    }

    setVisible(true)
    void playHelicopterSound(HELICOPTER_FLY_DURATION_MS)

    const hideTimer = window.setTimeout(() => {
      setVisible(false)
    }, HELICOPTER_FLY_DURATION_MS)

    return () => {
      window.clearTimeout(hideTimer)
      stopHelicopterSound()
    }
  }, [active])

  if (!visible) return null

  return (
    <div
      className={cn('leave-helicopter-flyover', isRejected && 'leave-helicopter-flyover--rejected')}
      aria-live="polite"
      aria-label={isRejected ? 'Leave rejected notice' : 'Leave approved celebration'}
    >
      <div
        className="leave-helicopter-flyover__craft"
        style={{ ['--helicopter-fly-duration' as string]: `${HELICOPTER_FLY_DURATION_MS}ms` }}
      >
        <svg
          className="leave-helicopter-flyover__svg"
          viewBox="0 0 220 92"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <ellipse cx="88" cy="58" rx="34" ry="18" fill="#2f6b4f" />
          <ellipse cx="88" cy="58" rx="28" ry="14" fill="#3d7a6a" />
          <rect x="104" y="48" width="34" height="16" rx="4" fill="#6ea88f" />
          <rect x="112" y="52" width="14" height="8" rx="2" fill="#d8f3dc" opacity="0.85" />
          <path d="M42 58 H18 V54 H42 Z" fill="#1f4f3c" />
          <path d="M18 58 H6 V50 H12 L18 54 Z" fill="#dc2626" />
          <circle cx="10" cy="52" r="2.5" fill="#fca5a5" />
          <g className="leave-helicopter-flyover__tail-rotor">
            <line x1="6" y1="50" x2="2" y2="46" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="6" y1="50" x2="2" y2="54" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <path d="M122 56 H168 L176 50 H186 L180 62 H168 Z" fill="#1b4332" />
          <circle cx="186" cy="56" r="3" fill="#94a3b8" />
          <path d="M70 66 C78 74 98 74 106 66" stroke="#14532d" strokeWidth="3" strokeLinecap="round" />
          <rect x="82" y="66" width="12" height="8" rx="2" fill="#334155" />
          <g className="leave-helicopter-flyover__main-rotor">
            <ellipse cx="88" cy="34" rx="54" ry="4.5" fill="#475569" opacity="0.9" />
            <ellipse cx="88" cy="34" rx="4.5" ry="54" fill="#475569" opacity="0.9" />
            <circle cx="88" cy="34" r="4" fill="#1e293b" />
          </g>
          <line
            className="leave-helicopter-flyover__banner-rope"
            x1="186"
            y1="58"
            x2="186"
            y2="82"
            stroke={isRejected ? '#991b1b' : '#78350f'}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        <div className="leave-helicopter-flyover__banner">
          <span
            className={cn(
              'leave-helicopter-flyover__tag',
              isRejected ? 'leave-helicopter-flyover__tag--rejected' : 'leave-helicopter-flyover__tag--approved',
            )}
          >
            {BANNER_COPY[variant]}
          </span>
        </div>
      </div>
    </div>
  )
}

/** @deprecated Use LeaveHelicopterFlyover */
export function LeaveApprovedHelicopter({ active }: { active: boolean }) {
  return <LeaveHelicopterFlyover active={active} variant="approved" />
}
