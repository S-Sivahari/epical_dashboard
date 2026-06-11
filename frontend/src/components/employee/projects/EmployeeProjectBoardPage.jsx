import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  GitBranch,
  History,
  Layers,
  LayoutGrid,
  ListChecks,
  Search,
  User,
  X,
} from 'lucide-react'
import { ROUTES } from '@constants/routes'
import { fetchMyDependencyGraph, fetchMyProjectWorkspace } from '@services/employeeProjectService'
import { useToast } from '@components/employee/shared/ToastProvider'
import { cn } from '@/utils/cn'
import { CELL_TYPES } from '@/types/projectWorkspace'
import { DependencyGraphView } from '@pages/admin/Projects/DependencyGraphView'
import { CellWorkflowPanel } from '@pages/admin/Projects/CellWorkflowPanel'
import { ProjectWorkflowOverview } from '@pages/admin/Projects/ProjectWorkflowOverview'
import {
  CELL_STATUS_FILTER_OPTIONS,
  CELL_TYPE_LABELS,
  STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
  cellDisplayStatus,
  normalizeCellWorkflow,
  projectCellProgressPercent,
} from '@pages/admin/Projects/projectWorkspaceUi'
import '@pages/admin/Projects/adminProjects.css'

const FILTER_SELECT_CLASS =
  'admin-projects-filter-select h-10 w-full min-w-[9.5rem] cursor-pointer appearance-none pl-3 pr-9 text-sm font-medium'

const ACTIVITY_FILTER_SELECT_CLASS =
  'admin-projects-filter-select admin-projects-activity-filter-control w-full cursor-pointer appearance-none pl-2.5 pr-8 text-xs font-medium'

const SECTION_ITEMS = [
  { id: 'home', label: 'Home', icon: LayoutGrid },
  { id: 'workflow', label: 'Workflow', icon: ListChecks },
  { id: 'graph', label: 'Dependency graph', icon: GitBranch },
  { id: 'activity', label: 'Activity log', icon: History },
  { id: 'checklist', label: 'Checklist', icon: ClipboardList },
]

const employeeCellPath = (projectId, cellId) => ROUTES.EMPLOYEE_PROJECT_CELL(projectId, cellId)

