import { useState, useEffect } from 'react'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'

type ViewMode = 'card' | 'list'

interface Library {
  id: string
  name: string
  projectName: string
  cellsCount: number
  progress: number
  status: 'Active' | 'In Progress' | 'Completed'
  updatedAt: string
}

export function LibrariesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('projectManagement.libraries.viewMode')
    return (saved as ViewMode) || 'card'
  })
  const [libraries, setLibraries] = useState<Library[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchLibraries()
  }, [])

  useEffect(() => {
    localStorage.setItem('projectManagement.libraries.viewMode', viewMode)
  }, [viewMode])

  const fetchLibraries = async () => {
    try {
      setLoading(true)
      const res = await api.get('/project-management/libraries')
      // Map backend library data to frontend structure
      const mappedLibraries = res.data.map((lib: any) => ({
        id: lib._id,
        name: lib.name,
        projectName: lib.projectId?.name || 'Unknown Project', // Will need project population
        cellsCount: 0, // Will be calculated from cells
        progress: lib.progress || 0,
        status: lib.status || 'In Progress',
        updatedAt: new Date(lib.updatedAt).toLocaleDateString(),
      }))
      setLibraries(mappedLibraries)
    } catch (err) {
      console.error('Failed to fetch libraries:', err)
      toast.error('Failed to load libraries')
      setLibraries([])
    } finally {
      setLoading(false)
    }
  }

  const filteredLibraries = libraries.filter((lib) =>
    lib.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lib.projectName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Libraries</h2>
          <p className="mt-1 text-sm text-slate-600">Manage project libraries</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--emerald-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green-600)]">
          <Plus className="h-4 w-4" />
          New Library
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search libraries..."
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
      ) : filteredLibraries.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <p className="text-sm font-semibold text-slate-600">No libraries found</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredLibraries.map((lib) => (
            <LibraryCard key={lib.id} library={lib} />
          ))}
        </div>
      ) : (
        <LibraryTable libraries={filteredLibraries} />
      )}
    </div>
  )
}

function LibraryCard({ library }: { library: Library }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="mb-2 text-lg font-bold text-slate-900">{library.name}</h3>
      <p className="mb-4 text-xs font-semibold text-slate-600">Project: {library.projectName}</p>
      
      <div className="mb-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Cells:</span>
          <span className="font-bold text-slate-900">{library.cellsCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Status:</span>
          <span className={`font-bold ${
            library.status === 'Completed' ? 'text-emerald-600' :
            library.status === 'In Progress' ? 'text-blue-600' : 'text-green-600'
          }`}>{library.status}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-semibold text-slate-600">Progress</span>
          <span className="font-bold text-slate-900">{library.progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-[var(--emerald-dark)]" style={{ width: `${library.progress}%` }} />
        </div>
      </div>

      <button className="w-full rounded-lg bg-[var(--emerald-dark)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--green-600)]">
        View Details
      </button>
    </div>
  )
}

function LibraryTable({ libraries }: { libraries: Library[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Library Name</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Project</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Cells</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Progress</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Status</th>
            <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {libraries.map((lib) => (
            <tr key={lib.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm font-bold text-slate-900">{lib.name}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{lib.projectName}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{lib.cellsCount}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{lib.progress}%</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{lib.status}</td>
              <td className="px-4 py-3 text-sm font-semibold text-slate-600">{lib.updatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
