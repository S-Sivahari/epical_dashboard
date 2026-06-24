import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImageIcon, Loader2, Plus, Search, Trophy } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { SelectField } from '@components/forms/SelectField'
import { AchievementFeedCard } from '@components/company-achievements/AchievementFeedCard'
import {
  type AchievementPageMeta,
  type CompanyAchievementRow,
  createCompanyAchievement,
  deleteCompanyAchievement,
  fetchAchievementImageBlob,
  getAchievementPageMeta,
  listAchievementCategories,
  listCompanyAchievements,
  updateCompanyAchievement,
} from '@services/companyAchievementsService'
import { toast } from 'sonner'
import { cn } from '@/utils/cn'
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENTS_PAGE_SIZE,
} from '@/utils/achievementConstants'

function useBlobUrl(
  loader: () => Promise<Blob | null>,
  deps: unknown[],
  enabled = true
) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setUrl(null)
      setLoading(false)
      return
    }
    let alive = true
    let objectUrl: string | null = null
    setUrl(null)
    setLoading(true)
    void loader().then((blob) => {
      if (!alive) return
      if (blob && blob.size > 0) {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      } else {
        setUrl(null)
      }
      setLoading(false)
    })
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return { url, loading }
}

function AchievementPhoto({
  achievementId,
  hasImage,
  imageRevision,
  alt,
  className,
}: {
  achievementId: string
  hasImage: boolean
  imageRevision?: string | null
  alt: string
  className?: string
}) {
  const load = useCallback(
    () =>
      hasImage
        ? fetchAchievementImageBlob(achievementId, imageRevision)
        : Promise.resolve(null),
    [achievementId, hasImage, imageRevision]
  )
  const { url, loading } = useBlobUrl(load, [achievementId, hasImage, imageRevision], hasImage)

  if (!hasImage) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-[#f0fdf4] text-muted',
          className
        )}
      >
        <ImageIcon className="mb-2 h-12 w-12 opacity-50" />
        <span className="text-sm">No image</span>
      </div>
    )
  }

  if (loading || !url) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center bg-slate-50', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-[#06C033]" />
      </div>
    )
  }

  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-slate-50', className)}>
      <img
        src={url}
        alt={alt}
        className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
        loading="lazy"
      />
    </div>
  )
}

