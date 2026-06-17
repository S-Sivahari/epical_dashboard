import { useMemo } from 'react'
import './celebration.css'

const CELEBRATION_EMOJI = '🥳'
const LANE_COUNT = 4
const SPAWN_INTERVAL_S = 0.52

export type CelebrationParticle = {
  id: string
  lane: number
  delay: number
  duration: number
  wobble: number
  size: number
}

type CelebrationParticlesProps = {
  active: boolean
  particleCount?: number
}

function createMeetStyleParticles(count: number, seed: string): CelebrationParticle[] {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }

  const rand = (index: number) => {
    const value = Math.sin(hash + index * 12.9898) * 43758.5453
    return value - Math.floor(value)
  }

  return Array.from({ length: count }, (_, index) => ({
    id: `${seed}-${index}`,
    lane: index % LANE_COUNT,
    delay: index * SPAWN_INTERVAL_S,
    duration: 3.6 + rand(index) * 0.8,
    wobble: (rand(index + 1) - 0.5) * 18,
    size: 1.35 + rand(index + 2) * 0.25,
  }))
}

export function CelebrationParticles({ active, particleCount = 10 }: CelebrationParticlesProps) {
  const particles = useMemo(() => {
    if (!active) return []
    return createMeetStyleParticles(particleCount, String(Date.now()))
  }, [active, particleCount])

  if (!active || particles.length === 0) return null

  return (
    <div className="celebration-stream" aria-hidden>
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="celebration-particle celebration-particle--meet"
          data-lane={particle.lane}
          style={{
            ['--delay' as string]: `${particle.delay}s`,
            ['--duration' as string]: `${particle.duration}s`,
            ['--wobble' as string]: `${particle.wobble}px`,
            ['--size' as string]: `${particle.size}rem`,
          }}
        >
          {CELEBRATION_EMOJI}
        </span>
      ))}
    </div>
  )
}
