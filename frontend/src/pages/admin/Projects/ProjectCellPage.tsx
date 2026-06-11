import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ClipboardList, GitBranch, Layers, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageWrapper } from '@components/layout/PageWrapper'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { Button } from '@components/ui/Button'
import { ROUTES } from '@constants/routes'
import { getEmployees } from '@services/employeeService'
import {
  completeCell,
  deleteCell,
  fetchCellCompletionReadiness,
  fetchWorkspaceSummary,
  touchCell,
  uncompleteCell,
  updateCell,
  type CellCompletionReadiness,
} from '@/services/projectWorkspaceService'
import { cn } from '@/utils/cn'
import {
  CELL_TYPES,
  WORK_STAGE_STATUSES,
  type CellStatus,
  type ProjectCell,
  type WorkflowStageStatus,
  type WorkspaceSummary,
} from '@/types/projectWorkspace'
import type { Employee } from '@/types'
import { CELL_STATUS_FILTER_OPTIONS, CELL_TYPE_LABELS, STATUS_LABELS, WORKFLOW_STATUS_LABELS, cellDisplayStatus, normalizeViewStatus, workflowStageStatusClass } from './projectWorkspaceUi'

const INLINE_FIELD_CLASS = 'admin-projects-cell-details-inline-field'
import { CellWorkflowPanel } from './CellWorkflowPanel'
import { CellWorkflowDurationLabel } from './CellWorkflowDurationLabel'
import { CellTypeChecklistTab } from './CellTypeChecklistTab'
import { calculateEstimatedHours, CELL_COMPLEXITY_OPTIONS, DEFAULT_BASE_HOURS, formatComplexityFactor, normalizeComplexity } from '@/utils/effortEstimationUtils'
import './adminProjects.css'

type ViewTab = 'layout' | 'symbol' | 'schematic'
type CellTab = 'details' | 'dependencies' | 'checklist'

const VIEW_TAB_LABELS: Record<ViewTab, string> = {
  layout: 'Layout',
  symbol: 'Symbol',
  schematic: 'Schematic',
}

type CellViewStatusButtonsProps = {
  status: WorkflowStageStatus
  disabled?: boolean
  onChange: (status: WorkflowStageStatus) => void
}

function CellViewStatusButtons({ status, disabled, onChange }: CellViewStatusButtonsProps) {
  return (
    <div className="admin-projects-view-status-btns">
      {WORK_STAGE_STATUSES.map((value) => (
        <button
          key={value}
          type="button"
          className={cn(
            'admin-projects-view-status-btn',
            workflowStageStatusClass(value),
            status === value && 'is-active',
          )}
          disabled={disabled}
          onClick={() => onChange(value)}
        >
          {WORKFLOW_STATUS_LABELS[value]}
        </button>
      ))}
    </div>
  )
}

