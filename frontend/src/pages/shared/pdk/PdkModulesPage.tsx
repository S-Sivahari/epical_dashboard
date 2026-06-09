import { useEffect, useState } from 'react'
import { ArrowLeft, Layers, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { MetalRoutingPageShell } from '@components/pdk/MetalRoutingPageShell'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import type { PdkModule, PdkModuleMetalSpec } from '@/types/pdkMetalRouting'
import { createPdkModule, fetchPdkModule, fetchPdkModules } from '@services/pdkMetalRoutingService'
import { cn } from '@/utils/cn'

const EMPTY_METAL = { metalType: '', currentDensityAt110: '', sheetResistance: '' }

export function PdkModulesPage() {
  const [modules, setModules] = useState<PdkModule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<PdkModule | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    technologyNode: '',
    notes: '',
    metals: [{ ...EMPTY_METAL }],
  })

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
      await createPdkModule({
        name: form.name.trim(),
        technologyNode: form.technologyNode.trim(),
        notes: form.notes.trim(),
        metals,
      })
      toast.success('PDK module created')
      setCreateOpen(false)
      setForm({ name: '', technologyNode: '', notes: '', metals: [{ ...EMPTY_METAL }] })
      await load()
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message ?? 'Failed to create module')
    } finally {
      setSaving(false)
    }
  }

  if (selectedId && selectedModule) {
    return (
      <MetalRoutingPageShell>
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
        <div className="mt-4 mb-6">
          <h1 className="text-xl font-semibold text-ink">{selectedModule.name}</h1>
          <p className="text-sm text-muted">
            {selectedModule.technologyNode}
            {selectedModule.notes ? ` · ${selectedModule.notes}` : ''}
          </p>
        </div>
        <MetalTable metals={selectedModule.metals} />
      </MetalRoutingPageShell>
    )
  }

  return (
    <MetalRoutingPageShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">PDK Modules</h1>
          <p className="mt-1 text-sm text-muted">
            Each module is a full Sheet 2 table. Same metal names can exist across modules with different values.
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Add PDK module
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : modules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white py-12 text-center">
          <p className="text-sm text-muted">No PDK modules yet.</p>
          <Button className="mt-4" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Create your first PDK module
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <button
              key={mod._id}
              type="button"
              onClick={() => void openModule(mod._id)}
              className={cn(
                'rounded-xl border border-border bg-white p-4 text-left shadow-sm transition-ui',
                'hover:border-primary/40 hover:shadow-md',
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-ink">{mod.name}</p>
                  <p className="text-xs text-muted">{mod.technologyNode || 'N/A'}</p>
                </div>
              </div>
              <p className="text-xs text-muted">{mod.metals.length} metal type(s)</p>
            </button>
          ))}
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
            <Button size="sm" variant="secondary" onClick={() => setForm((f) => ({ ...f, metals: [...f.metals, { ...EMPTY_METAL }] }))}>
              Add metal row
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void handleCreate()}>Create</Button>
          </div>
        </div>
      </Modal>
    </MetalRoutingPageShell>
  )
}

function MetalTable({ metals }: { metals: PdkModuleMetalSpec[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-yellow-300 text-xs font-bold uppercase text-black">
            <th className="border border-yellow-400 px-3 py-2">Metal Type</th>
            <th className="border border-yellow-400 px-3 py-2">Current Density @ 110° (mA)</th>
            <th className="border border-yellow-400 px-3 py-2">Sheet Resistance (Ω/sq)</th>
          </tr>
        </thead>
        <tbody>
          {metals.map((m) => (
            <tr key={m._id ?? m.metalType} className="bg-lime-400/70 font-medium text-black">
              <td className="border border-lime-500 px-3 py-2">{m.metalType}</td>
              <td className="border border-lime-500 px-3 py-2">{m.currentDensityAt110}</td>
              <td className="border border-lime-500 px-3 py-2">{m.sheetResistance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
