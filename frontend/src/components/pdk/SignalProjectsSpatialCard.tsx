import type { ReactNode } from 'react'
import { motion, useMotionTemplate } from 'framer-motion'
import { useSpatialTilt } from '@/hooks/useSpatialTilt'
import { cn } from '@/utils/cn'

export function SignalProjectsSpatialCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const {
    ref,
    rotateXSpring,
    rotateYSpring,
    mouseXSpring,
    mouseYSpring,
    onMouseMove,
    onMouseLeave,
  } = useSpatialTilt(1.5)

  const glowBackground = useMotionTemplate`radial-gradient(circle 250px at ${mouseXSpring}px ${mouseYSpring}px, rgba(59, 130, 246, 0.07), transparent 72%)`

  return (
    <div className="metal-routing-spatial-viewport">
      <motion.section
        ref={ref}
        className={cn('metal-routing-spatial-card', className)}
        style={{
          rotateX: rotateXSpring,
          rotateY: rotateYSpring,
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <motion.div
          aria-hidden
          className="metal-routing-spatial-glow"
          style={{ background: glowBackground }}
        />
        <div className="metal-routing-spatial-card__content">{children}</div>
      </motion.section>
    </div>
  )
}
