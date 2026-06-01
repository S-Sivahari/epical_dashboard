import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listNews,
  resolveNewsImageSrc,
  updateNews,
  type NewsItem,
} from '@services/newsService'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { NewsImage } from '@components/NewsImage'
import { formatDate } from '@/utils/formatDate'
import { cn } from '@/utils/cn'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, Pencil } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

const CACHE_KEY = 'admin-news-ticker-v2'
const MARQUEE_DURATION = '90s'
const TICKER_LIMIT = 5

type AdminNewsTickerProps = {
  variant?: 'default' | 'brand'
  scrollMode?: 'marquee' | 'static'
  className?: string
}

function NewsMarqueeCard({
  item,
  isBrand,
  onClick,
  onHoverStart,
}: {
  item: NewsItem
  isBrand: boolean
  onClick: () => void
  onHoverStart: () => void
}) {
  const hasImage = Boolean(item.imageUrl || item.hasImage)
  const summary = item.content?.trim().slice(0, 120) ?? ''

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHoverStart}
      className={cn(
        'dashboard-news-card w-full shrink-0 text-left transition-all',
        isBrand
          ? 'bg-white hover:shadow-md'
          : 'border border-zinc-700/40 bg-[#27272a] hover:border-zinc-600/60',
      )}
    >
      <div className="flex gap-3 p-2.5">
        <div className="relative h-[4.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-[rgba(38,107,28,0.1)]">
          {hasImage ? (
            <NewsImage item={item} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div
              className={cn(
                'flex h-full items-center justify-center',
                isBrand ? 'bg-[#e8f2e6]' : 'bg-[#3f3f46]',
              )}
            >
              <Megaphone
                className={cn('h-5 w-5', isBrand ? 'text-[#266b1c]' : 'text-[#8892a4]')}
              />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="dashboard-news-tag">
            <Megaphone className="h-2.5 w-2.5" />
            Company News
          </span>
          <h3 className="mt-1 line-clamp-2 font-display text-xs font-semibold leading-snug text-slate-900">
            {item.title}
          </h3>
          {summary ? (
            <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500">{summary}</p>
          ) : null}
          <span className="mt-1.5 inline-block text-[10px] font-semibold text-[#266b1c]">
            Read More →
          </span>
        </div>
      </div>
    </button>
  )
}

function MarqueeSkeleton({ isBrand, showAccent = true }: { isBrand: boolean; showAccent?: boolean }) {
  return (
    <div
      className={cn(
        'admin-news-panel flex h-full overflow-hidden',
        !isBrand && 'border border-zinc-700/50 bg-[#27272a]',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col p-2">
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`news-skeleton-${i}`} className="rounded-xl bg-white/80 p-2">
              <div className="aspect-[4/3] rounded-lg bg-slate-200 skeleton" />
              <div className="mt-1.5 h-2.5 w-14 rounded-full bg-slate-200 skeleton" />
              <div className="mt-1 h-3 w-full rounded bg-slate-200 skeleton" />
            </div>
          ))}
        </div>
      </div>
      {showAccent ? <div className="admin-news-panel-accent w-8 shrink-0" /> : null}
    </div>
  )
}

