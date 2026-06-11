import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, Layers, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { MetalRoutingPdkModuleCatalog } from '@components/pdk/MetalRoutingPdkModuleCatalog'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import type { PdkModule, PdkModuleMetalSpec, ProjectRoutingContext } from '@/types/pdkMetalRouting'
import {
  assignPdkToProject,
  createPdkModule,
  downloadPdkTemplate,
  fetchPdkModule,
  fetchPdkModules,
  fetchProjectContext,
  importPdkModuleFromExcel,
  updatePdkModule,
} from '@services/pdkMetalRoutingService'
import { useParams } from 'react-router-dom'

const EMPTY_METAL = { metalType: '', currentDensityAt110: '', sheetResistance: '' }

function MetalTable({ metals }: { metals: PdkModuleMetalSpec[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-yellow-300 text-[11px] font-bold uppercase text-black">
          <tr>
            <th className="border border-yellow-400 px-2 py-2">Metal Type</th>
            <th className="border border-yellow-400 px-2 py-2">J @110° (mA/µm)</th>
            <th className="border border-yellow-400 px-2 py-2">Sheet R (mΩ/sq)</th>
          </tr>
        </thead>
        <tbody className="bg-lime-400/70 font-medium text-black">
          {metals.map((m) => (
            <tr key={m._id ?? m.metalType}>
              <td className="border border-lime-500 px-2 py-2">{m.metalType}</td>
              <td className="border border-lime-500 px-2 py-2">{m.currentDensityAt110}</td>
              <td className="border border-lime-500 px-2 py-2">{m.sheetResistance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ProjectPdkModulesPage() {
  const { projectId = '' } = useParams()
  const [context, setContext] = useState<ProjectRoutingContext | null>(null)
  const [modules, setModules] = useState<PdkModule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<PdkModule | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [nodeFilter, setNodeFilter] = useState('all')
  const [form, setForm] = useState({ name: '', technologyNode: '', notes: '', metals: [{ ...EMPTY_METAL }] })
  const [editForm, setEditForm] = useState({ name: '', technologyNode: '', notes: '', metals: [{ ...EMPTY_METAL }] })
  const [importForm, setImportForm] = useState({ name: '', technologyNode: '', notes: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [mods, ctx] = await Promise.all([fetchPdkModules(), fetchProjectContext(projectId)])
      setModules(mods)
      setContext(ctx)
    } catch {
      toast.error('Failed to load PDK modules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) void load()
  }, [projectId])

  const openModule = async (id: string) => {
    setSelectedId(id)
    try {
      const mod = await fetchPdkModule(id)
      setSelectedModule(mod)
      setEditForm({
        name: mod.name,
        technologyNode: mod.technologyNode,
        notes: mod.notes,
        metals: mod.metals.map((m) => ({
          metalType: m.metalType,
          currentDensityAt110: String(m.currentDensityAt110),
          sheetResistance: String(m.sheetResistance),
        })),
      })
    } catch {
      toast.error('Failed to load module')
      setSelectedId(null)
    }
  }

  const handleAssign = async (pdkModuleId: string) => {
    try {
      await assignPdkToProject(projectId, pdkModuleId || null)
      toast.success('PDK module assigned to project')
      setContext(await fetchProjectContext(projectId))
    } catch {
      toast.error('Failed to assign PDK module')
    }
  }

  const parseMetals = (rows: typeof form.metals) =>
    rows
      .filter((m) => m.metalType.trim())
      .map((m) => ({
        metalType: m.metalType.trim(),
        currentDensityAt110: Number(m.currentDensityAt110),
        sheetResistance: Number(m.sheetResistance),
      }))

  const handleCreate = async () => {
    const metals = parseMetals(form.metals)
    if (!form.name.trim() || metals.length === 0) {
      toast.error('Name and at least one metal row are required')
      return
    }
    setSaving(true)
    try {
      const created = await createPdkModule({
        name: form.name.trim(),
        technologyNode: form.technologyNode.trim(),
        notes: form.notes.trim(),
        metals,
      })
      toast.success('PDK module created')
      setCreateOpen(false)
      setForm({ name: '', technologyNode: '', notes: '', metals: [{ ...EMPTY_METAL }] })
      await load()
      await openModule(created._id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create module')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedModule) return
    const metals = parseMetals(editForm.metals)
    if (!editForm.name.trim() || metals.length === 0) {
      toast.error('Name and at least one metal row are required')
      return
    }
    setSaving(true)
    try {
      await updatePdkModule(selectedModule._id, {
        name: editForm.name.trim(),
        technologyNode: editForm.technologyNode.trim(),
        notes: editForm.notes.trim(),
        metals,
      })
      toast.success('PDK module updated')
      setEditOpen(false)
      await load()
      await openModule(selectedModule._id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update module')
    } finally {
      setSaving(false)
    }
  }

  const handleImport = async () => {
    if (!importForm.name.trim() || !importFile) {
      toast.error('Module name and Excel file are required')
      return
    }
    setImporting(true)
    try {
      const created = await importPdkModuleFromExcel(importFile, importForm)
      toast.success('PDK module imported')
      setImportOpen(false)
      await load()
      await openModule(created._id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const showDetail = Boolean(selectedId && selectedModule)

  return (
    <MetalRoutingPageShell className="min-h-0 flex-1">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-6">
      {showDetail ? (
        <div className="metal-routing-dashboard">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => {
                setSelectedId(null)
                setSelectedModule(null)
              }}
            >
              Back to all modules
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>Edit module</Button>
          </div>
          <header className="metal-routing-dashboard-header">
            <h1 className="metal-routing-page-title">{selectedModule!.name}</h1>
            <p className="metal-routing-page-desc">{selectedModule!.technologyNode || 'N/A'}</p>
          </header>
          <MetalTable metals={selectedModule!.metals} />
        </div>
      ) : (
        <div className="metal-routing-dashboard metal-routing-pdk-modules-page">
          <header className="metal-routing-cell-routing-header metal-routing-pdk-modules-topbar">
            <div className="flex min-w-0 items-start gap-3">
              <span className="metal-routing-cell-routing-header__icon" aria-hidden>
                <Layers className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="metal-routing-page-title">PDK Modules</h1>
                <p className="metal-routing-page-desc">
                  Select the PDK module for {context?.project.projectName ?? 'this project'}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Create PDK
              </Button>
              <Button size="sm" variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
                Import Excel
              </Button>
            </div>
          </header>

          <div className="metal-routing-overview-card mb-4 p-4">
            <label className="block text-sm font-medium text-ink">Assigned PDK for this project</label>
            <select
              className="mt-2 h-10 w-full max-w-md rounded-lg border border-border bg-white px-3 text-sm"
              value={context?.project.pdkModuleId ?? ''}
              onChange={(e) => void handleAssign(e.target.value)}
            >
              <option value="">— Not assigned —</option>
              {modules.map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>

          <MetalRoutingPdkModuleCatalog
            modules={modules}
            loading={loading}
            search={search}
            nodeFilter={nodeFilter}
            onSearchChange={setSearch}
            onNodeFilterChange={setNodeFilter}
            onOpenModule={(id) => void openModule(id)}
          />
        </div>
      )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create PDK Module" size="lg">
        <div className="space-y-3">
          <Input label="Module Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Technology Node" value={form.technologyNode} onChange={(e) => setForm((f) => ({ ...f, technologyNode: e.target.value }))} />
          <Input label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          {form.metals.map((row, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="MET1" value={row.metalType} onChange={(e) => {
                const metals = [...form.metals]
                metals[i] = { ...metals[i], metalType: e.target.value }
                setForm((f) => ({ ...f, metals }))
              }} />
              <Input placeholder="J@110" type="number" value={row.currentDensityAt110} onChange={(e) => {
                const metals = [...form.metals]
                metals[i] = { ...metals[i], currentDensityAt110: e.target.value }
                setForm((f) => ({ ...f, metals }))
              }} />
              <Input placeholder="Sheet R" type="number" value={row.sheetResistance} onChange={(e) => {
                const metals = [...form.metals]
                metals[i] = { ...metals[i], sheetResistance: e.target.value }
                setForm((f) => ({ ...f, metals }))
              }} />
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setForm((f) => ({ ...f, metals: [...f.metals, { ...EMPTY_METAL }] }))}>
            Add metal row
          </Button>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void handleCreate()}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit PDK Module" size="lg">
        <div className="space-y-3">
          <Input label="Module Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Technology Node" value={editForm.technologyNode} onChange={(e) => setEditForm((f) => ({ ...f, technologyNode: e.target.value }))} />
          <Input label="Notes" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
          {editForm.metals.map((row, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <Input value={row.metalType} onChange={(e) => {
                const metals = [...editForm.metals]
                metals[i] = { ...metals[i], metalType: e.target.value }
                setEditForm((f) => ({ ...f, metals }))
              }} />
              <Input type="number" value={row.currentDensityAt110} onChange={(e) => {
                const metals = [...editForm.metals]
                metals[i] = { ...metals[i], currentDensityAt110: e.target.value }
                setEditForm((f) => ({ ...f, metals }))
              }} />
              <Input type="number" value={row.sheetResistance} onChange={(e) => {
                const metals = [...editForm.metals]
                metals[i] = { ...metals[i], sheetResistance: e.target.value }
                setEditForm((f) => ({ ...f, metals }))
              }} />
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setEditForm((f) => ({ ...f, metals: [...f.metals, { ...EMPTY_METAL }] }))}>
            Add metal row
          </Button>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void handleUpdate()}>Save changes</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={importOpen} onClose={() => setImportOpen(false)} title="Import PDK From Excel" size="md">
        <div className="space-y-3">
          <Input label="Module Name" value={importForm.name} onChange={(e) => setImportForm((f) => ({ ...f, name: e.target.value }))} />
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => void downloadPdkTemplate()}>
            <Download className="mr-1 inline h-3.5 w-3.5" />Download template
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button loading={importing} onClick={() => void handleImport()}>Import</Button>
          </div>
        </div>
      </Modal>
    </MetalRoutingPageShell>
  )
}