export function EmployeeProjectBoardPage({ routeProjectId = null }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [workspace, setWorkspace] = useState(null)
  const [graph, setGraph] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeLibraryId, setActiveLibraryId] = useState(null)
  const [workspaceSection, setWorkspaceSection] = useState('home')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterTypeSelect, setFilterTypeSelect] = useState('all')
  const [filterStatusSelect, setFilterStatusSelect] = useState('all')
  const [statFilter, setStatFilter] = useState(null)
  const [showAllCells, setShowAllCells] = useState(false)
  const [activityFilterSearch, setActivityFilterSearch] = useState('')
  const [activityLibraryFilter, setActivityLibraryFilter] = useState('all')
  const [activityCellFilter, setActivityCellFilter] = useState('all')
  const [workflowFilterSearch, setWorkflowFilterSearch] = useState('')
  const [workflowLibraryFilter, setWorkflowLibraryFilter] = useState('all')
  const [workflowCellFilter, setWorkflowCellFilter] = useState('all')

  const projectId = routeProjectId

  const reload = useCallback(async () => {
    if (!projectId) {
      setWorkspace(null)
      setGraph(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [ws, dg] = await Promise.all([
        fetchMyProjectWorkspace(projectId),
        fetchMyDependencyGraph(projectId),
      ])
      setWorkspace(ws)
      setGraph(dg)
      setActiveLibraryId((prev) => {
        if (prev && ws.libraries.some((lib) => lib.id === prev)) return prev
        return ws.libraries[0]?.id ?? null
      })
    } catch {
      toast({ title: 'Error', description: 'Failed to load project workspace' })
      setWorkspace(null)
      setGraph(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (workspaceSection !== 'graph' || !projectId) return
    void reload()
  }, [workspaceSection, projectId, reload])

  const libraries = workspace?.libraries ?? []
  const allCells = workspace?.cells ?? []
  const project = workspace?.project
  const stats = workspace?.stats

  const displayedCells = useMemo(() => {
    if (!workspace) return []
    let cells = showAllCells
      ? allCells
      : activeLibraryId
        ? allCells.filter((c) => c.libraryId === activeLibraryId)
        : []
    if (statFilter === 'complete') cells = cells.filter((c) => c.status === 'completed')
    if (statFilter === 'not_started') cells = cells.filter((c) => c.status === 'ready')
    if (statFilter === 'in_progress') cells = cells.filter((c) => c.status === 'in_progress')
    if (statFilter === 'unassigned') cells = cells.filter((c) => !c.assignedEmployeeId)
    const q = filterSearch.trim().toLowerCase()
    if (q) cells = cells.filter((c) => c.name.toLowerCase().includes(q))
    if (filterTypeSelect !== 'all') cells = cells.filter((c) => c.cellType === filterTypeSelect)
    if (filterStatusSelect !== 'all') {
      cells = cells.filter((c) => c.status === filterStatusSelect)
    }
    return cells
  }, [
    workspace,
    allCells,
    activeLibraryId,
    showAllCells,
    statFilter,
    filterSearch,
    filterTypeSelect,
    filterStatusSelect,
  ])

  const applyStatFilter = (filter) => {
    setFilterSearch('')
    setFilterTypeSelect('all')
    if (filter === 'complete') setFilterStatusSelect('completed')
    else if (filter === 'not_started') setFilterStatusSelect('ready')
    else if (filter === 'in_progress') setFilterStatusSelect('in_progress')
    else setFilterStatusSelect('all')
    setStatFilter((prev) => (prev === filter ? null : filter))
    setWorkspaceSection('home')
  }

  const clearFilters = () => {
    setFilterSearch('')
    setFilterTypeSelect('all')
    setFilterStatusSelect('all')
    setStatFilter(null)
  }

  const showAllProjectCells = () => {
    clearFilters()
    setShowAllCells(true)
    setWorkspaceSection('home')
  }

  const libraryCellCounts = useMemo(() => {
    const counts = new Map()
    for (const cell of allCells) {
      counts.set(cell.libraryId, (counts.get(cell.libraryId) ?? 0) + 1)
    }
    return counts
  }, [allCells])

  const activeLibrary = useMemo(
    () => libraries.find((lib) => lib.id === activeLibraryId) ?? null,
    [libraries, activeLibraryId],
  )

  const libraryNameById = useMemo(() => {
    const names = new Map()
    for (const lib of libraries) {
      names.set(lib.id, lib.name)
    }
    return names
  }, [libraries])

  const cellsById = useMemo(() => {
    const map = {}
    for (const cell of allCells) {
      map[cell.id] = cell
    }
    return map
  }, [allCells])

  const activityEntries = useMemo(() => {
    return allCells
      .flatMap((cell) =>
        (cell.activityLog ?? []).map((entry) => ({
          ...entry,
          cellId: cell.id,
          cellName: cell.name,
          libraryId: cell.libraryId,
          libraryName: libraryNameById.get(cell.libraryId) || '—',
        })),
      )
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [allCells, libraryNameById])

  const activityFilterCellOptions = useMemo(() => {
    let cells = allCells
    if (activityLibraryFilter !== 'all') {
      cells = cells.filter((cell) => cell.libraryId === activityLibraryFilter)
    }
    return [...cells].sort((a, b) => a.name.localeCompare(b.name))
  }, [allCells, activityLibraryFilter])

  const workflowFilterCellOptions = useMemo(() => {
    let cells = allCells
    if (workflowLibraryFilter !== 'all') {
      cells = cells.filter((cell) => cell.libraryId === workflowLibraryFilter)
    }
    return [...cells].sort((a, b) => a.name.localeCompare(b.name))
  }, [allCells, workflowLibraryFilter])

  const filteredWorkflowCells = useMemo(() => {
    const query = workflowFilterSearch.trim().toLowerCase()
    return allCells.filter((cell) => {
      if (workflowLibraryFilter !== 'all' && cell.libraryId !== workflowLibraryFilter) return false
      if (workflowCellFilter !== 'all' && cell.id !== workflowCellFilter) return false
      if (!query) return true
      const libraryName = libraryNameById.get(cell.libraryId) || ''
      const workflow = normalizeCellWorkflow(cell.workflow)
      const stageStatuses = workflow.map((stage) => WORKFLOW_STATUS_LABELS[stage.status]).join(' ')
      const haystack = [cell.name, libraryName, cell.cellType, stageStatuses]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [allCells, workflowFilterSearch, workflowLibraryFilter, workflowCellFilter, libraryNameById])

  const filteredActivityEntries = useMemo(() => {
    const query = activityFilterSearch.trim().toLowerCase()
    return activityEntries.filter((entry) => {
      if (activityLibraryFilter !== 'all' && entry.libraryId !== activityLibraryFilter) return false
      if (activityCellFilter !== 'all' && entry.cellId !== activityCellFilter) return false
      if (!query) return true
      const haystack = [
        entry.cellName,
        entry.libraryName,
        entry.action.replace(/_/g, ' '),
        entry.detail,
        entry.userName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [activityEntries, activityFilterSearch, activityLibraryFilter, activityCellFilter])

  const workflowProgressPercent = stats
    ? projectCellProgressPercent(stats.completedCells ?? 0, stats.cellCount ?? 0)
    : 0

  if (!projectId) {
    return (
      <div className="admin-projects-page px-6 py-8 text-center text-slate-500">
        Select a project from My Projects.
      </div>
    )
  }

  if (loading && !workspace) {
    return (
      <div className="admin-projects-page px-6 py-8 text-center text-slate-500">
        Loading workspace…
      </div>
    )
  }

  if (!workspace || !project || !stats) {
    return (
      <div className="admin-projects-page px-6 py-8 text-center">
        <p className="text-slate-600">Project not found or access denied.</p>
        <Link
          to={ROUTES.EMPLOYEE_MY_PROJECTS}
          className="mt-2 inline-block text-sm font-semibold text-emerald-700"
        >
          Back to my projects
        </Link>
      </div>
    )
  }

  return (
    <div
      className="admin-projects-page admin-projects-view relative flex h-full min-h-0 flex-1 flex-col font-body"
      data-employee-project-workspace
    >
      <div className="admin-projects-workspace-shell relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="admin-projects-workspace-chrome">
          <header className="admin-projects-workspace-head">
            <div className="admin-projects-workspace-head-bar">
              <div className="admin-projects-workspace-head-left">
                <Link to={ROUTES.EMPLOYEE_MY_PROJECTS} className="admin-projects-back-btn">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  My projects
                </Link>
                <div className="admin-projects-workspace-identity">
                  <h1 className="admin-projects-head-title">{project.name}</h1>
                  <p className="admin-projects-workspace-meta">
                    {project.client} · {project.technologyNode}
                    {stats.assignedToMe != null ? ` · ${stats.assignedToMe} assigned to you` : ''}
                  </p>
                </div>
              </div>

              <div className="admin-projects-workspace-head-right">
                <div className="admin-projects-stats-row admin-projects-stats-row--header admin-projects-stats-row--bar">
                  {[
                    { label: 'Libraries', value: stats.libraryCount, icon: BookOpen, filter: null },
                    { label: 'Cells', value: stats.cellCount, icon: Layers, filter: null },
                    { label: 'Complete', value: stats.completedCells, icon: CheckCircle2, filter: 'complete' },
                    { label: 'Not Started', value: stats.notStartedCells ?? 0, icon: Layers, filter: 'not_started' },
                    { label: 'In Progress', value: stats.inProgressCells ?? 0, icon: ListChecks, filter: 'in_progress' },
                    { label: 'Unassigned', value: stats.unassignedCells, icon: User, filter: 'unassigned' },
                  ].map(({ label, value, icon: Icon, filter }) => (
                    <button
                      key={label}
                      type="button"
                      className={cn(
                        'admin-projects-stat',
                        label === 'Cells' && showAllCells && 'admin-projects-stat--active',
                        filter && statFilter === filter && 'admin-projects-stat--active',
                      )}
                      onClick={() => {
                        if (label === 'Cells') {
                          if (showAllCells) {
                            setShowAllCells(false)
                            clearFilters()
                          } else {
                            setShowAllCells(true)
                            showAllProjectCells()
                          }
                        } else if (label === 'Libraries') {
                          setShowAllCells(false)
                          clearFilters()
                        } else if (filter) {
                          setShowAllCells(false)
                          applyStatFilter(filter)
                        }
                      }}
                    >
                      <div className="admin-projects-stat-label">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        <span>{label}</span>
                      </div>
                      <p className="admin-projects-stat-value">{value}</p>
                    </button>
                  ))}
                </div>

                <div
                  className="admin-projects-progress-pill"
                  aria-label={`Project progress ${stats.completedCells} of ${stats.cellCount} cells completed (${workflowProgressPercent}%)`}
                >
                  <div
                    className="admin-projects-progress-ring"
                    style={{ '--progress': `${workflowProgressPercent}%` }}
                  >
                    <span>{workflowProgressPercent}%</span>
                  </div>
                  <span className="admin-projects-progress-label">Progress</span>
                </div>
              </div>
            </div>
          </header>
        </div>

        <nav
          className="admin-projects-workspace-nav admin-projects-workspace-nav--below-chrome"
          aria-label="Workspace sections"
        >
          {SECTION_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setWorkspaceSection(id)}
              className={cn(
                'admin-projects-section-btn',
                workspaceSection === id
                  ? 'admin-projects-section-btn--active'
                  : 'admin-projects-section-btn--inactive',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div className="admin-projects-workspace-scroll">
          <div className="admin-projects-workspace-content">
            {workspaceSection === 'home' && (
              <div className="admin-projects-workspace-grid">
                <aside className="admin-projects-libraries-panel">
                  <div className="admin-projects-libraries-head-row">
                    <p className="admin-projects-libraries-head">
                      <BookOpen className="h-4 w-4" aria-hidden />
                      Libraries
                    </p>
                    <span className="admin-projects-libraries-count">{libraries.length}</span>
                  </div>
                  <div className="admin-projects-libraries-list">
                    {libraries.map((lib) => (
                      <div key={lib.id} className="admin-projects-library-row">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveLibraryId(lib.id)
                            setShowAllCells(false)
                            clearFilters()
                            setWorkspaceSection('home')
                          }}
                          className={cn(
                            'admin-projects-library-nav',
                            activeLibraryId === lib.id && !showAllCells && 'is-active',
                          )}
                        >
                          <span className="admin-projects-library-nav-label">{lib.name}</span>
                          <span className="admin-projects-library-badge">
                            {libraryCellCounts.get(lib.id) ?? 0}
                          </span>
                        </button>
                      </div>
                    ))}
                    {libraries.length === 0 && (
                      <p className="px-2 py-4 text-xs text-slate-500">No libraries in this project.</p>
                    )}
                  </div>
                </aside>

                <section className="admin-projects-cells-panel">
                  <div className="admin-projects-cells-head">
                    <div className="admin-projects-cells-head-text">
                      <h2>Cells</h2>
                      {showAllCells ? (
                        <span className="admin-projects-active-lib-pill">All libraries</span>
                      ) : activeLibrary ? (
                        <span className="admin-projects-active-lib-pill">{activeLibrary.name}</span>
                      ) : null}
                    </div>

                    <div className="admin-projects-cells-head-filters">
                      <div className="admin-projects-filter-search-wrap">
                        <Search className="admin-projects-filter-search-icon" strokeWidth={2} aria-hidden />
                        <input
                          type="text"
                          value={filterSearch}
                          onChange={(e) => {
                            setFilterSearch(e.target.value)
                            setStatFilter(null)
                          }}
                          placeholder="Search by cell name..."
                          className="admin-projects-filter-search-input"
                          aria-label="Search cells by name"
                        />
                        {filterSearch ? (
                          <button
                            type="button"
                            className="admin-projects-filter-search-clear"
                            onClick={() => setFilterSearch('')}
                            aria-label="Clear search"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>

                      <div className="admin-projects-filter-select-wrap">
                        <select
                          value={filterTypeSelect}
                          onChange={(e) => {
                            setFilterTypeSelect(e.target.value)
                            setStatFilter(null)
                          }}
                          className={FILTER_SELECT_CLASS}
                          aria-label="Filter by cell type"
                        >
                          <option value="all">All types</option>
                          {CELL_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {CELL_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
                      </div>

                      <div className="admin-projects-filter-select-wrap">
                        <select
                          value={filterStatusSelect}
                          onChange={(e) => {
                            setFilterStatusSelect(e.target.value)
                            setStatFilter(null)
                          }}
                          className={FILTER_SELECT_CLASS}
                          aria-label="Filter by status"
                        >
                          <option value="all">All statuses</option>
                          {CELL_STATUS_FILTER_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
                      </div>
                    </div>
                  </div>

                  <div className="admin-projects-cells-table-wrap">
                    <table className="admin-projects-table admin-projects-table--cells">
                      <thead>
                        <tr>
                          <th className="admin-projects-table-col-name">Name</th>
                          {showAllCells ? (
                            <th className="admin-projects-table-col-library">Library</th>
                          ) : null}
                          <th className="admin-projects-table-col-type">Type</th>
                          <th className="admin-projects-table-col-assigned">Assigned</th>
                          <th className="admin-projects-table-col-status">Status</th>
                          <th className="admin-projects-table-col-workflow">Workflow</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedCells.map((cell) => (
                          <tr
                            key={cell.id}
                            className="admin-projects-table-row-clickable"
                            onClick={() => navigate(employeeCellPath(projectId, cell.id))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                navigate(employeeCellPath(projectId, cell.id))
                              }
                            }}
                            tabIndex={0}
                            role="link"
                            aria-label={`Open ${cell.name}`}
                          >
                            <td className="admin-projects-table-col-name admin-projects-table-cell-name">
                              {cell.name}
                              {cell.isAssignedToMe ? (
                                <span className="ml-2 text-[10px] font-bold uppercase text-emerald-700">
                                  Yours
                                </span>
                              ) : null}
                            </td>
                            {showAllCells ? (
                              <td className="admin-projects-table-col-library">
                                {libraryNameById.get(cell.libraryId) || '—'}
                              </td>
                            ) : null}
                            <td className="admin-projects-table-col-type">
                              {CELL_TYPE_LABELS[cell.cellType] ?? cell.cellType}
                            </td>
                            <td className="admin-projects-table-col-assigned">
                              {cell.assignedEmployeeName || '—'}
                            </td>
                            <td className="admin-projects-table-col-status">
                              <span
                                className={cn(
                                  'admin-projects-status-chip admin-projects-status-chip--table',
                                  cell.status === 'ready' && 'is-not-started',
                                  cell.status === 'completed' && 'is-completed',
                                  cell.status === 'in_progress' && 'is-progress',
                                )}
                              >
                                {cellDisplayStatus(cell)}
                              </span>
                            </td>
                            <td
                              className="admin-projects-table-col-workflow"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <CellWorkflowPanel projectId={projectId} cell={cell} compact />
                            </td>
                          </tr>
                        ))}
                        {displayedCells.length === 0 && (
                          <tr>
                            <td
                              colSpan={showAllCells ? 6 : 5}
                              className="admin-projects-table-empty"
                            >
                              {showAllCells
                                ? 'No cells in this project.'
                                : 'No cells in this library.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {workspaceSection === 'workflow' && (
              <div className="admin-projects-section-panel admin-projects-section-panel--workflow">
                <div className="admin-projects-workflow-panel">
                  <div className="admin-projects-activity-head">
                    <h2 className="admin-projects-activity-head-title">Cell workflow overview</h2>
                    <div className="admin-projects-activity-head-filters">
                      <div className="admin-projects-filter-search-wrap admin-projects-activity-head-search">
                        <Search
                          className="admin-projects-filter-search-icon admin-projects-activity-filter-icon"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <input
                          type="text"
                          value={workflowFilterSearch}
                          onChange={(e) => setWorkflowFilterSearch(e.target.value)}
                          placeholder="Search workflow..."
                          className="admin-projects-filter-search-input admin-projects-activity-filter-control"
                          aria-label="Search workflow overview"
                        />
                        {workflowFilterSearch ? (
                          <button
                            type="button"
                            className="admin-projects-filter-search-clear"
                            onClick={() => setWorkflowFilterSearch('')}
                            aria-label="Clear workflow search"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <div className="admin-projects-filter-select-wrap admin-projects-activity-head-select">
                        <select
                          value={workflowCellFilter}
                          onChange={(e) => setWorkflowCellFilter(e.target.value)}
                          className={ACTIVITY_FILTER_SELECT_CLASS}
                          aria-label="Filter workflow by cell"
                        >
                          <option value="all">All cells</option>
                          {workflowFilterCellOptions.map((cell) => (
                            <option key={cell.id} value={cell.id}>
                              {cell.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="admin-projects-filter-select-icon admin-projects-activity-filter-icon"
                          aria-hidden
                        />
                      </div>
                      <div className="admin-projects-filter-select-wrap admin-projects-activity-head-select">
                        <select
                          value={workflowLibraryFilter}
                          onChange={(e) => {
                            const nextLibrary = e.target.value
                            setWorkflowLibraryFilter(nextLibrary)
                            if (workflowCellFilter !== 'all') {
                              const selectedCell = allCells.find((cell) => cell.id === workflowCellFilter)
                              if (
                                nextLibrary !== 'all' &&
                                selectedCell?.libraryId !== nextLibrary
                              ) {
                                setWorkflowCellFilter('all')
                              }
                            }
                          }}
                          className={ACTIVITY_FILTER_SELECT_CLASS}
                          aria-label="Filter workflow by library"
                        >
                          <option value="all">All libraries</option>
                          {libraries.map((lib) => (
                            <option key={lib.id} value={lib.id}>
                              {lib.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="admin-projects-filter-select-icon admin-projects-activity-filter-icon"
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                  <ProjectWorkflowOverview
                    projectId={projectId}
                    cells={filteredWorkflowCells}
                    totalCellCount={allCells.length}
                    completedCellCount={stats.completedCells}
                    libraryNameById={libraryNameById}
                    getCellPath={employeeCellPath}
                  />
                </div>
              </div>
            )}

            {workspaceSection === 'graph' && (
              <div className="admin-projects-section-panel admin-projects-section-panel--graph">
                <div className="admin-projects-graph-section">
                  <h2 className="admin-projects-graph-title">Dependency graph</h2>
                  <p className="admin-projects-graph-hint">
                    Horizontal workflow map of cell dependencies.
                  </p>
                  {graph ? (
                    <DependencyGraphView
                      graph={graph}
                      cellsById={cellsById}
                      projectId={projectId}
                      getCellPath={employeeCellPath}
                    />
                  ) : (
                    <p className="admin-projects-graph-loading">Loading dependency graph…</p>
                  )}
                </div>
              </div>
            )}

            {workspaceSection === 'activity' && (
              <div className="admin-projects-section-panel admin-projects-section-panel--activity">
                <div className="admin-projects-activity-panel">
                  <div className="admin-projects-activity-head">
                    <h2 className="admin-projects-activity-head-title">Activity log</h2>
                    <div className="admin-projects-activity-head-filters">
                      <div className="admin-projects-filter-search-wrap admin-projects-activity-head-search">
                        <Search
                          className="admin-projects-filter-search-icon admin-projects-activity-filter-icon"
                          strokeWidth={2}
                          aria-hidden
                        />
                        <input
                          type="text"
                          value={activityFilterSearch}
                          onChange={(e) => setActivityFilterSearch(e.target.value)}
                          placeholder="Search activity..."
                          className="admin-projects-filter-search-input admin-projects-activity-filter-control"
                          aria-label="Search activity log"
                        />
                        {activityFilterSearch ? (
                          <button
                            type="button"
                            className="admin-projects-filter-search-clear"
                            onClick={() => setActivityFilterSearch('')}
                            aria-label="Clear activity search"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <div className="admin-projects-filter-select-wrap admin-projects-activity-head-select">
                        <select
                          value={activityCellFilter}
                          onChange={(e) => setActivityCellFilter(e.target.value)}
                          className={ACTIVITY_FILTER_SELECT_CLASS}
                          aria-label="Filter activity by cell"
                        >
                          <option value="all">All cells</option>
                          {activityFilterCellOptions.map((cell) => (
                            <option key={cell.id} value={cell.id}>
                              {cell.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="admin-projects-filter-select-icon admin-projects-activity-filter-icon"
                          aria-hidden
                        />
                      </div>
                      <div className="admin-projects-filter-select-wrap admin-projects-activity-head-select">
                        <select
                          value={activityLibraryFilter}
                          onChange={(e) => {
                            const nextLibrary = e.target.value
                            setActivityLibraryFilter(nextLibrary)
                            if (activityCellFilter !== 'all') {
                              const selectedCell = allCells.find((cell) => cell.id === activityCellFilter)
                              if (
                                nextLibrary !== 'all' &&
                                selectedCell?.libraryId !== nextLibrary
                              ) {
                                setActivityCellFilter('all')
                              }
                            }
                          }}
                          className={ACTIVITY_FILTER_SELECT_CLASS}
                          aria-label="Filter activity by library"
                        >
                          <option value="all">All libraries</option>
                          {libraries.map((lib) => (
                            <option key={lib.id} value={lib.id}>
                              {lib.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="admin-projects-filter-select-icon admin-projects-activity-filter-icon"
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>

                  <div className="admin-projects-activity-table-wrap">
                    <table className="admin-projects-activity-table">
                      <thead>
                        <tr>
                          <th>Cell</th>
                          <th>Library</th>
                          <th>Action</th>
                          <th>Detail</th>
                          <th>User</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActivityEntries.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="admin-projects-activity-empty">
                              {activityEntries.length === 0
                                ? 'No activity recorded yet.'
                                : 'No activity matches your filters.'}
                            </td>
                          </tr>
                        ) : (
                          filteredActivityEntries.map((entry, index) => (
                            <tr key={`${entry.cellId}-${entry.at}-${index}`}>
                              <td className="admin-projects-activity-table-cell">{entry.cellName}</td>
                              <td>
                                <span className="admin-projects-activity-lib">{entry.libraryName}</span>
                              </td>
                              <td className="admin-projects-activity-table-action">
                                {entry.action.replace(/_/g, ' ')}
                              </td>
                              <td className="admin-projects-activity-table-detail">
                                {entry.detail || '—'}
                              </td>
                              <td>{entry.userName || '—'}</td>
                              <td className="admin-projects-activity-table-time">
                                <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {workspaceSection === 'checklist' && (
              <div className="admin-projects-section-panel admin-projects-section-panel--checklist">
                <div className="admin-projects-cells-panel px-4 py-6">
                  <h2 className="admin-projects-activity-head-title mb-2">Project checklists</h2>
                  <p className="text-sm text-slate-600">
                    Open a cell from the Home tab to complete its checklist and final cell details.
                    Project-level checklist templates are managed by administrators.
                  </p>
                  <div className="admin-projects-cells-table-wrap mt-4">
                    <table className="admin-projects-table admin-projects-table--cells">
                      <thead>
                        <tr>
                          <th className="admin-projects-table-col-name">Cell</th>
                          <th className="admin-projects-table-col-library">Library</th>
                          <th className="admin-projects-table-col-type">Type</th>
                          <th className="admin-projects-table-col-status">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCells.map((cell) => (
                          <tr
                            key={cell.id}
                            className="admin-projects-table-row-clickable"
                            onClick={() => navigate(employeeCellPath(projectId, cell.id))}
                          >
                            <td className="admin-projects-table-col-name">{cell.name}</td>
                            <td>{libraryNameById.get(cell.libraryId) || '—'}</td>
                            <td>{CELL_TYPE_LABELS[cell.cellType] ?? cell.cellType}</td>
                            <td>
                              <span
                                className={cn(
                                  'admin-projects-status-chip admin-projects-status-chip--table',
                                  cell.status === 'ready' && 'is-not-started',
                                  cell.status === 'completed' && 'is-completed',
                                  cell.status === 'in_progress' && 'is-progress',
                                )}
                              >
                                {cellDisplayStatus(cell)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
