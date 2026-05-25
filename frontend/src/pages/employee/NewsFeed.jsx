import { useEffect, useMemo, useState } from 'react'
import { listNews } from '@services/newsService'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/employee/ui/dialog'
import { Button } from '@components/employee/ui/button'
import { format } from 'date-fns'

export default function NewsFeed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await listNews()
        setItems(data)
      } catch {
        // swallow for now
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const loopItems = useMemo(() => {
    if (items.length === 0) return []
    // duplicate array for smooth loop
    return [...items, ...items]
  }, [items])

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl font-semibold">Company News</h2>
      {loading ? (
        <p className="text-sm text-muted">Loading news...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No news yet.</p>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border bg-white">
          <div
            className="flex animate-marquee gap-4 px-4 py-3"
            style={{ '--marquee-duration': '30s' }}
          >
            {loopItems.map((n, idx) => (
              <button
                key={`${n.id}-${idx}`}
                className="min-w-[220px] rounded-lg border border-border/60 bg-surface px-3 py-2 text-left shadow-sm hover:border-primary/50"
                onClick={() => setActive(n)}
              >
                <p className="text-xs text-muted">
                  {format(new Date(n.publishedAt), 'dd MMM yyyy')}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink line-clamp-2">{n.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

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
            {active?.imageUrl ? (
              <img src={active.imageUrl} alt="" className="w-full rounded-lg object-cover" />
            ) : null}
            <p className="leading-relaxed whitespace-pre-line">{active?.content}</p>
            {active?.link && (
              <a
                href={active.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-primary font-semibold"
              >
                Read more
              </a>
            )}
          </div>
          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setActive(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