const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => currentYear - i)
const MONTH_OPTIONS = [
  { value: '', label: 'All months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

function toDateInputValue(iso?: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function CompanyAchievementsExperience({
  editable = false,
  bleedClassName = '',
  employeePresentation = false,
  adminHub = false,
}: {
  editable?: boolean
  bleedClassName?: string
  employeePresentation?: boolean
  adminHub?: boolean
}) {
  const ep = employeePresentation
  const [pageMeta, setPageMeta] = useState<AchievementPageMeta | null>(null)
  const [rows, setRows] = useState<CompanyAchievementRow[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const fetchAchievements = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else {
        setLoading(true)
        setLoadError(null)
      }

      try {
        const result = await listCompanyAchievements({
          q: searchQuery.trim() || undefined,
          category: filterCategory || undefined,
          year: filterYear ? Number(filterYear) : undefined,
          month: filterMonth ? Number(filterMonth) : undefined,
          page: pageNum,
          limit: ACHIEVEMENTS_PAGE_SIZE,
        })

        setRows((prev) => (append ? [...prev, ...result.items] : result.items))
        setTotal(result.total)
        setHasMore(result.hasMore)
        setPage(result.page)
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to load achievements'
        setLoadError(msg)
        toast.error(msg)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [searchQuery, filterCategory, filterYear, filterMonth]
  )

  const loadPageSettings = useCallback(async () => {
    try {
      const [p, cats] = await Promise.all([getAchievementPageMeta(), listAchievementCategories()])
      setPageMeta(p)
      setCategories(cats)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load page settings'
      toast.error(msg)
    }
  }, [])

  useEffect(() => {
    void loadPageSettings()
  }, [loadPageSettings])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAchievements(1, false)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery, filterCategory, filterYear, filterMonth, fetchAchievements])

  const categoryOptions = useMemo(() => {
    const merged = new Set<string>([...ACHIEVEMENT_CATEGORIES, ...categories])
    return [
      { value: '', label: 'All categories' },
      ...Array.from(merged)
        .sort((a, b) => a.localeCompare(b))
        .map((c) => ({ value: c, label: c })),
    ]
  }, [categories])

  const defaultSectionTitle = 'Our achievements'
  const employeeSectionSubtitle = 'Celebrating milestones, recognition, and team wins.'
  // For employee presentation, always use the stable default to avoid a flicker from
  // the async pageMeta load overriding the initial title.
  const displaySectionTitleOverride = ep ? defaultSectionTitle : undefined

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CompanyAchievementRow | null>(null)
  const [aTitle, setATitle] = useState('')
  const [aDesc, setADesc] = useState('')
  const [aCategory, setACategory] = useState<string>(ACHIEVEMENT_CATEGORIES[0])
  const [aEmployee, setAEmployee] = useState('')
  const [aDate, setADate] = useState(toDateInputValue(new Date().toISOString()))
  const [aTags, setATags] = useState('')
  const [aFile, setAFile] = useState<File | null>(null)
  const [aFilePreviewUrl, setAFilePreviewUrl] = useState<string | null>(null)
  const [aRemoveImage, setARemoveImage] = useState(false)
  const [aSaving, setASaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompanyAchievementRow | null>(null)

  useEffect(() => {
    if (!aFile) {
      setAFilePreviewUrl(null)
      return
    }
    const preview = URL.createObjectURL(aFile)
    setAFilePreviewUrl(preview)
    return () => URL.revokeObjectURL(preview)
  }, [aFile])

  const resetForm = () => {
    setATitle('')
    setADesc('')
    setACategory(ACHIEVEMENT_CATEGORIES[0])
    setAEmployee('')
    setADate(toDateInputValue(new Date().toISOString()))
    setATags('')
    setAFile(null)
    setARemoveImage(false)
  }

  const openAdd = () => {
    setEditTarget(null)
    resetForm()
    setAddOpen(true)
  }

  const openEdit = (r: CompanyAchievementRow) => {
    setEditTarget(r)
    setATitle(r.title)
    setADesc(r.description)
    setACategory(r.category || ACHIEVEMENT_CATEGORIES[0])
    setAEmployee(r.employeeOrTeamName)
    setADate(toDateInputValue(r.achievementDate))
    setATags(r.tags.join(', '))
    setAFile(null)
    setARemoveImage(false)
    setAddOpen(true)
  }

  const saveAchievement = async () => {
    if (!aTitle.trim() || !aDesc.trim()) {
      toast.error('Title and description are required')
      return
    }
    if (!aCategory.trim()) {
      toast.error('Category is required')
      return
    }
    if (!aEmployee.trim()) {
      toast.error('Employee or team name is required')
      return
    }
    if (!aDate) {
      toast.error('Achievement date is required')
      return
    }

    setASaving(true)
    try {
      const fd = new FormData()
      fd.append('title', aTitle.trim())
      fd.append('description', aDesc.trim())
      fd.append('category', aCategory.trim())
      fd.append('employeeOrTeamName', aEmployee.trim())
      fd.append('achievementDate', aDate)
      fd.append('tags', aTags.trim())
      if (aFile) fd.append('image', aFile)
      if (editTarget && aRemoveImage && !aFile) fd.append('removeImage', 'true')

      if (editTarget) {
        await updateCompanyAchievement(editTarget.id, fd)
        toast.success('Achievement updated')
      } else {
        await createCompanyAchievement(fd)
        toast.success('Achievement published')
      }
      setAddOpen(false)
      void fetchAchievements(1, false)
      void listAchievementCategories().then(setCategories).catch(() => {})
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to save achievement'
      toast.error(msg)
    } finally {
      setASaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCompanyAchievement(deleteTarget.id)
      toast.success('Achievement deleted')
      void fetchAchievements(1, false)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete'
      toast.error(msg)
    } finally {
      setDeleteTarget(null)
    }
  }

  const displaySectionTitle = displaySectionTitleOverride ?? (pageMeta?.title?.trim() || defaultSectionTitle)
  const hasActiveFilters = !!(searchQuery || filterCategory || filterYear || filterMonth)

  const clearFilters = () => {
    setSearchQuery('')
    setFilterCategory('')
    setFilterYear('')
    setFilterMonth('')
  }

  return (
    <div
      className={cn(
        'w-full max-w-none text-ink',
        adminHub
          ? 'admin-achievements-experience'
          : cn('min-h-[calc(100vh-4rem)]', ep ? 'bg-[#fafdfb]' : 'bg-background'),
        bleedClassName
      )}
    >
      {loadError && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          {loadError}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => void fetchAchievements(1, false)}>
            Retry
          </Button>
        </div>
      )}

      <div
        className={cn(
          adminHub
            ? 'admin-achievements-intro'
            : cn(
                'px-4 sm:px-8 lg:px-12',
                ep
                  ? 'border-b border-[#06C033]/10 bg-white py-10 lg:py-14'
                  : 'border-b border-border bg-gradient-to-br from-white to-[#f0fdf4] py-10'
              )
        )}
      >
        <div
          className={cn(
            adminHub ? 'admin-achievements-intro-inner' : 'mx-auto max-w-7xl',
            ep ? 'text-center' : 'flex flex-col gap-6'
          )}
        >
          <div className={cn(ep && 'mx-auto max-w-2xl')}>
            
            <h2
              className={cn(
                adminHub
                  ? 'admin-achievements-section-title font-display text-2xl font-extrabold text-[#06C033]'
                  : ep
                    ? 'font-sans text-3xl font-bold tracking-tight text-[#06C033] sm:text-4xl'
                    : 'font-display text-2xl font-semibold text-[#06C033] sm:text-3xl'
              )}
            >
              {displaySectionTitle}
            </h2>
            {employeePresentation ? (
              <p className="mt-4 font-sans text-base text-slate-600 sm:text-lg">
                {employeeSectionSubtitle}
              </p>
            ) : null}
          </div>

          {editable && (
            <div
              className={cn(
                'flex shrink-0 flex-wrap items-center gap-2',
                ep ? 'mx-auto justify-center' : 'justify-start sm:justify-end'
              )}
            >
              <Button
                type="button"
                onClick={openAdd}
                className={cn(
                  'border-0 bg-[#06C033] text-white hover:bg-[#05a82c]',
                  adminHub && 'admin-achievements-primary-btn'
                )}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Achievement
              </Button>
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          adminHub ? 'admin-achievements-filters px-4 py-4' : 'mx-auto max-w-7xl px-4 py-6 sm:px-8 lg:px-12'
        )}
      >
        <div className="rounded-2xl border border-[#06C033]/15 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block w-full space-y-1.5 lg:col-span-2">
              <span className="text-sm font-medium text-ink">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title..."
                  className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </label>
            <SelectField
              label="Category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              options={categoryOptions}
              showChevron
            />
            <SelectField
              label="Year"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              options={[
                { value: '', label: 'All years' },
                ...YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) })),
              ]}
              showChevron
            />
            <SelectField
              label="Month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              options={MONTH_OPTIONS}
              showChevron
              disabled={!filterYear}
            />
          </div>
          {hasActiveFilters ? (
            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <span className="text-muted">
                Showing {rows.length} of {total} achievement{total === 1 ? '' : 's'}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div
          className={cn(
            'flex min-h-[240px] items-center justify-center py-20',
            adminHub && 'admin-achievements-loading'
          )}
        >
          <Loader2 className="h-10 w-10 animate-spin text-[#06C033]" />
        </div>
      ) : rows.length === 0 ? (
        <div
          className={cn(
            'py-20 text-center text-muted',
            adminHub ? 'admin-achievements-empty' : 'mx-auto max-w-7xl px-4 sm:px-8'
          )}
        >
          <Trophy className="mx-auto mb-3 h-10 w-10 text-[#06C033]/40" />
          <p>{hasActiveFilters ? 'No achievements match your filters.' : 'No achievements published yet.'}</p>
          {editable && !hasActiveFilters && (
            <Button type="button" variant="secondary" className="mt-4" onClick={openAdd}>
              Add the first one
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            adminHub ? 'admin-achievements-list px-4 pb-8' : 'mx-auto max-w-7xl px-4 pb-12 sm:px-8 lg:px-12',
            (ep || adminHub) && 'bg-transparent'
          )}
        >
          <div className="columns-1 gap-5 sm:columns-2 xl:columns-3 [&>article]:mb-5">
            {rows.map((row) => (
              <AchievementFeedCard
                key={row.id}
                row={row}
                editable={editable}
                onEdit={() => openEdit(row)}
                onDelete={() => setDeleteTarget(row)}
                imageSlot={
                  <AchievementPhoto
                    achievementId={row.id}
                    hasImage={row.hasImage}
                    imageRevision={row.updatedAt}
                    alt={row.title}
                    className="h-full w-full"
                  />
                }
              />
            ))}
          </div>

          {hasMore ? (
            <div className="mt-8 flex justify-center">
              <Button
                type="button"
                variant="secondary"
                disabled={loadingMore}
                onClick={() => void fetchAchievements(page + 1, true)}
                className="min-w-[160px] border-[#06C033]/30 text-[#047a24] hover:bg-[#f0fdf4]"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={editTarget ? 'Edit achievement' : 'Add achievement'}
        size="lg"
      >
        <div className="grid gap-4">
          <Input label="Title" value={aTitle} onChange={(e) => setATitle(e.target.value)} required />
          <label className="text-sm font-medium text-ink">
            Description
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={aDesc}
              onChange={(e) => setADesc(e.target.value)}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Category"
              value={aCategory}
              onChange={(e) => setACategory(e.target.value)}
              options={categoryOptions.filter((o) => o.value !== '')}
              showChevron
              required
            />
            <Input
              label="Employee / team name"
              value={aEmployee}
              onChange={(e) => setAEmployee(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Achievement date"
              type="date"
              value={aDate}
              onChange={(e) => setADate(e.target.value)}
              required
            />
            <Input
              label="Tags (optional)"
              value={aTags}
              onChange={(e) => setATags(e.target.value)}
              placeholder="innovation, milestone"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Image (JPEG/JPG)</p>
            <input
              type="file"
              accept="image/jpeg,image/jpg,.jpg,.jpeg"
              className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-[#06C033] file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              onChange={(e) => {
                setAFile(e.target.files?.[0] ?? null)
                if (e.target.files?.[0]) setARemoveImage(false)
              }}
            />
            {aFilePreviewUrl && (
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-slate-50">
                <img
                  src={aFilePreviewUrl}
                  alt="New image preview"
                  className="mx-auto max-h-64 w-full object-contain"
                />
                <p className="bg-muted/30 px-3 py-1.5 text-xs text-muted">New image (not saved yet)</p>
              </div>
            )}
            {editTarget?.hasImage && !aFilePreviewUrl && (
              <label className="mt-3 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={aRemoveImage}
                  onChange={(e) => setARemoveImage(e.target.checked)}
                />
                Remove current image
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={aSaving}
              onClick={() => void saveAchievement()}
              className="border-0 bg-[#06C033] text-white hover:bg-[#05a82c]"
            >
              {aSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete this achievement?"
        description={deleteTarget ? `“${deleteTarget.title}” will be removed permanently.` : ''}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
