import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { Spinner } from '@components/ui/Spinner'
import api from '@/services/api'
import { toast } from 'sonner'

interface Checklist {
  id: string
  name: string
  description: string
  itemsCount: number
  usageCount: number
  createdAt: string
  updatedAt: string
}

export function ChecklistsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchChecklists()
  }, [])

  const fetchChecklists = async () => {
    try {
      setLoading(true)
      const res = await api.get('/project-management/checklists/templates')
      // Map backend template data to frontend structure
      const mappedChecklists = res.data.map((template: any) => ({
        id: template._id,
        name: template.checklistType || 'Unknown',
        description: `${template.checklistType} checklist template`,
        itemsCount: template.versions?.[0]?.totalCount || 0,
        usageCount: 0, // Will need to query cell instances
        createdAt: new Date(template.createdAt).toLocaleDateString(),
        updatedAt: new Date(template.updatedAt).toLocaleDateString(),
      }))
      setChecklists(mappedChecklists)
    } catch (err) {
      console.error('Failed to fetch checklists:', err)
      toast.error('Failed to load checklists')
      setChecklists([])
    } finally {
      setLoading(false)
    }
  }

  const filteredChecklists = checklists.filter((checklist) =>
    checklist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    checklist.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Checklist Templates</h2>
          <p className="mt-1 text-sm text-slate-600">Manage reusable checklist templates</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-[var(--emerald-dark)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--green-600)]">
          <Plus className="h-4 w-4" />
          New Checklist
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search checklists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm font-semibold focus:border-[var(--emerald-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--emerald-dark)]/20"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : filteredChecklists.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <p className="text-sm font-semibold text-slate-600">No checklists found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChecklists.map((checklist) => (
            <ChecklistCard key={checklist.id} checklist={checklist} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChecklistCard({ checklist }: { checklist: Checklist }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-slate-900">{checklist.name}</h3>
        <p className="mt-1 text-xs text-slate-600 line-clamp-2">{checklist.description || 'No description'}</p>
      </div>
      
      <div className="mb-4 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Items:</span>
          <span className="font-bold text-slate-900">{checklist.itemsCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Used in:</span>
          <span className="font-bold text-slate-900">{checklist.usageCount} projects</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-600">Updated:</span>
          <span className="font-bold text-slate-900">{checklist.updatedAt}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 flex items-center justify-center gap-1">
          <Edit2 className="h-3 w-3" />
          Edit
        </button>
        <button className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 flex items-center justify-center gap-1">
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  )
}
