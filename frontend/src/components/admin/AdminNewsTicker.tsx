import { useEffect, useMemo, useState } from 'react'
import { listNews, type NewsItem } from '@services/newsService'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { NewsImage } from '@components/NewsImage'
import { formatDate } from '@/utils/formatDate'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'

// Gradient backgrounds for cards
const GRADIENTS = [
  'from-emerald-600 to-teal-500',
  'from-green-600 to-emerald-500',
  'from-teal-600 to-cyan-500',
  'from-emerald-700 to-green-500',
]

export function AdminNewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState<NewsItem | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Fetch only 10 most recent news items for better performance
        const data = await listNews(10)
        setItems(data)
        setIndex(0)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // Auto-advance every 5 seconds if multiple items
  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [items.length])

  if (loading || items.length === 0) return null

  const current = items[index]
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const excerpt = current.excerpt || current.content?.slice(0, 120) || ''

  return (
    <>
      {/* Carousel container matching employee design */}
      <div className="relative overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait">
          <motion.button
            key={current.id}
            type="button"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            onClick={() => setActive(current)}
            className={`w-full cursor-pointer bg-gradient-to-r p-6 text-left text-white md:p-8 ${gradient}`}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Megaphone className="h-6 w-6" />
              </div>
              
              {/* Content */}
              <div className="flex-1 pr-16">
                <p className="text-xs font-medium uppercase tracking-wider text-white/80">
                  Company Announcement
                </p>
                <h3 className="mt-1 font-display text-xl font-bold md:text-2xl">{current.title}</h3>
                <p className="mt-2 text-sm text-white/90 line-clamp-2">{excerpt}</p>
              </div>
            </div>
          </motion.button>
        </AnimatePresence>

        {/* Navigation arrows and dots */}
        {items.length > 1 && (
          <>
            {/* Arrow buttons */}
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndex((i) => (i - 1 + items.length) % items.length)
                }}
                className="rounded-lg bg-white/20 p-1.5 hover:bg-white/30"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndex((i) => (i + 1) % items.length)
                }}
                className="rounded-lg bg-white/20 p-1.5 hover:bg-white/30"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4 text-white" />
              </button>
            </div>
            
            {/* Dot indicators */}
            <div className="absolute bottom-4 left-6 flex gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIndex(i)
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal with smooth animation */}
      <AnimatePresence>
        {active && (
          <Modal
            isOpen={!!active}
            onClose={() => setActive(null)}
            title={active.title}
            size="lg"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Date badge */}
              <p className="text-sm text-muted">{formatDate(active.publishedAt)}</p>

              {/* Image if available */}
              {(active.imageUrl || active.hasImage) && (
                <NewsImage
                  item={active}
                  alt={active.title}
                  className="w-full rounded-xl object-cover max-h-80"
                />
              )}

              {/* Content */}
              <div className="rounded-lg bg-surface/50 p-4">
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                  {active.content}
                </p>
              </div>

              {/* Link if available */}
              {active.link && (
                <a
                  href={active.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <span>View Link</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              {/* Close button */}
              <div className="flex justify-end pt-3">
                <Button variant="secondary" onClick={() => setActive(null)}>
                  Close
                </Button>
              </div>
            </motion.div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}
