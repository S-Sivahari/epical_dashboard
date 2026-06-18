import { useCallback, useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '@/utils/cn'

const MAGNETIC_SPRING = { stiffness: 320, damping: 22, mass: 0.45 }

export function MagneticSurface({
  children,
  className,
  radius = 20,
  strength = 0.32,
  as: Component = 'div',
}: {
  children: ReactNode
  className?: string
  radius?: number
  strength?: number
  as?: 'div' | 'span'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const offsetX = useMotionValue(0)
  const offsetY = useMotionValue(0)
  const x = useSpring(offsetX, MAGNETIC_SPRING)
  const y = useSpring(offsetY, MAGNETIC_SPRING)

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const element = ref.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = event.clientX - centerX
      const dy = event.clientY - centerY
      const distance = Math.hypot(dx, dy)
      const influence = radius + Math.max(rect.width, rect.height) * 0.45

      if (distance < influence) {
        const pull = 1 - distance / influence
        offsetX.set(dx * pull * strength)
        offsetY.set(dy * pull * strength)
        return
      }

      offsetX.set(0)
      offsetY.set(0)
    },
    [offsetX, offsetY, radius, strength],
  )

  const onMouseLeave = useCallback(() => {
    offsetX.set(0)
    offsetY.set(0)
  }, [offsetX, offsetY])

  const MotionComponent = motion[Component]

  return (
    <MotionComponent
      ref={ref}
      className={cn('inline-flex', className)}
      style={{ x, y }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </MotionComponent>
  )
}

export function MagneticButton({
  children,
  className,
  radius = 20,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { radius?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const offsetX = useMotionValue(0)
  const offsetY = useMotionValue(0)
  const x = useSpring(offsetX, MAGNETIC_SPRING)
  const y = useSpring(offsetY, MAGNETIC_SPRING)

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLSpanElement>) => {
      const element = ref.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = event.clientX - centerX
      const dy = event.clientY - centerY
      const distance = Math.hypot(dx, dy)
      const influence = radius + Math.max(rect.width, rect.height) * 0.45

      if (distance < influence) {
        const pull = 1 - distance / influence
        offsetX.set(dx * pull * 0.32)
        offsetY.set(dy * pull * 0.32)
        return
      }

      offsetX.set(0)
      offsetY.set(0)
    },
    [offsetX, offsetY, radius],
  )

  const onMouseLeave = useCallback(() => {
    offsetX.set(0)
    offsetY.set(0)
  }, [offsetX, offsetY])

  return (
    <motion.span
      className="inline-flex"
      style={{ x, y }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <button type="button" className={className} {...props}>
        {children}
      </button>
    </motion.span>
  )
}
