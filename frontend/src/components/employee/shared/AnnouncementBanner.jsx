import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@pages/employee/lib/utils'
import { listNews } from '@services/newsService'
import { NewsImage } from '@components/NewsImage'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/employee/ui/dialog'
import { Button } from '@components/employee/ui/button'

export function AnnouncementBanner({ compact = false, inline = false, className }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
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
    }, 4400)
    return () => clearInterval(timer)
  }, [items.length])

  if (loading) {
    return (
      <div
        className={cn(
          'emp-announcement-gradient rounded-xl !text-white shadow-card',
          inline
            ? 'flex h-full w-44 shrink-0 items-center p-3 sm:w-48'
            : compact
              ? 'flex min-h-[3rem] items-center p-2.5'
              : 'min-h-[4.5rem] rounded-2xl p-6 md:p-8',
          className,
        )}
      >
        <p className={cn('!text-white/80', compact ? 'text-xs' : 'text-sm')}>Loading...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  const current = items[index]
  const excerpt = current.excerpt || current.content?.slice(0, 120) || ''

  return (
    <>
      <div
        className={cn(
          'emp-announcement-gradient relative flex flex-col overflow-hidden rounded-xl !text-white shadow-card',
          inline
            ? 'h-full w-44 shrink-0 sm:w-52'
            : compact
              ? 'min-h-[3rem]'
              : 'min-h-[4.5rem] rounded-2xl',
          className,
        )}
      >
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
              'w-full cursor-pointer border-0 bg-transparent text-left !text-white',
              inline
                ? 'flex flex-1 items-center p-3'
                : compact
                  ? 'px-3 py-2'
                  : 'p-6 md:p-8',
              items.length > 1 && !inline ? (compact ? 'pb-1' : 'pb-2') : 'h-full',
            )}
          >
            <div className={cn('flex min-w-0 items-center gap-2.5', inline ? 'w-full' : compact ? 'gap-2' : 'items-start gap-3')}>
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-lg bg-white/20',
                  inline ? 'h-8 w-8' : compact ? 'h-7 w-7' : 'h-12 w-12 rounded-xl',
                )}
              >
                <Megaphone className={cn('text-white', inline ? 'h-3.5 w-3.5' : compact ? 'h-3.5 w-3.5' : 'h-6 w-6')} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'font-medium uppercase tracking-wider !text-white/80',
                    inline ? 'text-[9px]' : compact ? 'text-[10px] leading-none' : 'text-[11px]',
                  )}
                >
                  News
                </p>
                <h3
                  className={cn(
                    'font-display font-bold !text-white',
                    inline
                      ? 'line-clamp-2 text-xs leading-snug'
                      : compact
                        ? 'line-clamp-1 text-sm leading-tight'
                        : 'mt-0.5 line-clamp-1 text-xl md:text-2xl',
                  )}
                >
                  {current.title}
                </h3>
                {!inline ? (
                  <p
                    className={cn(
                      '!text-white/90',
                      compact ? 'mt-0.5 line-clamp-1 text-[11px] leading-snug' : 'mt-1 line-clamp-2 text-sm',
                    )}
                  >
                    {excerpt}
                  </p>
                ) : null}
              </div>
            </div>
          </motion.button>
        </AnimatePresence>

        {items.length > 1 && !inline ? (
          <div
            className={cn(
              'flex shrink-0 items-center justify-between gap-2',
              compact ? 'px-3 pb-2 pt-0' : 'gap-3 px-4 pb-3 pt-1 md:px-5',
            )}
          >
            <div className="flex gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIndex(i)
                  }}
                  className={cn(
                    'rounded-full transition-all',
                    compact ? 'h-1 w-1' : 'h-1.5',
                    i === index ? (compact ? 'w-4 bg-white' : 'w-6 bg-white') : compact ? 'w-1 bg-white/40' : 'w-1.5 bg-white/40',
                  )}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <div className={cn('flex', compact ? 'gap-1' : 'gap-2')}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndex((i) => (i - 1 + items.length) % items.length)
                }}
                className={cn(
                  'rounded-lg bg-white/20 hover:bg-white/30',
                  compact ? 'p-1' : 'p-1.5',
                )}
                aria-label="Previous"
              >
                <ChevronLeft className={cn('text-white', compact ? 'h-3 w-3' : 'h-4 w-4')} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIndex((i) => (i + 1) % items.length)
                }}
                className={cn(
                  'rounded-lg bg-white/20 hover:bg-white/30',
                  compact ? 'p-1' : 'p-1.5',
                )}
                aria-label="Next"
              >
                <ChevronRight className={cn('text-white', compact ? 'h-3 w-3' : 'h-4 w-4')} />
              </button>
            </div>
          </div>
        ) : null}

        {items.length > 1 && inline ? (
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIndex((i) => (i - 1 + items.length) % items.length)
              }}
              className="rounded bg-white/20 p-1 hover:bg-white/30"
              aria-label="Previous"
            >
              <ChevronLeft className="h-3 w-3 text-white" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIndex((i) => (i + 1) % items.length)
              }}
              className="rounded bg-white/20 p-1 hover:bg-white/30"
              aria-label="Next"
            >
              <ChevronRight className="h-3 w-3 text-white" />
            </button>
          </div>
        ) : null}
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