const TAB_ITEMS: { id: CellTab; label: string; icon: typeof Layers }[] = [
  { id: 'details', label: 'Details', icon: Layers },
  { id: 'dependencies', label: 'Dependencies', icon: GitBranch },
  { id: 'checklist', label: 'Checklist', icon: ClipboardList },
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
  const [viewTab, setViewTab] = useState<ViewTab>('layout')
  const [savingViewStatus, setSavingViewStatus] = useState<ViewTab | null>(null)
  const [selectedDepIds, setSelectedDepIds] = useState<string[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completionReadiness, setCompletionReadiness] = useState<CellCompletionReadiness | null>(null)
  const [durationFetchedAt, setDurationFetchedAt] = useState(() => Date.now())

  const reload = useCallback(async () => {
    if (!projectId || !cellId) return
    setLoading(true)
    try {
      const [ws, empsRes, readiness] = await Promise.all([
        fetchWorkspaceSummary(projectId),
        getEmployees({ status: 'Active', pageSize: 500 }),
        fetchCellCompletionReadiness(projectId, cellId).catch(() => null),
      ])
      setSummary(ws)
      setEmployees(empsRes.data ?? [])
      setCompletionReadiness(readiness)
      setDurationFetchedAt(Date.now())
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

  useEffect(() => {
    if (!projectId || !cellId) return
    void touchCell(projectId, cellId)
      .then((updated) => {
        if (updated.status === 'in_progress') void reload()
      })
      .catch(() => undefined)
  }, [projectId, cellId, reload])

  const cell = useMemo(
    () => summary?.cells.find((c) => c.id === cellId) ?? null,
    [summary?.cells, cellId],
  )

  useEffect(() => {
    if (!projectId || !cellId || cell?.status === 'completed') return undefined
    const timer = window.setInterval(() => {
      void reload()
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [projectId, cellId, cell?.status, reload])

  const libraries = summary?.libraries ?? []
  const allCells = summary?.cells ?? []

  const libraryNameById = useMemo(() => {
    const names = new Map<string, string>()
    for (const lib of libraries) names.set(lib.id, lib.name)
    return names
  }, [libraries])

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

  const handleComplete = async () => {
    if (!projectId || !cellId || !completionReadiness?.canComplete) return
    try {
      await completeCell(projectId, cellId)
      toast.success('Cell completed')
      await reload()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; missing?: string[] } } })?.response?.data
      if (msg?.missing?.length) {
        toast.error(`Complete all sections: ${msg.missing.join(', ')}`)
      } else {
        toast.error(msg?.error || 'Failed to complete cell')
      }
    }
  }

  const handleUncomplete = async () => {
    if (!projectId || !cellId) return
    try {
      await uncompleteCell(projectId, cellId)
      toast.success('Cell marked incomplete')
      await reload()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Failed to uncomplete cell')
    }
  }

  const completeButtonTitle = completionReadiness?.canComplete
    ? 'Mark this cell as completed'
    : completionReadiness?.missing?.length
      ? `Finish required sections: ${completionReadiness.missing.join(', ')}`
      : 'Loading completion requirements…'

  const handleViewStatusChange = async (viewKey: 'symbol' | 'schematic', status: WorkflowStageStatus) => {
    if (!projectId || !cell) return
    setSavingViewStatus(viewKey)
    try {
      const updated = await updateCell(projectId, cell.id, {
        views: { ...cell.views, [viewKey]: status },
      })
      setCellForm(updated)
      toast.success(`${VIEW_TAB_LABELS[viewKey]} status updated`)
      await reload()
    } catch {
      toast.error('Failed to update view status')
    } finally {
      setSavingViewStatus(null)
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

        <div className="admin-projects-workspace-shell admin-projects-workspace-chrome relative z-10">
          <header className="admin-projects-workspace-head admin-projects-workspace-head--cell admin-projects-cell-page-head">
            <div className="admin-projects-cell-head-top">
              <Link
                to={ROUTES.PROJECT_WORKSPACE(projectId)}
                className="admin-projects-back-btn admin-projects-back-btn--icon-only"
                aria-label={`Back to ${project.name}`}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </Link>
              <div className="admin-projects-cell-head-identity">
                <h1 className="admin-projects-head-title">{cell.name}</h1>
                <p className="admin-projects-workspace-meta">
                  {activeLibrary?.name || 'Library'} · {CELL_TYPE_LABELS[cell.cellType] ?? cell.cellType} · {cellDisplayStatus(cell)}
                </p>
              </div>
              <div className="admin-projects-workspace-head-actions">
              <span className={cn(
                'admin-projects-status-chip admin-projects-status-chip--lg',
                cell.status === 'ready' && 'is-not-started',
                cell.status === 'completed' && 'is-completed',
                cell.status === 'in_progress' && 'is-progress',
              )}>
                {cellDisplayStatus(cell)}
              </span>
              <CellWorkflowDurationLabel
                cellStatus={cell.status}
                workflowDuration={cell.workflowDuration}
                fetchedAt={durationFetchedAt}
              />
              {cell.status === 'completed' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="admin-projects-cell-header-complete-btn h-8"
                  onClick={() => void handleUncomplete()}
                >
                  Uncomplete
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="admin-projects-cell-header-complete-btn h-8"
                  disabled={!completionReadiness?.canComplete}
                  title={completeButtonTitle}
                  onClick={() => void handleComplete()}
                >
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
              {activeTab === 'details' && (
                <div className="admin-projects-cell-details-layout">
                  <div className={cn(
                    'admin-projects-cell-details-summary-card',
                    isEditing && 'is-editing',
                  )}>
                    <dl className="admin-projects-cell-details-grid admin-projects-cell-details-grid--summary">
                      <div className="admin-projects-cell-details-item">
                        <dt>Cell name</dt>
                        <dd>
                          {isEditing ? (
                            <input
                              className={INLINE_FIELD_CLASS}
                              value={cellForm.name || ''}
                              onChange={(e) => setCellForm((f) => f && { ...f, name: e.target.value })}
                            />
                          ) : (
                            cell.name
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Library</dt>
                        <dd>
                          {isEditing ? (
                            <select
                              className={INLINE_FIELD_CLASS}
                              value={cellForm.libraryId}
                              onChange={(e) => setCellForm((f) => f && { ...f, libraryId: e.target.value })}
                            >
                              {libraries.map((lib) => (
                                <option key={lib.id} value={lib.id}>{lib.name}</option>
                              ))}
                            </select>
                          ) : (
                            activeLibrary?.name || '—'
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Cell type</dt>
                        <dd>
                          {isEditing ? (
                            <select
                              className={INLINE_FIELD_CLASS}
                              value={cellForm.cellType}
                              onChange={(e) => setCellForm((f) => f && { ...f, cellType: e.target.value as ProjectCell['cellType'] })}
                            >
                              {CELL_TYPES.map((t) => (
                                <option key={t} value={t}>{CELL_TYPE_LABELS[t]}</option>
                              ))}
                            </select>
                          ) : (
                            CELL_TYPE_LABELS[cell.cellType] ?? cell.cellType
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Description</dt>
                        <dd>
                          {isEditing ? (
                            <input
                              className={INLINE_FIELD_CLASS}
                              value={cellForm.description || ''}
                              placeholder="—"
                              onChange={(e) => setCellForm((f) => f && { ...f, description: e.target.value })}
                            />
                          ) : (
                            cell.description?.trim() || '—'
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Complexity</dt>
                        <dd>
                          {isEditing ? (
                            <select
                              className={INLINE_FIELD_CLASS}
                              value={cellForm.complexity}
                              onChange={(e) => {
                                const complexity = e.target.value as ProjectCell['complexity']
                                setCellForm((f) => f && {
                                  ...f,
                                  complexity,
                                  estimatedEffort: calculateEstimatedHours(f.baseHours ?? 0, complexity),
                                })
                              }}
                            >
                              {CELL_COMPLEXITY_OPTIONS.map((level) => (
                                <option key={level} value={level}>{level}</option>
                              ))}
                            </select>
                          ) : (
                            normalizeComplexity(cell.complexity)
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Base hours (1 day = {DEFAULT_BASE_HOURS}h)</dt>
                        <dd>
                          {isEditing ? (
                            <input
                              className={INLINE_FIELD_CLASS}
                              type="number"
                              min={0}
                              step="any"
                              value={String(cellForm.baseHours ?? 0)}
                              onChange={(e) => {
                                const baseHours = Number(e.target.value)
                                setCellForm((f) => f && {
                                  ...f,
                                  baseHours,
                                  estimatedEffort: calculateEstimatedHours(baseHours, f.complexity),
                                })
                              }}
                            />
                          ) : (
                            cell.baseHours ?? 0
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Complexity factor</dt>
                        <dd>{formatComplexityFactor(cell.complexity)}</dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Estimated effort (hours)</dt>
                        <dd>
                          {isEditing ? (
                            calculateEstimatedHours(cellForm.baseHours ?? 0, cellForm.complexity)
                          ) : (
                            cell.estimatedEffort ?? 0
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Smart estimate (hours)</dt>
                        <dd>
                          {cell.smartEstimate ?? cell.estimatedEffort ?? 0}
                          {' '}
                          <span className="text-xs text-slate-500">({cell.estimateConfidence ?? 'Low'} confidence)</span>
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Actual effort (hours)</dt>
                        <dd>
                          {isEditing ? (
                            <input
                              className={INLINE_FIELD_CLASS}
                              type="number"
                              min={0}
                              step="any"
                              value={String(cellForm.actualEffort ?? 0)}
                              onChange={(e) => setCellForm((f) => f && { ...f, actualEffort: Number(e.target.value) })}
                            />
                          ) : (
                            cell.actualEffort ?? 0
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Assigned employee</dt>
                        <dd>
                          {isEditing ? (
                            <select
                              className={INLINE_FIELD_CLASS}
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
                          ) : (
                            cell.assignedEmployeeName?.trim() || 'Unassigned'
                          )}
                        </dd>
                      </div>
                      <div className="admin-projects-cell-details-item">
                        <dt>Cell status</dt>
                        <dd>
                          {isEditing && cell.status !== 'completed' ? (
                            <select
                              className={INLINE_FIELD_CLASS}
                              value={cellForm.status}
                              onChange={(e) => setCellForm((f) => f && { ...f, status: e.target.value as CellStatus })}
                            >
                              {CELL_STATUS_FILTER_OPTIONS.filter((s) => s !== 'completed').map((s) => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={cn(
                              'admin-projects-status-chip',
                              cell.status === 'ready' && 'is-not-started',
                              cell.status === 'completed' && 'is-completed',
                              cell.status === 'in_progress' && 'is-progress',
                            )}>
                              {cellDisplayStatus(cell)}
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="admin-projects-cell-details-summary-edit h-8"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {isEditing && (
                    <div className="admin-projects-cell-details-summary-actions">
                      <Button variant="secondary" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </Button>
                      <Button onClick={() => void saveCell()} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  )}

                  <section className="admin-projects-cell-details-views-panel" aria-label="Cell views">
                    <div className="admin-projects-cell-details-views-panel-head">
                      <p className="admin-projects-cell-details-main-label">Views</p>
                      <div className="admin-projects-pill-rail">
                        {(['layout', 'symbol', 'schematic'] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setViewTab(v)}
                            className={cn('admin-projects-pill-btn', viewTab === v && 'is-active')}
                          >
                            {VIEW_TAB_LABELS[v]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="admin-projects-cell-details-views-panel-body">
                      <div className="admin-projects-cell-details-view-box">
                        {viewTab === 'layout' ? (
                          <CellWorkflowPanel
                            projectId={projectId}
                            cell={cell}
                            embedded
                            showReviews={false}
                            onUpdated={(updated) => {
                              setCellForm(updated)
                              void reload()
                            }}
                          />
                        ) : (
                          <CellViewStatusButtons
                            status={normalizeViewStatus(cell.views?.[viewTab])}
                            disabled={savingViewStatus === viewTab}
                            onChange={(status) => void handleViewStatusChange(viewTab, status)}
                          />
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === 'checklist' && (
                <div className="admin-projects-cell-checklist-tab-panel">
                  <CellTypeChecklistTab
                    projectId={projectId}
                    cellId={cellId}
                    cellStatus={cell.status}
                    onUpdated={() => void reload()}
                  />
                </div>
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
