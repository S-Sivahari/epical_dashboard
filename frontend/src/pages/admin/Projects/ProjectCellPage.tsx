import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, GitBranch, Layers, ListChecks, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageWrapper } from '@components/layout/PageWrapper'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { ROUTES } from '@constants/routes'
import { getEmployees } from '@services/employeeService'
import {
  addReviewMessage,
  completeCell,
  createCellReview,
  deleteCell,
  fetchCellReviews,
  fetchWorkspaceSummary,
  updateCell,
  updateCellStatus,
} from '@/services/projectWorkspaceService'
import { cn } from '@/utils/cn'
import {
  CELL_STATUSES,
  CELL_TYPES,
  type CellReview,
  type CellStatus,
  type ProjectCell,
  type ProjectLibrary,
  type WorkspaceSummary,
} from '@/types/projectWorkspace'
import type { Employee } from '@/types'
import { STATUS_LABELS, cellDisplayStatus } from './projectWorkspaceUi'
import { CellWorkflowPanel } from './CellWorkflowPanel'
import './adminProjects.css'

type CellTab = 'details' | 'workflow' | 'dependencies'

const TAB_ITEMS: { id: CellTab; label: string; icon: typeof Layers }[] = [
  { id: 'details', label: 'Details', icon: Layers },
  { id: 'workflow', label: 'Workflow', icon: ListChecks },
  { id: 'dependencies', label: 'Dependencies', icon: GitBranch },
]

