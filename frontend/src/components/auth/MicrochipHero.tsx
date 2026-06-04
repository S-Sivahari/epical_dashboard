import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { APP_NAME, APP_SHORT_NAME } from '@/utils/constants'

const DARK_GREEN = '#14532d'
const DARK_GREEN_RGB = '20, 83, 45'

const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  angle: (i / 8) * 360,
  radius: 105 + (i % 3) * 22,
  size: 1.5 + (i % 2) * 0.5,
  duration: 8 + (i % 4) * 2,
}))

const SPARKS = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  x: 22 + i * 15,
  y: 18 + (i % 3) * 22,
  delay: i * 0.45,
}))

export function MicrochipHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springConfig = { stiffness: 120, damping: 20 }
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), springConfig)
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), springConfig)
  const glowX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-24, 24]), springConfig)
  const glowY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-24, 24]), springConfig)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
    },
    [mouseX, mouseY],
  )

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0)
    mouseY.set(0)
    setIsHovered(false)
  }, [mouseX, mouseY])

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="relative flex w-full max-w-lg flex-col items-center gap-8 px-4 text-center lg:items-start lg:text-left"
    >
      <div
        ref={containerRef}
        className="relative mx-auto flex h-[280px] w-[280px] items-center justify-center sm:h-[320px] sm:w-[320px] lg:mx-0"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{ perspective: '900px' }}
      >
        {/* Soft hover halo with light green tint */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            x: glowX,
            y: glowY,
            background:
              'radial-gradient(circle, rgba(20,83,45,0.14) 0%, rgba(255,255,255,0.35) 45%, transparent 68%)',
          }}
        />

        {/* Ambient pulse */}
        <motion.div
          className="pointer-events-none absolute inset-[-18%] rounded-full bg-[#14532d]/12 blur-3xl"
          animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0.38, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Orbit dots — muted green */}
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="pointer-events-none absolute rounded-full bg-[#14532d]/60"
            style={{ width: p.size, height: p.size }}
            animate={{ rotate: [p.angle, p.angle + 360] }}
            transition={{ duration: p.duration, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute rounded-full bg-[#14532d]/85"
              style={{ width: p.size, height: p.size, left: p.radius, top: 0 }}
            />
          </motion.div>
        ))}

        <motion.div
          className="relative"
          style={{ width: 180, height: 180, rotateX, rotateY, transformStyle: 'preserve-3d' }}
          animate={{
            y: [0, -10, 0],
            rotateZ: [0, 1.5, 0, -1.5, 0],
          }}
          transition={{
            y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            rotateZ: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
          }}
          whileHover={{ scale: 1.04 }}
        >
          <div
            className="absolute left-1/2 top-full h-7 w-36 -translate-x-1/2 rounded-full bg-slate-500/18 blur-xl"
            style={{ transform: 'translateZ(-40px)' }}
          />

          {/* Outer frame */}
          <motion.div
            className="absolute inset-0 rounded-xl border border-[#14532d]/45 bg-[#eef1f5]/90"
            style={{
              width: 180,
              height: 180,
              transform: 'translateZ(0px)',
              boxShadow:
                `0 10px 28px rgba(71,85,105,0.12), 0 0 20px rgba(${DARK_GREEN_RGB},0.14), inset 0 0 0 1px rgba(255,255,255,0.65)`,
            }}
            animate={{ rotateZ: [0, 360] }}
            transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
          >
            {[0, 90, 180, 270].map((deg) => (
              <div
                key={deg}
                className="absolute h-2.5 w-2.5 border border-[#14532d]/60 bg-[#e8f0ea]"
                style={{
                  top: deg === 0 || deg === 180 ? (deg === 0 ? -5 : 'auto') : '50%',
                  bottom: deg === 180 ? -5 : 'auto',
                  left: deg === 270 || deg === 90 ? (deg === 270 ? -5 : 'auto') : '50%',
                  right: deg === 90 ? -5 : 'auto',
                  transform: `translate(${deg === 90 || deg === 270 ? '0' : '-50%'}, ${deg === 0 || deg === 180 ? '0' : '-50%'})`,
                }}
              />
            ))}
          </motion.div>

          {/* Middle layer — blueprint traces */}
          <motion.div
            className="absolute rounded-lg border border-[#14532d]/40 bg-[#f8fafc]/95"
            style={{
              width: 140,
              height: 140,
              left: 20,
              top: 20,
              transform: 'translateZ(18px)',
              boxShadow: `0 6px 20px rgba(71,85,105,0.08), 0 0 16px rgba(${DARK_GREEN_RGB},0.12)`,
            }}
            animate={{ rotateZ: [0, -360] }}
            transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
          >
            <svg className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" viewBox="0 0 100 100">
              <motion.path
                d="M10 50 H40 V20 H60 V50 H90 M50 50 V80"
                stroke={DARK_GREEN}
                strokeWidth="0.85"
                fill="none"
                opacity="0.7"
                strokeDasharray="5 7"
                animate={{ strokeDashoffset: [0, -24] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
              <path
                d="M20 20 H80 V80 H20 Z"
                stroke="#94a3b8"
                strokeWidth="0.5"
                fill="none"
                opacity="0.45"
              />
            </svg>
          </motion.div>

          {/* Inner core */}
          <motion.div
            className="absolute flex items-center justify-center rounded-md border border-[#14532d]/50 bg-gradient-to-br from-[#f8fafc] to-[#e8f0ea]"
            style={{
              width: 80,
              height: 80,
              left: 50,
              top: 50,
              transform: 'translateZ(36px)',
            }}
            animate={{
              boxShadow: isHovered
                ? [
                    `0 8px 24px rgba(71,85,105,0.14), 0 0 22px rgba(${DARK_GREEN_RGB},0.22), inset 0 0 0 1px rgba(255,255,255,0.8)`,
                    `0 12px 28px rgba(71,85,105,0.16), 0 0 28px rgba(${DARK_GREEN_RGB},0.3), inset 0 0 0 1px rgba(255,255,255,0.9)`,
                    `0 8px 24px rgba(71,85,105,0.14), 0 0 22px rgba(${DARK_GREEN_RGB},0.22), inset 0 0 0 1px rgba(255,255,255,0.8)`,
                  ]
                : [
                    `0 6px 18px rgba(71,85,105,0.1), 0 0 14px rgba(${DARK_GREEN_RGB},0.16), inset 0 0 0 1px rgba(255,255,255,0.75)`,
                    `0 10px 22px rgba(71,85,105,0.12), 0 0 20px rgba(${DARK_GREEN_RGB},0.24), inset 0 0 0 1px rgba(255,255,255,0.85)`,
                    `0 6px 18px rgba(71,85,105,0.1), 0 0 14px rgba(${DARK_GREEN_RGB},0.16), inset 0 0 0 1px rgba(255,255,255,0.75)`,
                  ],
            }}
            transition={{ duration: isHovered ? 1.5 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.div
              className="absolute inset-0 rounded-md border border-[#14532d]/45"
              animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="h-5 w-5 rounded-sm bg-[#14532d]"
              animate={{ opacity: [0.72, 1, 0.72], scale: [0.94, 1.04, 0.94] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: `0 0 10px rgba(${DARK_GREEN_RGB},0.4)` }}
            />
          </motion.div>

          {/* Top accent square */}
          <motion.div
            className="absolute rounded border border-[#14532d]/35 bg-[#f1f5f9]/90"
            style={{
              width: 48,
              height: 48,
              left: 66,
              top: 66,
              transform: 'translateZ(50px)',
              boxShadow: '0 4px 12px rgba(71,85,105,0.08)',
            }}
            animate={{ rotateZ: [0, 90, 180, 270, 360] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        {/* Line sparks — same tone as bg geometry */}
        {SPARKS.map((s) => (
          <motion.div
            key={s.id}
            className="pointer-events-none absolute h-px w-10 bg-gradient-to-r from-transparent via-[#14532d]/65 to-transparent"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            animate={{ opacity: [0, 0.65, 0], scaleX: [0.6, 1.3, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="space-y-4">
        <h1 className="font-display text-[2.025rem] font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-[2.7rem] lg:text-[3.375rem]">
          {APP_SHORT_NAME}
          <motion.span
            className="mt-2 block h-1 w-[3.6rem] rounded-full bg-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.5)]"
            animate={{ width: ['3.6rem', '4.5rem', '3.6rem'], opacity: [0.6, 0.9, 0.6] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </h1>
        <p className="max-w-md text-[0.9rem] leading-relaxed text-slate-200 drop-shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:text-[1.0125rem] lg:text-[1.125rem]">
          {APP_NAME}
        </p>
      </div>
    </motion.div>
  )
}
