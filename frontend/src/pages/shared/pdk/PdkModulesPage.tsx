import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock, Download, Hash, Layers, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PdkModulesAnalyticsChart } from '@components/pdk/PdkModulesAnalyticsChart'
import { MetalRoutingInsightsPanel } from '@components/pdk/MetalRoutingInsightsPanel'
import {
  buildPdkModuleStats,
  MetalRoutingPdkModuleCatalog,
} from '@components/pdk/MetalRoutingPdkModuleCatalog'
import { PdkModuleDetailPanel } from '@components/pdk/PdkModuleDetailPanel'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import type { PdkModule } from '@/types/pdkMetalRouting'
import {
  createPdkModule,
  downloadPdkTemplate,
  fetchPdkModule,
  fetchPdkModules,
  importPdkModuleFromExcel,
} from '@services/pdkMetalRoutingService'
import { cn } from '@/utils/cn'

const EMPTY_METAL = { metalType: '', currentDensityAt110: '', sheetResistance: '' }

const PDK_MENU_TRIGGER_CLASS = cn(
  'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium shadow-sm transition-ui',
  'bg-primary text-white hover:bg-[#1f5516] active:bg-[#1a4814] active:translate-y-[1px] active:shadow-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
)

const PDK_MENU_ITEM_CLASS = cn(
  'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink',
  'transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
)

function runAfterMenuClose(action: () => void) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(action)
  })
}

