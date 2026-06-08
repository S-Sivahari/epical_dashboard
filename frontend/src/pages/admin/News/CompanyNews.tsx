import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Megaphone,
  Plus,
  PlusCircle,
  Rss,
  Newspaper,
  CalendarDays,
  X,
} from 'lucide-react'
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
import {
  isPastNewsDateInput,
  maxPastNewsDateInputValue,
  PAST_NEWS_DATE_HINT,
  publishedAtIsoFromDateInput,
  yesterdayDateInputValue,
} from '@/utils/newsDateRules'

const CACHE_KEY = 'admin-news-list-v1'
const MAX_PAST_NEWS_DATE = maxPastNewsDateInputValue()

type TabId = 'current' | 'publish' | 'fetch'

const tabs: Array<{ id: TabId; label: string; icon: typeof Rss }> = [
  { id: 'current', label: 'Current Feed', icon: Newspaper },
  { id: 'publish', label: 'Publish Console', icon: Megaphone },
  { id: 'fetch', label: 'Fetch Streams', icon: Rss },
]

const DEFAULT_FETCH_FILTERS = [
  'Semiconductor',
  'Chip Manufacturing',
  'VLSI',
  'Technology',
  'Artificial Intelligence',
]

const FETCH_LIMIT_OPTIONS = [5, 10, 15, 20, 25, 30, 50] as const

const NEWS_TAB_IDS: TabId[] = ['current', 'publish', 'fetch']

function isNewsTab(value: string | null): value is TabId {
  return value !== null && NEWS_TAB_IDS.includes(value as TabId)
}