export function ProjectCellPage() {
  const { projectId = '', cellId = '' } = useParams()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CellTab>('details')
  const [isEditing, setIsEditing] = useState(false)
  const [cellForm, setCellForm] = useState<ProjectCell | null>(null)
  const [viewTab, setViewTab] = useState<'layout' | 'symbol' | 'schematic'>('layout')
  const [selectedDepIds, setSelectedDepIds] = useState<string[]>([])
  const [reviews, setReviews] = useState<CellReview[]>([])
  const [reviewComment, setReviewComment] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!projectId || !cellId) return
    setLoading(true)
    try {
      const [ws, empsRes, reviewList] = await Promise.all([
        fetchWorkspaceSummary(projectId),
        getEmployees({ status: 'Active', pageSize: 500 }),
        fetchCellReviews(projectId, cellId),
      ])
      setSummary(ws)
      setEmployees(empsRes.data ?? [])
      setReviews(reviewList)
      const cell = ws.cells.find((c) => c.id === cellId)
      if (cell) {
        setCellForm(cell)
        setSelectedDepIds(cell.dependencyCellIds ?? [])
      }
    } catch {
      toast.error('Failed to load cell')
    } finally {
      setLoading(false)
    }
  }, [projectId, cellId])

  useEffect(() => {
    void reload()
  }, [reload])

  const cell = useMemo(
    () => summary?.cells.find((c) => c.id === cellId) ?? null,
    [summary?.cells, cellId],
  )

  const libraries = summary?.libraries ?? []
  const allCells = summary?.cells ?? []

  const libraryNameById = useMemo(() => {
    const names = new Map<string, string>()
    for (const lib of libraries) names.set(lib.id, lib.name)
    return names
  }, [libraries])

  const libraryCellCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of allCells) counts.set(c.libraryId, (counts.get(c.libraryId) ?? 0) + 1)
    return counts
  }, [allCells])

  const dependencyOptions = useMemo(
    () => allCells.filter((c) => c.id !== cellId),
    [allCells, cellId],
  )

  const toggleDependency = (depId: string) => {
    setSelectedDepIds((prev) =>
      prev.includes(depId) ? prev.filter((id) => id !== depId) : [...prev, depId],
    )
  }

  const cancelEdit = () => {
    if (cell) setCellForm(cell)
    setIsEditing(false)
  }

  const saveCell = async () => {
    if (!projectId || !cellForm) return
    setSaving(true)
    try {
      await updateCell(projectId, cellForm.id, cellForm)
      toast.success('Cell updated')
      setIsEditing(false)
      await reload()
    } catch {
      toast.error('Failed to save cell')
    } finally {
      setSaving(false)
    }
  }

  const saveDependencies = async () => {
    if (!projectId || !cellId) return
    setSaving(true)
    try {
      await updateCell(projectId, cellId, { dependencyCellIds: selectedDepIds })
      toast.success(selectedDepIds.length ? 'Dependencies updated' : 'Dependencies cleared')
      await reload()
    } catch {
      toast.error('Failed to update dependencies')
    } finally {
      setSaving(false)
    }
  }

  const requestReview = async () => {
    if (!projectId || !cellId) return
    await createCellReview(projectId, cellId, reviewComment || 'Review requested')
    setReviewComment('')
    const list = await fetchCellReviews(projectId, cellId)
    setReviews(list)
    toast.success('Review request sent')
    await reload()
  }

  const postReviewReply = async (reviewId: string, body: string) => {
    if (!projectId || !cellId || !body.trim()) return
    await addReviewMessage(projectId, cellId, reviewId, body)
    const list = await fetchCellReviews(projectId, cellId)
    setReviews(list)
  }

  const handleComplete = async () => {
    if (!projectId || !cellId) return
    try {
      await completeCell(projectId, cellId)
      toast.success('Cell completed')
      await reload()
    } catch {
      toast.error('Failed to complete cell')
    }
  }

  const handleDelete = async () => {
    if (!projectId || !cellId) return
    try {
      await deleteCell(projectId, cellId)
      toast.success('Cell deleted')
      navigate(ROUTES.PROJECT_WORKSPACE(projectId))
    } catch {
      toast.error('Failed to delete cell')
    }
  }

  if (loading && !summary) {
    return (
      <PageWrapper className="admin-hub-page-wrap py-8 text-center text-slate-500" data-page-scrollable>
        Loading cell…
      </PageWrapper>
    )
  }

  if (!summary || !cell || !cellForm) {
    return (
      <PageWrapper className="admin-hub-page-wrap py-8 text-center" data-page-scrollable>
        <p className="text-slate-600">Cell not found.</p>
        <Link to={ROUTES.PROJECT_WORKSPACE(projectId)} className="mt-2 inline-block text-sm font-semibold text-emerald-700">
          Back to workspace
        </Link>
      </PageWrapper>
    )
  }

  const { project } = summary
  const activeLibrary = libraries.find((lib) => lib.id === cell.libraryId)

  return (
    <PageWrapper
      fillViewport
      className="admin-hub-page-wrap admin-projects-page relative z-10 max-w-none !px-0 !py-0 font-body"
    >
      <div className="crewiq-dashboard admin-projects-view relative flex h-full min-h-0 flex-1 flex-col">
        <div className="dashboard-page-bg" aria-hidden>
          <div className="dashboard-page-bg-gradient" />
          <div className="dashboard-page-bg-pattern" />
        </div>

        <div className="admin-projects-workspace-shell relative z-10">
          <header className="admin-projects-workspace-head">
            <div className="min-w-0">
              <Link to={ROUTES.PROJECT_WORKSPACE(projectId)} className="admin-projects-back-btn">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to {project.name}
              </Link>
              <h1 className="admin-projects-head-title">{cell.name}</h1>
              <p className="admin-projects-workspace-meta">
                {activeLibrary?.name || 'Library'} · {cell.cellType} · {cellDisplayStatus(cell)}
              </p>
            </div>
            <div className="admin-projects-workspace-head-actions">
              <span className={cn(
                'admin-projects-status-chip admin-projects-status-chip--lg',
                cell.isBlocked && 'is-blocked',
                cell.isReady && 'is-ready',
                cell.status === 'completed' && 'is-completed',
                cell.status === 'in_progress' && !cell.isBlocked && 'is-progress',
              )}>
                {cellDisplayStatus(cell)}
              </span>
              {cell.status !== 'completed' && (
                <Button size="sm" className="h-8" onClick={() => void handleComplete()}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Complete
                </Button>
              )}
              <button
                type="button"
                className="admin-projects-icon-btn admin-projects-icon-btn--light admin-projects-icon-btn--danger"
                title={`Delete ${cell.name}`}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="admin-projects-cell-page-body">
            <nav className="admin-projects-cell-tab-rail" aria-label="Cell sections">
              {TAB_ITEMS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      'admin-projects-cell-tab-btn',
                      activeTab === tab.id && 'is-active',
                    )}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setIsEditing(false)
                      if (cell) setCellForm(cell)
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {tab.label}
                  </button>
                )
              })}
            </nav>

            <div className="admin-projects-cell-page-panel">
              {activeTab === 'details' && !isEditing && (
                <div className="admin-projects-cell-details">
                  <div className="admin-projects-cell-details-head">
                    <h2 className="admin-projects-cell-details-title">Cell details</h2>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                  <dl className="admin-projects-cell-details-grid">
                    <div className="admin-projects-cell-details-item">
                      <dt>Library</dt>
                      <dd>{activeLibrary?.name || '—'}</dd>
                    </div>
                    <div className="admin-projects-cell-details-item">
                      <dt>Cell name</dt>
                      <dd>{cell.name}</dd>
                    </div>
                    <div className="admin-projects-cell-details-item">
                      <dt>Cell type</dt>
                      <dd>{cell.cellType}</dd>
                    </div>
                    <div className="admin-projects-cell-details-item admin-projects-cell-details-item--full">
                      <dt>Description</dt>
                      <dd>{cell.description?.trim() || '—'}</dd>
                    </div>
                    <div className="admin-projects-cell-details-item">
                      <dt>Complexity</dt>
                      <dd>{cell.complexity}</dd>
                    </div>
                    <div className="admin-projects-cell-details-item">
                      <dt>Estimated effort (hours)</dt>
                      <dd>{cell.estimatedEffort ?? 0}</dd>
                    </div>
                    <div className="admin-projects-cell-details-item">
                      <dt>Assigned employee</dt>
                      <dd>{cell.assignedEmployeeName?.trim() || 'Unassigned'}</dd>
                    </div>
                    <div className="admin-projects-cell-details-item">
                      <dt>Cell status</dt>
                      <dd>
                        <span className={cn(
                          'admin-projects-status-chip',
                          cell.isBlocked && 'is-blocked',
                          cell.isReady && 'is-ready',
                          cell.status === 'completed' && 'is-completed',
                          cell.status === 'in_progress' && !cell.isBlocked && 'is-progress',
                        )}>
                          {cellDisplayStatus(cell)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  <div className="admin-projects-cell-details-views">
                    <p className="admin-projects-field-label">Views</p>
                    <div className="admin-projects-pill-rail mb-2">
                      {(['layout', 'symbol', 'schematic'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setViewTab(v)}
                          className={cn('admin-projects-pill-btn', viewTab === v && 'is-active')}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <p className="admin-projects-cell-details-view-text">
                      {cell.views?.[viewTab]?.trim() || '—'}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'details' && isEditing && (
                <div className="admin-projects-cell-form">
                  <div className="admin-projects-cell-details-head">
                    <h2 className="admin-projects-cell-details-title">Edit cell</h2>
                  </div>
                  <div>
                    <p className="admin-projects-field-label">Target library</p>
                    <div className="admin-projects-library-pick">
                      <div className="admin-projects-libraries-list">
                        {libraries.map((lib: ProjectLibrary) => (
                          <button
                            key={lib.id}
                            type="button"
                            onClick={() => setCellForm((f) => f && { ...f, libraryId: lib.id })}
                            className={cn(
                              'admin-projects-library-nav',
                              cellForm.libraryId === lib.id && 'is-active',
                            )}
                          >
                            <span className="admin-projects-library-nav-label">{lib.name}</span>
                            <span className="admin-projects-library-badge">{libraryCellCounts.get(lib.id) ?? 0}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Input label="Cell name" value={cellForm.name || ''} onChange={(e) => setCellForm((f) => f && { ...f, name: e.target.value })} />
                  <label className="text-sm font-medium">Cell type
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={cellForm.cellType}
                      onChange={(e) => setCellForm((f) => f && { ...f, cellType: e.target.value as ProjectCell['cellType'] })}
                    >
                      {CELL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium">Description
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={cellForm.description || ''}
                      onChange={(e) => setCellForm((f) => f && { ...f, description: e.target.value })}
                    />
                  </label>
                  <label className="text-sm font-medium">Complexity
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={cellForm.complexity}
                      onChange={(e) => setCellForm((f) => f && { ...f, complexity: e.target.value as ProjectCell['complexity'] })}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </label>
                  <Input
                    label="Estimated effort (hours)"
                    type="number"
                    value={String(cellForm.estimatedEffort ?? 0)}
                    onChange={(e) => setCellForm((f) => f && { ...f, estimatedEffort: Number(e.target.value) })}
                  />
                  <label className="text-sm font-medium">Assign employee
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={cellForm.assignedEmployeeId || ''}
                      onChange={(e) => {
                        const emp = employees.find((x) => x.id === e.target.value)
                        setCellForm((f) => f && {
                          ...f,
                          assignedEmployeeId: e.target.value,
                          assignedEmployeeName: emp ? `${emp.firstName} ${emp.lastName}` : '',
                        })
                      }}
                    >
                      <option value="">Unassigned</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                      ))}
                    </select>
                  </label>
                  {cell.status !== 'completed' && (
                    <label className="text-sm font-medium">Workflow status
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={cellForm.status}
                        onChange={async (e) => {
                          const status = e.target.value as CellStatus
                          await updateCellStatus(projectId, cellId, status)
                          setCellForm((f) => f && { ...f, status })
                          toast.success('Status updated')
                          await reload()
                        }}
                      >
                        {CELL_STATUSES.filter((s) => s !== 'completed').map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div>
                    <p className="admin-projects-field-label">Views</p>
                    <div className="admin-projects-pill-rail mb-2">
                      {(['layout', 'symbol', 'schematic'] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setViewTab(v)}
                          className={cn('admin-projects-pill-btn', viewTab === v && 'is-active')}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="min-h-[80px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder={`${viewTab} view notes or asset reference`}
                      value={cellForm.views?.[viewTab] || ''}
                      onChange={(e) => setCellForm((f) => f && { ...f, views: { ...f.views!, [viewTab]: e.target.value } })}
                    />
                  </div>
                  <div className="admin-projects-cell-form-actions">
                    <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={() => void saveCell()} disabled={saving}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'workflow' && (
                <CellWorkflowPanel
                  projectId={projectId}
                  cell={cell}
                  reviews={reviews}
                  reviewComment={reviewComment}
                  onReviewCommentChange={setReviewComment}
                  onRequestReview={requestReview}
                  onPostReviewReply={postReviewReply}
                  onUpdated={(updated) => {
                    setCellForm(updated)
                    void reload()
                  }}
                />
              )}

              {activeTab === 'dependencies' && (
                <div className="admin-projects-cell-deps">
                  <p className="admin-projects-cell-deps-intro">
                    Select which cells <strong>{cell.name}</strong> must wait for. Links appear in the project dependency graph.
                  </p>
                  <div className="admin-projects-dep-pick">
                    {dependencyOptions.length === 0 ? (
                      <p className="px-2 py-4 text-sm text-slate-500">No other cells available to depend on.</p>
                    ) : (
                      dependencyOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleDependency(option.id)}
                          className={cn(
                            'admin-projects-dep-option',
                            selectedDepIds.includes(option.id) && 'is-selected',
                          )}
                        >
                          <span className={cn(
                            'admin-projects-dep-check',
                            selectedDepIds.includes(option.id) && 'is-selected',
                          )}
                          />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block font-semibold text-slate-900">{option.name}</span>
                            <span className="block text-xs text-slate-500">
                              {libraryNameById.get(option.libraryId) || 'Library'} · {option.cellType} · {STATUS_LABELS[option.status]}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  {selectedDepIds.length > 0 && (
                    <p className="text-xs font-semibold text-emerald-800">
                      {selectedDepIds.length} dependenc{selectedDepIds.length === 1 ? 'y' : 'ies'} selected
                    </p>
                  )}
                  <div className="admin-projects-cell-form-actions">
                    <Button onClick={() => void saveDependencies()} disabled={saving}>
                      <GitBranch className="mr-1.5 h-3.5 w-3.5" />
                      {selectedDepIds.length ? 'Save dependencies' : 'Clear dependencies'}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteOpen}
        title="Delete cell"
        description={`Delete cell "${cell.name}"? Related reviews and dependencies will be removed.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </PageWrapper>
  )
}
