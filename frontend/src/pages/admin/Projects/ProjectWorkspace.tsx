import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, CheckCircle2, GitBranch, Layers, MessageSquare, Plus, Trash2, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageWrapper } from '@components/layout/PageWrapper'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { ROUTES } from '@constants/routes'
import { getEmployees } from '@services/employeeService'
import {
  addReviewMessage,
  completeCell,
  createCell,
  createCellReview,
  createLibrary,
  deleteCell,
  deleteLibrary,
  fetchCellReviews,
  fetchDependencyGraph,
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
  type DependencyGraph,
  type ProjectCell,
  type ProjectLibrary,
  type WorkspaceSummary,
} from '@/types/projectWorkspace'
import type { Employee } from '@/types'
import './adminProjects.css'

type DeleteTarget = { type: 'library' | 'cell'; id: string; name: string }

const STATUS_LABELS: Record<CellStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  drc: 'DRC',
  lvs: 'LVS',
  review: 'Review',
  completed: 'Completed',
  blocked: 'Blocked',
}

function emptyCellForm(libraryId: string, technologyNode: string): Partial<ProjectCell> & { libraryId: string } {
  return {
    libraryId,
    name: '',
    description: '',
    cellType: 'Other',
    technologyNode,
    complexity: 'Medium',
    estimatedEffort: 0,
    assignedEmployeeId: '',
    assignedEmployeeName: '',
    dependencyCellIds: [],
    views: { layout: '', symbol: '', schematic: '' },
  }
}

