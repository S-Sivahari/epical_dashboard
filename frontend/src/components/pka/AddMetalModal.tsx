import { useEffect, useMemo, useState } from 'react'
import { Calculator, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import type { MetalEntry, PkaModule } from '@/types/pkaMetalRouting'
import { previewMetal } from '@services/pkaMetalRoutingService'

export function AddMetalModal({
  isOpen,
  onClose,
  pkaModules,
  onAdd,
  adding,
}: {
  isOpen: boolean
  onClose: () => void
  pkaModules: PkaModule[]
  onAdd: (payload: {
    metalType: string
    width: number
    length: number
    pkaModuleId: string
    preview: MetalEntry
  }) => Promise<void>
  adding: boolean
}) {
  const [pkaModuleId, setPkaModuleId] = useState('')
  const [metalType, setMetalType] = useState('')
  const [width, setWidth] = useState('')
  const [length, setLength] = useState('')
  const [preview, setPreview] = useState<MetalEntry | null>(null)
  const [calculating, setCalculating] = useState(false)

  const selectedModule = useMemo(
    () => pkaModules.find((m) => m._id === pkaModuleId) ?? null,
    [pkaModules, pkaModuleId],
  )

  const metalOptions = selectedModule?.metals ?? []

  useEffect(() => {
    if (!isOpen) {
      setPkaModuleId('')
      setMetalType('')
      setWidth('')
      setLength('')
      setPreview(null)
    }
  }, [isOpen])

  useEffect(() => {
    setMetalType('')
    setPreview(null)
  }, [pkaModuleId])

  const handleCalculate = async () => {
    const w = Number(width)
    const l = Number(length)
    if (!pkaModuleId || !metalType.trim()) {
      toast.error('Select PKA module and metal type')
      return
    }
    if (!Number.isFinite(w) || w < 0 || !Number.isFinite(l) || l < 0) {
      toast.error('Enter valid width and length')
      return
    }
    setCalculating(true)
    try {
      const result = await previewMetal(
        { fromCell: '', toCell: '', fromSignal: '', toSignal: '' },
        { metalType, width: w, length: l, pkaModuleId },
      )
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

  const handleAdd = async () => {
    if (!preview) {
      toast.error('Calculate first to preview the row')
      return
    }
    await onAdd({
      metalType: preview.metalType,
      width: preview.width,
      length: preview.length,
      pkaModuleId,
      preview,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Metal Entry" size="lg">
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">PKA Module</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={pkaModuleId}
            onChange={(e) => setPkaModuleId(e.target.value)}
          >
            <option value="">Select module…</option>
            {pkaModules.map((mod) => (
              <option key={mod._id} value={mod._id}>
                {mod.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Metal Type</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={metalType}
            onChange={(e) => setMetalType(e.target.value)}
            disabled={!selectedModule}
          >
            <option value="">Select metal from module…</option>
            {metalOptions.map((m) => (
              <option key={m._id ?? m.metalType} value={m.metalType}>
                {m.metalType} — J@110°={m.currentDensityAt110}, ρ={m.sheetResistance}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Metal Width (µm)"
            type="number"
            step="any"
            min={0}
            value={width}
            onChange={(e) => setWidth(e.target.value)}
          />
          <Input
            label="Metal Length (µm)"
            type="number"
            step="any"
            min={0}
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
        </div>

        <Button
          variant="secondary"
          loading={calculating}
          icon={<Calculator className="h-4 w-4" />}
          onClick={() => void handleCalculate()}
        >
          Calculate
        </Button>

        {preview ? (
          <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50/50">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead className="bg-yellow-300 text-[11px] font-bold uppercase text-black">
                <tr>
                  <th className="px-2 py-2">Metal Type</th>
                  <th className="px-2 py-2">Width (µm)</th>
                  <th className="px-2 py-2">Length (µm)</th>
                  <th className="px-2 py-2">Given Current Density (mA)</th>
                  <th className="px-2 py-2">Implemented Capacity (mA)</th>
                  <th className="px-2 py-2">Routing Impedance (Ω)</th>
                </tr>
              </thead>
              <tbody className="bg-lime-400/70 font-medium text-black">
                <tr>
                  <td className="px-2 py-2">{preview.metalType}</td>
                  <td className="px-2 py-2">{preview.width}</td>
                  <td className="px-2 py-2">{preview.length}</td>
                  <td className="px-2 py-2">{preview.givenCurrentDensity.toFixed(4)}</td>
                  <td className="px-2 py-2">{preview.implementedCurrentMetalCapacity.toFixed(4)}</td>
                  <td className="px-2 py-2">{preview.routingMetalImpedance.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={adding}
            disabled={!preview}
            icon={<Plus className="h-4 w-4" />}
            onClick={() => void handleAdd()}
          >
            Add to table
          </Button>
        </div>
      </div>
    </Modal>
  )
}
