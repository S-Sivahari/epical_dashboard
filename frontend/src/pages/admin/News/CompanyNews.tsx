import { useEffect, useState } from 'react'
import { Megaphone, PlusCircle, Rss, Newspaper, CalendarDays, Sparkles } from 'lucide-react'
import { PageWrapper } from '@components/layout/PageWrapper'
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

const tabs: Array<{ id: TabId; label: string; icon: typeof Rss }> = [
  { id: 'fetch', label: 'Fetch News', icon: Rss },
  { id: 'publish', label: 'Publish News', icon: Megaphone },
  { id: 'current', label: 'Current News', icon: Newspaper },
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
    <PageWrapper className="relative z-10 py-3 font-body">
      <div className="crewiq-dashboard admin-news-view">
        <div className="admin-news-shell animate-fadeIn">
          {/* Hero — title, tabs, optional metrics */}
          <div className="admin-news-hero">
            <div className="admin-news-hero-top">
              <div className="min-w-0">
                <h1 className="admin-news-hero-title font-display">Company News</h1>
                <p className="admin-news-hero-sub">
                  Fetch headlines, publish announcements, and manage what employees see
                </p>
              </div>
              <div className="admin-news-tab-rail">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-bold transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'admin-dash-action-btn-sm text-white'
                        : 'admin-news-tab-inactive'
                    }`}
                  >
                    <tab.icon className="h-3 w-3 shrink-0" />
                    {tab.label}
                    <span
                      className={`rounded-full px-1 py-px text-[9px] font-black tabular-nums leading-none ${
                        activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/15 text-white/80'
                      }`}
                    >
                      {tab.id === 'fetch'
                        ? externalItems.length
                        : tab.id === 'current'
                          ? items.length
                          : '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {activeTab === 'current' && (
              <div className="admin-news-metrics-band">
                <div className="admin-news-metric-glass">
                  <p className="admin-news-metric-label">Published</p>
                  <p className="admin-news-metric-value font-display">{items.length}</p>
                </div>
                <div className="admin-news-metric-glass">
                  <p className="admin-news-metric-label">Fetched Today</p>
                  <p className="admin-news-metric-value font-display">{externalItems.length}</p>
                </div>
                <div className="admin-news-metric-glass">
                  <p className="admin-news-metric-label">Selected to Import</p>
                  <p className="admin-news-metric-value font-display">{selectedExternal.size}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── FETCH TAB ── */}
          {activeTab === 'fetch' && (
            <div className="admin-news-body-grid">
              <aside className="admin-news-sidebar space-y-4">
                <p className="admin-news-sidebar-title">Fetch Headlines</p>
                <p className="text-xs font-medium leading-relaxed text-[var(--emerald-dark)]/80">
                  Pull the top 10 headlines for a date, then choose which items to publish.
                </p>
                <Input
                  label="News date"
                  type="date"
                  value={fetchDate}
                  onChange={(e) => setFetchDate(e.target.value)}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    className="admin-dash-action-btn w-full border-0"
                    onClick={() => void handleFetchExternal()}
                    disabled={fetchingExternal}
                  >
                    <Rss className="h-4 w-4" />
                    {fetchingExternal ? 'Fetching...' : 'Fetch Top 10'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="admin-news-secondary-btn w-full"
                    onClick={() => void handleImportExternal()}
                    disabled={importingExternal || selectedExternal.size === 0}
                  >
                    {importingExternal
                      ? 'Adding...'
                      : `Add Selected (${selectedExternal.size})`}
                  </Button>
                </div>
                <div className="admin-news-tip-box rounded-lg p-3 text-xs font-medium leading-relaxed">
                  <Sparkles className="mb-1.5 h-3.5 w-3.5 text-[var(--emerald-dark)]" />
                  Select headlines on the right, then import them as draft news items.
                </div>
              </aside>

              <div className="admin-news-main-panel">
                <div className="admin-news-panel-header">
                  <div>
                    <h2 className="font-display text-sm font-bold text-[var(--emerald-dark)]">
                      Headline Preview
                    </h2>
                    <p className="text-xs font-medium text-slate-600">
                      {externalItems.length > 0
                        ? `${externalItems.length} headline${externalItems.length === 1 ? '' : 's'} · ${selectedExternal.size} selected`
                        : 'No headlines loaded yet'}
                    </p>
                  </div>
                  {externalItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedExternal(new Set(externalItems.map((i) => i.link)))}
                      className="text-xs font-bold text-[var(--emerald-dark)] hover:text-[var(--green-600)]"
                    >
                      Select all
                    </button>
                  )}
                </div>

                {externalItems.length === 0 ? (
                  <div className="admin-news-empty-state flex min-h-[280px] flex-col items-center justify-center rounded-xl px-6 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 shadow-sm">
                      <Rss className="h-6 w-6 text-[var(--emerald-dark)]" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--emerald-dark)]">
                      Ready to fetch headlines
                    </p>
                    <p className="mt-1 max-w-sm text-xs font-medium text-slate-600">
                      Pick a date in the sidebar and click Fetch Top 10 to preview external news here.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {externalItems.map((item) => {
                      const checked = selectedExternal.has(item.link)
                      return (
                        <div
                          key={item.link}
                          className={`admin-news-fetch-card rounded-xl p-4 transition-all ${
                            checked ? 'admin-news-fetch-card-selected' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleExternalSelection(item.link)}
                              className="mt-1 h-4 w-4 accent-[var(--emerald-dark)]"
                              aria-label={`Select ${item.title}`}
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--emerald-dark)]/70">
                                {formatDate(item.publishedAt)}
                                {item.source ? ` · ${item.source}` : ''}
                              </p>
                              <h3 className="line-clamp-2 text-sm font-bold text-ink">{item.title}</h3>
                              <p className="line-clamp-3 text-xs font-medium text-slate-600">
                                {item.content}
                              </p>
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex text-xs font-bold text-[var(--emerald-dark)] hover:underline"
                              >
                                View source
                              </a>
                            </div>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-16 w-20 shrink-0 rounded-lg object-cover ring-1 ring-[rgba(20,83,45,0.15)]"
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
          )}

          {/* ── PUBLISH TAB ── */}
          {activeTab === 'publish' && (
            <div className="admin-news-body-grid admin-news-publish-grid">
              <div className="admin-news-main-panel space-y-5">
                <div className="admin-news-panel-header border-b-0 pb-0">
                  <div>
                    <h2 className="font-display text-sm font-bold text-[var(--emerald-dark)]">
                      Create Announcement
                    </h2>
                    <p className="text-xs font-medium text-slate-600">
                      Published news appears on dashboards and the news ticker
                    </p>
                  </div>
                </div>

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
                    className="admin-news-textarea min-h-[160px] w-full resize-y rounded-lg border px-3 py-2.5 text-sm font-medium text-ink shadow-sm outline-none transition-ui placeholder:text-muted"
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
                        className="admin-news-file-input block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-bold"
                        onChange={(e) => handleImageFileChange(e.target.files?.[0] ?? null)}
                      />
                      {imageFile && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-muted hover:text-ink"
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

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(20,83,45,0.12)] pt-4">
                  <p className="text-xs font-medium text-slate-600">Required fields are marked with *</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                      Clear
                    </Button>
                    <Button
                      className="admin-dash-action-btn border-0"
                      onClick={() => void handleAdd()}
                      disabled={saving || !title.trim() || !content.trim()}
                    >
                      <PlusCircle className="h-4 w-4" />
                      {saving ? 'Publishing...' : 'Publish News'}
                    </Button>
                  </div>
                </div>
              </div>

              <aside className="admin-news-preview-panel">
                <p className="admin-news-sidebar-title mb-3">Live Preview</p>
                <div className="admin-news-panel flex overflow-hidden">
                  <div className="min-w-0 flex-1">
                    {previewImageSrc ? (
                      <div className="aspect-[4/3] bg-slate-100">
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
                      <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-[var(--emerald-dark)] to-[#166534]">
                        <Megaphone className="h-10 w-10 text-white/80" />
                      </div>
                    )}
                    <div className="space-y-2 p-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--emerald-dark)]">
                        <Megaphone className="h-2.5 w-2.5" />
                        Company News
                      </span>
                      <h3 className="line-clamp-2 font-display text-sm font-bold text-ink">
                        {title.trim() || 'Announcement title'}
                      </h3>
                      <p className="line-clamp-6 whitespace-pre-line text-xs font-medium leading-relaxed text-slate-600">
                        {contentPreview}
                      </p>
                      {link.trim() && (
                        <p className="truncate text-[10px] font-semibold text-[var(--emerald-dark)]">
                          {link}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="admin-news-panel-accent w-2 shrink-0 sm:w-2.5" aria-hidden />
                </div>
              </aside>
            </div>
          )}

          {/* ── CURRENT TAB ── */}
          {activeTab === 'current' && (
            <div className="admin-news-main-panel admin-news-gallery-panel">
              <div className="admin-news-panel-header">
                <div>
                  <h2 className="font-display text-sm font-bold text-[var(--emerald-dark)]">
                    Published News
                  </h2>
                  <p className="text-xs font-medium text-slate-600">
                    {items.length} announcement{items.length === 1 ? '' : 's'} live on employee dashboards
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--emerald-dark)]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Manage & edit below
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={`news-skeleton-${i}`}
                      className="admin-news-card-skeleton min-h-[260px] rounded-xl p-5"
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
                  <div className="admin-news-empty-state col-span-full flex min-h-[220px] flex-col items-center justify-center rounded-xl px-6 text-center">
                    <Newspaper className="mb-2 h-8 w-8 text-[var(--emerald-dark)]/50" />
                    <p className="text-sm font-semibold text-[var(--emerald-dark)]">No news published yet</p>
                    <p className="mt-1 text-xs text-slate-600">Switch to Publish News to create your first announcement.</p>
                  </div>
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
            </div>
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
