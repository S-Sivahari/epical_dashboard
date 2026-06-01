import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@pages/employee/lib/utils'
import { listNews } from '@services/newsService'
import { NewsImage } from '@components/NewsImage'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/employee/ui/dialog'
import { Button } from '@components/employee/ui/button'

const GRADIENTS = [
  'from-emerald-600 to-teal-500',
  'from-green-600 to-emerald-500',
  'from-teal-600 to-cyan-500',
  'from-emerald-700 to-green-500',
]

export function AnnouncementBanner({ compact = false }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(null)

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

  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [items.length])

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-card',
          compact ? 'p-4' : 'rounded-2xl p-6 md:p-8',
        )}
      >
        <p className="text-sm text-white/80">Loading announcements...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  const current = items[index]
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const excerpt = current.excerpt || current.content?.slice(0, 120) || ''

  return (
    <>
      <div className={cn('relative overflow-hidden shadow-card', compact ? 'rounded-xl' : 'rounded-2xl')}>
        <AnimatePresence mode="wait">
          <motion.button
            key={current.id}
            type="button"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            onClick={() => setActive(current)}
            className={cn(
              'w-full cursor-pointer bg-gradient-to-r text-left text-white',
              compact ? 'p-4 md:p-5' : 'p-6 md:p-8',
              gradient,
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-lg bg-white/20',
                  compact ? 'h-9 w-9' : 'h-12 w-12 rounded-xl',
                )}
              >
                <Megaphone className={compact ? 'h-4 w-4' : 'h-6 w-6'} />
              </div>
              <div className={cn('min-w-0 flex-1', items.length > 1 ? 'pr-14' : '')}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/80">
                  Company announcements
                </p>
                <h3
                  className={cn(
                    'mt-0.5 font-display font-bold text-white',
                    compact ? 'line-clamp-1 text-base md:text-lg' : 'text-xl md:text-2xl',
                  )}
                >
                  {current.title}
                </h3>
                <p className={cn('mt-1 text-white/90 line-clamp-2', compact ? 'text-xs' : 'text-sm')}>
                  {excerpt}
                </p>
              </div>
            </div>
          </motion.button>
        </AnimatePresence>

        {items.length > 1 && (
          <>
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
            <div className="absolute bottom-4 left-6 flex gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIndex(i)
                  }}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                  )}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={() => setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            {active?.publishedAt ? (
              <p className="text-sm text-muted">
                {format(new Date(active.publishedAt), 'dd MMM yyyy')}
              </p>
            ) : null}
          </DialogHeader>
          <div className="space-y-3 text-sm text-ink">
            {(active?.imageUrl || active?.hasImage) ? (
              <NewsImage item={active} alt="" className="w-full rounded-lg object-cover" />
            ) : null}
            <p className="leading-relaxed whitespace-pre-line">{active?.content}</p>
            {active?.link && (
              <a
                href={active.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex font-semibold text-primary hover:underline"
              >
                Read more
              </a>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setActive(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
