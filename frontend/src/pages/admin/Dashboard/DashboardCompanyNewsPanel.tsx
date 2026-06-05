import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listNews, type NewsItem } from '@services/newsService'
import { ROUTES } from '@constants/routes'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/formatDate'
import {
  type CompanyNewsCategory,
  type DashboardCompanyNewsItem,
} from './dashboardCompanyNewsData'

function mapCategory(item: NewsItem): CompanyNewsCategory {
  const text = `${item.title} ${item.content}`.toLowerCase()
  if (text.includes('policy') || text.includes('handbook') || text.includes('enrollment')) {
    return 'Policy'
  }
  if (text.includes('event') || text.includes('town hall') || text.includes('meeting')) {
    return 'Event'
  }
  return 'Announcement'
}

function toPanelItem(item: NewsItem): DashboardCompanyNewsItem {
  return {
    id: item.id,
    category: mapCategory(item),
    headline: item.title,
    summary: item.content?.trim().slice(0, 120) ?? '',
    date: item.publishedAt ? formatDate(item.publishedAt, 'MMM d, yyyy') : '—',
  }
}

type DashboardCompanyNewsPanelProps = {
  className?: string
}

export function DashboardCompanyNewsPanel({ className }: DashboardCompanyNewsPanelProps) {
  const navigate = useNavigate()
  const [items, setItems] = useState<DashboardCompanyNewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await listNews(3)
        setItems(data.slice(0, 3).map(toPanelItem))
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const displayItems = useMemo(() => items.slice(0, 3), [items])

  return (
    <section className={cn('dashboard-company-news-panel', className)} aria-label="Company news">
      <header className="dashboard-workspace-header dashboard-workspace-header--forest">
        <h2 className="dashboard-workspace-header-title !text-white">COMPANY NEWS</h2>
      </header>

      <div className="dashboard-company-news-body">
        {loading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-slate-100 skeleton" />
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <p className="dashboard-workspace-empty p-3">No news published yet.</p>
        ) : (
          displayItems.map((item, index) => (
            <article
              key={item.id}
              className={cn(
                'dashboard-company-news-card',
                index < displayItems.length - 1 && 'dashboard-company-news-card--bordered',
              )}
            >
              <span
                className={cn(
                  'dashboard-company-news-tag',
                  `dashboard-company-news-tag--${item.category.toLowerCase()}`,
                )}
              >
                {item.category}
              </span>
              <h3 className="dashboard-company-news-headline">{item.headline}</h3>
              <p className="dashboard-company-news-summary">{item.summary}</p>
              <div className="dashboard-company-news-meta">
                <time className="dashboard-company-news-date">{item.date}</time>
                <button
                  type="button"
                  className="dashboard-company-news-link"
                  onClick={() => navigate(ROUTES.NEWS)}
                >
                  Read more
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
