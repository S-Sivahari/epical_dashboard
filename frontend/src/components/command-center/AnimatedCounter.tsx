import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { easeOut } from '@/utils/motionPresets'

export function AnimatedCounter({
  value,
  suffix = '',
  duration = 0.8,
  className,
}: {
  value: number
  suffix?: string
  duration?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(value)

  useEffect(() => {
    const start = prevRef.current
    const end = value
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(tick)
      else prevRef.current = end
    }

    requestAnimationFrame(tick)
  }, [value, duration])

  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}
      className={className}
    >
      {display.toLocaleString()}
      {suffix}
    </motion.span>
  )
}
