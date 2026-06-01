import { motion, useTransform, type MotionValue } from 'framer-motion'

type RingSpec = {
  id: string
  size: number
  tiltX: number
  tiltY: number
  duration: number
  reverse?: boolean
  opacity: number
  stroke: number
  dashed?: boolean
  depth: number
  pulseDelay: number
}

const CHIP_RINGS: RingSpec[] = [
  { id: 'r1', size: 300, tiltX: 74, tiltY: 14, duration: 42, opacity: 0.2, stroke: 1.5, depth: -90, pulseDelay: 0 },
  { id: 'r2', size: 260, tiltX: 66, tiltY: -16, duration: 30, reverse: true, opacity: 0.16, stroke: 1, dashed: true, depth: -45, pulseDelay: 0.6 },
  { id: 'r3', size: 220, tiltX: 80, tiltY: 6, duration: 24, opacity: 0.26, stroke: 2, depth: 25, pulseDelay: 1.2 },
  { id: 'r4', size: 340, tiltX: 70, tiltY: -10, duration: 56, reverse: true, opacity: 0.11, stroke: 1, depth: -130, pulseDelay: 0.3 },
]

const STAGE_RINGS: RingSpec[] = [
  { id: 's1', size: 1.05, tiltX: 68, tiltY: 0, duration: 64, opacity: 0.14, stroke: 1.2, depth: 0, pulseDelay: 0 },
  { id: 's2', size: 0.9, tiltX: 72, tiltY: 22, duration: 48, reverse: true, opacity: 0.1, stroke: 1, dashed: true, depth: 0, pulseDelay: 0.8 },
  { id: 's3', size: 1.14, tiltX: 62, tiltY: -14, duration: 72, opacity: 0.08, stroke: 0.8, depth: 0, pulseDelay: 1.4 },
]

function RingLayer({ spec, spaceGlow }: { spec: RingSpec; spaceGlow: MotionValue<number> }) {
  const resolvedSize = spec.size
  const glowOpacity = useTransform(spaceGlow, (g) => spec.opacity + g * 0.14)
  const pulseScale = useTransform(spaceGlow, (g) => 1 + g * 0.04)

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width: resolvedSize,
        height: resolvedSize * 0.38,
        marginLeft: -resolvedSize / 2,
        marginTop: -(resolvedSize * 0.38) / 2,
        transformStyle: 'preserve-3d',
        rotateX: spec.tiltX,
        rotateY: spec.tiltY,
        translateZ: spec.depth,
        opacity: glowOpacity,
        scale: pulseScale,
      }}
      animate={{ rotateZ: spec.reverse ? [360, 0] : [0, 360] }}
      transition={{ duration: spec.duration, repeat: Infinity, ease: 'linear' }}
    >
      <div
        className="absolute inset-0 rounded-[50%]"
        style={{
          border: `${spec.stroke}px ${spec.dashed ? 'dashed' : 'solid'} rgba(0,200,83,${spec.opacity + 0.12})`,
          boxShadow: `0 0 18px rgba(0,200,83,0.15), inset 0 0 24px rgba(0,200,83,0.06)`,
        }}
      />
      {/* Digital scan lines */}
      <div
        className="absolute inset-[6%] rounded-[50%] opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 5px, rgba(0,200,83,0.07) 5px, rgba(0,200,83,0.07) 6px)',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 72%)',
        }}
      />
      {/* Energy pulse arc */}
      <motion.div
        className="absolute inset-0 rounded-[50%]"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, rgba(0,230,118,0.35) 18deg, transparent 36deg, transparent 360deg)',
        }}
        animate={{ rotate: [0, 360], opacity: [0.25, 0.65, 0.25] }}
        transition={{
          rotate: { duration: spec.duration * 0.6, repeat: Infinity, ease: 'linear' },
          opacity: { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: spec.pulseDelay },
        }}
      />
      {/* Holographic shimmer */}
      <motion.div
        className="absolute inset-[12%] rounded-[50%]"
        style={{
          background:
            'linear-gradient(105deg, transparent 40%, rgba(0,230,118,0.12) 50%, transparent 60%)',
        }}
        animate={{ opacity: [0, 0.5, 0], x: ['-20%', '20%'] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: spec.pulseDelay * 2 }}
      />
    </motion.div>
  )
}

/** Large stage-level holographic rings — anchored to orbit center */
export function StageHolographicRings({
  spaceGlow,
  ringSize,
}: {
  spaceGlow: MotionValue<number>
  ringSize: { w: number; h: number }
}) {
  const base = Math.min(Math.max(ringSize.w, ringSize.h * 1.1), 340)

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
    >
      {STAGE_RINGS.map((spec) => (
        <RingLayer
          key={spec.id}
          spec={{ ...spec, size: base * spec.size }}
          spaceGlow={spaceGlow}
        />
      ))}
    </div>
  )
}

/** Tight holographic rings orbiting with the AI core chip */
export function ChipHolographicRings({ spaceGlow }: { spaceGlow: MotionValue<number> }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
      style={{ perspective: 900, transformStyle: 'preserve-3d' }}
    >
      {CHIP_RINGS.map((spec) => (
        <RingLayer key={spec.id} spec={spec} spaceGlow={spaceGlow} />
      ))}
      {/* Inner power halo */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0,200,83,0.18) 0%, transparent 68%)',
          translateZ: 10,
        }}
        animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.65, 0.35] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
