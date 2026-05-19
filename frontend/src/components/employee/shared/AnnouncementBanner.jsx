import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { cn } from '@pages/employee/lib/utils'

export function AnnouncementBanner({ announcements }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % announcements.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [announcements.length])

  const current = announcements[index]

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4 }}
          className={cn('bg-gradient-to-r p-6 text-white md:p-8', current.gradient)}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Megaphone className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-white/80">Company Announcement</p>
              <h3 className="mt-1 font-heading text-xl font-bold md:text-2xl">{current.title}</h3>
              <p className="mt-2 text-sm text-white/90">{current.excerpt}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-4 right-4 flex gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => (i - 1 + announcements.length) % announcements.length)}
          className="rounded-lg bg-white/20 p-1.5 hover:bg-white/30"
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => (i + 1) % announcements.length)}
          className="rounded-lg bg-white/20 p-1.5 hover:bg-white/30"
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </button>
      </div>
      <div className="absolute bottom-4 left-6 flex gap-1.5">
        {announcements.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40')}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
