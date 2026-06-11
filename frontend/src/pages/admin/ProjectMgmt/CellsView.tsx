import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { Spinner } from '@components/ui/Spinner'
import { toast } from 'sonner'
import {
  Plus,
  ArrowLeft,
  Search,
  Users,
  FileCode2,
  Eye,
} from 'lucide-react'
import { ROUTES } from '@constants/routes'
import {
  fetchCells,
  createCell,
  updateCell,
  fetchLibraries,
  type CellSummary,
  type CellType,
  type CellAssignment,
  type LibrarySummary,
} from '@/services/projectMgmtService'
import { getEmployees } from '@/services/employeeService'
import type { Employee } from '@/types'
import { cn } from '@/utils/cn'
import { stringToHueColor } from '@/utils/stringColor'

const CELL_TYPES: CellType[] = ['Block', 'IO', 'ESD', 'TOP']

const TYPE_COLORS: Record<CellType, string> = {
  Block: 'bg-violet-50 text-violet-700 border-violet-200',
  IO: 'bg-amber-50 text-amber-700 border-amber-200',
  ESD: 'bg-rose-50 text-rose-700 border-rose-200',
  TOP: 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

const STAGE_LABELS: Record<string, string> = {
  floor_plan: 'Floor Plan',
  drc_1: 'DRC',
  routing: 'Routing',
  drc_2: 'DRC',
  lvs: 'LVS',
}

export function CellsView() {
  const { projectId, libraryId } = useParams<{ projectId: string; libraryId: string }>()
  const navigate = useNavigate()
  const [library, setLibrary] = useState<LibrarySummary | null>(null)
  const [cells, setCells] = useState<CellSummary[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add cell modal
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<CellType>('Block')
  const [creating, setCreating] = useState(false)

  // Assign employees modal
  const [showAssign, setShowAssign] = useState(false)
  const [assignCell, setAssignCell] = useState<CellSummary | null>(null)
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)

  const loadData = useCallback(async () => {
    if (!projectId || !libraryId) return
    try {
      setLoading(true)
      const [libs, cellData, empData] = await Promise.all([
        fetchLibraries(projectId),
        fetchCells(libraryId),
        getEmployees({ status: 'Active', pageSize: 500 }),
      ])
      setLibrary(libs.find((l) => l.id === libraryId) || null)
      setCells(cellData)
      setEmployees(empData.data || [])
    } catch {
      toast.error('Failed to load cells')
    } finally {
      setLoading(false)
    }
  }, [projectId, libraryId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Cell name is required')
      return
    }
    try {
      setCreating(true)
      await createCell(libraryId!, { name: newName.trim(), type: newType })
      toast.success('Cell created')
      setShowAdd(false)
      setNewName('')
      setNewType('Block')
      void loadData()
    } catch {
      toast.error('Failed to create cell')
    } finally {
      setCreating(false)
    }
  }

  const openAssignModal = (cell: CellSummary) => {
    setAssignCell(cell)
    setSelectedEmpIds(new Set(cell.assignedTo.map((a) => a.employeeId)))
    setShowAssign(true)
  }

  const handleAssign = async () => {
    if (!assignCell) return
    try {
      setAssigning(true)
      const assignedTo: CellAssignment[] = Array.from(selectedEmpIds)
        .map((id: string) => {
          const emp = employees.find((e) => e.id === id)
          if (!emp) return null
          return { employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`.trim() }
        })
        .filter(Boolean) as CellAssignment[]

      await updateCell(assignCell.id, { assignedTo })
      toast.success('Employees assigned')
      setShowAssign(false)
      void loadData()
    } catch {
      toast.error('Failed to assign employees')
    } finally {
      setAssigning(false)
    }
  }

  const toggleEmployee = (id: string) => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = cells.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <PageWrapper scrollable>
      {/* Breadcrumb */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(ROUTES.PROJECT_MGMT_PROJECT(projectId!))}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Libraries
        </button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              {library?.name || 'Library'}
            </h1>
            <p className="mt-1 text-sm text-muted">Cells in this library</p>
          </div>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>
            Add Cell
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search cells..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-white pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileCode2 className="mb-3 h-12 w-12 text-slate-300" />
          <p className="text-lg font-semibold text-slate-500">No cells yet</p>
          <p className="mt-1 text-sm text-muted">Add a cell to start tracking its layout stages</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/60">
                <th className="px-4 py-3 font-semibold text-slate-600">Cell Name</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Type</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Stage</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Assigned</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cell) => (
                <tr
                  key={cell.id}
                  className="border-b border-border/50 transition-colors hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: stringToHueColor(cell.name) }}
                      />
                      <span className="font-medium text-ink">{cell.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                        TYPE_COLORS[cell.type]
                      )}
                    >
                      {cell.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {STAGE_LABELS[cell.currentStage] || cell.currentStage}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                        cell.stageStatus === 'in_progress' && 'bg-blue-50 text-blue-700',
                        cell.stageStatus === 'for_review' && 'bg-amber-50 text-amber-700',
                        cell.stageStatus === 'approved' && 'bg-emerald-50 text-emerald-700'
                      )}
                    >
                      {cell.stageStatus === 'for_review' ? 'For Review' : cell.stageStatus === 'in_progress' ? 'In Progress' : 'Approved'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openAssignModal(cell)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {cell.assignedTo.length > 0
                        ? `${cell.assignedTo.length} assigned`
                        : 'Assign'}
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
            </tbody>
          </table>
        </div>
      )}

      {/* Add Cell Modal */}
      <Modal isOpen={showAdd} title="Add Cell" onClose={() => setShowAdd(false)} size="md">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Cell Name *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. INV_X1"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Cell Type *</label>
            <div className="flex flex-wrap gap-2">
              {CELL_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    newType === t
                      ? TYPE_COLORS[t] + ' ring-2 ring-offset-1'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Create Cell
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Employees Modal */}
      <Modal isOpen={showAssign} title={`Assign Employees — ${assignCell?.name || ''}`} onClose={() => setShowAssign(false)} size="lg">
        <div className="space-y-3">
          <p className="text-sm text-muted">Select employees to assign to this cell.</p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {employees.map((emp) => (
              <label
                key={emp.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border/50 px-4 py-2.5 last:border-0 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedEmpIds.has(emp.id)}
                  onChange={() => toggleEmployee(emp.id)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                />
                <span className="text-sm text-ink">
                  {emp.firstName} {emp.lastName}
                </span>
                <span className="ml-auto text-xs text-muted">
                  {emp.employeeId} · {emp.designation}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">{selectedEmpIds.size} employee(s) selected</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAssign(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} loading={assigning}>
              Save Assignments
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
