import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import type { ProjectCellsByType, SignalRouteSummary } from '@/types/pdkMetalRouting'

export function EditSignalModal({
  isOpen,
  onClose,
  signalRow,
  cellNames,
  cellsByType,
  onSave,
  saving,
}: {
  isOpen: boolean
  onClose: () => void
  signalRow: SignalRouteSummary | null
  cellNames: string[]
  cellsByType?: ProjectCellsByType
  onSave: (payload: {
    signal: string
    fromCell: string
    toCell: string
    schematicCurrentDensity?: number
  }) => Promise<void>
  saving: boolean
}) {
  const [signal, setSignal] = useState('')
  const [fromCell, setFromCell] = useState('')
  const [toCell, setToCell] = useState('')
  const [schematicDensity, setSchematicDensity] = useState('')

  useEffect(() => {
    if (!isOpen || !signalRow) return
    setSignal(signalRow.signal)
    setFromCell(signalRow.fromCell)
    setToCell(signalRow.toCell)
    setSchematicDensity(
      signalRow.schematicCurrentDensity != null ? String(signalRow.schematicCurrentDensity) : '',
    )
  }, [isOpen, signalRow])

  const allCells = useMemo(() => {
    const fromGroups = cellsByType
      ? [...cellsByType.BLOCK, ...cellsByType.IO, ...cellsByType.ESD, ...cellsByType.TOP]
      : []
    return Array.from(new Set([...cellNames, ...fromGroups])).filter(Boolean).sort()
  }, [cellNames, cellsByType])

  const handleSave = async () => {
    if (!signal.trim()) {
      toast.error('Signal name is required')
      return
    }
    if (!fromCell.trim() || !toCell.trim()) {
      toast.error('From cell and to cell are required')
      return
    }
    const schematic = schematicDensity.trim() ? Number(schematicDensity) : undefined
    if (schematic != null && (!Number.isFinite(schematic) || schematic < 0)) {
      toast.error('Enter a valid schematic current density')
      return
    }
    await onSave({
      signal: signal.trim(),
      fromCell: fromCell.trim(),
      toCell: toCell.trim(),
      schematicCurrentDensity: schematic,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit signal route" size="md">
      <div className="space-y-4">
        <Input
          label="Signal name"
          value={signal}
          onChange={(e) => setSignal(e.target.value)}
          placeholder="e.g. CLK_MAIN"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">From cell</span>
          <input
            list="edit-signal-from-cells"
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={fromCell}
            onChange={(e) => setFromCell(e.target.value)}
            placeholder="Select or type cell name"
          />
          <datalist id="edit-signal-from-cells">
            {allCells.map((c) => (
              <option key={`from-${c}`} value={c} />
            ))}
          </datalist>
        </label>
        <Input
          label="Schematic current density (mA/µm)"
          type="number"
          step="any"
          min={0}
          value={schematicDensity}
          onChange={(e) => setSchematicDensity(e.target.value)}
          hint="Applied as Given current density on all metal rows for this signal"
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">To cell</span>
          <input
            list="edit-signal-to-cells"
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={toCell}
            onChange={(e) => setToCell(e.target.value)}
            placeholder="Select or type cell name"
          />
          <datalist id="edit-signal-to-cells">
            {allCells.map((c) => (
              <option key={`to-${c}`} value={c} />
            ))}
          </datalist>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={() => void handleSave()}>Save changes</Button>
        </div>
      </div>
    </Modal>
  )
}
