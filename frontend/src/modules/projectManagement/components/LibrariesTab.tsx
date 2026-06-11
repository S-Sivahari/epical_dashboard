import { useEffect, useState, useCallback } from 'react'
import api from '@/services/api'
import { Spinner } from '@components/ui/Spinner'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { toast } from 'sonner'
import {
  FolderOpen,
  Plus,
  Archive,
  RefreshCw,
  Edit2
} from 'lucide-react'

interface Project {
  _id: string
  id: string
  name: string
  projectName?: string
}

interface Library {
  _id: string
  projectId: string
  name: string
  description?: string
  progress: number
  status: 'In Progress' | 'Completed'
  isArchived: boolean
}

export function LibrariesTab() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [libraries, setLibraries] = useState<Library[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingLibs, setLoadingLibs] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  // Modals state
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingLib, setEditingLib] = useState<Library | null>(null)

  // Fields
  const [libName, setLibName] = useState('')
  const [libDesc, setLibDesc] = useState('')

  // Fetch Projects from original Projects source of truth
  useEffect(() => {
    api.get('/projects')
      .then(res => {
        setProjects(res.data)
        if (res.data.length > 0) {
          setSelectedProjectId(res.data[0].id)
        }
      })
      .catch(() => toast.error('Failed to load projects list'))
      .finally(() => setLoadingProjects(false))
  }, [])

  // Fetch libraries
  const fetchLibraries = useCallback(async () => {
    if (!selectedProjectId) return
    try {
      setLoadingLibs(true)
      const res = await api.get(`/project-management/libraries?projectId=${selectedProjectId}&archived=${showArchived}`)
      setLibraries(res.data)
    } catch {
      toast.error('Failed to load libraries')
    } finally {
      setLoadingLibs(false)
    }
  }, [selectedProjectId, showArchived])

  useEffect(() => {
    fetchLibraries()
  }, [fetchLibraries])

  // Handle Create Library
  const handleCreate = async () => {
    if (!libName.trim()) {
      toast.error('Library Name is required')
      return
    }

    try {
      await api.post('/project-management/libraries', {
        projectId: selectedProjectId,
        name: libName.trim(),
        description: libDesc.trim()
      })
      toast.success('Library created successfully')
      setCreateOpen(false)
      setLibName('')
      setLibDesc('')
      fetchLibraries()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create library')
    }
  }

  // Handle Edit Library
  const handleEdit = async () => {
    if (!editingLib || !libName.trim()) {
      toast.error('Library Name is required')
      return
    }

    try {
      await api.put(`/project-management/libraries/${editingLib._id}`, {
        name: libName.trim(),
        description: libDesc.trim()
      })
      toast.success('Library updated successfully')
      setEditOpen(false)
      setEditingLib(null)
      setLibName('')
      setLibDesc('')
      fetchLibraries()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update library')
    }
  }

  // Handle Archive / Restore Library (Archive/Restore Philosophy)
  const handleArchive = async (libId: string, archive: boolean) => {
    try {
      const endpoint = archive ? 'archive' : 'restore'
      await api.post(`/project-management/libraries/${libId}/${endpoint}`)
      toast.success(`Library successfully ${archive ? 'archived' : 'restored'}`)
      fetchLibraries()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Operation failed')
    }
  }

  const openEditModal = (lib: Library) => {
    setEditingLib(lib)
    setLibName(lib.name)
    setLibDesc(lib.description || '')
    setEditOpen(true)
  }

  if (loadingProjects) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Filters Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <FolderOpen className="h-5 w-5 text-indigo-500 shrink-0" />
          <div className="flex flex-col gap-1 w-full">
            <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider leading-none">Select Project</label>
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 focus:bg-white focus:outline-none w-full sm:w-72"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.projectName || p.name}
                </option>
              ))}
            </select>
          </div>
        </div>


        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Button
            onClick={() => setShowArchived(!showArchived)}
            className={`h-9 px-3 text-xs font-bold border rounded-lg flex items-center gap-1.5 transition-colors ${
              showArchived
                ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100/50'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            {showArchived ? 'Viewing Archived' : 'View Archived'}
          </Button>

          {selectedProjectId && !showArchived && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-[var(--emerald-dark)] hover:bg-emerald-800 text-white font-bold h-9 px-4 text-xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Library
            </Button>
          )}
        </div>
      </div>

      {/* Libraries Grid */}
      {loadingLibs ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-6 w-6 text-emerald-600" />
        </div>
      ) : libraries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold text-xs">
          No libraries found in this project.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {libraries.map(lib => (
            <div key={lib._id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between gap-5 hover:shadow-md transition-all">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-bold text-slate-800 truncate text-sm" title={lib.name}>{lib.name}</h4>
                  <Badge variant={lib.status === 'Completed' ? 'success' : 'neutral'}>
                    {lib.status}
                  </Badge>
                </div>
                {lib.description && (
                  <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">{lib.description}</p>
                )}
              </div>

              <div className="flex flex-col gap-3.5">
                {/* Progress Bar */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 leading-none">
                    <span>Progress</span>
                    <span className="font-mono text-slate-600">{lib.progress}%</span>
                  </div>
                  <div className="bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-50">
                    <div 
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${lib.progress}%` }}
                    />
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  {!lib.isArchived ? (
                    <>
                      <Button
                        onClick={() => openEditModal(lib)}
                        className="h-8 w-8 p-0 border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center rounded-lg"
                        title="Edit Library"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        onClick={() => handleArchive(lib._id, true)}
                        className="h-8 w-8 p-0 border border-rose-100 hover:bg-rose-50 text-rose-600 flex items-center justify-center rounded-lg"
                        title="Archive Library"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleArchive(lib._id, false)}
                      className="h-8 px-2.5 border border-emerald-150 hover:bg-emerald-50/50 text-emerald-700 flex items-center gap-1.5 rounded-lg text-[10px] font-bold"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE LIBRARY MODAL */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Library">
        <div className="space-y-4 p-4 text-xs font-semibold">
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Library Name</label>
            <Input value={libName} onChange={e => setLibName(e.target.value)} placeholder="e.g. ADC_Lib" className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Description</label>
            <textarea
              value={libDesc}
              onChange={e => setLibDesc(e.target.value)}
              placeholder="e.g. Mixed-signal layout libraries for high speed ADC block"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:bg-white focus:outline-none min-h-[80px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-[var(--emerald-dark)] text-white hover:bg-emerald-800">Create Library</Button>
          </div>
        </div>
      </Modal>

      {/* EDIT LIBRARY MODAL */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Library">
        <div className="space-y-4 p-4 text-xs font-semibold">
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Library Name</label>
            <Input value={libName} onChange={e => setLibName(e.target.value)} placeholder="e.g. ADC_Lib" className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-bold text-slate-500 uppercase">Description</label>
            <textarea
              value={libDesc}
              onChange={e => setLibDesc(e.target.value)}
              placeholder="e.g. Mixed-signal layout libraries..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:bg-white focus:outline-none min-h-[80px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} className="bg-[var(--emerald-dark)] text-white hover:bg-emerald-800">Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