function PdkAddMenu({
  onCreate,
  onImport,
  onDownloadTemplate,
}: {
  onCreate: () => void
  onImport: () => void
  onDownloadTemplate: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const choose = (action: () => void) => {
    setOpen(false)
    runAfterMenuClose(action)
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={PDK_MENU_TRIGGER_CLASS}
        aria-label="Add PDK module options"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="h-4 w-4" />
        Add PDK module
        <ChevronDown className={cn('h-4 w-4 opacity-80 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-[200] min-w-[240px] rounded-xl border border-border bg-white p-1 shadow-lg"
        >
          <button type="button" role="menuitem" className={PDK_MENU_ITEM_CLASS} onClick={() => choose(onCreate)}>
            <Plus className="h-4 w-4 text-primary" />
            Create PDK Manually
          </button>
          <button type="button" role="menuitem" className={PDK_MENU_ITEM_CLASS} onClick={() => choose(onImport)}>
            <Upload className="h-4 w-4 text-primary" />
            Import PDK From Excel
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            className={PDK_MENU_ITEM_CLASS}
            onClick={() => choose(onDownloadTemplate)}
          >
            <Download className="h-4 w-4 text-primary" />
            Download Template
          </button>
        </div>
      )}
    </div>
  )
}

export function PdkModulesPage({ embedded = false }: { embedded?: boolean }) {
  const [modules, setModules] = useState<PdkModule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<PdkModule | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '',
    technologyNode: '',
    notes: '',
    metals: [{ ...EMPTY_METAL }],
  })
  const [importForm, setImportForm] = useState({
    name: '',
    technologyNode: '',
    notes: '',
  })
  const [search, setSearch] = useState('')
  const [nodeFilter, setNodeFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      setModules(await fetchPdkModules())
    } catch {
      toast.error('Failed to load PDK modules')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openModule = async (id: string) => {
    setSelectedId(id)
    try {
      setSelectedModule(await fetchPdkModule(id))
    } catch {
      toast.error('Failed to load module')
      setSelectedId(null)
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Module name is required')
      return
    }
    const metals = form.metals
      .filter((m) => m.metalType.trim())
      .map((m) => ({
        metalType: m.metalType.trim(),
        currentDensityAt110: Number(m.currentDensityAt110),
        sheetResistance: Number(m.sheetResistance),
      }))
    if (metals.length === 0) {
      toast.error('Add at least one metal row')
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

  const resetImportForm = () => {
    setImportForm({ name: '', technologyNode: '', notes: '' })
    setImportFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    if (!importForm.name.trim()) {
      toast.error('Module name is required')
      return
    }
    if (!importFile) {
      toast.error('Select an Excel file to import')
      return
    }

    setImporting(true)
    try {
      const created = await importPdkModuleFromExcel(importFile, {
        name: importForm.name.trim(),
        technologyNode: importForm.technologyNode.trim(),
        notes: importForm.notes.trim(),
      })
      toast.success(`PDK module "${created.name}" imported successfully`)
      setImportOpen(false)
      resetImportForm()
      await load()
      await openModule(created._id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to import PDK module')
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await downloadPdkTemplate()
      toast.success('Template downloaded')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to download template')
    }
  }

  const openCreateModal = () => setCreateOpen(true)

  const openImportModal = () => {
    resetImportForm()
    setImportOpen(true)
  }

  const showDetail = Boolean(selectedId && selectedModule)

  const moduleStats = useMemo(() => buildPdkModuleStats(modules), [modules])

  const insightCards = useMemo(
    () => [
      {
        label: 'Total Modules',
        value: moduleStats.totalModules,
        hint: 'Available in system',
        icon: Layers,
        tone: 'green' as const,
      },
      {
        label: 'Total Metal Types',
        value: moduleStats.totalMetalTypes,
        hint: 'Across all modules',
        icon: Hash,
        tone: 'blue' as const,
      },
      {
        label: 'Recently Added',
        value: moduleStats.recentlyAdded,
        hint: 'In last 30 days',
        icon: Clock,
        tone: 'orange' as const,
      },
    ],
    [moduleStats],
  )

  const pageBody = (
    <>
      {showDetail && selectedModule ? (
        <PdkModuleDetailPanel
          module={selectedModule}
          onBack={() => {
            setSelectedId(null)
            setSelectedModule(null)
          }}
          onSaved={(updated) => {
            setSelectedModule(updated)
            setModules((prev) => prev.map((m) => (m._id === updated._id ? updated : m)))
          }}
        />
      ) : (
        <div className="metal-routing-pdk-workspace">
          <div className="metal-routing-pdk-workspace-main metal-routing-page-shell">
            <div className="metal-routing-dashboard metal-routing-pdk-modules-page">
              <header className="metal-routing-cell-routing-header metal-routing-pdk-modules-topbar">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="metal-routing-cell-routing-header__icon" aria-hidden>
                    <Layers className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h1 className="metal-routing-page-title">PDK Modules</h1>
                  </div>
                </div>
              </header>
              {loading ? (
                <MetalRoutingPdkModuleCatalog
                  modules={modules}
                  loading={loading}
                  search={search}
                  nodeFilter={nodeFilter}
                  onSearchChange={setSearch}
                  onNodeFilterChange={setNodeFilter}
                  onOpenModule={(id) => void openModule(id)}
                />
              ) : modules.length === 0 ? (
                <div className="metal-routing-overview-card metal-routing-pdk-empty-state">
                  <p className="text-sm text-muted">No PDK modules yet.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button type="button" icon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
                      Create PDK Manually
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<Upload className="h-4 w-4" />}
                      onClick={openImportModal}
                    >
                      Import From Excel
                    </Button>
                  </div>
                </div>
              ) : (
                <MetalRoutingPdkModuleCatalog
                  modules={modules}
                  loading={loading}
                  search={search}
                  nodeFilter={nodeFilter}
                  onSearchChange={setSearch}
                  onNodeFilterChange={setNodeFilter}
                  onOpenModule={(id) => void openModule(id)}
                />
              )}
            </div>
          </div>
          <aside className="metal-routing-pdk-modules-sidebar" aria-label="PDK module insights">
            <div className="metal-routing-pdk-sidebar-actions">
              <PdkAddMenu
                onCreate={openCreateModal}
                onImport={openImportModal}
                onDownloadTemplate={() => void handleDownloadTemplate()}
              />
            </div>
            <MetalRoutingInsightsPanel
              cards={insightCards}
              loading={loading}
              embedded
              compact
            />
            <PdkModulesAnalyticsChart modules={modules} loading={loading} sidebar fill />
          </aside>
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create PDK Module" size="lg">
        <div className="space-y-3">
          <Input label="Module Name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Technology Node" value={form.technologyNode} onChange={(e) => setForm((f) => ({ ...f, technologyNode: e.target.value }))} />
          <Input label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Metal rows</p>
            {form.metals.map((row, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="MET1" value={row.metalType} onChange={(e) => {
                  const metals = [...form.metals]
                  metals[i] = { ...metals[i], metalType: e.target.value }
                  setForm((f) => ({ ...f, metals }))
                }} />
                <Input placeholder="J@110°" type="number" step="any" value={row.currentDensityAt110} onChange={(e) => {
                  const metals = [...form.metals]
                  metals[i] = { ...metals[i], currentDensityAt110: e.target.value }
                  setForm((f) => ({ ...f, metals }))
                }} />
                <Input placeholder="Sheet R" type="number" step="any" value={row.sheetResistance} onChange={(e) => {
                  const metals = [...form.metals]
                  metals[i] = { ...metals[i], sheetResistance: e.target.value }
                  setForm((f) => ({ ...f, metals }))
                }} />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setForm((f) => ({ ...f, metals: [...f.metals, { ...EMPTY_METAL }] }))}
            >
              Add metal row
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="button" loading={saving} onClick={() => void handleCreate()}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={importOpen}
        onClose={() => {
          setImportOpen(false)
          resetImportForm()
        }}
        title="Import PDK From Excel"
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface/60 p-4 text-sm">
            <h4 className="mb-2 font-medium text-ink">Excel format</h4>
            <ul className="list-inside list-disc space-y-1 text-muted">
              <li>Columns: Name, J_DC(mA/µm), J_DC(mA/µm) at 110° C, mOhm/Sq at 110° C</li>
              <li>Supports the two-row grouped header template (Current Density / Sheet Resistance)</li>
              <li>Each data row is one metal layer (MET1–MET6, AP, etc.)</li>
              <li>
                <strong className="text-ink">Required:</strong> fill the green cells (J_DC @110°C and Sheet Resistance) for every metal row before importing
              </li>
            </ul>
            <button
              type="button"
              onClick={() => void handleDownloadTemplate()}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download template
            </button>
          </div>

          <Input
            label="Module Name"
            required
            value={importForm.name}
            onChange={(e) => setImportForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. PDK_28nm_STD"
          />
          <Input
            label="Technology Node"
            value={importForm.technologyNode}
            onChange={(e) => setImportForm((f) => ({ ...f, technologyNode: e.target.value }))}
            placeholder="e.g. 28nm"
          />
          <Input
            label="Notes"
            value={importForm.notes}
            onChange={(e) => setImportForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes"
          />

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">
              Excel file <span className="text-red-500">*</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer text-sm text-muted file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
            />
            {importFile && (
              <p className="mt-1.5 text-xs text-muted">Selected: {importFile.name}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setImportOpen(false)
                resetImportForm()
              }}
            >
              Cancel
            </Button>
            <Button type="button" loading={importing} icon={<Upload className="h-4 w-4" />} onClick={() => void handleImport()}>
              Import PDK
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )

  if (embedded) {
    return <div className="metal-routing-pdk-embedded-root">{pageBody}</div>
  }

  return (
    <MetalRoutingPageShell fill={!showDetail} bleed={!showDetail}>
      {pageBody}
    </MetalRoutingPageShell>
  )
}