export function ProjectWorkspace() {
  const { projectId = '' } = useParams()
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null)
  const [graph, setGraph] = useState<DependencyGraph | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null)
  const [libraryModal, setLibraryModal] = useState(false)
  const [libraryName, setLibraryName] = useState('')
  const [libraryDesc, setLibraryDesc] = useState('')
  const [cellModal, setCellModal] = useState(false)
  const [cellForm, setCellForm] = useState<ReturnType<typeof emptyCellForm> | null>(null)
  const [editingCellId, setEditingCellId] = useState<string | null>(null)
  const [reviewModal, setReviewModal] = useState(false)
  const [reviewCell, setReviewCell] = useState<ProjectCell | null>(null)
  const [reviews, setReviews] = useState<CellReview[]>([])
  const [reviewComment, setReviewComment] = useState('')
  const [viewTab, setViewTab] = useState<'layout' | 'symbol' | 'schematic'>('layout')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [dependencyModal, setDependencyModal] = useState(false)
  const [dependencyCell, setDependencyCell] = useState<ProjectCell | null>(null)
  const [selectedDepIds, setSelectedDepIds] = useState<string[]>([])

  const reload = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [ws, dg, empsRes] = await Promise.all([
        fetchWorkspaceSummary(projectId),
        fetchDependencyGraph(projectId),
        getEmployees({ status: 'Active', pageSize: 500 }),
      ])
      setSummary(ws)
      setGraph(dg)
      setEmployees(empsRes.data ?? [])
      setActiveLibraryId((prev) => {
        if (prev && ws.libraries.some((lib) => lib.id === prev)) return prev
        return ws.libraries[0]?.id ?? null
      })
    } catch {
      toast.error('Failed to load project workspace')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const displayedCells = useMemo(() => {
    if (!summary || !activeLibraryId) return []
    return summary.cells.filter((c) => c.libraryId === activeLibraryId)
  }, [summary, activeLibraryId])

  const libraryCellCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const cell of summary?.cells ?? []) {
      counts.set(cell.libraryId, (counts.get(cell.libraryId) ?? 0) + 1)
    }
    return counts
  }, [summary?.cells])

  const activeLibrary = useMemo(
    () => summary?.libraries.find((lib) => lib.id === activeLibraryId) ?? null,
    [summary?.libraries, activeLibraryId],
  )

  const libraryNameById = useMemo(() => {
    const names = new Map<string, string>()
    for (const lib of summary?.libraries ?? []) {
      names.set(lib.id, lib.name)
    }
    return names
  }, [summary?.libraries])

  const allCells = summary?.cells ?? []

  const dependencyOptions = useMemo(() => {
    if (!dependencyCell) return []
    return allCells.filter((c) => c.id !== dependencyCell.id)
  }, [allCells, dependencyCell])

  const openCreateCell = () => {
    if (!summary || summary.libraries.length === 0) {
      toast.error('Create a library first')
      return
    }
    const libraryId = activeLibraryId ?? summary.libraries[0]?.id
    if (!libraryId) return
    setEditingCellId(null)
    setCellForm(emptyCellForm(libraryId, summary.project.technologyNode))
    setCellModal(true)
  }

  const openEditCell = (cell: ProjectCell) => {
    setEditingCellId(cell.id)
    setCellForm({ ...cell, libraryId: cell.libraryId })
    setCellModal(true)
  }

  const openDependencies = (cell: ProjectCell) => {
    setDependencyCell(cell)
    setSelectedDepIds(cell.dependencyCellIds ?? [])
    setDependencyModal(true)
  }

  const toggleDependency = (depId: string) => {
    setSelectedDepIds((prev) =>
      prev.includes(depId) ? prev.filter((id) => id !== depId) : [...prev, depId],
    )
  }

  const saveDependencies = async () => {
    if (!projectId || !dependencyCell) return
    try {
      await updateCell(projectId, dependencyCell.id, { dependencyCellIds: selectedDepIds })
      toast.success(selectedDepIds.length ? 'Dependencies updated' : 'Dependencies cleared')
      setDependencyModal(false)
      setDependencyCell(null)
      await reload()
    } catch {
      toast.error('Failed to update dependencies')
    }
  }

  const saveCell = async () => {
    if (!projectId || !cellForm || !cellForm.libraryId) {
      toast.error('Select a library for this cell')
      return
    }
    try {
      if (editingCellId) {
        await updateCell(projectId, editingCellId, cellForm)
        toast.success('Cell updated')
        setActiveLibraryId(cellForm.libraryId)
      } else {
        await createCell(projectId, cellForm.libraryId, { ...cellForm, name: cellForm.name || 'Untitled' })
        toast.success('Cell created')
        setActiveLibraryId(cellForm.libraryId)
      }
      setCellModal(false)
      await reload()
    } catch {
      toast.error('Failed to save cell')
    }
  }

  const saveLibrary = async () => {
    if (!projectId || !libraryName.trim()) return
    await createLibrary(projectId, { name: libraryName, description: libraryDesc })
    setLibraryModal(false)
    setLibraryName('')
    setLibraryDesc('')
    await reload()
  }

  const openReviews = async (cell: ProjectCell) => {
    setReviewCell(cell)
    setReviewModal(true)
    const list = await fetchCellReviews(projectId, cell.id)
    setReviews(list)
  }

  const requestReview = async () => {
    if (!reviewCell) return
    await createCellReview(projectId, reviewCell.id, reviewComment || 'Review requested')
    setReviewComment('')
    const list = await fetchCellReviews(projectId, reviewCell.id)
    setReviews(list)
    toast.success('Review request sent')
    await reload()
  }

  const postReviewReply = async (reviewId: string, body: string) => {
    if (!reviewCell || !body.trim()) return
    await addReviewMessage(projectId, reviewCell.id, reviewId, body)
    const list = await fetchCellReviews(projectId, reviewCell.id)
    setReviews(list)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !projectId) return
    try {
      if (deleteTarget.type === 'library') {
        await deleteLibrary(projectId, deleteTarget.id)
        if (activeLibraryId === deleteTarget.id) {
          const remaining = summary?.libraries.filter((lib) => lib.id !== deleteTarget.id) ?? []
          setActiveLibraryId(remaining[0]?.id ?? null)
        }
        toast.success('Library deleted')
      } else {
        await deleteCell(projectId, deleteTarget.id)
        toast.success('Cell deleted')
      }
      setDeleteTarget(null)
      await reload()
    } catch {
      toast.error(deleteTarget.type === 'library' ? 'Failed to delete library' : 'Failed to delete cell')
    }
  }

  if (loading && !summary) {
    return (
      <PageWrapper className="admin-hub-page-wrap py-8 text-center text-slate-500" data-page-scrollable>
        Loading workspace…
      </PageWrapper>
    )
  }

  if (!summary) {
    return (
      <PageWrapper className="admin-hub-page-wrap py-8 text-center" data-page-scrollable>
        <p className="text-slate-600">Project not found.</p>
        <Link to={ROUTES.PROJECTS} className="mt-2 inline-block text-sm font-semibold text-emerald-700">Back to projects</Link>
      </PageWrapper>
    )
  }

  const { project, libraries, stats } = summary

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
              <Link to={ROUTES.PROJECTS} className="admin-projects-back-btn">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                All projects
              </Link>
              <h1 className="admin-projects-head-title">{project.name}</h1>
              <p className="admin-projects-workspace-meta">
                {project.client} · {project.accessType === 'public' ? 'Public' : 'Private'} · Lead: {project.teamLead || '—'}
              </p>
            </div>
            <div className="admin-projects-progress-pill">
              <span>Progress</span>
              <strong>{project.completionPercentage}%</strong>
            </div>
          </header>

          <div className="admin-projects-workspace-body">
            <div className="admin-projects-stats-row">
              {[
                { label: 'Libraries', value: stats.libraryCount, icon: BookOpen },
                { label: 'Cells', value: stats.cellCount, icon: Layers },
                { label: 'Ready', value: stats.readyCells, icon: CheckCircle2 },
                { label: 'Blocked', value: stats.blockedCells, icon: GitBranch },
                { label: 'Unassigned', value: stats.unassignedCells, icon: User },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="admin-projects-stat">
                  <div className="admin-projects-stat-label">
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </div>
                  <p className="admin-projects-stat-value">{value}</p>
                </div>
              ))}
            </div>

            <div className="admin-projects-workspace-grid">
              <aside className="admin-projects-libraries-panel">
                <p className="admin-projects-libraries-head">Libraries</p>
                <button
                  type="button"
                  className="admin-projects-libraries-create"
                  onClick={() => setLibraryModal(true)}
                >
                  <Plus className="h-4 w-4" /> Add library
                </button>
                <div className="admin-projects-libraries-list">
                  {libraries.map((lib: ProjectLibrary) => (
                    <div key={lib.id} className="admin-projects-library-row">
                      <button
                        type="button"
                        onClick={() => setActiveLibraryId(lib.id)}
                        className={cn(
                          'admin-projects-library-nav',
                          activeLibraryId === lib.id && 'is-active',
                        )}
                      >
                        <span className="admin-projects-library-nav-label">{lib.name}</span>
                        <span className="admin-projects-library-badge">{libraryCellCounts.get(lib.id) ?? 0}</span>
                      </button>
                      <button
                        type="button"
                        className="admin-projects-icon-btn admin-projects-icon-btn--danger"
                        title={`Delete ${lib.name}`}
                        onClick={() => setDeleteTarget({ type: 'library', id: lib.id, name: lib.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {libraries.length === 0 && (
                    <p className="px-2 py-4 text-xs text-slate-500">No libraries yet.</p>
                  )}
                </div>
              </aside>

              <section className="admin-projects-cells-panel">
                <div className="admin-projects-cells-head">
                  <div>
                    <h2>Cells</h2>
                    {activeLibrary && (
                      <span className="admin-projects-active-lib-pill">{activeLibrary.name}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="admin-projects-cells-create"
                    disabled={libraries.length === 0}
                    onClick={openCreateCell}
                  >
                    <Plus className="h-4 w-4" /> New cell
                  </button>
                </div>

                <div className="admin-projects-cells-table-wrap">
                  <table className="admin-projects-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Assigned</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCells.map((cell) => (
                        <tr key={cell.id}>
                          <td style={{ fontWeight: 600 }}>{cell.name}</td>
                          <td>{cell.cellType}</td>
                          <td>{cell.assignedEmployeeName || '—'}</td>
                          <td>
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-semibold',
                              cell.status === 'completed' && 'bg-emerald-100 text-emerald-800',
                              cell.status === 'blocked' && 'bg-red-100 text-red-800',
                              cell.isReady && 'bg-sky-100 text-sky-800',
                              !['completed', 'blocked'].includes(cell.status) && !cell.isReady && 'bg-amber-50 text-amber-800',
                            )}>
                              {cell.isReady ? 'Ready' : STATUS_LABELS[cell.status]}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => openEditCell(cell)}>Edit</Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs"
                                onClick={() => openDependencies(cell)}
                              >
                                <GitBranch className="mr-1 h-3 w-3" />
                                {cell.dependencyCellIds?.length ? 'Edit deps' : 'Add deps'}
                              </Button>
                              <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => void openReviews(cell)}>
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                              {cell.status !== 'completed' && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={async () => {
                                    await completeCell(projectId, cell.id)
                                    toast.success('Cell completed')
                                    await reload()
                                  }}
                                >
                                  Complete
                                </Button>
                              )}
                              <button
                                type="button"
                                className="admin-projects-icon-btn admin-projects-icon-btn--danger"
                                title={`Delete ${cell.name}`}
                                onClick={() => setDeleteTarget({ type: 'cell', id: cell.id, name: cell.name })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {displayedCells.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                            No cells in this library.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="admin-projects-graph-section">
                  <h2 className="admin-projects-graph-title">Dependency graph</h2>
                  {graph && graph.nodes.length > 0 ? (
                    <>
                      {graph.edges.length > 0 && (
                        <div className="admin-projects-graph-flow">
                          {graph.edges.map((edge) => {
                            const from = graph.nodes.find((n) => n.id === edge.from)?.name ?? '—'
                            const to = graph.nodes.find((n) => n.id === edge.to)?.name ?? '—'
                            return (
                              <span key={`${edge.from}-${edge.to}`} className="admin-projects-graph-edge">
                                {from} <span aria-hidden>→</span> {to}
                              </span>
                            )
                          })}
                        </div>
                      )}
                      <div className="admin-projects-graph-grid">
                        {graph.nodes.map((node) => {
                          const incoming = graph.edges.filter((e) => e.to === node.id)
                          const outgoing = graph.edges.filter((e) => e.from === node.id)
                          return (
                            <div
                              key={node.id}
                              className={cn(
                                'admin-projects-graph-node',
                                incoming.length > 0 && 'has-deps',
                                node.isBlocked && 'is-blocked',
                                node.isReady && 'is-ready',
                              )}
                            >
                              <p className="admin-projects-graph-node-name">{node.name}</p>
                              <p className="admin-projects-graph-node-status">{STATUS_LABELS[node.status]}</p>
                              {incoming.length > 0 && (
                                <p className="admin-projects-graph-node-meta">
                                  Depends on: {incoming.map((e) => graph.nodes.find((n) => n.id === e.from)?.name).filter(Boolean).join(', ')}
                                </p>
                              )}
                              {outgoing.length > 0 && (
                                <p className="admin-projects-graph-node-meta">
                                  Blocks: {outgoing.map((e) => graph.nodes.find((n) => n.id === e.to)?.name).filter(Boolean).join(', ')}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                      Add cells with dependencies to see the graph.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={libraryModal} title="New library" onClose={() => setLibraryModal(false)}>
        <div className="grid gap-3">
          <Input label="Library name" value={libraryName} onChange={(e) => setLibraryName(e.target.value)} />
          <label className="text-sm font-medium">Description
            <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={libraryDesc} onChange={(e) => setLibraryDesc(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLibraryModal(false)}>Cancel</Button>
            <Button onClick={() => void saveLibrary()}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={cellModal && !!cellForm} title={editingCellId ? 'Edit cell' : 'New cell'} onClose={() => setCellModal(false)}>
        {cellForm && (
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
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
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={cellForm.cellType} onChange={(e) => setCellForm((f) => f && { ...f, cellType: e.target.value as ProjectCell['cellType'] })}>
                {CELL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Description
              <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={cellForm.description || ''} onChange={(e) => setCellForm((f) => f && { ...f, description: e.target.value })} />
            </label>
            <Input label="Technology node" value={cellForm.technologyNode || ''} onChange={(e) => setCellForm((f) => f && { ...f, technologyNode: e.target.value })} />
            <label className="text-sm font-medium">Complexity
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={cellForm.complexity} onChange={(e) => setCellForm((f) => f && { ...f, complexity: e.target.value as ProjectCell['complexity'] })}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
            <Input label="Estimated effort (hours)" type="number" value={String(cellForm.estimatedEffort ?? 0)} onChange={(e) => setCellForm((f) => f && { ...f, estimatedEffort: Number(e.target.value) })} />
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
            {editingCellId && (
              <label className="text-sm font-medium">Workflow status
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={cellForm.status}
                  onChange={async (e) => {
                    const status = e.target.value as CellStatus
                    await updateCellStatus(projectId, editingCellId, status)
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCellModal(false)}>Cancel</Button>
              <Button onClick={() => void saveCell()}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={dependencyModal && !!dependencyCell}
        title={dependencyCell?.dependencyCellIds?.length ? `Edit dependencies — ${dependencyCell?.name}` : `Add dependencies — ${dependencyCell?.name}`}
        onClose={() => {
          setDependencyModal(false)
          setDependencyCell(null)
        }}
      >
        {dependencyCell && (
          <div className="grid gap-3">
            <p className="text-sm text-slate-600">
              Select which cells <strong>{dependencyCell.name}</strong> must wait for. Links appear in the dependency graph below.
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
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setDependencyModal(false)
                  setDependencyCell(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => void saveDependencies()}>Save dependencies</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'library' ? 'Delete library' : 'Delete cell'}
        description={
          deleteTarget?.type === 'library'
            ? `Delete "${deleteTarget.name}" and all cells inside it? This cannot be undone.`
            : `Delete cell "${deleteTarget?.name}"? Related reviews and dependencies will be removed.`
        }
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <Modal isOpen={reviewModal && !!reviewCell} title={`Reviews — ${reviewCell?.name}`} onClose={() => setReviewModal(false)}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input className="flex-1" placeholder="Request review or add comment…" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
            <Button onClick={() => void requestReview()}>Request review</Button>
          </div>
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">
                {review.initiatedByName} · stage {review.stageAtRequest} · {review.status}
              </p>
              <ul className="mt-2 space-y-2">
                {review.messages.map((msg, i) => (
                  <li key={i} className="rounded bg-slate-50 px-2 py-1.5 text-sm">
                    <span className="font-semibold">{msg.authorName}</span> ({msg.authorRole}): {msg.body}
                  </li>
                ))}
              </ul>
              {review.status === 'open' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2"
                  onClick={() => {
                    const body = window.prompt('Reply')
                    if (body) void postReviewReply(review.id, body)
                  }}
                >
                  Reply
                </Button>
              )}
            </div>
          ))}
          {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
        </div>
      </Modal>
    </PageWrapper>
  )
}
