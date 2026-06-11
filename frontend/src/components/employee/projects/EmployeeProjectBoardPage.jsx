import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  BookOpen,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  History,
  Layers,
  LayoutGrid,
  Network,
  Plus,
  User,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/employee/ui/dialog'
import { EmployeeAssignedCellsList } from '@components/employee/projects/EmployeeAssignedCellsList'
import { EmployeeProjectAnalyticsPanel } from '@components/employee/projects/EmployeeProjectAnalyticsPanel'
import { EmployeeProjectEffortPanel } from '@components/employee/projects/EmployeeProjectEffortPanel'
import { EmployeeDependencyGraphView } from '@components/employee/projects/EmployeeDependencyGraphView'
import {
  EmployeeCreateCellDialog,
  EmployeeCreateLibraryDialog,
} from '@components/employee/projects/EmployeeProjectManageDialogs'
import { EmployeeTeamLeadReviewsPanel } from '@components/employee/projects/EmployeeTeamLeadReviewsPanel'
import {
  fetchMyAssignedProjects,
  fetchMyDependencyGraph,
  fetchMyProjectWorkspace,
  fetchProjectPendingReviews,
} from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import { cn } from '@pages/employee/lib/utils'
import { getViewProgressStatus, SIMPLE_VIEW_COLUMNS } from '@/utils/cellWorkflowUi'
import '@pages/admin/Projects/adminProjects.css'
import './employeeProjectWorkflow.css'
import './employeeProjectsAdminTheme.css'

const BASE_SECTION_ITEMS = [
  { id: 'cells', label: 'Cells', icon: LayoutGrid },
  { id: 'effort', label: 'Estimation', icon: Clock3 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'graph', label: 'Dependencies', icon: Network },
  { id: 'activity', label: 'Activity', icon: History },
]

const TEAM_LEAD_SECTION = { id: 'reviews', label: 'Team reviews', icon: ClipboardCheck }

