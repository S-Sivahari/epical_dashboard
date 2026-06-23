import { useEffect, useMemo, useState } from 'react'
import { listNews, type NewsItem } from '@services/newsService'
import { NewsDetailModal } from '@components/news/NewsDetailModal'
import { cn } from '@/utils/cn'

const CACHE_KEY = 'admin-news-ticker-v2'
const MARQUEE_DURATION = '28s'
const TICKER_LIMIT = 8

type CommandBarNewsMarqueeProps = {
  className?: string
}

export function CommandBarNewsMarquee({ className }: CommandBarNewsMarqueeProps) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [active, setActive] = useState<NewsItem | null>(null)

  useEffect(() => {
    let hasCached = false
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as NewsItem[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed.slice(0, TICKER_LIMIT))
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
        const data = await listNews(TICKER_LIMIT)
        const limited = data.slice(0, TICKER_LIMIT)
        setItems(limited)
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(limited))
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const loopItems = useMemo(
    () => (items.length > 0 ? [...items, ...items] : []),
    [items],
  )

  if (loopItems.length === 0) return null

  return (
    <>
      <div
        className={cn('cmd-bar-news', className)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-label="Company news ticker"
        aria-busy={loading}
      >
        <div className="cmd-bar-news-viewport min-w-0 flex-1">
          <div
            className={cn(
              'cmd-bar-news-track animate-marquee',
              loading && 'opacity-80',
            )}
            style={
              {
                '--marquee-duration': MARQUEE_DURATION,
                animationPlayState: paused ? 'paused' : 'running',
              } as React.CSSProperties
            }
          >
            {loopItems.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                type="button"
                className="cmd-bar-news-item"
                onClick={() => setActive(item)}
              >
                <span className="cmd-bar-news-item-title">{item.title}</span>
                <span className="cmd-bar-news-separator" aria-hidden>
                  ◆
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <NewsDetailModal item={active} onClose={() => setActive(null)} />
    </>
  )
}
