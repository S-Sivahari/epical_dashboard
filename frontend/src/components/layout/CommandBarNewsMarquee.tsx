import { useEffect, useMemo, useState } from 'react'
import { listNews, type NewsItem } from '@services/newsService'
import { NewsDetailModal } from '@components/news/NewsDetailModal'
import { cn } from '@/utils/cn'

const CACHE_KEY = 'admin-news-ticker-v2'
const MARQUEE_DURATION = '50s'
const TICKER_LIMIT = 8

const FALLBACK_ITEMS: NewsItem[] = [
  {
    id: 'fallback-0',
    title: 'Q3 health insurance open enrollment closes this Friday',
    content:
      'Review plan options and submit enrollment changes before the deadline. Contact HR for questions about coverage.',
    excerpt: '',
    publishedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-1',
    title: 'Company town hall scheduled for next Wednesday at 3:00 PM IST',
    content: 'All staff are invited. Join for company updates, Q&A, and team highlights.',
    excerpt: '',
    publishedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-2',
    title: 'New engineering hires onboarding this week — welcome aboard',
    content: 'Please welcome new team members and help them get set up on projects and tools.',
    excerpt: '',
    publishedAt: new Date().toISOString(),
  },
  {
    id: 'fallback-3',
    title: 'Timesheet cutoff reminder: submit hours before 6:00 PM today',
    content: 'Ensure all project hours are logged and submitted before the daily cutoff.',
    excerpt: '',
    publishedAt: new Date().toISOString(),
  },
]

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

  const displayItems = useMemo(() => {
    if (items.length > 0) return items
    return FALLBACK_ITEMS
  }, [items])

  const loopItems = useMemo(
    () => (displayItems.length > 0 ? [...displayItems, ...displayItems] : []),
    [displayItems],
  )

  if (!loading && loopItems.length === 0) return null

  return (
    <>
      <div
        className={cn('cmd-bar-news', className)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        aria-label="Company news ticker"
      >
        <div className="cmd-bar-news-viewport min-w-0 flex-1">
          {loading ? (
            <div className="cmd-bar-news-skeleton" aria-hidden />
          ) : (
            <div
              className="cmd-bar-news-track animate-marquee"
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
          )}
        </div>
      </div>

      <NewsDetailModal item={active} onClose={() => setActive(null)} />
    </>
  )
}
