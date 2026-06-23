import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { Spinner } from '@components/ui/Spinner'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import { ROUTES } from '@constants/routes'
import {
  fetchProjectOverview,
  createLibrary,
  createCell,
  updateCell,
  type ProjectOverview,
  type CellType,
  type CellAssignment,
  type CellSummary,
  type CellStage,
} from '@/services/projectMgmtService'
import { AnalyticsStatGrid } from '@/components/projectMgmt/AnalyticsStatGrid'
import { StageMiniBar } from '@/components/projectMgmt/StageMiniBar'
import {
  CELL_TYPE_COLORS,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_STYLES,
  getStageLabel,
} from '@/components/projectMgmt/stageConstants'
import { getEmployees } from '@/services/employeeService'
import type { Employee } from '@/types'
import { cn } from '@/utils/cn'
import { stringToHueColor } from '@/utils/stringColor'

const CELL_TYPES: CellType[] = ['Block', 'IO', 'ESD', 'TOP']

export function LibrariesView() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedLibs, setExpandedLibs] = useState<Set<string>>(new Set())
  const [employees, setEmployees] = useState<Employee[]>([])

  const [showAddLib, setShowAddLib] = useState(false)
  const [newLibName, setNewLibName] = useState('')
  const [newLibDesc, setNewLibDesc] = useState('')
  const [creatingLib, setCreatingLib] = useState(false)

  const [showAddCell, setShowAddCell] = useState<string | null>(null)
  const [newCellName, setNewCellName] = useState('')
  const [newCellType, setNewCellType] = useState<CellType>('Block')
  const [creatingCell, setCreatingCell] = useState(false)

  const [showAssign, setShowAssign] = useState<CellSummary | null>(null)
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)

  const loadData = useCallback(async () => {
    if (!projectId) return
    try {
      setLoading(true)
      const [data, empData] = await Promise.all([
        fetchProjectOverview(projectId),
        getEmployees({ status: 'Active', view: 'Public', pageSize: 500 }),
      ])
      setOverview(data)
      setEmployees(empData.data || [])
      setExpandedLibs(new Set(data.libraries.map((l) => l.id)))
    } catch {
      toast.error('Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredLibraries = useMemo(() => {
    if (!overview) return []
    const q = search.toLowerCase()
    if (!q) return overview.libraries
    return overview.libraries
      .map((lib) => ({
        ...lib,
        cells: lib.cells.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            lib.name.toLowerCase().includes(q) ||
            c.type.toLowerCase().includes(q)
        ),
      }))
      .filter((lib) => lib.name.toLowerCase().includes(q) || lib.cells.length > 0)
  }, [overview, search])

  const handleCreateLib = async () => {
    if (!newLibName.trim()) return toast.error('Library name required')
    try {
      setCreatingLib(true)
      await createLibrary(projectId!, { name: newLibName.trim(), description: newLibDesc.trim() })
      toast.success('Library created')
      setShowAddLib(false)
      setNewLibName('')
      setNewLibDesc('')
      void loadData()
    } catch {
      toast.error('Failed to create library')
    } finally {
      setCreatingLib(false)
    }
  }

  const handleCreateCell = async (libraryId: string) => {
    if (!newCellName.trim()) return toast.error('Cell name required')
    try {
      setCreatingCell(true)
      await createCell(libraryId, { name: newCellName.trim(), type: newCellType })
      toast.success('Cell created')
      setShowAddCell(null)
      setNewCellName('')
      setNewCellType('Block')
      void loadData()
    } catch {
      toast.error('Failed to create cell')
    } finally {
      setCreatingCell(false)
    }
  }

  const handleAssign = async () => {
    if (!showAssign) return
    try {
      setAssigning(true)
      const assignedTo: CellAssignment[] = Array.from(selectedEmpIds)
        .map((id) => {
          const emp = employees.find((e) => e.id === id)
          return emp
            ? { employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`.trim() }
            : null
        })
        .filter(Boolean) as CellAssignment[]
      await updateCell(showAssign.id, { assignedTo })
      toast.success('Employees assigned')
      setShowAssign(null)
      void loadData()
    } catch {
      toast.error('Failed to assign')
    } finally {
      setAssigning(false)
    }
  }

  const toggleLib = (id: string) => {
    setExpandedLibs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const project = overview?.project
  const stats = overview?.stats

  return (
    <PageWrapper scrollable>
      <button
        type="button"
        onClick={() => navigate(ROUTES.PROJECT_MGMT)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        All Projects
      </button>

      <div className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: stringToHueColor(project?.name || '') }}
              />
              <h1 className="font-display text-2xl font-bold text-ink">{project?.name || 'Project'}</h1>
            </div>
            <p className="mt-1 text-sm text-muted">
              {[project?.client, project?.technologyNode].filter(Boolean).join(' · ') || 'Project workspace'}
            </p>
          </div>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddLib(true)}>
            Add Library
          </Button>
        </div>

        {stats && (
          <div className="mt-5">
            <AnalyticsStatGrid
              columns={5}
              stats={[
                { label: 'Libraries', value: stats.libraryCount, color: 'text-primary' },
                { label: 'Cells', value: stats.cellCount },
                { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600' },
                { label: 'For Review', value: stats.forReview, color: 'text-amber-600' },
                { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
              ]}
            />
          </div>
        )}
      </div>

      {stats && stats.cellCount > 0 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Stage Distribution</h3>
            <div className="space-y-2">
              {Object.entries(stats.byStage).map(([stage, count]) => (
                <div key={stage} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-medium text-ink">{getStageLabel(stage as CellStage)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${stats.cellCount ? (count / stats.cellCount) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-muted">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Cell Types</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div
                  key={type}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-center',
                    CELL_TYPE_COLORS[type as CellType]
                  )}
                >
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-[10px] font-bold uppercase">{type}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search libraries and cells..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      )}

      {!loading && filteredLibraries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center">
          <Layers className="mx-auto mb-3 h-12 w-12 text-slate-200" />
          <p className="font-semibold text-muted">No libraries yet</p>
          <p className="mt-1 text-sm text-muted">Add a library to organize cells</p>
        </div>
      )}

      {!loading && filteredLibraries.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/80 text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Library / Cell</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Pipeline</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Team</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLibraries.map((lib) => (
                <Fragment key={lib.id}>
                  <tr
                    className="border-b border-border/60 bg-slate-50/40 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3" colSpan={7}>
                      <button
                        type="button"
                        onClick={() => toggleLib(lib.id)}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        {expandedLibs.has(lib.id) ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted" />
                        )}
                        <Layers className="h-4 w-4 text-primary" />
                        <span className="font-display font-bold text-ink">{lib.name}</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {lib.cells.length} cells
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowAddCell(lib.id)
                          }}
                          className="ml-auto rounded-lg border border-border bg-white px-2 py-1 text-[10px] font-semibold hover:bg-slate-50"
                        >
                          + Add Cell
                        </button>
                      </button>
                    </td>
                  </tr>
                  {expandedLibs.has(lib.id) &&
                    lib.cells.map((cell) => (
                      <tr
                        key={cell.id}
                        className="border-b border-border/40 transition-colors hover:bg-primary/[0.02]"
                      >
                        <td className="px-4 py-3 pl-12">
                          <button
                            type="button"
                            onClick={() => navigate(ROUTES.PROJECT_MGMT_CELL(cell.id))}
                            className="font-semibold text-ink hover:text-primary hover:underline"
                          >
                            {cell.name}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-md border px-2 py-0.5 text-[10px] font-bold',
                              CELL_TYPE_COLORS[cell.type]
                            )}
                          >
                            {cell.type}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <div className="w-32">
                            <StageMiniBar
                              currentStage={cell.currentStage}
                              stageStatus={cell.stageStatus}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">{getStageLabel(cell.currentStage)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                              STAGE_STATUS_STYLES[cell.stageStatus]
                            )}
                          >
                            {STAGE_STATUS_LABELS[cell.stageStatus]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAssign(cell)
                              setSelectedEmpIds(new Set(cell.assignedTo.map((a) => a.employeeId)))
                            }}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Users className="h-3 w-3" />
                            {cell.assignedTo.length || 'Assign'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Eye className="h-3.5 w-3.5" />}
                            onClick={() => navigate(ROUTES.PROJECT_MGMT_CELL(cell.id))}
                          >
                            Dashboard
                          </Button>
                        </td>
                      </tr>
                    ))}
                  {expandedLibs.has(lib.id) && lib.cells.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 pl-12 text-center text-xs text-muted">
                        No cells in this library — click &quot;+ Add Cell&quot; above
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showAddLib} title="Add Library" onClose={() => setShowAddLib(false)} size="md">
        <div className="space-y-4">
          <input
            type="text"
            value={newLibName}
            onChange={(e) => setNewLibName(e.target.value)}
            placeholder="Library name *"
            className="h-10 w-full rounded-xl border border-border px-3 text-sm"
          />
          <textarea
            value={newLibDesc}
            onChange={(e) => setNewLibDesc(e.target.value)}
            placeholder="Description"
            rows={2}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddLib(false)}>Cancel</Button>
            <Button onClick={handleCreateLib} loading={creatingLib}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!showAddCell}
        title="Add Cell"
        onClose={() => setShowAddCell(null)}
        size="md"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={newCellName}
            onChange={(e) => setNewCellName(e.target.value)}
            placeholder="Cell name *"
            className="h-10 w-full rounded-xl border border-border px-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {CELL_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNewCellType(t)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-semibold',
                  newCellType === t ? CELL_TYPE_COLORS[t] : 'border-border'
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddCell(null)}>Cancel</Button>
            <Button onClick={() => showAddCell && handleCreateCell(showAddCell)} loading={creatingCell}>
              Create Cell
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!showAssign}
        title={`Assign — ${showAssign?.name || ''}`}
        onClose={() => setShowAssign(null)}
        size="lg"
      >
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {employees.map((emp) => (
            <label key={emp.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selectedEmpIds.has(emp.id)}
                onChange={() =>
                  setSelectedEmpIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(emp.id)) next.delete(emp.id)
                    else next.add(emp.id)
                    return next
                  })
                }
              />
              <span className="text-sm">{emp.firstName} {emp.lastName}</span>
              <span className="ml-auto text-xs text-muted">{emp.employeeId}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShowAssign(null)}>Cancel</Button>
          <Button onClick={handleAssign} loading={assigning}>Save</Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
