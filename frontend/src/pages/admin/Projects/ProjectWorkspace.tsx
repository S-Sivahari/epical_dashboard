import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, BookOpen, CheckCircle2, ChevronDown, ClipboardList, GitBranch, History, Layers, LayoutGrid, ListChecks, Plus, Search, User, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageWrapper } from '@components/layout/PageWrapper'
import { ConfirmModal } from '@components/modals/ConfirmModal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { useProjectPortal } from './projectPortal'
import { getEmployees } from '@services/employeeService'
import {
  createCell,
  createLibrary,
  deleteCell,
  deleteLibrary,
  downloadCellImportTemplate,
  fetchDependencyGraph,
  fetchEffortPrediction,
  fetchWorkspaceSummary,
  importCellsForLibrary,
  updateLibrary,
  type EffortPrediction,
} from '@/services/projectWorkspaceService'
import {
  createMyProjectCell,
  createMyProjectLibrary,
  fetchMyDependencyGraph,
  fetchMyEffortPrediction,
  fetchMyProjectWorkspace,
} from '@/services/employeeProjectService'
import { mapEmployeeWorkspaceToSummary } from '@/utils/employeeWorkspaceAdapter'
import { cn } from '@/utils/cn'
import {
  CELL_TYPES,
  type CellStatus,
  type DependencyGraph,
  type ProjectCell,
  type ProjectLibrary,
  type WorkspaceSummary,
} from '@/types/projectWorkspace'
import type { Employee } from '@/types'
import { formatDateTime } from '@/utils/formatDate'
import { DependencyGraphView } from './DependencyGraphView'
import { CellWorkflowPanel } from './CellWorkflowPanel'
import { CellCompletionTimeSummaryLauncher } from './CellCompletionTimeSummaryLauncher'
import { ProjectWorkflowOverview } from './ProjectWorkflowOverview'
import { ProjectTypeChecklistPanel } from './ProjectTypeChecklistPanel'
import {
  CELL_STATUS_FILTER_OPTIONS,
  CELL_TYPE_LABELS,
  STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
  cellActualEffortHours,
  cellDisplayStatus,
  cellTypeLabel,
  normalizeCellType,
  normalizeCellWorkflow,
  projectCellProgressPercent,
} from './projectWorkspaceUi'
import { calculateEstimatedHours, CELL_COMPLEXITY_OPTIONS, DEFAULT_BASE_HOURS, formatComplexityFactor } from '@/utils/effortEstimationUtils'
import { buildEmployeeFullName, findEmployeeByAssigneeId, resolveAssigneeSelectValue } from '@/utils/employeeDisplayName'
import { WorkspaceLibraryCard, WorkspaceLibraryToolbar } from './WorkspaceLibraryCard'
import './adminProjects.css'

type DeleteTarget = { type: 'library' | 'cell'; id: string; name: string }
type WorkspaceSection = 'home' | 'workflow' | 'graph' | 'activity' | 'checklist'
type StatFilter = 'complete' | 'not_started' | 'in_progress' | 'unassigned' | null

const FILTER_SELECT_CLASS =
  'admin-projects-filter-select h-10 w-full min-w-[9.5rem] cursor-pointer appearance-none pl-3 pr-9 text-sm font-medium'

const ACTIVITY_FILTER_SELECT_CLASS =
  'admin-projects-filter-select admin-projects-activity-filter-control w-full cursor-pointer appearance-none pl-2.5 pr-8 text-xs font-medium'

const SECTION_ITEMS: { id: WorkspaceSection; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'home', label: 'Home', icon: LayoutGrid },
  { id: 'workflow', label: 'Work progress', icon: ListChecks },
  { id: 'graph', label: 'Dependency cell', icon: GitBranch },
  { id: 'activity', label: 'Activity log', icon: History },
  { id: 'checklist', label: 'Checklists', icon: ClipboardList },
]

function emptyCellForm(libraryId: string, technologyNode: string): Partial<ProjectCell> & { libraryId: string } {
  return {
    libraryId,
    name: '',
    description: '',
    cellType: 'block',
    technologyNode,
    complexity: 'Medium',
    baseHours: DEFAULT_BASE_HOURS,
    estimatedEffort: 0,
    assignedEmployeeId: '',
    assignedEmployeeName: '',
    dependencyCellIds: [],
    views: { layout: '', symbol: '', schematic: '' },
  }
}

