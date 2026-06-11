import { useEffect, useState } from 'react'
import { Calculator, Plus, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { MetalRoutingColumnHeaderCell } from '@components/pdk/MetalRoutingColumnHeader'
import { METAL_ROUTING_TABLE_HEADERS } from '@/constants/metalRoutingTableHeaders'
import type { MetalConnectionType, MetalEntry, PdkModule } from '@/types/pdkMetalRouting'
import { previewMetal } from '@services/pdkMetalRoutingService'

type MetalPayload = {
  metalType: string
  width: number
  length: number
  connectionType?: MetalConnectionType
}

export function AddMetalModal({
  isOpen,
  onClose,
  projectId,
  pdkModule,
  routeSchematicCurrentDensity,
  isFirstMetal,
  isEditingFirstMetal,
  editingMetal,
  onAdd,
  onUpdate,
  saving,
}: {
  isOpen: boolean
  onClose: () => void
  projectId: string
  pdkModule: PdkModule | null
  routeSchematicCurrentDensity?: number
  isFirstMetal?: boolean
  isEditingFirstMetal?: boolean
  editingMetal?: MetalEntry | null
  onAdd: (payload: MetalPayload) => Promise<void>
  onUpdate?: (metalId: string, payload: MetalPayload) => Promise<void>
  saving: boolean
}) {
  const isEdit = Boolean(editingMetal)
  const showConnection = !isFirstMetal && !isEditingFirstMetal
  const [metalType, setMetalType] = useState('')
  const [width, setWidth] = useState('')
  const [length, setLength] = useState('')
  const [connectionType, setConnectionType] = useState<MetalConnectionType>('series')
  const [preview, setPreview] = useState<MetalEntry | null>(null)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setMetalType('')
      setWidth('')
      setLength('')
      setConnectionType('series')
      setPreview(null)
      return
    }
    if (editingMetal) {
      setMetalType(editingMetal.metalType)
      setWidth(String(editingMetal.width))
      setLength(String(editingMetal.length))
      setConnectionType(editingMetal.connectionType ?? 'series')
      setPreview(null)
    }
  }, [isOpen, editingMetal])

  const effectiveConnection: MetalConnectionType = showConnection ? connectionType : 'series'

  const handleCalculate = async () => {
    const w = Number(width)
    const l = Number(length)
    if (!metalType.trim()) {
      toast.error('Select a metal type')
      return
    }
    if (!Number.isFinite(w) || w < 0 || !Number.isFinite(l) || l < 0) {
      toast.error('Enter valid width and length')
      return
    }
    setCalculating(true)
    try {
      const result = await previewMetal(projectId, {
        metalType,
        width: w,
        length: l,
        schematicCurrentDensity: routeSchematicCurrentDensity,
        connectionType: effectiveConnection,
      })
      setPreview(result)
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      toast.error(message ?? 'Calculation failed')
    } finally {
      setCalculating(false)
    }
  }

  const buildPayload = (): MetalPayload | null => {
    if (!preview) return null
    return {
      metalType: preview.metalType,
      width: preview.width,
      length: preview.length,
      ...(showConnection ? { connectionType: preview.connectionType ?? effectiveConnection } : {}),
    }
  }

  const handleSave = async () => {
    const payload = buildPayload()
    if (!payload) {
      toast.error('Calculate first to preview the row')
      return
    }
    if (isEdit && editingMetal && onUpdate) {
      await onUpdate(editingMetal._id, payload)
    } else {
      await onAdd(payload)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Metal Entry' : 'Add Metal Entry'}
      size="lg"
    >
      <div className="space-y-4">
        {pdkModule ? (
          <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">
            Using project PDK: <strong className="text-ink">{pdkModule.name}</strong>
            {routeSchematicCurrentDensity != null ? (
              <>
                {' '}
                · Schematic: <strong className="text-ink">{routeSchematicCurrentDensity}</strong> mA/µm
              </>
            ) : null}
          </p>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No PDK assigned to this project. Assign one from PDK Modules first.
          </p>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Metal Type</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={metalType}
            onChange={(e) => {
              setMetalType(e.target.value)
              setPreview(null)
            }}
            disabled={!pdkModule}
          >
            <option value="">Select metal from assigned PDK…</option>
            {(pdkModule?.metals ?? []).map((m) => (
              <option key={m._id ?? m.metalType} value={m.metalType}>
                {m.metalType} — J@110°={m.currentDensityAt110}, ρ={m.sheetResistance}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Metal Width(µm)" type="number" step="any" min={0} value={width} onChange={(e) => { setWidth(e.target.value); setPreview(null) }} />
          <Input label="Metal Length(µm)" type="number" step="any" min={0} value={length} onChange={(e) => { setLength(e.target.value); setPreview(null) }} />
        </div>

        {showConnection ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Connection</span>
            <select
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
              value={connectionType}
              onChange={(e) => {
                setConnectionType(e.target.value as MetalConnectionType)
                setPreview(null)
              }}
            >
              <option value="series">Series — add resistance to total</option>
              <option value="parallel">Parallel — combine with (R1×R2)/(R1+R2)</option>
            </select>
          </label>
        ) : null}

        <Button variant="secondary" loading={calculating} icon={<Calculator className="h-4 w-4" />} onClick={() => void handleCalculate()} disabled={!pdkModule}>
          Calculate
        </Button>

        {preview ? (
          <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50/50">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead className="metal-routing-metal-table__head bg-yellow-300 text-[11px] font-bold text-black">
                <tr>
                  <th className="px-2 py-2">
                    <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.metalType} />
                  </th>
                  {showConnection ? <th className="px-2 py-2">Conn.</th> : null}
                  <th className="px-2 py-2">
                    <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.givenDensity} />
                  </th>
                  <th className="px-2 py-2">
                    <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.implementedCapacity} />
                  </th>
                  <th className="px-2 py-2">
                    <MetalRoutingColumnHeaderCell header={METAL_ROUTING_TABLE_HEADERS.routingImpedance} />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-lime-400/70 font-medium text-black">
                <tr>
                  <td className="px-2 py-2">{preview.metalType}</td>
                  {showConnection ? (
                    <td className="px-2 py-2">{preview.connectionType ?? effectiveConnection}</td>
                  ) : null}
                  <td className="px-2 py-2">{preview.givenCurrentDensity.toFixed(4)}</td>
                  <td className="px-2 py-2">{preview.implementedCurrentMetalCapacity.toFixed(4)}</td>
                  <td className="px-2 py-2">{preview.routingMetalImpedance.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={saving}
            disabled={!preview || !pdkModule}
            icon={isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            onClick={() => void handleSave()}
          >
            {isEdit ? 'Save changes' : 'Add to table'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
