import { useEffect, useState } from 'react'
import { Megaphone, PlusCircle, Rss } from 'lucide-react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { NewsCard } from '@components/cards/NewsCard'
import { NewsImage } from '@components/NewsImage'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import {
  createNews,
  deleteNews,
  fetchExternalNews,
  importExternalNews,
  listNews,
  resolveNewsImageSrc,
  updateNews,
  type ExternalNewsItem,
  type NewsItem,
} from '@services/newsService'
import { formatDate } from '@/utils/formatDate'

const CACHE_KEY = 'admin-news-list-v1'

type TabId = 'fetch' | 'publish' | 'current'

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'fetch', label: 'Fetch News' },
  { id: 'publish', label: 'Publish News' },
  { id: 'current', label: 'Current News' },
]

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function CompanyNews() {
  const [activeTab, setActiveTab] = useState<TabId>('fetch')
  const [items, setItems] = useState<NewsItem[]>([])
  const [externalItems, setExternalItems] = useState<ExternalNewsItem[]>([])
  const [selectedExternal, setSelectedExternal] = useState<Set<string>>(new Set())
  const [fetchDate, setFetchDate] = useState(() => toDateInputValue(new Date()))
  const [fetchingExternal, setFetchingExternal] = useState(false)
  const [importingExternal, setImportingExternal] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<NewsItem | null>(null)
  const [editing, setEditing] = useState<NewsItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [editClearImage, setEditClearImage] = useState(false)
  const [editLink, setEditLink] = useState('')
  const [updating, setUpdating] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<NewsItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadNews = async (showLoader = true) => {
    if (showLoader) setLoading(true)
    try {
      // Fetch all news items for admin management
      const data = await listNews()
      setItems(data)
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch {
      // Handle error silently
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let hasCached = false
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed)
          setLoading(false)
          hasCached = true
        }
      } catch {
        // ignore cache parse errors
      }
    }
    void loadNews(!hasCached)
  }, [])

  const handleImageFileChange = (file: File | null, forEdit = false) => {
    if (forEdit) {
      setEditImageFile(file)
      setEditClearImage(false)
      setEditImagePreview(file ? URL.createObjectURL(file) : null)
      return
    }
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  const toggleExternalSelection = (link: string) => {
    setSelectedExternal((prev) => {
      const next = new Set(prev)
      if (next.has(link)) {
        next.delete(link)
      } else {
        next.add(link)
      }
      return next
    })
  }

  const handleFetchExternal = async () => {
    if (!fetchDate) {
      return
    }
    setFetchingExternal(true)
    try {
      const response = await fetchExternalNews(fetchDate)
      setExternalItems(response.items)
      setSelectedExternal(new Set())
    } catch {
      // Handle error silently
    } finally {
      setFetchingExternal(false)
    }
  }

  const handleImportExternal = async () => {
    const selected = externalItems.filter((item) => selectedExternal.has(item.link))
    if (selected.length === 0) {
      return
    }
    setImportingExternal(true)
    try {
      const created = await importExternalNews(selected)
      setItems((prev) => [...created, ...prev])
      setExternalItems((prev) => prev.filter((item) => !selectedExternal.has(item.link)))
      setSelectedExternal(new Set())
    } catch {
      // Handle error silently
    } finally {
      setImportingExternal(false)
    }
  }

  const handleAdd = async () => {
    if (!title || !content) {
      return
    }
    setSaving(true)
    try {
      const item = await createNews({ title, content, imageUrl, link, imageFile })
      setItems((prev) => [item, ...prev])
      resetForm()
    } catch {
      // Handle error silently
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!itemToDelete) return
    setDeleting(true)
    try {
      await deleteNews(itemToDelete.id)
      setItems((prev) => prev.filter((n) => n.id !== itemToDelete.id))
      setDeleteConfirmOpen(false)
      setItemToDelete(null)
    } catch {
      // Handle error silently
    } finally {
      setDeleting(false)
    }
  }

  const requestRemove = (item: NewsItem) => {
    setItemToDelete(item)
    setDeleteConfirmOpen(true)
  }

  const openEdit = async (item: NewsItem) => {
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

  const handleUpdate = async () => {
    if (!editing) return
    if (!editTitle || !editContent) {
      return
    }
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
      setItems((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      setEditing(null)
    } catch {
      // Handle error silently
    } finally {
      setUpdating(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setContent('')
    setImageUrl('')
    setImageFile(null)
    setImagePreview(null)
    setLink('')
  }

  const previewImageSrc = imagePreview || imageUrl.trim() || null

  const contentPreview = content.trim() || 'Your announcement content will appear here...'

  return (
    <PageWrapper>
      <div className="crewiq-dashboard">
        <PageHeader title="" breadcrumb={<Breadcrumb items={[{ label: 'Manage News' }]} />} />

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl border border-border bg-surface/60 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'fetch' && (
          <section
            className="mb-6 overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="border-b border-border bg-gradient-to-r from-sky-950/30 via-[var(--bg-card)] to-cyan-950/20 px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                  <Rss className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">Fetch News</h2>
                  <p className="mt-1 text-sm text-muted">
                    Pull the top 10 headlines for a date, then choose which items to publish.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-6 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-2">
                <Input
                  label="News date"
                  type="date"
                  value={fetchDate}
                  onChange={(e) => setFetchDate(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handleFetchExternal()} disabled={fetchingExternal}>
                    {fetchingExternal ? 'Fetching...' : 'Fetch Top 10'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void handleImportExternal()}
                    disabled={importingExternal || selectedExternal.size === 0}
                  >
                    {importingExternal
                      ? 'Adding...'
                      : `Add Selected (${selectedExternal.size})`}
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-3">
                {externalItems.length === 0 ? (
                  <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-4 text-center text-sm text-muted">
                    Fetch top headlines to preview and select news items.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {externalItems.map((item) => {
                      const checked = selectedExternal.has(item.link)
                      return (
                        <div
                          key={item.link}
                          className={`rounded-xl border bg-white p-4 shadow-sm ${
                            checked ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleExternalSelection(item.link)}
                              className="mt-1 h-4 w-4 accent-emerald-600"
                              aria-label={`Select ${item.title}`}
                            />
                            <div className="flex-1 space-y-1">
                              <p className="text-xs text-muted">
                                {formatDate(item.publishedAt)}
                                {item.source ? ` - ${item.source}` : ''}
                              </p>
                              <h3 className="text-sm font-semibold text-ink line-clamp-2">
                                {item.title}
                              </h3>
                              <p className="text-xs text-muted line-clamp-3">{item.content}</p>
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-xs font-semibold text-primary hover:underline"
                              >
                                View source
                              </a>
                            </div>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-16 w-20 rounded-lg object-cover ring-1 ring-border"
                                loading="lazy"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'publish' && (
          <section
            className="mb-6 overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
        <div className="border-b border-border bg-gradient-to-r from-emerald-950/30 via-[var(--bg-card)] to-teal-950/20 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Publish Company News</h2>
              <p className="mt-1 text-sm text-muted">
                Create announcements for employees. Published news appears on dashboards and the
                news ticker.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-5">
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
              <div className="space-y-2">
                <Input
                  label="Image URL (optional)"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">Upload image (optional)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
                    onChange={(e) => handleImageFileChange(e.target.files?.[0] ?? null)}
                  />
                  {imageFile && (
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-ink"
                      onClick={() => handleImageFileChange(null)}
                    >
                      Remove selected file
                    </button>
                  )}
                </label>
              </div>
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
                <Button
                  onClick={() => void handleAdd()}
                  disabled={saving || !title.trim() || !content.trim()}
                >
                  <PlusCircle className="h-4 w-4" />
                  {saving ? 'Publishing...' : 'Publish News'}
                </Button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Live Preview
            </p>
            <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
              {previewImageSrc ? (
                <div className="aspect-[16/9] bg-surface">
                  <img
                    src={previewImageSrc}
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
                <p className="text-xs font-medium uppercase tracking-wider text-primary">
                  Company Announcement
                </p>
                <h3 className="font-display text-base font-semibold text-ink line-clamp-2">
                  {title.trim() || 'Announcement title'}
                </h3>
                <p className="text-sm leading-relaxed text-muted line-clamp-5 whitespace-pre-line">
                  {contentPreview}
                </p>
                {link.trim() && <p className="truncate text-xs text-primary">{link}</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
        )}

      {activeTab === 'current' && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Published News</h2>
              <p className="text-sm text-muted">
                {items.length} announcement{items.length === 1 ? '' : 's'} live
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`news-skeleton-${i}`}
                  className="min-h-[260px] rounded-xl border border-border bg-white p-5 shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 rounded-full skeleton" />
                    <div className="h-4 w-11/12 rounded-full skeleton" />
                    <div className="h-4 w-10/12 rounded-full skeleton" />
                    <div className="h-4 w-9/12 rounded-full skeleton" />
                    <div className="h-3 w-24 rounded-full skeleton" />
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <div className="h-8 w-20 rounded-lg skeleton" />
                    <div className="h-8 w-20 rounded-lg skeleton" />
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <p className="text-sm text-muted">No news published yet.</p>
            ) : (
              items.map((n) => (
                <NewsCard
                  key={n.id}
                  item={n}
                  onView={() => setPreview(n)}
                  onEdit={() => openEdit(n)}
                  onRemove={() => requestRemove(n)}
                />
              ))
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title ?? 'News'}
        size="lg"
      >
        {preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Published {formatDate(preview.publishedAt)}</p>
            {(preview.imageUrl || preview.hasImage) && (
              <NewsImage
                item={preview}
                alt=""
                className="max-h-64 w-full rounded-lg object-cover"
              />
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
              {preview.content}
            </p>
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
              onChange={(e) => handleImageFileChange(e.target.files?.[0] ?? null, true)}
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

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Remove news?"
        description={
          itemToDelete
            ? `Are you sure you want to remove "${itemToDelete.title}"? This announcement will no longer appear on dashboards or the news ticker.`
            : 'Are you sure you want to remove this news item?'
        }
        confirmLabel={deleting ? 'Removing...' : 'Remove'}
        danger
        onClose={() => {
          if (deleting) return
          setDeleteConfirmOpen(false)
          setItemToDelete(null)
        }}
        onConfirm={() => void handleRemove()}
      />
      </div>
    </PageWrapper>
  )
}
