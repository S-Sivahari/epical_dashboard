import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

/** Matches the 3D microchip neon green palette */
const NEON = '#00C853'
const NEON_BRIGHT = '#00e676'
const NEON_GLOW = 'rgba(0, 200, 83,'
const NEON_BRIGHT_GLOW = 'rgba(0, 230, 118,'

const INTERACTIVE_SELECTOR =
  'button, input, a, textarea, select, .login-card-shell, .login-input, .login-link-glow, .login-btn-glow, .login-btn-secondary'

export function CursorGlow() {
  const [active, setActive] = useState(false)
  const [hovering, setHovering] = useState(false)
  const lastPos = useRef({ x: 0, y: 0, t: Date.now() })

  const cursorX = useMotionValue(-200)
  const cursorY = useMotionValue(-200)
  const speed = useMotionValue(0)
  const hoverMul = useMotionValue(1)

  const springFast = { stiffness: 280, damping: 28, mass: 0.35 }
  const springTrail = { stiffness: 120, damping: 22, mass: 0.6 }
  const springSlow = { stiffness: 60, damping: 18, mass: 0.9 }

  const orbX = useSpring(cursorX, springFast)
  const orbY = useSpring(cursorY, springFast)
  const trailX = useSpring(cursorX, springTrail)
  const trailY = useSpring(cursorY, springTrail)
  const ghostX = useSpring(cursorX, springSlow)
  const ghostY = useSpring(cursorY, springSlow)

  const velocityScale = useSpring(useTransform(speed, [0, 15, 40], [1, 1.12, 1.35]), {
    stiffness: 200,
    damping: 20,
  })
  const finalScale = useTransform([velocityScale, hoverMul], ([v, h]) => (v as number) * (h as number))

  useEffect(() => {
    hoverMul.set(hovering ? 1.4 : 1)
  }, [hovering, hoverMul])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = Date.now()
      const dt = Math.max(now - lastPos.current.t, 1)
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      speed.set(dist / dt)

      cursorX.set(e.clientX)
      cursorY.set(e.clientY)
      lastPos.current = { x: e.clientX, y: e.clientY, t: now }
      setActive(true)

      const target = document.elementFromPoint(e.clientX, e.clientY)
      setHovering(!!target?.closest(INTERACTIVE_SELECTOR))
    }

    const onLeave = () => setActive(false)

    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
    }
  }, [cursorX, cursorY, speed])

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden="true">
      {/* Far ghost trail */}
      <motion.div
        className="absolute rounded-full"
        animate={{ opacity: active ? (hovering ? 0.55 : 0.35) : 0 }}
        transition={{ duration: 0.35 }}
        style={{
          x: ghostX,
          y: ghostY,
          width: 360,
          height: 360,
          marginLeft: -180,
          marginTop: -180,
          background: `radial-gradient(circle, ${NEON_GLOW}0.06) 0%, ${NEON_GLOW}0.02) 50%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />

      {/* Mid trail bloom */}
      <motion.div
        className="absolute rounded-full"
        animate={{ opacity: active ? (hovering ? 0.75 : 0.5) : 0 }}
        transition={{ duration: 0.25 }}
        style={{
          x: trailX,
          y: trailY,
          width: 200,
          height: 200,
          marginLeft: -100,
          marginTop: -100,
          background: `radial-gradient(circle, ${NEON_GLOW}0.14) 0%, ${NEON_BRIGHT_GLOW}0.06) 45%, transparent 68%)`,
          filter: 'blur(35px)',
        }}
      />

      {/* Primary cursor orb — acts as the visible pointer */}
      <motion.div
        className="absolute rounded-full"
        animate={{
          opacity: active ? 1 : 0,
          width: hovering ? 28 : 22,
          height: hovering ? 28 : 22,
          marginLeft: hovering ? -14 : -11,
          marginTop: hovering ? -14 : -11,
        }}
        transition={{ duration: 0.15, width: { duration: 0.2 }, height: { duration: 0.2 } }}
        style={{
          x: orbX,
          y: orbY,
          scale: finalScale,
          background: `radial-gradient(circle, ${NEON_BRIGHT} 0%, ${NEON} 55%, rgba(0,168,68,0.6) 100%)`,
          boxShadow: hovering
            ? `0 0 20px ${NEON}, 0 0 45px ${NEON_GLOW}0.7), 0 0 80px ${NEON_GLOW}0.35)`
            : `0 0 14px ${NEON}, 0 0 30px ${NEON_GLOW}0.55), 0 0 55px ${NEON_GLOW}0.2)`,
          filter: 'blur(0.5px)',
        }}
      />

      {/* Inner bright core */}
      <motion.div
        className="absolute rounded-full bg-white"
        animate={{ opacity: active ? (hovering ? 0.9 : 0.7) : 0 }}
        transition={{ duration: 0.15 }}
        style={{
          x: orbX,
          y: orbY,
          width: 8,
          height: 8,
          marginLeft: -4,
          marginTop: -4,
          boxShadow: `0 0 10px ${NEON_BRIGHT}, 0 0 20px ${NEON}`,
        }}
      />
    </div>
  )
}