export function CompanyNews() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>('current')

  const setNewsTab = useCallback(
    (tab: TabId) => {
      setActiveTab(tab)
      const next = new URLSearchParams(searchParams)
      if (tab === 'current') next.delete('tab')
      else next.set('tab', tab)
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (isNewsTab(tab)) setActiveTab(tab)
    else if (!tab) setActiveTab('current')
  }, [searchParams])
  const [items, setItems] = useState<NewsItem[]>([])
  const [externalItems, setExternalItems] = useState<ExternalNewsItem[]>([])
  const [selectedExternal, setSelectedExternal] = useState<Set<string>>(new Set())
  const [fetchDate, setFetchDate] = useState(() => yesterdayDateInputValue())
  const [publishDate, setPublishDate] = useState(() => yesterdayDateInputValue())
  const [fetchLimit, setFetchLimit] = useState<number>(10)
  const [fetchFilters, setFetchFilters] = useState<string[]>(() => [...DEFAULT_FETCH_FILTERS])
  const [newFilterInput, setNewFilterInput] = useState('')
  const [fetchingExternal, setFetchingExternal] = useState(false)
  const [importingExternal, setImportingExternal] = useState(false)
  const [importingLink, setImportingLink] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
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
  const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteMode, setDeleteMode] = useState<'single' | 'bulk'>('single')
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

  const toggleFeedSelection = (id: string) => {
    setSelectedFeedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFeed = () => {
    setSelectedFeedIds(new Set(items.map((item) => item.id)))
  }

  const clearFeedSelection = () => {
    setSelectedFeedIds(new Set())
  }

  const activeFetchFilters = fetchFilters.map((term) => term.trim()).filter(Boolean)

  const addFetchFilter = (raw: string) => {
    const term = raw.trim()
    if (!term) return
    setFetchFilters((prev) => {
      const exists = prev.some((f) => f.toLowerCase() === term.toLowerCase())
      if (exists) return prev
      return [...prev, term]
    })
    setNewFilterInput('')
  }

  const removeFetchFilter = (index: number) => {
    setFetchFilters((prev) => prev.filter((_, i) => i !== index))
  }

  const resetFetchFilters = () => {
    setFetchFilters([...DEFAULT_FETCH_FILTERS])
    setNewFilterInput('')
  }

  const clampPastNewsDate = (value: string) =>
    !value || isPastNewsDateInput(value) ? value : MAX_PAST_NEWS_DATE

  const handleFetchExternal = async () => {
    if (!fetchDate || !isPastNewsDateInput(fetchDate)) {
      return
    }
    setFetchingExternal(true)
    try {
      const response = await fetchExternalNews({
        date: fetchDate,
        limit: fetchLimit,
        filters: activeFetchFilters.length > 0 ? activeFetchFilters : undefined,
      })
      setExternalItems(response.items)
      setSelectedExternal(new Set())
    } catch {
      // Handle error silently
    } finally {
      setFetchingExternal(false)
    }
  }

  const importExternalItems = async (toImport: ExternalNewsItem[], linksToClear: Set<string>) => {
    if (toImport.length === 0) return false
    setImportError(null)
    try {
      const created = await importExternalNews(toImport)
      setItems((prev) => [...created, ...prev])
      setExternalItems((prev) => prev.filter((item) => !linksToClear.has(item.link)))
      setSelectedExternal((prev) => {
        const next = new Set(prev)
        linksToClear.forEach((link) => next.delete(link))
        return next
      })
      setNewsTab('current')
      return true
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to add selected headlines to the feed.'
      setImportError(message)
      return false
    }
  }

  const handleImportExternal = async () => {
    const selected = externalItems.filter((item) => selectedExternal.has(item.link))
    if (selected.length === 0) {
      return
    }
    setImportingExternal(true)
    try {
      await importExternalItems(selected, selectedExternal)
    } finally {
      setImportingExternal(false)
    }
  }

  const handleImportOne = async (item: ExternalNewsItem) => {
    setImportingLink(item.link)
    try {
      await importExternalItems([item], new Set([item.link]))
    } finally {
      setImportingLink(null)
    }
  }

  const handleAdd = async () => {
    if (!title || !content || !isPastNewsDateInput(publishDate)) {
      return
    }
    setSaving(true)
    try {
      const item = await createNews({
        title,
        content,
        imageUrl,
        link,
        imageFile,
        publishedDate: publishDate,
      })
      setItems((prev) => [item, ...prev])
      resetForm()
      setNewsTab('current')
    } catch {
      // Handle error silently
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setDeleting(true)
    try {
      if (deleteMode === 'bulk') {
        const ids = Array.from(selectedFeedIds)
        if (ids.length === 0) return
        await Promise.all(ids.map((id) => deleteNews(id)))
        setItems((prev) => prev.filter((n) => !selectedFeedIds.has(n.id)))
        clearFeedSelection()
      } else {
        if (!itemToDelete) return
        await deleteNews(itemToDelete.id)
        setItems((prev) => prev.filter((n) => n.id !== itemToDelete.id))
        setSelectedFeedIds((prev) => {
          if (!prev.has(itemToDelete.id)) return prev
          const next = new Set(prev)
          next.delete(itemToDelete.id)
          return next
        })
        setItemToDelete(null)
      }
      setDeleteConfirmOpen(false)
      setDeleteMode('single')
    } catch {
      // Handle error silently
    } finally {
      setDeleting(false)
    }
  }

  const requestRemove = (item: NewsItem) => {
    setDeleteMode('single')
    setItemToDelete(item)
    setDeleteConfirmOpen(true)
  }

  const requestBulkRemove = () => {
    if (selectedFeedIds.size === 0) return
    setDeleteMode('bulk')
    setItemToDelete(null)
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
    setPublishDate(yesterdayDateInputValue())
  }

  const previewImageSrc = imagePreview || imageUrl.trim() || null

  const contentPreview = content.trim() || 'Your announcement content will appear here...'

  return (
    <PageWrapper fillViewport className="admin-hub-page-wrap relative z-10 !py-3 font-body">
      <div className="crewiq-dashboard admin-news-view relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>
        <div className="admin-news-shell relative z-10 flex min-h-0 flex-1 animate-fadeIn flex-col overflow-hidden">
          {/* Unified hub header — Deep Forest Green + view pills */}
          <header className="admin-news-hub-header">
            <div className="admin-news-hero-top">
              <div className="min-w-0">
                <h1 className="admin-news-hero-title font-display">Company News Curation Hub</h1>
              </div>
              <nav className="admin-news-tab-rail" aria-label="News curation views">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setNewsTab(tab.id)}
                    className={
                      activeTab === tab.id
                        ? 'admin-news-tab-btn admin-news-tab-btn--active'
                        : 'admin-news-tab-btn admin-news-tab-btn--inactive'
                    }
                  >
                    <tab.icon className="admin-news-tab-icon shrink-0" aria-hidden />
                    <span className="admin-news-tab-label">{tab.label}</span>
                    <span className="admin-news-tab-count tabular-nums">
                      {tab.id === 'fetch'
                        ? externalItems.length
                        : tab.id === 'current'
                          ? items.length
                          : '—'}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
            {activeTab === 'current' && (
              <div className="admin-news-metrics-band" role="group" aria-label="Feed metrics">
                <div className="admin-news-metric-tile">
                  <p className="admin-news-metric-label">Published</p>
                  <p className="admin-news-metric-value font-display">{items.length}</p>
                </div>
                <div className="admin-news-metric-tile">
                  <p className="admin-news-metric-label">Fetched Today</p>
                  <p className="admin-news-metric-value font-display">{externalItems.length}</p>
                </div>
                <div className="admin-news-metric-tile">
                  <p className="admin-news-metric-label">Selected to Import</p>
                  <p className="admin-news-metric-value font-display">{selectedExternal.size}</p>
                </div>
              </div>
            )}
          </header>

          {/* ── CURRENT FEED MANAGER ── */}
          {activeTab === 'current' && (
            <section className="admin-news-current-view" aria-label="Current feed manager">
              <div className="admin-news-feed-container">
                <div className="admin-news-feed-toolbar">
                  <div>
                    <h2 className="font-display text-sm font-extrabold admin-news-panel-title">
                      Published News
                    </h2>
                    {selectedFeedIds.size > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        {selectedFeedIds.size} selected
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {items.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={selectAllFeed}
                          className="text-xs font-bold admin-news-link hover:opacity-80"
                        >
                          Select all
                        </button>
                        {selectedFeedIds.size > 0 ? (
                          <button
                            type="button"
                            onClick={clearFeedSelection}
                            className="text-xs font-bold text-slate-500 hover:text-slate-700"
                          >
                            Clear
                          </button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          className="admin-news-btn-remove shrink-0"
                          onClick={requestBulkRemove}
                          disabled={selectedFeedIds.size === 0 || deleting}
                        >
                          Remove selected ({selectedFeedIds.size})
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-semibold admin-news-text-brand">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        Manage &amp; edit below
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-news-feed-grid">
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
                          <div className="h-8 w-20 rounded-lg skeleton" />
                        </div>
                      </div>
                    ))
                  ) : items.length === 0 ? (
                    <div className="admin-news-feed-empty col-span-full flex min-h-[220px] flex-col items-center justify-center rounded-xl px-6 text-center">
                      <Newspaper className="mb-2 h-8 w-8 admin-news-text-brand opacity-50" />
                      <p className="text-sm font-semibold admin-news-text-brand">
                        No news published yet
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Open Publish Console to create your first announcement.
                      </p>
                    </div>
                  ) : (
                    items.map((n) => (
                      <NewsCard
                        key={n.id}
                        item={n}
                        variant="hub"
                        selectable
                        selected={selectedFeedIds.has(n.id)}
                        onToggleSelect={() => toggleFeedSelection(n.id)}
                        onView={() => setPreview(n)}
                        onEdit={() => openEdit(n)}
                        onRemove={() => requestRemove(n)}
                      />
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── PUBLISH CONSOLE (full page) ── */}
          {activeTab === 'publish' && (
            <section className="admin-news-publish-page" aria-label="Publish console">
              <div className="admin-news-publish-sheet">
                <header className="admin-news-publish-form-head">
                  <h2 className="font-display text-base font-extrabold admin-news-panel-title">
                    Create Announcement
                  </h2>
                </header>

                <div className="admin-news-publish-body">
                  <div className="admin-news-publish-columns">
                    <div className="admin-news-publish-main">
                      <Input
                        label="Title"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Q2 Town Hall — June 12"
                      />

                      <label className="admin-news-publish-content-field">
                        <span className="text-sm font-semibold text-slate-800">
                          News Content <span className="text-danger">*</span>
                        </span>
                        <textarea
                          className="admin-news-textarea admin-news-publish-textarea w-full resize-y rounded-lg border text-sm font-medium text-slate-800 shadow-sm outline-none transition-ui placeholder:text-slate-400"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="Write the full announcement. Include date, venue, and key details employees should know."
                        />
                        <p className="text-xs leading-relaxed text-slate-500">
                          {content.length} characters
                        </p>
                      </label>
                    </div>

                    <div className="admin-news-publish-side">
                      <label className="block space-y-1.5">
                        <span className="text-sm font-semibold leading-relaxed text-slate-800">
                          Publish date <span className="text-danger">*</span>
                        </span>
                        <input
                          type="date"
                          value={publishDate}
                          max={MAX_PAST_NEWS_DATE}
                          onChange={(e) => setPublishDate(clampPastNewsDate(e.target.value))}
                          className="admin-news-fetch-bar-input w-full"
                          required
                        />
                        <p className="admin-news-past-date-hint" role="note">
                          {PAST_NEWS_DATE_HINT}
                        </p>
                      </label>
                      <Input
                        label="Image URL (optional)"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                      <label className="admin-news-publish-upload block">
                        <span className="mb-2 block text-sm font-semibold leading-relaxed text-slate-800">
                          Upload image (optional)
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="admin-news-file-input block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-sm file:font-bold"
                          onChange={(e) => handleImageFileChange(e.target.files?.[0] ?? null)}
                        />
                        {imageFile && (
                          <button
                            type="button"
                            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                            onClick={() => handleImageFileChange(null)}
                          >
                            Remove selected file
                          </button>
                        )}
                      </label>
                      <Input
                        label="Reference Link"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="https://example.com/read-more"
                      />
                    </div>
                  </div>

                  <div className="admin-news-publish-image-row" aria-label="Image preview">
                    <p className="admin-news-live-preview-label">Image preview</p>
                    <div className="admin-news-publish-preview-inner admin-news-publish-preview-inner--image">
                      <div className="admin-news-publish-preview-media shrink-0">
                        {previewImageSrc ? (
                          <img
                            src={previewImageSrc}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="admin-news-preview-placeholder flex h-full min-h-[7rem] items-center justify-center">
                            <Megaphone className="h-8 w-8 text-white/80" aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="admin-news-publish-preview-copy min-w-0 flex-1">
                        <span className="admin-news-tag-pill inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          <Megaphone className="h-2.5 w-2.5" aria-hidden />
                          Company News
                        </span>
                        <h3 className="mt-2 line-clamp-2 font-display text-sm font-bold text-slate-800">
                          {title.trim() || 'Announcement title'}
                        </h3>
                        <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm font-medium text-slate-600">
                          {contentPreview}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-500">
                          {isPastNewsDateInput(publishDate)
                            ? `Publish date: ${formatDate(publishedAtIsoFromDateInput(publishDate))}`
                            : PAST_NEWS_DATE_HINT}
                        </p>
                        {link.trim() ? (
                          <p className="truncate text-[10px] font-semibold admin-news-text-brand">
                            {link}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <footer className="admin-news-publish-actions">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                      Clear
                    </Button>
                    <Button
                      className="admin-news-publish-btn border-0"
                      onClick={() => void handleAdd()}
                      disabled={
                        saving ||
                        !title.trim() ||
                        !content.trim() ||
                        !isPastNewsDateInput(publishDate)
                      }
                    >
                      <PlusCircle className="h-4 w-4" />
                      {saving ? 'Publishing...' : 'Publish News'}
                    </Button>
                  </div>
                </footer>
              </div>
            </section>
          )}

          {/* ── FETCH STREAMS ── */}
          {activeTab === 'fetch' && (
            <section className="admin-news-fetch-page" aria-label="Fetch streams">
              <div className="admin-news-fetch-bar">
                <p className="admin-news-past-date-hint admin-news-past-date-hint--bar" role="note">
                  {PAST_NEWS_DATE_HINT}
                </p>
                <div className="admin-news-fetch-bar-controls">
                  <label className="admin-news-fetch-bar-field">
                    <span className="admin-news-fetch-bar-label">Date</span>
                    <input
                      type="date"
                      value={fetchDate}
                      max={MAX_PAST_NEWS_DATE}
                      onChange={(e) => setFetchDate(clampPastNewsDate(e.target.value))}
                      className="admin-news-fetch-bar-input"
                    />
                  </label>
                  <label className="admin-news-fetch-bar-field">
                    <span className="admin-news-fetch-bar-label">Count</span>
                    <select
                      className="admin-news-fetch-bar-input admin-news-fetch-select"
                      value={fetchLimit}
                      onChange={(e) => setFetchLimit(Number(e.target.value))}
                    >
                      {FETCH_LIMIT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    className="admin-news-fetch-primary-btn shrink-0 border-0"
                    onClick={() => void handleFetchExternal()}
                    disabled={fetchingExternal || !isPastNewsDateInput(fetchDate)}
                  >
                    <Rss className="h-4 w-4" />
                    {fetchingExternal ? 'Fetching...' : `Fetch ${fetchLimit}`}
                  </Button>
                  <Button
                    variant="secondary"
                    className="admin-news-secondary-btn shrink-0"
                    onClick={() => void handleImportExternal()}
                    disabled={importingExternal || selectedExternal.size === 0}
                  >
                    {importingExternal
                      ? 'Adding...'
                      : `Add selected (${selectedExternal.size})`}
                  </Button>
                </div>

                <div className="admin-news-fetch-filter-bar">
                  <span className="admin-news-fetch-bar-label shrink-0">Filters</span>
                  <div className="admin-news-fetch-filter-chips" role="list">
                    {fetchFilters.length === 0 ? (
                      <span className="text-xs font-medium text-slate-500">
                        Add a keyword below to search
                      </span>
                    ) : (
                      fetchFilters.map((term, index) => (
                        <span
                          key={`${term}-${index}`}
                          role="listitem"
                          className="admin-news-fetch-filter-pill"
                        >
                          <span className="max-w-[12rem] truncate">{term}</span>
                          <button
                            type="button"
                            className="admin-news-fetch-filter-pill-remove"
                            onClick={() => removeFetchFilter(index)}
                            aria-label={`Remove filter ${term}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="admin-news-fetch-filter-add">
                    <input
                      type="text"
                      value={newFilterInput}
                      onChange={(e) => setNewFilterInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addFetchFilter(newFilterInput)
                        }
                      }}
                      placeholder="Add keyword…"
                      className="admin-news-fetch-filter-input min-w-[8rem] flex-1 rounded-lg border px-2.5 py-1.5 text-sm font-medium text-slate-800 shadow-sm outline-none"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="admin-news-fetch-primary-btn shrink-0 border-0 px-2.5"
                      onClick={() => addFetchFilter(newFilterInput)}
                      disabled={!newFilterInput.trim()}
                      aria-label="Add filter"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="admin-news-fetch-reset shrink-0 text-xs font-bold admin-news-link hover:opacity-80"
                    onClick={resetFetchFilters}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {importError ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {importError}
                </p>
              ) : null}

              <div className="admin-news-fetch-workspace">
                {externalItems.length === 0 ? (
                  <div className="admin-news-fetch-zero flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
                      <Rss className="h-7 w-7 text-slate-400" aria-hidden />
                    </div>
                    <p className="max-w-md text-sm font-medium leading-relaxed text-slate-600">
                      Ready to fetch headlines. Set date, count, and filters in the bar above, then
                      run a search to preview external news here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="admin-news-fetch-results-head mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-600">
                        {externalItems.length} headline{externalItems.length === 1 ? '' : 's'} ·{' '}
                        {selectedExternal.size} selected
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedExternal(new Set(externalItems.map((i) => i.link)))
                        }
                        className="text-xs font-bold admin-news-link hover:opacity-80"
                      >
                        Select all
                      </button>
                    </div>
                    <div className="admin-news-fetch-results-grid grid gap-4 md:grid-cols-2">
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
                              className="mt-1 h-4 w-4"
                              aria-label={`Select ${item.title}`}
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wide admin-news-text-brand-muted">
                                {formatDate(item.publishedAt)}
                                {item.source ? ` · ${item.source}` : ''}
                              </p>
                              <h3 className="line-clamp-2 text-sm font-bold text-ink">{item.title}</h3>
                              <p className="line-clamp-3 text-xs font-medium text-slate-600">
                                {item.content}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex text-xs font-bold admin-news-text-brand hover:underline"
                                >
                                  View source
                                </a>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="admin-news-fetch-primary-btn border-0"
                                  disabled={importingLink === item.link || importingExternal}
                                  onClick={() => void handleImportOne(item)}
                                >
                                  {importingLink === item.link ? 'Adding...' : 'Add to feed'}
                                </Button>
                              </div>
                            </div>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-16 w-20 shrink-0 rounded-lg object-cover ring-1 ring-[rgba(26,67,41,0.15)]"
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
                  </>
                )}
              </div>
            </section>
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
        title={deleteMode === 'bulk' ? 'Remove selected news?' : 'Remove news?'}
        description={
          deleteMode === 'bulk'
            ? `Remove ${selectedFeedIds.size} selected announcement${
                selectedFeedIds.size === 1 ? '' : 's'
              }? They will no longer appear on dashboards or the news ticker.`
            : itemToDelete
              ? `Are you sure you want to remove "${itemToDelete.title}"? This announcement will no longer appear on dashboards or the news ticker.`
              : 'Are you sure you want to remove this news item?'
        }
        confirmLabel={deleting ? 'Removing...' : 'Remove'}
        danger
        onClose={() => {
          if (deleting) return
          setDeleteConfirmOpen(false)
          setDeleteMode('single')
          setItemToDelete(null)
        }}
        onConfirm={() => void handleRemove()}
      />
      </div>
    </PageWrapper>
  )
}
