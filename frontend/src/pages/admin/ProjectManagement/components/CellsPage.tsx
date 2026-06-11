import { useState, useEffect } from 'react'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'

type ViewMode = 'card' | 'list'

interface Cell {
  id: string
  name: string
  viewType: string
  assignedEmployee: string
  currentStage: string
  progress: number
  status: 'Active' | 'In Progress' | 'Pending Review' | 'Completed'
  updatedAt: string
}

export function CellsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('projectManagement.cells.viewMode')
    return (saved as ViewMode) || 'card'
  })
  const [cells, setCells] = useState<Cell[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCells()
  }, [])

  useEffect(() => {
    localStorage.setItem('projectManagement.cells.viewMode', viewMode)
  }, [viewMode])

  const fetchCells = async () => {
    try {
      setLoading(true)
      const res = await api.get('/project-management/cells')
      // Map backend cell data to frontend structure
      const mappedCells = res.data.map((cell: any) => ({
        id: cell._id,
        name: cell.name,
        viewType: cell.viewType || 'Unknown',
        assignedEmployee: 'N/A', // Will need assignment data
        currentStage: cell.status || 'Not Started',
        progress: cell.progress || 0,
        status: cell.status || 'In Progress',
        updatedAt: new Date(cell.updatedAt).toLocaleDateString(),
      }))
      setCells(mappedCells)
    } catch (err) {
      console.error('Failed to fetch cells:', err)
      toast.error('Failed to load cells')
      setCells([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCells = cells.filter((cell) =>
    cell.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cell.assignedEmployee.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cells & Views</h2>
          <p className="mt-1 text-sm text-slate-600">Manage cell workflow and views</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--emerald-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green-600)]">
          <Plus className="h-4 w-4" />
          New Cell
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search cells..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm font-semibold focus:border-[var(--emerald-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--emerald-dark)]/20"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-1">
          <button
            onClick={() => setViewMode('card')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
              viewMode === 'card' ? 'bg-[var(--emerald-dark)] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Card View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
              viewMode === 'list' ? 'bg-[var(--emerald-dark)] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <List className="h-4 w-4" />
            List View
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredCells.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <p className="text-sm font-semibold text-slate-600">No cells found</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCells.map((cell) => (
            <CellCard key={cell.id} cell={cell} />
          ))}
        </div>
      ) : (
        <CellTable cells={filteredCells} />
      )}
    </div>
  )
}

function CellCard({ cell }: { cell: Cell }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-lg font-bold text-slate-900">{cell.name}</h3>
        <span className={`rounded-lg px-2 py-1 text-xs font-bold ${
          cell.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
          cell.status === 'Pending Review' ? 'bg-yellow-50 text-yellow-700' :
          cell.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
          'bg-green-50 text-green-700'
        }`}>
          {cell.status}
        </span>
      </div>
      
      <div className="mb-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">View Type:</span>
          <span className="font-bold text-slate-900">{cell.viewType}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Assigned:</span>
          <span className="font-bold text-slate-900">{cell.assignedEmployee}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Stage:</span>
          <span className="font-bold text-slate-900">{cell.currentStage}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-semibold text-slate-600">Progress</span>
          <span className="font-bold text-slate-900">{cell.progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-[var(--emerald-dark)]" style={{ width: `${cell.progress}%` }} />
        </div>
      </div>

      <button className="w-full rounded-lg bg-[var(--emerald-dark)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--green-600)]">
        View Details
      </button>
    </div>
  )
}

function CellTable({ cells }: { cells: Cell[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Cell Name</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">View Type</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Employee</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Stage</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Progress</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Status</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cells.map((cell) => (
            <tr key={cell.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm font-bold text-slate-900">{cell.name}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{cell.viewType}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{cell.assignedEmployee}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{cell.currentStage}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{cell.progress}%</td>
              <td className="px-4 py-3">
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${
                  cell.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                  cell.status === 'Pending Review' ? 'bg-yellow-50 text-yellow-700' :
                  cell.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
                  'bg-green-50 text-green-700'
                }`}>
                  {cell.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{cell.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
