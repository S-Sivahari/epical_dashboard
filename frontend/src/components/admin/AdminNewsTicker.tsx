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
  'from-emerald-600/90 to-teal-500/90',
  'from-green-600/90 to-emerald-500/90',
  'from-teal-600/90 to-cyan-500/90',
  'from-emerald-700/90 to-green-500/90',
]

const CACHE_KEY = 'admin-news-ticker-v1'

export function AdminNewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState<NewsItem | null>(null)

  useEffect(() => {
    let hasCached = false
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed)
          setIndex(0)
          setLoading(false)
          hasCached = true
        }
      } catch {
        hasCached = false
      }
    }

    const load = async () => {
      if (!hasCached) setLoading(true)
      try {
        // Fetch only 10 most recent news items for better performance
        const data = await listNews(10)
        setItems(data)
        setIndex(0)
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
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

  if (loading && items.length === 0) {
    return (
      <div className="min-h-[110px] rounded-2xl border border-border bg-white p-4.5 shadow-sm md:min-h-[124px] md:p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 rounded-full skeleton" />
            <div className="h-5 w-2/3 rounded-lg skeleton" />
            <div className="h-4 w-full rounded-lg skeleton" />
            <div className="h-4 w-5/6 rounded-lg skeleton" />
          </div>
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  const current = items[index]
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const excerpt = current.excerpt || current.content?.slice(0, 120) || ''

  return (
    <>
      {/* Carousel container matching employee design */}
      <div className="relative min-h-[110px] overflow-hidden rounded-2xl md:min-h-[124px]">
        <AnimatePresence mode="wait">
          <motion.button
            key={current.id}
            type="button"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            onClick={() => setActive(current)}
            className={`min-h-[110px] w-full cursor-pointer bg-gradient-to-r p-4.5 text-left text-white md:min-h-[124px] md:p-5 ${gradient}`}
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
                <Megaphone className="h-5 w-5" />
              </div>

              {/* Content */}
              <div className="flex-1 pr-14">
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">
                  Company Announcement
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold md:text-xl">
                  {current.title}
                </h3>
                <p className="mt-1.5 text-sm text-white/90 line-clamp-2">{excerpt}</p>
              </div>
            </div>
          </motion.button>
        </AnimatePresence>

        {/* Navigation arrows and dots */}
        {items.length > 1 && (
          <>
            {/* Arrow buttons */}
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndex((i) => (i - 1 + items.length) % items.length)
                }}
                className="rounded-md bg-white/20 p-1 hover:bg-white/30"
                aria-label="Previous"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndex((i) => (i + 1) % items.length)
                }}
                className="rounded-md bg-white/20 p-1 hover:bg-white/30"
                aria-label="Next"
              >
                <ChevronRight className="h-3.5 w-3.5 text-white" />
              </button>
            </div>

            {/* Dot indicators */}
            <div className="absolute bottom-3 left-5 flex gap-1">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIndex(i)
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/45'
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
          <Modal isOpen={!!active} onClose={() => setActive(null)} title={active.title} size="lg">
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
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