export function AdminNewsTicker({
  variant = 'brand',
  scrollMode = 'marquee',
  className,
}: AdminNewsTickerProps) {
  const navigate = useNavigate()
  const isBrand = variant === 'brand'
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [active, setActive] = useState<NewsItem | null>(null)
  const [editing, setEditing] = useState<NewsItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editLink, setEditLink] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [editClearImage, setEditClearImage] = useState(false)
  const [updating, setUpdating] = useState(false)

  const tickerItems = items.slice(0, TICKER_LIMIT)
  const loopItems = useMemo(() => {
    if (scrollMode === 'static') return tickerItems
    if (tickerItems.length === 0) return []
    return [...tickerItems, ...tickerItems]
  }, [tickerItems, scrollMode])

  const persistItems = (next: NewsItem[]) => {
    const limited = next.slice(0, TICKER_LIMIT)
    setItems(limited)
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(limited))
  }

  useEffect(() => {
    let hasCached = false
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
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
        persistItems(data)
      } catch {
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const openEdit = async (item: NewsItem) => {
    setActive(null)
    setEditing(item)
    setEditTitle(item.title)
    setEditContent(item.content)
    setEditImageUrl(item.imageUrl || '')
    setEditLink(item.link || '')
    setEditImageFile(null)
    setEditClearImage(false)
    if (item.imageUrl?.trim()) {
      setEditImagePreview(item.imageUrl)
    } else if (item.hasImage) {
      const src = await resolveNewsImageSrc(item)
      setEditImagePreview(src)
    } else {
      setEditImagePreview(null)
    }
  }

  const handleEditImageChange = (file: File | null) => {
    setEditImageFile(file)
    setEditClearImage(false)
    setEditImagePreview(file ? URL.createObjectURL(file) : null)
  }

  const handleUpdate = async () => {
    if (!editing || !editTitle.trim() || !editContent.trim()) return
    setUpdating(true)
    try {
      const updated = await updateNews(editing.id, {
        title: editTitle,
        content: editContent,
        imageUrl: editImageUrl,
        link: editLink,
        imageFile: editImageFile,
        clearImage: editClearImage,
      })
      persistItems(items.map((n) => (n.id === updated.id ? updated : n)))
      setEditing(null)
    } catch {
      // Handle error silently
    } finally {
      setUpdating(false)
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className={cn('min-h-0', className)}>
        <MarqueeSkeleton isBrand={isBrand} showAccent={scrollMode === 'marquee'} />
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <>
      <div
        className={cn(
          'admin-news-panel flex h-full min-h-0 overflow-hidden',
          !isBrand && 'border border-zinc-700/40 bg-[#27272a]',
          className,
        )}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="dashboard-news-header flex shrink-0 items-center justify-between px-3 py-2.5">
            <p className="dashboard-news-header-title">Company News</p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.NEWS)}
              className="dashboard-news-manage-btn"
            >
              Manage
            </button>
          </div>

          <div
            className={cn(
              'relative min-h-0 flex-1 px-3 pb-3 pt-1',
              scrollMode === 'static' ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
            )}
          >
            <div
              className={cn(
                'flex w-full flex-col gap-3',
                scrollMode === 'marquee' && 'animate-marquee-vertical',
              )}
              style={
                scrollMode === 'marquee'
                  ? ({
                      '--marquee-duration': MARQUEE_DURATION,
                      animationPlayState: paused ? 'paused' : 'running',
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {loopItems.map((item, idx) => (
                <NewsMarqueeCard
                  key={`${item.id}-${idx}`}
                  item={item}
                  isBrand={isBrand}
                  onClick={() => setActive(item)}
                  onHoverStart={() => setPaused(true)}
                />
              ))}
            </div>
          </div>
        </div>

        {scrollMode === 'marquee' ? (
          <aside
            className="dashboard-news-accent admin-news-panel-accent flex w-9 shrink-0 flex-col items-center justify-center gap-3 py-4 sm:w-10"
            aria-hidden
          >
            <Megaphone className="h-4 w-4 text-white/90" strokeWidth={2} />
            <span className="admin-news-panel-accent-label text-[10px] font-bold uppercase">
              News
            </span>
          </aside>
        ) : null}
      </div>

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
              <p className="text-sm text-muted">{formatDate(active.publishedAt)}</p>

              {(active.imageUrl || active.hasImage) && (
                <NewsImage
                  item={active}
                  alt={active.title}
                  className="max-h-80 w-full rounded-xl object-cover"
                />
              )}

              <div className="rounded-lg bg-surface/50 p-4">
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                  {active.content}
                </p>
              </div>

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

              <div className="flex justify-end gap-2 pt-3">
                <Button variant="secondary" onClick={() => setActive(null)}>
                  Close
                </Button>
                <Button onClick={() => void openEdit(active)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </motion.div>
          </Modal>
        )}
      </AnimatePresence>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit News" size="lg">
        <div className="space-y-4">
          <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <Input
            label="Image URL (optional)"
            value={editImageUrl}
            onChange={(e) => setEditImageUrl(e.target.value)}
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Upload image (optional)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
              onChange={(e) => handleEditImageChange(e.target.files?.[0] ?? null)}
            />
            {(editImagePreview || editing?.hasImage) && (
              <div className="flex items-center gap-3 pt-1">
                {editImagePreview && (
                  <img
                    src={editImagePreview}
                    alt=""
                    className="h-16 w-24 rounded-lg object-cover ring-1 ring-border"
                  />
                )}
                <button
                  type="button"
                  className="text-xs text-danger hover:underline"
                  onClick={() => {
                    setEditImageFile(null)
                    setEditImagePreview(null)
                    setEditClearImage(true)
                  }}
                >
                  Remove image
                </button>
              </div>
            )}
          </label>
          <Input
            label="Link (optional)"
            value={editLink}
            onChange={(e) => setEditLink(e.target.value)}
          />
          <label className="block text-sm font-medium text-ink">
            News Content
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdate()} disabled={updating}>
              {updating ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
