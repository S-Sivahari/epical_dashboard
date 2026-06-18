import { useCallback, useRef, type MouseEvent } from 'react'
import { useMotionValue, useSpring } from 'framer-motion'

const TILT_SPRING = { stiffness: 120, damping: 22, mass: 0.6 }
const GLOW_SPRING = { stiffness: 80, damping: 20, mass: 0.5 }

export function useSpatialTilt(maxTiltDeg = 1.5) {
  const ref = useRef<HTMLElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const rotateXSpring = useSpring(rotateX, TILT_SPRING)
  const rotateYSpring = useSpring(rotateY, TILT_SPRING)
  const mouseXSpring = useSpring(mouseX, GLOW_SPRING)
  const mouseYSpring = useSpring(mouseY, GLOW_SPRING)

  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const element = ref.current
      if (!element) return

      const rect = element.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const px = x / rect.width - 0.5
      const py = y / rect.height - 0.5

      rotateY.set(px * maxTiltDeg * 2)
      rotateX.set(-py * maxTiltDeg * 2)
      mouseX.set(x)
      mouseY.set(y)
    },
    [maxTiltDeg, mouseX, mouseY, rotateX, rotateY],
  )

  const onMouseLeave = useCallback(() => {
    rotateX.set(0)
    rotateY.set(0)
    mouseX.set(-9999)
    mouseY.set(-9999)
  }, [mouseX, mouseY, rotateX, rotateY])

  return {
    ref,
    rotateXSpring,
    rotateYSpring,
    mouseXSpring,
    mouseYSpring,
    onMouseMove,
    onMouseLeave,
  }
}
