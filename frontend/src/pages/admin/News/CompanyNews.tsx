import { useEffect, useState } from 'react'
import { Megaphone, PlusCircle } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { NewsCard } from '@components/cards/NewsCard'
import { toast } from 'sonner'
import { createNews, deleteNews, listNews, updateNews, type NewsItem } from '@services/newsService'
import { formatDate } from '@/utils/formatDate'

export function CompanyNews() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<NewsItem | null>(null)
  const [editing, setEditing] = useState<NewsItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editLink, setEditLink] = useState('')
  const [updating, setUpdating] = useState(false)

  const loadNews = async () => {
    setLoading(true)
    try {
      const data = await listNews()
      setItems(data)
    } catch {
      toast.error('Failed to load news')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadNews()
  }, [])

  const handleAdd = async () => {
    if (!title || !content) {
      toast.error('Title and content are required')
      return
    }
    setSaving(true)
    try {
      const item = await createNews({ title, content, imageUrl, link })
      setItems((prev) => [item, ...prev])
      setTitle('')
      setContent('')
      setImageUrl('')
      setLink('')
      toast.success('News published')
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Failed to publish news')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await deleteNews(id)
      setItems((prev) => prev.filter((n) => n.id !== id))
      toast.success('News removed')
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Failed to remove news')
    }
  }

  const openEdit = (item: NewsItem) => {
    setEditing(item)
    setEditTitle(item.title)
    setEditContent(item.content)
    setEditImageUrl(item.imageUrl || '')
    setEditLink(item.link || '')
  }

  const handleUpdate = async () => {
    if (!editing) return
    if (!editTitle || !editContent) {
      toast.error('Title and content are required')
      return
    }
    setUpdating(true)
    try {
      const updated = await updateNews(editing.id, {
        title: editTitle,
        content: editContent,
        imageUrl: editImageUrl,
        link: editLink,
      })
      setItems((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      setEditing(null)
      toast.success('News updated')
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Failed to update news')
    } finally {
      setUpdating(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setContent('')
    setImageUrl('')
    setLink('')
  }

  const contentPreview = content.trim() || 'Your announcement content will appear here...'

  return (
    <PageWrapper>
      <PageHeader title="" breadcrumb={<Breadcrumb items={[{ label: 'Manage News' }]} />} />

      <section className="mb-10 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Publish Company News</h2>
              <p className="mt-1 text-sm text-muted">
                Create announcements for employees. Published news appears on dashboards and the news ticker.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-5">
          <div className="space-y-5 lg:col-span-3">
            <Input
              label="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q2 Town Hall — June 12"
            />

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">
                News Content <span className="text-danger">*</span>
              </span>
              <textarea
                className="min-h-[160px] w-full resize-y rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition-ui placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the full announcement. Include date, venue, and key details employees should know."
              />
              <p className="text-xs text-muted">{content.length} characters</p>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Image URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              <Input
                label="Reference Link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://example.com/read-more"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted">Required fields are marked with *</p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                  Clear
                </Button>
                <Button onClick={() => void handleAdd()} disabled={saving || !title.trim() || !content.trim()}>
                  <PlusCircle className="h-4 w-4" />
                  {saving ? 'Publishing...' : 'Publish News'}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Live Preview</p>
            <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
              {imageUrl.trim() ? (
                <div className="aspect-[16/9] bg-surface">
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-500">
                  <Megaphone className="h-10 w-10 text-white/80" />
                </div>
              )}
              <div className="space-y-2 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">Company Announcement</p>
                <h3 className="font-display text-base font-semibold text-ink line-clamp-2">
                  {title.trim() || 'Announcement title'}
                </h3>
                <p className="text-sm leading-relaxed text-muted line-clamp-5 whitespace-pre-line">{contentPreview}</p>
                {link.trim() && (
                  <p className="truncate text-xs text-primary">{link}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">Published News</h2>
          <p className="text-sm text-muted">{items.length} announcement{items.length === 1 ? '' : 's'} live</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="text-sm text-muted">Loading published news...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No news published yet.</p>
        ) : (
          items.map((n) => (
            <NewsCard
              key={n.id}
              item={n}
              onView={() => setPreview(n)}
              onEdit={() => openEdit(n)}
              onRemove={() => void handleRemove(n.id)}
            />
          ))
        )}
      </div>

      <Modal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title ?? 'News'}
        size="lg"
      >
        {preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Published {formatDate(preview.publishedAt)}</p>
            {preview.imageUrl && (
              <img src={preview.imageUrl} alt="" className="max-h-64 w-full rounded-lg object-cover" />
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{preview.content}</p>
            {preview.link && (
              <a
                href={preview.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-semibold text-primary hover:underline"
              >
                {preview.link}
              </a>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Edit News"
        size="lg"
      >
        <div className="space-y-4">
          <Input label="Title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <Input
            label="Image URL (optional)"
            value={editImageUrl}
            onChange={(e) => setEditImageUrl(e.target.value)}
          />
          <Input label="Link (optional)" value={editLink} onChange={(e) => setEditLink(e.target.value)} />
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
    </PageWrapper>
  )
}
