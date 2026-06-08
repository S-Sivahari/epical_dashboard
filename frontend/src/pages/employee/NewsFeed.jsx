import { useEffect, useState } from 'react'
import { listNews } from '@services/newsService'
import { NewsImage } from '@components/NewsImage'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/employee/ui/dialog'
import { Button } from '@components/employee/ui/button'
import { Badge } from '@components/ui/Badge'
import { format } from 'date-fns'
import { Newspaper, Calendar, ExternalLink } from 'lucide-react'
import { portalCardClass } from '@components/employee/shared/interactiveCard'

export default function NewsFeed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // Fetch only 20 most recent news items for better performance
        const data = await listNews(20)
        setItems(data)
      } catch {
        // swallow for now
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const getNewsCategory = (content = '') => {
    const lower = content.toLowerCase()
    if (lower.includes('product') || lower.includes('launch') || lower.includes('release')) return 'Product'
    if (lower.includes('team') || lower.includes('employee') || lower.includes('hire')) return 'Team'
    if (lower.includes('policy') || lower.includes('update') || lower.includes('change')) return 'Policy'
    if (lower.includes('event') || lower.includes('celebration') || lower.includes('party')) return 'Event'
    return 'General'
  }

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Product': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', badge: 'info' }
      case 'Team': return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', badge: 'default' }
      case 'Policy': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', badge: 'warning' }
      case 'Event': return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100', badge: 'success' }
      default: return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-100', badge: 'secondary' }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="emp-page-header flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="emp-dash-icon emp-dash-icon--sage" aria-hidden>
            <Newspaper className="h-4 w-4" />
          </div>
          <h2 className="font-heading text-xl font-semibold text-[#2f6b4f]">Company News</h2>
          {items.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold bg-emerald-100" style={{ color: '#2f6b4f' }}>
              {items.length}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div
          data-portal-card=""
          className={portalCardClass({ className: 'flex h-[200px] flex-col items-center justify-center bg-white p-6 shadow-sm' })}
        >
          <div className="animate-pulse space-y-3 w-full">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 rounded w-full"></div>
            <div className="h-3 bg-slate-200 rounded w-5/6"></div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div
          data-portal-card=""
          className={portalCardClass({ className: 'flex h-[200px] flex-col items-center justify-center bg-white p-6 shadow-sm' })}
        >
          <span className="text-4xl mb-2 opacity-50">📰</span>
          <p className="text-muted text-sm">No news articles yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {items.map((news) => {
            const category = getNewsCategory(news.content)
            const colors = getCategoryColor(category)
            const excerpt = news.excerpt || news.content?.slice(0, 150) || ''

            return (
              <div
                key={news.id}
                data-portal-card=""
                className={portalCardClass({ className: 'flex flex-col bg-white shadow-sm cursor-pointer transition-all hover:shadow-md' })}
                onClick={() => setActive(news)}
              >
                {/* News Image */}
                {(news.imageUrl || news.hasImage) && (
                  <div className="relative h-40 overflow-hidden rounded-t-xl">
                    <NewsImage 
                      item={news} 
                      alt={news.title} 
                      className="w-full h-full object-cover transition-transform hover:scale-105 duration-300" 
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant={colors.badge} className="text-[10px] px-2 py-0.5 shadow-sm">
                        {category}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* News Content */}
                <div className="flex flex-col flex-1 p-4">
                  {/* Category badge if no image */}
                  {!news.imageUrl && !news.hasImage && (
                    <Badge variant={colors.badge} className="text-[10px] px-2 py-0.5 w-fit mb-2">
                      {category}
                    </Badge>
                  )}

                  {/* Date */}
                  <div className="flex items-center gap-1.5 text-muted mb-2">
                    <Calendar className="h-3 w-3" />
                    <p className="text-xs">
                      {format(new Date(news.publishedAt), 'dd MMM yyyy')}
                    </p>
                  </div>

                  {/* Title */}
                  <h3 className="font-display font-semibold text-ink text-base mb-2 line-clamp-2 min-h-[3rem]">
                    {news.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-sm text-muted line-clamp-3 mb-3 flex-1">
                    {excerpt}
                  </p>

                  {/* Read more link */}
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#2f6b4f' }}>
                    <span className="text-xs font-medium hover:underline inline-flex items-center gap-1" style={{ color: '#2f6b4f' }}>
                      Read more
                      <ExternalLink className="h-3 w-3" />
                    </span>
                    {news.link && (
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-muted transition-colors"
                        style={{ color: '#2f6b4f' }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        External
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!active} onOpenChange={() => setActive(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <DialogTitle className="text-xl">{active?.title}</DialogTitle>
                {active?.publishedAt && (
                  <div className="flex items-center gap-1.5 text-muted mt-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <p className="text-sm">
                      {format(new Date(active.publishedAt), 'EEEE, MMMM d, yyyy')}
                    </p>
                  </div>
                )}
              </div>
              <Badge variant={getCategoryColor(getNewsCategory(active?.content)).badge} className="shrink-0">
                {getNewsCategory(active?.content)}
              </Badge>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 text-sm text-ink mt-4">
            {(active?.imageUrl || active?.hasImage) && (
              <NewsImage 
                item={active} 
                alt={active.title} 
                className="w-full rounded-xl object-cover max-h-96" 
              />
            )}
            
            <div className="prose prose-sm max-w-none">
              <p className="leading-relaxed whitespace-pre-line text-base">
                {active?.content}
              </p>
            </div>
            
            {active?.link && (
              <div className="pt-3 border-t border-border">
                <a
                  href={active.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Read full article
                </a>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setActive(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
