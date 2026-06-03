import { useCallback, useEffect, useState } from 'react'
import { ImageIcon, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { Input } from '@components/ui/Input'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import {
  type AchievementPageMeta,
  type CompanyAchievementRow,
  createCompanyAchievement,
  deleteCompanyAchievement,
  fetchAchievementImageBlob,
  fetchCoverImageBlob,
  getAchievementPageMeta,
  listCompanyAchievements,
  updateAchievementPage,
  updateCompanyAchievement,
} from '@services/companyAchievementsService'
import { toast } from 'sonner'
import { cn } from '@/utils/cn'

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
  alt,
  className,
  employeePresentation,
}: {
  achievementId: string
  hasImage: boolean
  alt: string
  className?: string
  employeePresentation?: boolean
}) {
  const load = useCallback(
    () => (hasImage ? fetchAchievementImageBlob(achievementId) : Promise.resolve(null)),
    [achievementId, hasImage]
  )
  const { url, loading } = useBlobUrl(load, [achievementId, hasImage], hasImage)

  const frame = employeePresentation ? 'rounded-xl border border-zinc-200/80 shadow-md' : 'rounded-2xl border border-border shadow-sm'

  if (!hasImage) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center border border-dashed bg-muted/30 text-muted',
          employeePresentation ? 'rounded-xl border-zinc-200 bg-zinc-50' : 'rounded-2xl border-border',
          className
        )}
      >
        <ImageIcon className="mb-2 h-14 w-14 opacity-60" />
        <span className="text-sm">Image placeholder</span>
      </div>
    )
  }

  if (loading || !url) {
    return (
      <div
        className={cn(
          'flex items-center justify-center border bg-muted/40',
          frame,
          className
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted" />
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden', frame, className)}>
      <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </div>
  )
}

/** Corporate marketing-style layout (centered hero, green headings, white sections) — use on employee portal */
export function CompanyAchievementsExperience({
  editable = false,
  bleedClassName = '',
  employeePresentation = false,
  adminHub = false,
}: {
  editable?: boolean
  /** Extra classes for full-bleed breakout (e.g. employee main padding) */
  bleedClassName?: string
  /** Match employee-facing reference: centered hero, #006400 titles, centered section intro */
  employeePresentation?: boolean
  /** Admin portal hub shell — dash palette panels (not employee layout) */
  adminHub?: boolean
}) {
  const ep = employeePresentation
  const [pageMeta, setPageMeta] = useState<AchievementPageMeta | null>(null)
  const [rows, setRows] = useState<CompanyAchievementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const coverEnabled = !!(pageMeta?.hasCoverImage)
  const coverRevision = pageMeta?.updatedAt ?? ''
  const loadCover = useCallback(
    () => (coverEnabled ? fetchCoverImageBlob() : Promise.resolve(null)),
    [coverEnabled]
  )
  const { url: coverUrl, loading: coverLoading } = useBlobUrl(loadCover, [coverRevision], coverEnabled)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [p, list] = await Promise.all([
        getAchievementPageMeta(),
        listCompanyAchievements(),
      ])
      setPageMeta(p)
      setRows(list)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to load achievements'
      setLoadError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Cover modal
  const [coverOpen, setCoverOpen] = useState(false)
  const [covTitle, setCovTitle] = useState('')
  const [covSubtitle, setCovSubtitle] = useState('')
  const [covClear, setCovClear] = useState(false)
  const [covSaving, setCovSaving] = useState(false)
  const [covFile, setCovFile] = useState<File | null>(null)

  useEffect(() => {
    if (coverOpen && pageMeta) {
      setCovTitle(pageMeta.title || '')
      setCovSubtitle(pageMeta.subtitle || '')
      setCovClear(false)
      setCovFile(null)
    }
  }, [coverOpen, pageMeta])

  const saveCover = async () => {
    if (!covTitle.trim()) {
      toast.error('Title is required')
      return
    }
    setCovSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', covTitle.trim())
      fd.append('subtitle', covSubtitle.trim())
      if (covClear) fd.append('clearCover', 'true')
      if (covFile) fd.append('cover', covFile)
      const next = await updateAchievementPage(fd)
      setPageMeta(next)
      setCoverOpen(false)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to save cover'
      toast.error(msg)
    } finally {
      setCovSaving(false)
    }
  }

  // Add / edit achievement
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CompanyAchievementRow | null>(null)
  const [aTitle, setATitle] = useState('')
  const [aDesc, setADesc] = useState('')
  const [aFile, setAFile] = useState<File | null>(null)
  const [aRemoveImage, setARemoveImage] = useState(false)
  const [aSaving, setASaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompanyAchievementRow | null>(null)

  const openAdd = () => {
    setEditTarget(null)
    setATitle('')
    setADesc('')
    setAFile(null)
    setARemoveImage(false)
    setAddOpen(true)
  }

  const openEdit = (r: CompanyAchievementRow) => {
    setEditTarget(r)
    setATitle(r.title)
    setADesc(r.description)
    setAFile(null)
    setARemoveImage(false)
    setAddOpen(true)
  }

  const saveAchievement = async () => {
    if (!aTitle.trim() || !aDesc.trim()) {
      toast.error('Title and description are required')
      return
    }
    setASaving(true)
    try {
      const fd = new FormData()
      fd.append('title', aTitle.trim())
      fd.append('description', aDesc.trim())
      if (aFile) fd.append('image', aFile)
      if (editTarget && aRemoveImage && !aFile) fd.append('removeImage', 'true')

      if (editTarget) {
        const updated = await updateCompanyAchievement(editTarget.id, fd)
        setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      } else {
        const created = await createCompanyAchievement(fd)
        setRows((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder))
      }
      setAddOpen(false)
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
      setRows((prev) => prev.filter((x) => x.id !== deleteTarget.id))
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete'
      toast.error(msg)
    } finally {
      setDeleteTarget(null)
    }
  }

  const displayTitle = pageMeta?.title?.trim() || 'Company achievements'
  const displaySubtitle = pageMeta?.subtitle?.trim() || ''

  return (
    <div
      className={cn(
        'w-full max-w-none text-ink',
        adminHub
          ? 'admin-achievements-experience'
          : cn('min-h-[calc(100vh-4rem)]', ep ? 'bg-white' : 'bg-background'),
        bleedClassName
      )}
    >
      {loadError && (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          {loadError}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}

      {/* Cover hero */}
      <section
        className={cn('relative isolate w-full overflow-hidden bg-zinc-900', ep ? 'min-h-[min(520px,55vh)]' : 'min-h-[42vh]')}
      >
        {pageMeta?.hasCoverImage ? (
          coverUrl && !coverLoading ? (
            <img
              src={coverUrl}
              alt=""
              className={cn('absolute inset-0 h-full w-full object-cover', ep ? 'opacity-80' : 'opacity-90')}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              <Loader2 className="h-10 w-10 animate-spin text-white/40" />
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <ImageIcon className="h-16 w-16 opacity-50" />
              <span className="text-sm font-medium tracking-wide">Cover image placeholder</span>
            </div>
          </div>
        )}
        <div
          className={cn(
            'absolute inset-0',
            ep
              ? 'bg-gradient-to-b from-black/50 via-black/60 to-black/75'
              : 'bg-gradient-to-t from-black/75 via-black/35 to-black/20'
          )}
        />
        <div
          className={cn(
            'relative z-10 flex flex-col px-6 sm:px-10 lg:px-16',
            ep ? 'min-h-[min(520px,55vh)] items-center justify-center py-16 text-center' : 'min-h-[42vh] justify-end pb-12 pt-24'
          )}
        >
          {editable && (
            <div className={cn('absolute top-4 z-20 sm:right-8', ep ? 'right-4 sm:right-8' : 'right-4')}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-white/95 shadow-md backdrop-blur"
                onClick={() => setCoverOpen(true)}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Change cover
              </Button>
            </div>
          )}
          {loading && !pageMeta ? (
            <div className="flex items-center gap-2 text-white/90">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <h1
                className={cn(
                  'text-white',
                  ep
                    ? 'max-w-5xl font-sans text-3xl font-bold uppercase tracking-[0.12em] sm:text-4xl md:text-5xl lg:text-6xl'
                    : 'font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl'
                )}
              >
                {displayTitle}
              </h1>
              {displaySubtitle ? (
                <p
                  className={cn(
                    'text-white/95',
                    ep
                      ? 'mx-auto mt-5 max-w-2xl font-sans text-base font-normal leading-relaxed sm:text-lg'
                      : 'mt-3 max-w-2xl text-lg sm:text-xl'
                  )}
                >
                  {displaySubtitle}
                </p>
              ) : (
                !ep && (
                  <p className="mt-3 max-w-2xl text-sm italic text-white/60">
                    {editable ? 'Add a subtitle when you edit the cover.' : ''}
                  </p>
                )
              )}
            </>
          )}
        </div>
      </section>

      {/* Section intro */}
      <div
        className={cn(
          'px-4 sm:px-8 lg:px-12',
          adminHub
            ? 'admin-achievements-intro'
            : ep
              ? 'border-b border-zinc-100 bg-white py-14 lg:py-20'
              : 'border-b border-border bg-muted/20 py-10'
        )}
      >
        <div
          className={cn(
            'mx-auto max-w-6xl',
            ep ? 'text-center' : 'flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'
          )}
        >
          <div className={ep ? 'mx-auto max-w-2xl' : undefined}>
            <h2
              className={cn(
                adminHub
                  ? 'admin-achievements-section-title font-display text-2xl font-extrabold'
                  : ep
                    ? 'font-sans text-2xl font-bold tracking-tight text-[#006400] sm:text-3xl md:text-[2rem]'
                    : 'font-display text-2xl font-semibold text-ink'
              )}
            >
              Our achievements
            </h2>
            {!adminHub && (
              <p
                className={cn(
                  ep ? 'mt-4 font-sans text-sm text-zinc-500 sm:text-base' : 'mt-1 text-sm text-muted'
                )}
              >
                {ep
                  ? 'Celebrating our greatest milestones and accomplishments.'
                  : 'Milestones and recognition that shape our culture.'}
              </p>
            )}
          </div>
          {editable && (
            <Button
              type="button"
              onClick={openAdd}
              className={cn(
                'shrink-0',
                adminHub && 'admin-achievements-primary-btn border-0',
                ep && 'mx-auto mt-8 sm:mx-0 sm:mt-0'
              )}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add achievement
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mx-auto max-w-6xl px-4 py-20 text-center text-muted sm:px-8">
          <p>No achievements published yet.</p>
          {editable && (
            <Button type="button" variant="secondary" className="mt-4" onClick={openAdd}>
              Add the first one
            </Button>
          )}
        </div>
      ) : (
        <div className={cn('mx-auto max-w-6xl', (ep || adminHub) && 'bg-white', adminHub && 'admin-achievements-list')}>
          {rows.map((row, index) => (
            <article
              key={row.id}
              className={cn(
                'grid gap-8 px-4 sm:px-8 lg:grid-cols-2 lg:px-12',
                adminHub
                  ? 'admin-achievements-row py-12 last:border-b-0 lg:gap-12 lg:py-14'
                  : ep
                    ? 'border-b border-zinc-100 py-14 last:border-b-0 lg:gap-16 lg:py-20'
                    : 'border-b border-border py-14 last:border-b-0 lg:gap-12 lg:py-16'
              )}
            >
              <div
                className={`flex flex-col justify-center ${
                  index % 2 === 1 ? 'lg:order-2' : 'lg:order-1'
                }`}
              >
                <AchievementPhoto
                  achievementId={row.id}
                  hasImage={row.hasImage}
                  alt={row.title}
                  employeePresentation={ep}
                  className="aspect-[4/3] w-full max-h-[360px] lg:max-h-none"
                />
              </div>
              <div
                className={`flex flex-col justify-center ${
                  index % 2 === 1 ? 'lg:order-1' : 'lg:order-2'
                }`}
              >
                <h3
                  className={cn(
                    adminHub
                      ? 'admin-achievements-item-title font-display text-2xl font-bold lg:text-3xl'
                      : ep
                        ? 'font-sans text-xl font-bold text-[#006400] sm:text-2xl lg:text-[1.75rem]'
                        : 'font-display text-2xl font-semibold text-ink lg:text-3xl'
                  )}
                >
                  {row.title}
                </h3>
                <p
                  className={cn(
                    'mt-4 whitespace-pre-wrap leading-relaxed',
                    ep ? 'font-sans text-sm text-zinc-600 sm:text-base' : 'text-base text-muted'
                  )}
                >
                  {row.description}
                </p>
                {editable && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(row)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => setDeleteTarget(row)}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Cover modal */}
      <Modal isOpen={coverOpen} onClose={() => setCoverOpen(false)} title="Edit cover section" size="lg">
        <div className="grid gap-4">
          <Input label="Title" value={covTitle} onChange={(e) => setCovTitle(e.target.value)} />
          <label className="text-sm font-medium text-ink">
            Subtitle
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={covSubtitle}
              onChange={(e) => setCovSubtitle(e.target.value)}
            />
          </label>
          <div>
            <p className="text-sm font-medium text-ink">Cover image</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              onChange={(e) => setCovFile(e.target.files?.[0] ?? null)}
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={covClear} onChange={(e) => setCovClear(e.target.checked)} />
              Remove existing cover image
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setCoverOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={covSaving} onClick={() => void saveCover()}>
              {covSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add / edit achievement */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={editTarget ? 'Edit achievement' : 'Add achievement'}
        size="lg"
      >
        <div className="grid gap-4">
          <Input label="Title" value={aTitle} onChange={(e) => setATitle(e.target.value)} />
          <label className="text-sm font-medium text-ink">
            Description
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={aDesc}
              onChange={(e) => setADesc(e.target.value)}
            />
          </label>
          <div>
            <p className="text-sm font-medium text-ink">Image (JPEG, PNG, WebP)</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              onChange={(e) => setAFile(e.target.files?.[0] ?? null)}
            />
            {editTarget?.hasImage && (
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
            <Button type="button" disabled={aSaving} onClick={() => void saveAchievement()}>
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