export function EmployeeProjectBoardPage({ routeProjectId = null }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId)
  const [workspace, setWorkspace] = useState(null)
  const [graph, setGraph] = useState(null)
  const [selectedLibraryId, setSelectedLibraryId] = useState(null)
  const [workspaceSection, setWorkspaceSection] = useState('cells')
  const [statusFilter, setStatusFilter] = useState(null)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingWorkspace, setLoadingWorkspace] = useState(false)
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false)
  const [libraryModalOpen, setLibraryModalOpen] = useState(false)
  const [cellModalOpen, setCellModalOpen] = useState(false)
  const [pendingReviews, setPendingReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true)
      try {
        const data = await fetchMyAssignedProjects()
        const list = Array.isArray(data) ? data : []
        setProjects(list)
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

  const loadPendingReviews = useCallback(async () => {
    if (!selectedProjectId || !workspace?.isTeamLead) {
      setPendingReviews([])
      return
    }
    setLoadingReviews(true)
    try {
      const data = await fetchProjectPendingReviews(selectedProjectId)
      setPendingReviews(Array.isArray(data) ? data : [])
    } catch {
      setPendingReviews([])
    } finally {
      setLoadingReviews(false)
    }
  }, [selectedProjectId, workspace?.isTeamLead])

  useEffect(() => {
    void loadPendingReviews()
  }, [loadPendingReviews])

  useEffect(() => {
    if (workspaceSection === 'reviews' && workspace?.isTeamLead) {
      void loadPendingReviews()
    }
  }, [workspaceSection, workspace?.isTeamLead, loadPendingReviews])

  useEffect(() => {
    if (workspaceSection !== 'graph' || !selectedProjectId) return
    void loadWorkspace()
  }, [workspaceSection, selectedProjectId, loadWorkspace])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && workspaceSection === 'graph' && selectedProjectId) {
        void loadWorkspace()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [workspaceSection, selectedProjectId, loadWorkspace])

  const libraryCells = useMemo(() => {
    if (!workspace) return []
    if (!selectedLibraryId) return workspace.cells || []
    return (workspace.cells || []).filter((cell) => cell.libraryId === selectedLibraryId)
  }, [workspace, selectedLibraryId])

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(SIMPLE_VIEW_COLUMNS.map((col) => [col.id, 0]))
    for (const cell of libraryCells) {
      const status = getViewProgressStatus(cell, 'layout')
      if (counts[status] != null) counts[status] += 1
    }
    return counts
  }, [libraryCells])

  const filteredLibraryCells = useMemo(() => {
    if (!statusFilter) return libraryCells
    return libraryCells.filter((cell) => getViewProgressStatus(cell, 'layout') === statusFilter)
  }, [libraryCells, statusFilter])

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

  const cellsById = useMemo(() => {
    const map = {}
    for (const cell of workspace?.cells || []) {
      map[cell.id] = cell
    }
    return map
  }, [workspace?.cells])

  const assignedCells = useMemo(
    () => (workspace?.cells || []).filter((cell) => cell.isAssignedToMe),
    [workspace?.cells],
  )

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const stats = workspace?.stats
  const isTeamLead = Boolean(workspace?.isTeamLead)
  const sectionItems = isTeamLead ? [...BASE_SECTION_ITEMS, TEAM_LEAD_SECTION] : BASE_SECTION_ITEMS

  const assigneeOptions = workspace?.assignees || []
  const activeLibrary = workspace?.libraries?.find((lib) => lib.id === selectedLibraryId)
  const completionPercentage = workspace?.project?.completionPercentage ?? 0

  const handleProjectChange = (projectId) => {
    if (!projectId || projectId === selectedProjectId) {
      setProjectSwitcherOpen(false)
      return
    }
    setSelectedProjectId(projectId)
    setProjectSwitcherOpen(false)
    navigate(`/employee/projects/${projectId}`, { replace: true })
  }

  const loading = loadingProjects || loadingWorkspace

  if (loading && !workspace) {
    return (
      <div className="admin-projects-employee-workspace" data-employee-project-workspace>
        <p className="px-4 py-8 text-center text-sm text-slate-500">Loading workflow…</p>
      </div>
    )
  }

  if (!selectedProjectId || projects.length === 0) {
    return (
      <div className="admin-projects-employee-workspace" data-employee-project-workspace>
        <p className="px-4 py-8 text-center text-sm text-slate-500">No assigned projects yet.</p>
      </div>
    )
  }

  return (
    <div className="admin-projects-employee-workspace" data-employee-project-workspace>
      <div className="admin-projects-workspace-shell">
        <div className="admin-projects-workspace-chrome">
          <header className="admin-projects-workspace-head">
            <div className="admin-projects-workspace-head-bar">
              <div className="admin-projects-workspace-head-left">
                <Link to="/employee/projects" className="admin-projects-back-btn">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  All projects
                </Link>
                <div className="admin-projects-workspace-identity">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="admin-projects-head-title">
                      {workspace?.project?.name || selectedProject?.name}
                    </h1>
                    {projects.length > 1 ? (
                      <>
                        <button
                          type="button"
                          className="admin-projects-project-switch-btn"
                          onClick={() => setProjectSwitcherOpen(true)}
                          aria-label="Switch project"
                        >
                          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                          Switch
                        </button>
                        <Dialog open={projectSwitcherOpen} onOpenChange={setProjectSwitcherOpen}>
                          <DialogContent className="emp-wf-project-switch-dialog">
                            <DialogHeader>
                              <DialogTitle>Choose project</DialogTitle>
                              <DialogDescription>
                                Select a project to open its workspace.
                              </DialogDescription>
                            </DialogHeader>
                            <ul className="emp-wf-project-switch-list">
                              {projects.map((project) => {
                                const isActive = project.id === selectedProjectId
                                return (
                                  <li key={project.id}>
                                    <button
                                      type="button"
                                      className={cn(
                                        'emp-wf-project-switch-item',
                                        isActive && 'is-active',
                                      )}
                                      onClick={() => handleProjectChange(project.id)}
                                    >
                                      <span className="emp-wf-project-switch-item-name">{project.name}</span>
                                      <span className="emp-wf-project-switch-item-meta">
                                        {project.client || 'Client'}
                                        {project.technologyNode ? ` · ${project.technologyNode}` : ''}
                                      </span>
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          </DialogContent>
                        </Dialog>
                      </>
                    ) : null}
                  </div>
                  <p className="admin-projects-workspace-meta">
                    {workspace?.project?.client} · {workspace?.project?.technologyNode}
                    {stats ? ` · ${stats.assignedToMe} assigned to you` : ''}
                  </p>
                </div>
              </div>

              <div className="admin-projects-workspace-head-right">
                {stats ? (
                  <div className="admin-projects-stats-row admin-projects-stats-row--header admin-projects-stats-row--bar">
                    {[
                      { label: 'Libraries', value: stats.libraryCount, icon: BookOpen },
                      { label: 'Cells', value: stats.cellCount, icon: Layers },
                      { label: 'Yours', value: stats.assignedToMe, icon: User },
                      { label: 'Complete', value: stats.readyCells, icon: CheckCircle2 },
                      { label: 'Archived', value: stats.blockedCells, icon: Archive },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="admin-projects-stat">
                        <div className="admin-projects-stat-label">
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                          <span>{label}</span>
                        </div>
                        <p className="admin-projects-stat-value">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {workspace?.project?.completionPercentage != null ? (
                  <div
                    className="admin-projects-progress-pill"
                    aria-label={`Project progress ${completionPercentage}%`}
                  >
                    <div
                      className="admin-projects-progress-ring"
                      style={{ '--progress': `${completionPercentage}%` }}
                    >
                      <span>{completionPercentage}%</span>
                    </div>
                    <span className="admin-projects-progress-label">Progress</span>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
        </div>

        <nav
          className="admin-projects-workspace-nav admin-projects-workspace-nav--below-chrome"
          aria-label="Workspace sections"
        >
          {sectionItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setWorkspaceSection(id)}
              className={cn(
                'admin-projects-section-btn',
                workspaceSection === id ? 'admin-projects-section-btn--active' : 'admin-projects-section-btn--inactive',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
              {id === 'reviews' && pendingReviews.length > 0 ? (
                <span className="admin-projects-employee-reviews-badge">{pendingReviews.length}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="admin-projects-workspace-scroll">
          <div className="admin-projects-workspace-content">
            {workspaceSection === 'cells' && (
              <div className="admin-projects-workspace-grid">
                <aside className="admin-projects-libraries-panel">
                  <div className="admin-projects-libraries-head-row">
                    <p className="admin-projects-libraries-head">
                      <BookOpen className="h-4 w-4" aria-hidden />
                      Libraries
                    </p>
                    <span className="admin-projects-libraries-count">
                      {workspace?.libraries?.length ?? 0}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="admin-projects-libraries-create"
                    onClick={() => setLibraryModalOpen(true)}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add library
                  </button>
                  <div className="admin-projects-libraries-list">
                    {(workspace?.libraries || []).map((lib) => (
                      <div key={lib.id} className="admin-projects-library-row">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLibraryId(lib.id)
                            setStatusFilter(null)
                          }}
                          className={cn(
                            'admin-projects-library-nav',
                            selectedLibraryId === lib.id && 'is-active',
                          )}
                        >
                          <span className="admin-projects-library-nav-label">{lib.name}</span>
                          <span className="admin-projects-library-badge">
                            {libraryCellCounts.get(lib.id) ?? 0}
                          </span>
                        </button>
                      </div>
                    ))}
                    {(workspace?.libraries || []).length === 0 ? (
                      <p className="px-2 py-4 text-xs text-slate-500">No libraries in this project.</p>
                    ) : null}
                  </div>
                </aside>

                <section className="admin-projects-cells-panel">
                  <div className="admin-projects-cells-head">
                    <div className="admin-projects-cells-head-text">
                      <h2>Cells</h2>
                      {activeLibrary ? (
                        <span className="admin-projects-active-lib-pill">{activeLibrary.name}</span>
                      ) : null}
                    </div>
                    <div className="admin-projects-cells-head-filters">
                      <div className="admin-projects-pill-rail" role="group" aria-label="Filter cells by status">
                        {SIMPLE_VIEW_COLUMNS.map((col) => (
                          <button
                            key={col.id}
                            type="button"
                            className={cn(
                              'admin-projects-pill-btn',
                              statusFilter === col.id && 'is-active',
                            )}
                            onClick={() => setStatusFilter(statusFilter === col.id ? null : col.id)}
                          >
                            {col.label}
                            <span className="ml-1 opacity-80">({statusCounts[col.id] ?? 0})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-projects-cells-create"
                      disabled={!selectedLibraryId}
                      onClick={() => setCellModalOpen(true)}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Add cell
                    </button>
                  </div>
                  <div className="admin-projects-employee-cells-body">
                    <EmployeeAssignedCellsList
                      cells={filteredLibraryCells}
                      projectId={selectedProjectId}
                      libraryNameById={Object.fromEntries(libraryNameById)}
                      isTeamLead={isTeamLead}
                      assigneeOptions={assigneeOptions}
                      onAssigned={() => void loadWorkspace()}
                      emptyMessage={
                        statusFilter
                          ? 'No cells match this status.'
                          : 'No cells in this library.'
                      }
                    />
                  </div>
                </section>
              </div>
            )}

            {workspaceSection === 'effort' && (
              <EmployeeProjectEffortPanel
                cells={assignedCells}
                projectId={selectedProjectId}
              />
            )}

            {workspaceSection === 'analytics' && (
              <div className="admin-projects-section-panel">
                <EmployeeProjectAnalyticsPanel workspaces={workspace ? [workspace] : []} />
              </div>
            )}

            {workspaceSection === 'graph' && (
              <section className="admin-projects-section-panel emp-wf-graph-panel">
                <div className="emp-wf-graph-panel-head">
                  <h2 className="emp-wf-graph-section-title">Dependency graph</h2>
                  <p className="emp-wf-graph-section-hint">
                    Horizontal workflow map of cell dependencies.
                  </p>
                </div>
                {graph ? (
                  <EmployeeDependencyGraphView
                    graph={graph}
                    cellsById={cellsById}
                    projectId={selectedProjectId}
                  />
                ) : (
                  <p className="emp-wf-status">Loading dependency graph…</p>
                )}
              </section>
            )}

            {workspaceSection === 'activity' && (
              <div className="admin-projects-section-panel emp-wf-section-panel">
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

            {workspaceSection === 'reviews' && isTeamLead && (
              <section className="admin-projects-section-panel">
                <div className="mb-3">
                  <h2 className="emp-wf-section-title">Team review queue</h2>
                  <p className="emp-wf-graph-section-hint">
                    Approve or reject review requests from engineers on this project.
                  </p>
                </div>
                <EmployeeTeamLeadReviewsPanel
                  projectId={selectedProjectId}
                  reviews={pendingReviews}
                  loading={loadingReviews}
                  onResolved={async () => {
                    await loadPendingReviews()
                    await loadWorkspace()
                  }}
                />
              </section>
            )}
          </div>
        </div>
      </div>

      <EmployeeCreateLibraryDialog
        open={libraryModalOpen}
        onOpenChange={setLibraryModalOpen}
        projectId={selectedProjectId}
        isTeamLead={isTeamLead}
        assigneeOptions={assigneeOptions}
        onCreated={() => void loadWorkspace()}
      />
      <EmployeeCreateCellDialog
        open={cellModalOpen}
        onOpenChange={setCellModalOpen}
        projectId={selectedProjectId}
        libraries={workspace?.libraries || []}
        libraryCellCounts={libraryCellCounts}
        technologyNode={workspace?.project?.technologyNode || selectedProject?.technologyNode || ''}
        assigneeOptions={assigneeOptions}
        isTeamLead={isTeamLead}
        defaultLibraryId={selectedLibraryId}
        onCreated={() => void loadWorkspace()}
      />
    </div>
  )
}
