import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { APP_NAME, APP_SHORT_NAME } from '@/utils/constants'

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  angle: (i / 12) * 360,
  radius: 110 + (i % 3) * 25,
  size: 2 + (i % 2),
  duration: 6 + (i % 4) * 2,
}))

const SPARKS = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  x: 20 + i * 14,
  y: 15 + (i % 3) * 20,
  delay: i * 0.4,
}))

export function MicrochipHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springConfig = { stiffness: 120, damping: 20 }
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), springConfig)
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-12, 12]), springConfig)
  const glowX = useSpring(useTransform(mouseX, [-0.5, 0.5], [-30, 30]), springConfig)
  const glowY = useSpring(useTransform(mouseY, [-0.5, 0.5], [-30, 30]), springConfig)

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
      {/* 3D Chip container */}
      <div
        ref={containerRef}
        className="relative mx-auto flex h-[280px] w-[280px] items-center justify-center sm:h-[320px] sm:w-[320px] lg:mx-0"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{ perspective: '900px' }}
      >
        {/* Cursor-reactive glow */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            x: glowX,
            y: glowY,
            background: 'radial-gradient(circle, rgba(0,200,83,0.25) 0%, transparent 65%)',
          }}
        />

        {/* Outer ambient glow pulse */}
        <motion.div
          className="pointer-events-none absolute inset-[-20%] rounded-full bg-[#00C853]/10 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Orbiting particles */}
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="pointer-events-none absolute rounded-full bg-[#00C853]"
            style={{
              width: p.size,
              height: p.size,
              boxShadow: '0 0 6px #00C853, 0 0 12px rgba(0,200,83,0.5)',
            }}
            animate={{
              rotate: [p.angle, p.angle + 360],
            }}
            transition={{ duration: p.duration, repeat: Infinity, ease: 'linear' }}
          >
            <motion.div
              className="absolute rounded-full bg-[#00C853]"
              style={{
                width: p.size,
                height: p.size,
                left: p.radius,
                top: 0,
                boxShadow: '0 0 8px #00C853',
              }}
            />
          </motion.div>
        ))}

        {/* 3D Chip */}
        <motion.div
          className="relative"
          style={{ width: 180, height: 180, rotateX, rotateY, transformStyle: 'preserve-3d' }}
          animate={{
            y: [0, -12, 0],
            rotateZ: [0, 2, 0, -2, 0],
          }}
          transition={{
            y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            rotateZ: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
          }}
          whileHover={{ scale: 1.05 }}
        >
          {/* Shadow layer */}
          <div
            className="absolute left-1/2 top-full h-8 w-40 -translate-x-1/2 rounded-full bg-black/40 blur-xl"
            style={{ transform: 'translateZ(-40px)' }}
          />

          {/* Outer circuit frame — layer 1 */}
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-[#00C853]/40"
            style={{
              width: 180,
              height: 180,
              transform: 'translateZ(0px)',
              boxShadow: '0 0 30px rgba(0,200,83,0.15), inset 0 0 20px rgba(0,200,83,0.05)',
            }}
            animate={{ rotateZ: [0, 360] }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          >
            {/* Corner pins */}
            {[0, 90, 180, 270].map((deg) => (
              <div
                key={deg}
                className="absolute h-3 w-3 bg-[#00C853]/60"
                style={{
                  top: deg === 0 || deg === 180 ? (deg === 0 ? -6 : 'auto') : '50%',
                  bottom: deg === 180 ? -6 : 'auto',
                  left: deg === 270 || deg === 90 ? (deg === 270 ? -6 : 'auto') : '50%',
                  right: deg === 90 ? -6 : 'auto',
                  transform: `translate(${deg === 90 || deg === 270 ? '0' : '-50%'}, ${deg === 0 || deg === 180 ? '0' : '-50%'})`,
                  boxShadow: '0 0 8px #00C853',
                }}
              />
            ))}
          </motion.div>

          {/* Middle layer — rotating square */}
          <motion.div
            className="absolute rounded-lg border border-[#00C853]/30 bg-[#0a1a0f]/80"
            style={{
              width: 140,
              height: 140,
              left: 20,
              top: 20,
              transform: 'translateZ(20px)',
              boxShadow: '0 0 40px rgba(0,200,83,0.1)',
            }}
            animate={{ rotateZ: [0, -360] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            {/* Circuit traces */}
            <svg className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" viewBox="0 0 100 100">
              <motion.path
                d="M10 50 H40 V20 H60 V50 H90 M50 50 V80"
                stroke="#00C853"
                strokeWidth="0.8"
                fill="none"
                opacity="0.5"
                strokeDasharray="4 6"
                animate={{ strokeDashoffset: [0, -20] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            </svg>
          </motion.div>

          {/* Inner core — glowing center */}
          <motion.div
            className="absolute flex items-center justify-center rounded-md border border-[#00C853]/50 bg-gradient-to-br from-[#0d2818] to-[#051208]"
            style={{
              width: 80,
              height: 80,
              left: 50,
              top: 50,
              transform: 'translateZ(40px)',
            }}
            animate={{
              boxShadow: isHovered
                ? [
                    '0 0 50px rgba(0,200,83,0.5), inset 0 0 25px rgba(0,200,83,0.2)',
                    '0 0 60px rgba(0,200,83,0.6), inset 0 0 30px rgba(0,200,83,0.25)',
                    '0 0 50px rgba(0,200,83,0.5), inset 0 0 25px rgba(0,200,83,0.2)',
                  ]
                : [
                    '0 0 30px rgba(0,200,83,0.25), inset 0 0 15px rgba(0,200,83,0.1)',
                    '0 0 50px rgba(0,200,83,0.45), inset 0 0 25px rgba(0,200,83,0.2)',
                    '0 0 30px rgba(0,200,83,0.25), inset 0 0 15px rgba(0,200,83,0.1)',
                  ],
            }}
            transition={{ duration: isHovered ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Data pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-md border border-[#00C853]/60"
              animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="h-6 w-6 rounded-sm bg-[#00C853]"
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ boxShadow: '0 0 20px #00C853, 0 0 40px rgba(0,200,83,0.6)' }}
            />
          </motion.div>

          {/* Top layer accent square */}
          <motion.div
            className="absolute rounded border border-white/10 bg-white/[0.03]"
            style={{
              width: 50,
              height: 50,
              left: 65,
              top: 65,
              transform: 'translateZ(55px)',
            }}
            animate={{ rotateZ: [0, 90, 180, 270, 360] }}
            transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        {/* Circuit sparks */}
        {SPARKS.map((s) => (
          <motion.div
            key={s.id}
            className="pointer-events-none absolute h-px w-8 bg-gradient-to-r from-transparent via-[#00C853] to-transparent"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            animate={{ opacity: [0, 1, 0], scaleX: [0.5, 1.5, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, delay: s.delay, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Hero text */}
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {APP_SHORT_NAME}
          <motion.span
            className="mt-2 block h-1 w-16 rounded-full bg-[#00C853]"
            animate={{ width: ['4rem', '5rem', '4rem'], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-white/45 lg:text-base">{APP_NAME}</p>
        <p className="hidden text-xs tracking-widest text-[#00C853]/60 lg:block">
          SECURE · ENTERPRISE · CONNECTED
        </p>
      </div>
    </motion.div>
  )
}
