import { useEffect, useMemo, useState } from 'react'
import { listNews, type NewsItem } from '@services/newsService'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { NewsImage } from '@components/NewsImage'
import { formatDate } from '@/utils/formatDate'

export function AdminNewsTicker() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<NewsItem | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await listNews()
        setItems(data)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const loopItems = useMemo(() => {
    if (items.length === 0) return []
    return [...items, ...items]
  }, [items])

  if (loading || items.length === 0) return null

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/60">
        <div
          className="flex animate-marquee gap-3 px-4 py-3"
          style={{ ['--marquee-duration' as string]: `${Math.max(items.length * 8, 24)}s` }}
        >
          {loopItems.map((item, idx) => (
            <button
              key={`${item.id}-${idx}`}
              type="button"
              onClick={() => setActive(item)}
              className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
            >
              {item.title}
            </button>
          ))}
        </div>
      </div>

      <Modal
        isOpen={!!active}
        onClose={() => setActive(null)}
        title={active?.title ?? 'News'}
        size="lg"
      >
        {active && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{formatDate(active.publishedAt)}</p>
            {(active.imageUrl || active.hasImage) && (
              <NewsImage item={active} alt="" className="w-full rounded-lg object-cover max-h-64" />
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{active.content}</p>
            {active.link && (
              <a
                href={active.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-semibold text-primary hover:underline"
              >
                {active.link}
              </a>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setActive(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
