import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  GitBranch,
  History,
  Layers,
  LayoutGrid,
  User,
} from 'lucide-react'
import { ProjectWorkflowBoard } from '@components/employee/projects/ProjectWorkflowBoard'
import { DependencyGraphView } from '@pages/admin/Projects/DependencyGraphView'
import {
  fetchMyAssignedProjects,
  fetchMyDependencyGraph,
  fetchMyProjectWorkspace,
  requestCellReview,
  updateCellWorkflow,
} from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import { useAuthStore } from '@store/authStore'
import { cn } from '@pages/employee/lib/utils'
import { VIEW_TABS } from '@/utils/cellWorkflowUi'
import './employeeProjectWorkflow.css'

const SECTION_ITEMS = [
  { id: 'home', label: 'Home', icon: LayoutGrid },
  { id: 'graph', label: 'Dependency graph', icon: GitBranch },
  { id: 'activity', label: 'Activity log', icon: History },
]

export function EmployeeProjectBoardPage({ routeProjectId = null }) {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId)
  const [workspace, setWorkspace] = useState(null)
  const [graph, setGraph] = useState(null)
  const [selectedLibraryId, setSelectedLibraryId] = useState(null)
  const [workspaceSection, setWorkspaceSection] = useState('home')
  const [viewTab, setViewTab] = useState('layout')
  const [activeFilter, setActiveFilter] = useState(null)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true)
      try {
        const data = await fetchMyAssignedProjects()
        const list = Array.isArray(data) ? data : []
        setProjects(list)
        if (!routeProjectId) {
          setSelectedProjectId((prev) => prev || list[0]?.id || null)
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to load projects' })
        setProjects([])
      } finally {
        setLoadingProjects(false)
      }
    }
    void loadProjects()
  }, [toast, routeProjectId])

  useEffect(() => {
    if (routeProjectId) setSelectedProjectId(routeProjectId)
  }, [routeProjectId])

  const loadWorkspace = useCallback(async () => {
    if (!selectedProjectId) {
      setWorkspace(null)
      setGraph(null)
      return
    }
    setLoadingWorkspace(true)
    try {
      const [ws, dg] = await Promise.all([
        fetchMyProjectWorkspace(selectedProjectId),
        fetchMyDependencyGraph(selectedProjectId),
      ])
      setWorkspace(ws)
      setGraph(dg)
      setSelectedLibraryId((prev) => {
        if (prev && ws.libraries.some((lib) => lib.id === prev)) return prev
        return ws.libraries[0]?.id ?? null
      })
    } catch {
      toast({ title: 'Error', description: 'Failed to load project workspace' })
      setWorkspace(null)
      setGraph(null)
    } finally {
      setLoadingWorkspace(false)
    }
  }, [selectedProjectId, toast])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const libraryCells = useMemo(() => {
    if (!workspace) return []
    if (!selectedLibraryId) return workspace.cells || []
    return (workspace.cells || []).filter((cell) => cell.libraryId === selectedLibraryId)
  }, [workspace, selectedLibraryId])

  const libraryNameById = useMemo(() => {
    const map = new Map()
    workspace?.libraries.forEach((lib) => map.set(lib.id, lib.name))
    return map
  }, [workspace?.libraries])

  const activityEntries = useMemo(() => {
    const cells = workspace?.cells || []
    return cells
      .flatMap((cell) =>
        (cell.activityLog || []).map((entry) => ({
          ...entry,
          cellId: cell.id,
          cellName: cell.name,
          libraryName: libraryNameById.get(cell.libraryId) || '—',
        })),
      )
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [workspace?.cells, libraryNameById])

  const libraryCellCounts = useMemo(() => {
    const counts = new Map()
    for (const cell of workspace?.cells || []) {
      counts.set(cell.libraryId, (counts.get(cell.libraryId) ?? 0) + 1)
    }
    return counts
  }, [workspace?.cells])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const stats = workspace?.stats

  const updateCellInState = (updatedCell) => {
    setWorkspace((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        cells: prev.cells.map((cell) => (cell.id === updatedCell.id ? { ...cell, ...updatedCell } : cell)),
      }
    })
  }

  const handleAdvance = async (cell, payload) => {
    if (!selectedProjectId || !cell.isAssignedToMe) return
    setSavingId(cell.id)
    try {
      const updated = await updateCellWorkflow(selectedProjectId, cell.id, payload)
      updateCellInState(updated)
      toast({ title: 'Stage updated', description: `${cell.name} advanced` })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to advance stage' })
    } finally {
      setSavingId(null)
    }
  }

  const handleRequestReview = async (cell) => {
    if (!selectedProjectId || !cell.isAssignedToMe) return
    setSavingId(cell.id)
    try {
      const result = await requestCellReview(selectedProjectId, cell.id)
      updateCellInState(result.cell)
      toast({ title: 'Review requested', description: 'Admin will review your submission.' })
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to request review' })
    } finally {
      setSavingId(null)
    }
  }

  const loading = loadingProjects || loadingWorkspace

  return (
    <div className="emp-wf-page">
      <div className="emp-wf-surface">
        {projects.length > 1 ? (
          <div className="emp-wf-project-rail">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={cn('emp-wf-project-btn', selectedProjectId === project.id && 'is-active')}
                onClick={() => setSelectedProjectId(project.id)}
              >
                {project.name}
              </button>
            ))}
          </div>
        ) : null}

        {loading && !workspace ? (
          <p className="emp-wf-status">Loading workflow…</p>
        ) : !selectedProjectId || projects.length === 0 ? (
          <p className="emp-wf-status">No assigned projects yet.</p>
        ) : (
          <>
            <header className="emp-wf-workspace-head">
              <div className="min-w-0">
                <h1 className="emp-wf-workspace-title">{workspace?.project?.name || selectedProject?.name}</h1>
                <p className="emp-wf-workspace-meta">
                  {workspace?.project?.client} · {workspace?.project?.technologyNode}
                  {stats ? ` · ${stats.assignedToMe} assigned to you` : ''}
                </p>
              </div>
              <div className="emp-wf-workspace-head-actions">
                <nav className="emp-wf-section-rail" aria-label="Workspace sections">
                  {SECTION_ITEMS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWorkspaceSection(id)}
                      className={cn(
                        'emp-wf-section-btn',
                        workspaceSection === id ? 'emp-wf-section-btn--active' : 'emp-wf-section-btn--inactive',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {label}
                    </button>
                  ))}
                </nav>
                {workspace?.project?.completionPercentage != null ? (
                  <div className="emp-wf-progress-pill">
                    <span>Progress</span>
                    <strong>{workspace.project.completionPercentage}%</strong>
                  </div>
                ) : null}
              </div>
            </header>

            {stats ? (
              <div className="emp-wf-stats-row">
                {[
                  { label: 'Libraries', value: stats.libraryCount, icon: BookOpen },
                  { label: 'Cells', value: stats.cellCount, icon: Layers },
                  { label: 'Yours', value: stats.assignedToMe, icon: User },
                  { label: 'Ready', value: stats.readyCells, icon: CheckCircle2 },
                  { label: 'Blocked', value: stats.blockedCells, icon: GitBranch },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="emp-wf-stat">
                    <div className="emp-wf-stat-label">
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </div>
                    <p className="emp-wf-stat-value">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {workspaceSection === 'home' && (
              <div className="emp-wf-home-grid">
                <aside className="emp-wf-libraries-panel">
                  <p className="emp-wf-libraries-head">Libraries</p>
                  <div className="emp-wf-libraries-list">
                    {(workspace?.libraries || []).map((lib) => (
                      <button
                        key={lib.id}
                        type="button"
                        onClick={() => setSelectedLibraryId(lib.id)}
                        className={cn(
                          'emp-wf-library-nav',
                          selectedLibraryId === lib.id && 'is-active',
                        )}
                      >
                        <span className="emp-wf-library-nav-label">{lib.name}</span>
                        <span className="emp-wf-library-badge">{libraryCellCounts.get(lib.id) ?? 0}</span>
                      </button>
                    ))}
                    {(workspace?.libraries || []).length === 0 ? (
                      <p className="emp-wf-libraries-empty">No libraries in this project.</p>
                    ) : null}
                  </div>
                </aside>

                <section className="emp-wf-board-panel">
                  <div className="emp-wf-view-tabs">
                    {VIEW_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={cn('emp-wf-view-tab', viewTab === tab.id && 'is-active')}
                        onClick={() => {
                          setViewTab(tab.id)
                          setActiveFilter(null)
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {libraryCells.length === 0 ? (
                    <p className="emp-wf-status">No cells in this library.</p>
                  ) : (
                    <ProjectWorkflowBoard
                      cells={libraryCells}
                      user={user}
                      viewTab={viewTab}
                      activeFilter={activeFilter}
                      onFilterChange={setActiveFilter}
                      savingId={savingId}
                      onAdvance={handleAdvance}
                      onRequestReview={handleRequestReview}
                    />
                  )}
                </section>
              </div>
            )}

            {workspaceSection === 'graph' && (
              <div className="emp-wf-section-panel">
                <h2 className="emp-wf-section-title">Dependency graph</h2>
                {graph ? <DependencyGraphView graph={graph} /> : null}
              </div>
            )}

            {workspaceSection === 'activity' && (
              <div className="emp-wf-section-panel">
                <h2 className="emp-wf-section-title">Activity log</h2>
                <div className="emp-wf-activity-list">
                  {activityEntries.length === 0 ? (
                    <p className="emp-wf-activity-empty">No activity recorded yet.</p>
                  ) : (
                    activityEntries.map((entry, index) => (
                      <div key={`${entry.cellId}-${entry.at}-${index}`} className="emp-wf-activity-item">
                        <div className="emp-wf-activity-item-head">
                          <span className="emp-wf-activity-cell">{entry.cellName}</span>
                          <span className="emp-wf-activity-lib">{entry.libraryName}</span>
                          <time className="emp-wf-activity-time">
                            {new Date(entry.at).toLocaleString()}
                          </time>
                        </div>
                        <p className="emp-wf-activity-action">{String(entry.action || '').replace(/_/g, ' ')}</p>
                        {entry.detail ? <p className="emp-wf-activity-detail">{entry.detail}</p> : null}
                        {entry.userName ? <p className="emp-wf-activity-user">by {entry.userName}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
