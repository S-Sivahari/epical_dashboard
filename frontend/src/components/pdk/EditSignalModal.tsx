import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { CellCombobox } from '@components/pdk/CellCombobox'
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
  const [formError, setFormError] = useState<string | null>(null)

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
      setFormError('Signal name is required')
      return
    }
    if (!fromCell.trim() || !toCell.trim()) {
      setFormError('From cell and to cell are required')
      return
    }
    const schematic = schematicDensity.trim() ? Number(schematicDensity) : undefined
    if (schematic != null && (!Number.isFinite(schematic) || schematic < 0)) {
      setFormError('Enter a valid given current capability')
      return
    }
    setFormError(null)
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
        <CellCombobox
          id="edit-signal-from-cell"
          label="From cell"
          value={fromCell}
          onChange={setFromCell}
          options={allCells}
        />
        <div className="space-y-1.5">
          <Input
            label="Given current capability (mA/µm)"
            type="number"
            step="any"
            min={0}
            value={schematicDensity}
            onChange={(e) => setSchematicDensity(e.target.value)}
          />
          <p className="text-xs text-muted">
            Applied as given current capability on all metal rows for this signal.
          </p>
        </div>
        <CellCombobox
          id="edit-signal-to-cell"
          label="To cell"
          value={toCell}
          onChange={setToCell}
          options={allCells}
        />
        {formError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={() => void handleSave()}>Save changes</Button>
        </div>
      </div>
    </Modal>
  )
}
