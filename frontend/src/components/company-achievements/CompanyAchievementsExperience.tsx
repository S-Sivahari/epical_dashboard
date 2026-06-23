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
  employeePresentation,
}: {
  achievementId: string
  hasImage: boolean
  imageRevision?: string | null
  alt: string
  className?: string
  employeePresentation?: boolean
}) {
  const load = useCallback(
    () =>
      hasImage
        ? fetchAchievementImageBlob(achievementId, imageRevision)
        : Promise.resolve(null),
    [achievementId, hasImage, imageRevision]
  )
  const { url, loading } = useBlobUrl(load, [achievementId, hasImage, imageRevision], hasImage)

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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  const [pageEditOpen, setPageEditOpen] = useState(false)
  const [pageTitle, setPageTitle] = useState('')
  const [pageSaving, setPageSaving] = useState(false)

  useEffect(() => {
    if (pageEditOpen && pageMeta) {
      setPageTitle(pageMeta.title || '')
    }
  }, [pageEditOpen, pageMeta])

  const savePageTitle = async () => {
    if (!pageTitle.trim()) {
      toast.error('Page title is required')
      return
    }
    setPageSaving(true)
    try {
      const next = await updateAchievementPage(pageTitle.trim())
      setPageMeta(next)
      setPageEditOpen(false)
      toast.success('Page title saved')
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to save page title'
      toast.error(msg)
    } finally {
      setPageSaving(false)
    }
  }

  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CompanyAchievementRow | null>(null)
  const [aTitle, setATitle] = useState('')
  const [aDesc, setADesc] = useState('')
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

  return (
    <div
      className={cn(
        'w-full max-w-none text-ink',
        adminHub
          ? 'admin-achievements-experience'
          : 'min-h-[calc(100vh-4rem)] bg-[#f4faf7]',
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

      <header
        className={cn(
          adminHub
            ? 'admin-achievements-intro'
            : cn(
                'border-b border-[#d4e8dc] px-4 sm:px-8 lg:px-12',
                'bg-[#e8f5ee] py-10 lg:py-14'
              )
        )}
      >
        <div
          className={cn(
            adminHub
              ? 'admin-achievements-intro-inner flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'
              : cn(
                  'mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
                  ep && 'text-center sm:text-left'
                )
          )}
        >
          {loading && !pageMeta ? (
            <div className="flex items-center gap-2 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : (
            <h1
              className={cn(
                adminHub
                  ? 'admin-achievements-section-title font-display text-2xl font-extrabold'
                  : ep
                    ? 'font-sans text-3xl font-bold tracking-tight text-[#006400] sm:text-4xl'
                    : 'font-display text-2xl font-semibold text-[#006400] sm:text-3xl'
              )}
            >
              {displayTitle}
            </h1>
          )}
          {editable && (
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPageEditOpen(true)}
                className={adminHub ? 'admin-achievements-secondary-btn' : undefined}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit title
              </Button>
              <Button
                type="button"
                onClick={openAdd}
                className={cn(adminHub && 'admin-achievements-primary-btn border-0')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Achievement
              </Button>
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div
          className={cn(
            'flex min-h-[200px] items-center justify-center py-20',
            adminHub && 'admin-achievements-loading'
          )}
        >
          <Loader2 className="h-10 w-10 animate-spin text-muted" />
        </div>
      ) : rows.length === 0 ? (
        <div
          className={cn(
            'py-20 text-center text-muted',
            adminHub ? 'admin-achievements-empty' : 'mx-auto max-w-6xl px-4 sm:px-8'
          )}
        >
          <p>No achievements published yet.</p>
          {editable && (
            <Button type="button" variant="secondary" className="mt-4" onClick={openAdd}>
              Add the first one
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            adminHub ? 'w-full admin-achievements-list' : 'mx-auto max-w-6xl'
          )}
        >
          {rows.map((row, index) => (
            <article
              key={row.id}
              className={cn(
                adminHub
                  ? 'admin-achievements-row last:border-b-0'
                  : cn(
                      'grid gap-8 px-4 sm:px-8 lg:grid-cols-2 lg:px-12',
                      ep
                        ? 'border-b border-zinc-100 py-14 last:border-b-0 lg:gap-16 lg:py-20'
                        : 'border-b border-border py-14 last:border-b-0 lg:gap-12 lg:py-16'
                    )
              )}
            >
              <div
                className={cn(
                  adminHub
                    ? 'admin-achievements-row-inner grid gap-8 lg:grid-cols-2 lg:gap-12'
                    : 'contents'
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
                    imageRevision={row.updatedAt}
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
                        ? 'admin-achievements-item-title font-display text-2xl font-bold text-[#006400] lg:text-3xl'
                        : ep
                          ? 'font-sans text-2xl font-bold text-[#006400] sm:text-3xl lg:text-4xl'
                          : 'font-display text-2xl font-semibold text-[#006400] lg:text-3xl'
                    )}
                  >
                    {row.title}
                  </h3>
                  <p
                    className={cn(
                      'mt-4 whitespace-pre-wrap leading-relaxed text-zinc-600',
                      ep ? 'font-sans text-base sm:text-lg' : 'text-base'
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
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={pageEditOpen}
        onClose={() => setPageEditOpen(false)}
        title="Edit page title"
        size="md"
      >
        <div className="grid gap-4">
          <Input
            label="Page title"
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            placeholder="Company achievements"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setPageEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pageSaving}
              onClick={() => void savePageTitle()}
              className={adminHub ? 'admin-achievements-primary-btn border-0' : undefined}
            >
              {pageSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </Modal>

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
              onChange={(e) => {
                setAFile(e.target.files?.[0] ?? null)
                if (e.target.files?.[0]) setARemoveImage(false)
              }}
            />
            {aFilePreviewUrl && (
              <div className="mt-3 overflow-hidden rounded-xl border border-border">
                <img
                  src={aFilePreviewUrl}
                  alt="New image preview"
                  className="aspect-[4/3] w-full object-cover"
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