export function ProjectWorkspace() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { projectsListPath, projectCellPath, isEmployee } = useProjectPortal()
  const canManageWorkspace = !isEmployee
  const canCreateInWorkspace = true
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null)
  const [graph, setGraph] = useState<DependencyGraph | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(null)
  const [libraryModal, setLibraryModal] = useState(false)
  const [editingLibrary, setEditingLibrary] = useState<ProjectLibrary | null>(null)
  const [libraryName, setLibraryName] = useState('')
  const [libraryDesc, setLibraryDesc] = useState('')
  const [openLibraryMenuId, setOpenLibraryMenuId] = useState<string | null>(null)
  const [downloadingCellTemplate, setDownloadingCellTemplate] = useState(false)
  const [importingLibraryId, setImportingLibraryId] = useState<string | null>(null)
  const cellImportInputRef = useRef<HTMLInputElement>(null)
  const importLibraryIdRef = useRef<string | null>(null)
  const [cellModal, setCellModal] = useState(false)
  const [cellForm, setCellForm] = useState<ReturnType<typeof emptyCellForm> | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('home')
  const [filterSearch, setFilterSearch] = useState('')
  const [filterTypeSelect, setFilterTypeSelect] = useState<'all' | ProjectCell['cellType']>('all')
  const [filterStatusSelect, setFilterStatusSelect] = useState<'all' | CellStatus>('all')
  const [statFilter, setStatFilter] = useState<StatFilter>(null)
  const [showAllCells, setShowAllCells] = useState(false)
  const [effortPreview, setEffortPreview] = useState<EffortPrediction | null>(null)
  const [activityFilterSearch, setActivityFilterSearch] = useState('')
  const [activityLibraryFilter, setActivityLibraryFilter] = useState('all')
  const [activityCellFilter, setActivityCellFilter] = useState('all')
  const [workflowFilterSearch, setWorkflowFilterSearch] = useState('')
  const [workflowLibraryFilter, setWorkflowLibraryFilter] = useState('all')
  const [workflowCellFilter, setWorkflowCellFilter] = useState('all')
  const reload = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      if (isEmployee) {
        const [ws, dg] = await Promise.all([
          fetchMyProjectWorkspace(projectId),
          fetchMyDependencyGraph(projectId),
        ])
        const summaryData = mapEmployeeWorkspaceToSummary(ws)
        setSummary(summaryData)
        setGraph(dg)
        setEmployees([])
        setActiveLibraryId((prev) => {
          if (prev && summaryData.libraries.some((lib) => lib.id === prev)) return prev
          return summaryData.libraries[0]?.id ?? null
        })
        return
      }

      const [ws, dg, empsRes] = await Promise.all([
        fetchWorkspaceSummary(projectId),
        fetchDependencyGraph(projectId),
        getEmployees({ status: 'Active', view: 'Public', pageSize: 500 }),
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
  }, [projectId, isEmployee])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!cellModal || !cellForm || !projectId) {
      setEffortPreview(null)
      return
    }

    const timer = window.setTimeout(() => {
      const params = {
        cellType: cellForm.cellType || 'block',
        technologyNode: cellForm.technologyNode || summary?.project.technologyNode || '',
        complexity: cellForm.complexity || 'Medium',
        baseHours: cellForm.baseHours ?? 0,
      }
      const prediction = isEmployee
        ? fetchMyEffortPrediction(projectId, params)
        : fetchEffortPrediction(projectId, params)
      void prediction.then(setEffortPreview).catch(() => setEffortPreview(null))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [cellModal, cellForm, projectId, summary?.project.technologyNode, isEmployee])

  const refreshGraphData = useCallback(async () => {
    if (!projectId) return
    try {
      if (isEmployee) {
        const [ws, dg] = await Promise.all([
          fetchMyProjectWorkspace(projectId),
          fetchMyDependencyGraph(projectId),
        ])
        setSummary(mapEmployeeWorkspaceToSummary(ws))
        setGraph(dg)
        return
      }

      const [ws, dg] = await Promise.all([
        fetchWorkspaceSummary(projectId),
        fetchDependencyGraph(projectId),
      ])
      setSummary(ws)
      setGraph(dg)
    } catch {
      toast.error('Failed to refresh dependency graph')
    }
  }, [projectId, isEmployee])

  useEffect(() => {
    if (workspaceSection !== 'graph' || !projectId) return
    void refreshGraphData()
  }, [workspaceSection, projectId, refreshGraphData])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && workspaceSection === 'graph') {
        void refreshGraphData()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [workspaceSection, refreshGraphData])

  const displayedCells = useMemo(() => {
    if (!summary) return []
    let cells = showAllCells
      ? summary.cells
      : activeLibraryId
        ? summary.cells.filter((c) => c.libraryId === activeLibraryId)
        : []
    if (statFilter === 'complete') cells = cells.filter((c) => c.status === 'completed')
    if (statFilter === 'not_started') cells = cells.filter((c) => c.status === 'ready')
    if (statFilter === 'in_progress') cells = cells.filter((c) => c.status === 'in_progress')
    if (statFilter === 'unassigned') cells = cells.filter((c) => !c.assignedEmployeeId)
    const q = filterSearch.trim().toLowerCase()
    if (q) cells = cells.filter((c) => c.name.toLowerCase().includes(q))
    if (filterTypeSelect !== 'all') {
      cells = cells.filter((c) => normalizeCellType(c.cellType) === filterTypeSelect)
    }
    if (filterStatusSelect !== 'all') {
      cells = cells.filter((c) => c.status === filterStatusSelect)
    }
    return cells
  }, [summary, activeLibraryId, showAllCells, statFilter, filterSearch, filterTypeSelect, filterStatusSelect])

  const applyStatFilter = (filter: StatFilter) => {
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

  const cellsById = useMemo(() => {
    const map: Record<string, ProjectCell> = {}
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
      if (workflowLibraryFilter !== 'all' && cell.libraryId !== workflowLibraryFilter) {
        return false
      }
      if (workflowCellFilter !== 'all' && cell.id !== workflowCellFilter) {
        return false
      }
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
      if (activityLibraryFilter !== 'all' && entry.libraryId !== activityLibraryFilter) {
        return false
      }
      if (activityCellFilter !== 'all' && entry.cellId !== activityCellFilter) {
        return false
      }
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

  const openCreateCell = () => {
    if (!summary || summary.libraries.length === 0) {
      toast.error('Create a library first')
      return
    }
    const libraryId = activeLibraryId ?? summary.libraries[0]?.id
    if (!libraryId) return
    setCellForm(emptyCellForm(libraryId, summary.project.technologyNode))
    setCellModal(true)
  }

  const saveCell = async () => {
    if (!projectId || !cellForm || !cellForm.libraryId) {
      toast.error('Select a library for this cell')
      return
    }
    try {
      const payload = { ...cellForm, name: cellForm.name || 'Untitled' }
      if (isEmployee) {
        await createMyProjectCell(projectId, cellForm.libraryId, payload)
      } else {
        await createCell(projectId, cellForm.libraryId, payload)
      }
      toast.success('Cell created')
      setActiveLibraryId(cellForm.libraryId)
      setCellModal(false)
      await reload()
    } catch {
      toast.error('Failed to save cell')
    }
  }

  const saveLibrary = async () => {
    if (!projectId || !libraryName.trim()) return
    try {
      if (editingLibrary) {
        await updateLibrary(projectId, editingLibrary.id, {
          name: libraryName.trim(),
          description: libraryDesc,
        })
        toast.success('Library updated')
      } else if (isEmployee) {
        await createMyProjectLibrary(projectId, { name: libraryName.trim(), description: libraryDesc })
        toast.success('Library created')
      } else {
        await createLibrary(projectId, { name: libraryName, description: libraryDesc })
        toast.success('Library created')
      }
      setLibraryModal(false)
      setEditingLibrary(null)
      setLibraryName('')
      setLibraryDesc('')
      await reload()
    } catch {
      toast.error(editingLibrary ? 'Failed to update library' : 'Failed to create library')
    }
  }

  const openCreateLibraryModal = () => {
    setEditingLibrary(null)
    setLibraryName('')
    setLibraryDesc('')
    setLibraryModal(true)
  }

  const openEditLibraryModal = (library: ProjectLibrary) => {
    setEditingLibrary(library)
    setLibraryName(library.name)
    setLibraryDesc(library.description || '')
    setOpenLibraryMenuId(null)
    setLibraryModal(true)
  }

  const handleDownloadCellTemplate = async () => {
    if (!projectId) return
    setDownloadingCellTemplate(true)
    try {
      await downloadCellImportTemplate(projectId)
      toast.success('Cell template downloaded')
    } catch {
      toast.error('Failed to download cell template')
    } finally {
      setDownloadingCellTemplate(false)
    }
  }

  const startLibraryCellImport = (libraryId: string) => {
    importLibraryIdRef.current = libraryId
    setOpenLibraryMenuId(null)
    cellImportInputRef.current?.click()
  }

  const handleLibraryCellImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const libraryId = importLibraryIdRef.current
    importLibraryIdRef.current = null
    if (!file || !projectId || !libraryId) return

    setImportingLibraryId(libraryId)
    try {
      const result = await importCellsForLibrary(projectId, libraryId, file)
      const skippedNote = result.skipped > 0 ? ` (${result.skipped} skipped as duplicates)` : ''
      toast.success(`${result.message}${skippedNote}`)
      setActiveLibraryId(libraryId)
      setShowAllCells(false)
      await reload()
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Failed to import cells')
    } finally {
      setImportingLibraryId(null)
    }
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
        <Link to={projectsListPath} className="mt-2 inline-block text-sm font-semibold text-emerald-700">Back to projects</Link>
      </PageWrapper>
    )
  }

  const { project, libraries, stats } = summary
  const workflowProgressPercent = projectCellProgressPercent(stats.completedCells, stats.cellCount)

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
          <div className="admin-projects-workspace-chrome">
            <header className="admin-projects-workspace-head">
              <div className="admin-projects-workspace-head-bar">
                <div className="admin-projects-workspace-head-left">
                  <Link to={projectsListPath} className="admin-projects-back-btn">
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                    All projects
                  </Link>
                  <div className="admin-projects-workspace-identity">
                    <h1 className="admin-projects-head-title">{project.name}</h1>
                  </div>
                </div>

                <div className="admin-projects-workspace-head-right">
                  <div className="admin-projects-stats-row admin-projects-stats-row--header admin-projects-stats-row--bar">
                    {[
                      { label: 'Libraries', value: stats.libraryCount, icon: BookOpen, filter: null as StatFilter },
                      { label: 'Cells', value: stats.cellCount, icon: Layers, filter: null },
                      { label: 'Complete', value: stats.completedCells, icon: CheckCircle2, filter: 'complete' as StatFilter },
                      { label: 'Not Started', value: stats.notStartedCells ?? 0, icon: Layers, filter: 'not_started' as StatFilter },
                      { label: 'In Progress', value: stats.inProgressCells ?? 0, icon: ListChecks, filter: 'in_progress' as StatFilter },
                      { label: 'Unassigned', value: stats.unassignedCells, icon: User, filter: 'unassigned' as StatFilter },
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
                    <div className="admin-projects-progress-ring" style={{ '--progress': `${workflowProgressPercent}%` } as CSSProperties}>
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
                  workspaceSection === id ? 'admin-projects-section-btn--active' : 'admin-projects-section-btn--inactive',
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
                {canCreateInWorkspace ? (
                  <WorkspaceLibraryToolbar
                    onAddLibrary={openCreateLibraryModal}
                    onDownloadTemplate={() => void handleDownloadCellTemplate()}
                    downloading={downloadingCellTemplate}
                    showTemplateDownload={canManageWorkspace}
                  />
                ) : null}
                <input
                  ref={cellImportInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(event) => void handleLibraryCellImport(event)}
                />
                <div className="admin-projects-libraries-list">
                  {libraries.map((lib: ProjectLibrary) => (
                    <WorkspaceLibraryCard
                      key={lib.id}
                      library={lib}
                      cellCount={libraryCellCounts.get(lib.id) ?? 0}
                      isActive={activeLibraryId === lib.id && !showAllCells}
                      menuOpen={openLibraryMenuId === lib.id}
                      manageable={canManageWorkspace}
                      onSelect={() => {
                        setActiveLibraryId(lib.id)
                        setShowAllCells(false)
                        clearFilters()
                        setWorkspaceSection('home')
                        setOpenLibraryMenuId(null)
                      }}
                      onToggleMenu={() => {
                        setOpenLibraryMenuId((prev) => (prev === lib.id ? null : lib.id))
                      }}
                      onCloseMenu={() => setOpenLibraryMenuId(null)}
                      onImport={() => startLibraryCellImport(lib.id)}
                      onEdit={() => openEditLibraryModal(lib)}
                      onDelete={() => {
                        setOpenLibraryMenuId(null)
                        setDeleteTarget({ type: 'library', id: lib.id, name: lib.name })
                      }}
                    />
                  ))}
                  {importingLibraryId ? (
                    <p className="px-2 py-2 text-xs text-slate-500">Importing cells…</p>
                  ) : null}
                  {libraries.length === 0 && (
                    <p className="px-2 py-4 text-xs text-slate-500">No libraries yet.</p>
                  )}
                </div>
              </aside>

              <section className="admin-projects-cells-panel">
                <div className="admin-projects-cells-head">
                  <div className="admin-projects-cells-head-text">
                    <h2>Cells</h2>
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
                          setFilterTypeSelect(e.target.value as 'all' | ProjectCell['cellType'])
                          setStatFilter(null)
                        }}
                        className={FILTER_SELECT_CLASS}
                        aria-label="Filter by cell type"
                      >
                        <option value="all">All types</option>
                        {CELL_TYPES.map((type) => (
                          <option key={type} value={type}>{CELL_TYPE_LABELS[type]}</option>
                        ))}
                      </select>
                      <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
                    </div>

                    <div className="admin-projects-filter-select-wrap">
                      <select
                        value={filterStatusSelect}
                        onChange={(e) => {
                          setFilterStatusSelect(e.target.value as 'all' | CellStatus)
                          setStatFilter(null)
                        }}
                        className={FILTER_SELECT_CLASS}
                        aria-label="Filter by status"
                      >
                        <option value="all">All statuses</option>
                        {CELL_STATUS_FILTER_OPTIONS.map((status) => (
                          <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                      <ChevronDown className="admin-projects-filter-select-icon" aria-hidden />
                    </div>
                  </div>

                  {canCreateInWorkspace ? (
                    <button
                      type="button"
                      className="admin-projects-cells-create"
                      disabled={libraries.length === 0}
                      onClick={openCreateCell}
                    >
                      <Plus className="h-4 w-4" /> New cell
                    </button>
                  ) : null}
                </div>

                <div className="admin-projects-cells-table-wrap">
                  <table className="admin-projects-table admin-projects-table--cells">
                    <thead>
                      <tr>
                        <th className="admin-projects-table-col-name">Name</th>
                        {showAllCells ? <th className="admin-projects-table-col-library">Library</th> : null}
                        <th className="admin-projects-table-col-type">Type</th>
                        <th className="admin-projects-table-col-assigned">Assigned</th>
                        <th className="admin-projects-table-col-status">Status</th>
                        <th className="admin-projects-table-col-est-hours">Est. Hours</th>
                        <th className="admin-projects-table-col-act-hours">Actual Hours</th>
                        <th className="admin-projects-table-col-productive-time">Productive Time</th>
                        <th className="admin-projects-table-col-workflow">Workflow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCells.map((cell) => (
                        <tr
                          key={cell.id}
                          className="admin-projects-table-row-clickable"
                          onClick={() => navigate(projectCellPath(projectId, cell.id))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              navigate(projectCellPath(projectId, cell.id))
                            }
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={`Open ${cell.name}`}
                        >
                          <td className="admin-projects-table-col-name admin-projects-table-cell-name">{cell.name}</td>
                          {showAllCells ? (
                            <td className="admin-projects-table-col-library">{libraryNameById.get(cell.libraryId) || '—'}</td>
                          ) : null}
                          <td className="admin-projects-table-col-type">{cellTypeLabel(cell.cellType)}</td>
                          <td className="admin-projects-table-col-assigned">{cell.assignedEmployeeName || '—'}</td>
                          <td className="admin-projects-table-col-status">
                            <span className={cn(
                              'admin-projects-status-chip admin-projects-status-chip--table',
                              cell.status === 'ready' && 'is-not-started',
                              cell.status === 'completed' && 'is-completed',
                              cell.status === 'in_progress' && 'is-progress',
                            )}>
                              {cellDisplayStatus(cell)}
                            </span>
                          </td>
                          <td className="admin-projects-table-col-est-hours tabular-nums">
                            {cell.estimatedEffort ?? 0}h
                          </td>
                          <td className="admin-projects-table-col-act-hours tabular-nums">
                            {cellActualEffortHours(cell)}h
                          </td>
                          <td
                            className="admin-projects-table-col-productive-time"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {cell.status === 'completed' || cell.status === 'in_progress' ? (
                              <CellCompletionTimeSummaryLauncher cell={cell} />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="admin-projects-table-col-workflow" onClick={(e) => e.stopPropagation()}>
                            <CellWorkflowPanel projectId={projectId} cell={cell} compact />
                          </td>
                        </tr>
                      ))}
                      {displayedCells.length === 0 && (
                        <tr>
                          <td colSpan={showAllCells ? 9 : 8} className="admin-projects-table-empty">
                            {showAllCells ? 'No cells in this project.' : 'No cells in this library.'}
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
                            <option key={cell.id} value={cell.id}>{cell.name}</option>
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
                            <option key={lib.id} value={lib.id}>{lib.name}</option>
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
                    getCellPath={projectCellPath}
                  />
                </div>
              </div>
            )}

            {workspaceSection === 'graph' && (
              <div className="admin-projects-section-panel admin-projects-section-panel--graph">
                <div className="admin-projects-graph-section">
                  <h2 className="admin-projects-graph-title">Dependency cell</h2>
                  <p className="admin-projects-graph-hint">
                    Horizontal workflow map of cell dependencies.
                  </p>
                  {graph ? (
                    <DependencyGraphView
                      graph={graph}
                      cellsById={cellsById}
                      projectId={projectId}
                      getCellPath={projectCellPath}
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
                            <option key={cell.id} value={cell.id}>{cell.name}</option>
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
                            <option key={lib.id} value={lib.id}>{lib.name}</option>
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
                              <td className="admin-projects-activity-table-detail">{entry.detail || '—'}</td>
                              <td>{entry.userName || '—'}</td>
                              <td className="admin-projects-activity-table-time">
                                <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
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
                <ProjectTypeChecklistPanel projectId={projectId} />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={libraryModal}
        title={editingLibrary ? 'Edit library' : 'New library'}
        onClose={() => {
          setLibraryModal(false)
          setEditingLibrary(null)
        }}
      >
        <div className="grid gap-3">
          <Input label="Library name" value={libraryName} onChange={(e) => setLibraryName(e.target.value)} />
          <label className="text-sm font-medium">Description
            <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={libraryDesc} onChange={(e) => setLibraryDesc(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => {
              setLibraryModal(false)
              setEditingLibrary(null)
            }}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveLibrary()}>{editingLibrary ? 'Save changes' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={cellModal && !!cellForm} title="New cell" onClose={() => setCellModal(false)}>
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
                {CELL_TYPES.map((t) => (
                  <option key={t} value={t}>{CELL_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">Description
              <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={cellForm.description || ''} onChange={(e) => setCellForm((f) => f && { ...f, description: e.target.value })} />
            </label>
            <label className="text-sm font-medium">Complexity
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={cellForm.complexity} onChange={(e) => setCellForm((f) => f && { ...f, complexity: e.target.value as ProjectCell['complexity'] })}>
                {CELL_COMPLEXITY_OPTIONS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            <Input
              label={`Base hours (1 day = ${DEFAULT_BASE_HOURS}h)`}
              type="number"
              min={0}
              step="any"
              value={String(cellForm.baseHours ?? 0)}
              onChange={(e) => setCellForm((f) => f && { ...f, baseHours: Number(e.target.value) })}
            />
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <p className="font-semibold text-slate-700">Effort estimate preview</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Complexity factor</dt>
                  <dd>{formatComplexityFactor(cellForm.complexity)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Estimated hours</dt>
                  <dd>{effortPreview?.estimatedHours ?? calculateEstimatedHours(cellForm.baseHours ?? 0, cellForm.complexity)}h</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Smart estimate</dt>
                  <dd>{effortPreview?.smartEstimate ?? calculateEstimatedHours(cellForm.baseHours ?? 0, cellForm.complexity)}h</dd>
                </div>
              </dl>
              {effortPreview && effortPreview.similarBlockCount > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Based on {effortPreview.similarBlockCount} similar completed block{effortPreview.similarBlockCount === 1 ? '' : 's'}
                  {' '}(avg variance {effortPreview.avgVariance}x).
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No similar completed blocks yet — smart estimate matches base estimate.</p>
              )}
            </div>
            {!isEmployee ? (
              <label className="text-sm font-medium">Assign employee
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={resolveAssigneeSelectValue(employees, cellForm.assignedEmployeeId)}
                  onChange={(e) => {
                    const emp = findEmployeeByAssigneeId(employees, e.target.value)
                      ?? employees.find((x) => x.id === e.target.value)
                    setCellForm((f) => f && {
                      ...f,
                      assignedEmployeeId: emp?.id ?? e.target.value,
                      assignedEmployeeName: emp ? buildEmployeeFullName(emp) : '',
                    })
                  }}
                >
                  <option value="">Unassigned</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{buildEmployeeFullName(e)}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCellModal(false)}>Cancel</Button>
              <Button onClick={() => void saveCell()}>Save</Button>
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

    </PageWrapper>
  )
}
