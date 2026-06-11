import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { Spinner } from '@components/ui/Spinner'
import { toast } from 'sonner'
import {
  FolderKanban,
  Plus,
  ChevronRight,
  Search,
  Cpu,
  Layers,
  Upload,
  Eye,
} from 'lucide-react'
import { ROUTES } from '@constants/routes'
import {
  fetchProjects,
  createProject,
  fetchChecklists,
  uploadChecklist,
  setTypeChecklistItems,
  fetchReviewCount,
  type ProjectSummary,
  type ChecklistInfo,
  type CellType,
} from '@/services/projectMgmtService'
import { TypeChecklistEditor } from '@/components/projectMgmt/CombinedChecklistSection'
import { AnalyticsStatGrid } from '@/components/projectMgmt/AnalyticsStatGrid'
import { ViewModeToggle, type ViewMode } from '@/components/projectMgmt/ViewModeToggle'
import { cn } from '@/utils/cn'
import { stringToHueColor } from '@/utils/stringColor'
export function ProjectMgmtPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [checklists, setChecklists] = useState<ChecklistInfo[]>([])
  const [savingType, setSavingType] = useState<CellType | null>(null)
  const [reviewCount, setReviewCount] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Add project form state
  const [newName, setNewName] = useState('')
  const [newClient, setNewClient] = useState('')
  const [newTechNode, setNewTechNode] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchProjects()
      setProjects(data)
    } catch {
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadChecklists = useCallback(async () => {
    try {
      const data = await fetchChecklists()
      setChecklists(data)
    } catch {
      // silent
    }
  }, [])

  const loadReviewCount = useCallback(async () => {
    try {
      const count = await fetchReviewCount()
      setReviewCount(count)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    void loadProjects()
    void loadChecklists()
    void loadReviewCount()
  }, [loadProjects, loadChecklists, loadReviewCount])

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Project name is required')
      return
    }
    try {
      setCreating(true)
      await createProject({
        name: newName.trim(),
        client: newClient.trim(),
        technologyNode: newTechNode.trim(),
        description: newDesc.trim(),
      })
      toast.success('Project created')
      setShowAdd(false)
      setNewName('')
      setNewClient('')
      setNewTechNode('')
      setNewDesc('')
      void loadProjects()
    } catch {
      toast.error('Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.technologyNode.toLowerCase().includes(search.toLowerCase())
  )

  const portfolio = useMemo(
    () => ({
      projects: projects.length,
      libraries: projects.reduce((s, p) => s + (p.libraryCount || 0), 0),
      cells: projects.reduce((s, p) => s + (p.cellCount || 0), 0),
      forReview: projects.reduce((s, p) => s + (p.forReviewCount || 0), 0),
      completed: projects.reduce((s, p) => s + (p.completedCount || 0), 0),
    }),
    [projects]
  )

  return (
    <PageWrapper scrollable>
      {/* Header */}
      <div className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Project Management
            </h1>
            <p className="mt-1 text-sm text-muted">
              Projects → Libraries → Cells with layout pipeline and review gates
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Eye className="h-4 w-4" />}
              onClick={() => navigate(ROUTES.PROJECT_MGMT_REVIEWS)}
            >
              Review Queue
              {reviewCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {reviewCount}
                </span>
              )}
            </Button>
            <Button
              variant="secondary"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => setShowChecklist(true)}
            >
              Manage Checklists
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowAdd(true)}>
              Add Project
            </Button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <AnalyticsStatGrid
          columns={5}
          stats={[
            { label: 'Projects', value: portfolio.projects, color: 'text-primary' },
            { label: 'Libraries', value: portfolio.libraries },
            { label: 'Total Cells', value: portfolio.cells },
            { label: 'Awaiting Review', value: portfolio.forReview, color: 'text-amber-600' },
            { label: 'Completed Cells', value: portfolio.completed, color: 'text-emerald-600' },
          ]}
        />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="mb-3 h-12 w-12 text-slate-300" />
          <p className="text-lg font-semibold text-slate-500">No projects yet</p>
          <p className="mt-1 text-sm text-muted">Create your first project to get started</p>
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(ROUTES.PROJECT_MGMT_PROJECT(project.id))}
              className="group relative flex flex-col rounded-2xl border border-border bg-white p-5 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div
                className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
                style={{ backgroundColor: stringToHueColor(project.name) }}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-base font-bold text-ink group-hover:text-primary">
                    {project.name}
                  </h3>
                  {project.client && <p className="mt-0.5 truncate text-xs text-muted">{project.client}</p>}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:translate-x-1 group-hover:text-primary" />
              </div>
              {project.technologyNode && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Cpu className="h-3.5 w-3.5" />
                  <span className="font-mono">{project.technologyNode}</span>
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-ink">{project.libraryCount}</p>
                  <p className="text-[9px] font-semibold uppercase text-muted">Libs</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-ink">{project.cellCount ?? 0}</p>
                  <p className="text-[9px] font-semibold uppercase text-muted">Cells</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">{project.forReviewCount ?? 0}</p>
                  <p className="text-[9px] font-semibold uppercase text-muted">Review</p>
                </div>
              </div>
              {project.status && (
                <span
                  className={cn(
                    'mt-3 inline-flex self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                    project.status === 'Active' && 'bg-emerald-50 text-emerald-700',
                    project.status === 'Completed' && 'bg-blue-50 text-blue-700',
                    project.status === 'Cancelled' && 'bg-red-50 text-red-700'
                  )}
                >
                  {project.status}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && viewMode === 'table' && (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/80 text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">Project</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Node</th>
                <th className="px-4 py-3 font-semibold">Libraries</th>
                <th className="px-4 py-3 font-semibold">Cells</th>
                <th className="px-4 py-3 font-semibold">Review</th>
                <th className="px-4 py-3 font-semibold">Done</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => navigate(ROUTES.PROJECT_MGMT_PROJECT(project.id))}
                  className="cursor-pointer border-b border-border/50 transition-colors hover:bg-primary/[0.03]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stringToHueColor(project.name) }} />
                      <span className="font-semibold text-ink">{project.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{project.client || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{project.technologyNode || '—'}</td>
                  <td className="px-4 py-3">{project.libraryCount}</td>
                  <td className="px-4 py-3 font-semibold">{project.cellCount ?? 0}</td>
                  <td className="px-4 py-3">
                    {(project.forReviewCount ?? 0) > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                        {project.forReviewCount}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="px-4 py-3 text-emerald-600 font-semibold">{project.completedCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted">{project.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Project Modal */}
      <Modal isOpen={showAdd} title="Add Project" onClose={() => setShowAdd(false)} size="md">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Project Name *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. 5nm Standard Cell Library"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Client</label>
            <input
              type="text"
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Technology Node</label>
            <input
              type="text"
              value={newTechNode}
              onChange={(e) => setNewTechNode(e.target.value)}
              placeholder="e.g. 5nm"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Description</label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Brief description..."
              rows={3}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Create Project
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showChecklist} title="Manage Type Checklists" onClose={() => setShowChecklist(false)} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Define checklist items for each cell type. Items appear inline on every cell dashboard of that type.
            You can also attach an optional reference file.
          </p>
          {(['Block', 'IO', 'ESD', 'TOP'] as CellType[]).map((ct) => {
            const existing = checklists.find((c) => c.cellType === ct)
            return (
              <TypeChecklistEditor
                key={ct}
                cellType={ct}
                items={existing?.items || []}
                hasFile={existing?.hasFile}
                saving={savingType === ct}
                onSave={async (labels) => {
                  try {
                    setSavingType(ct)
                    await setTypeChecklistItems(ct, labels.map((label) => ({ label })))
                    toast.success(`${ct} checklist saved`)
                    void loadChecklists()
                  } catch {
                    toast.error(`Failed to save ${ct} checklist`)
                  } finally {
                    setSavingType(null)
                  }
                }}
                onUploadFile={async (file) => {
                  try {
                    setSavingType(ct)
                    await uploadChecklist(ct, file)
                    toast.success(`File attached for ${ct}`)
                    void loadChecklists()
                  } catch {
                    toast.error(`Failed to upload file for ${ct}`)
                  } finally {
                    setSavingType(null)
                  }
                }}
              />
            )
          })}
        </div>
      </Modal>
    </PageWrapper>
  )
}
