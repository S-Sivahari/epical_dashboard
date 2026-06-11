import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import type { ProjectCellTypeKey, ProjectCellsByType } from '@/types/pdkMetalRouting'
const CELL_TYPES: ProjectCellTypeKey[] = ['BLOCK', 'IO', 'ESD', 'TOP']

export function AddSignalModal({
  isOpen,
  onClose,
  cellsByType,
  onSubmit,
  submitting,
}: {
  isOpen: boolean
  onClose: () => void
  cellsByType: ProjectCellsByType
  onSubmit: (payload: {
    signal: string
    fromCell: string
    toCell: string
    schematicCurrentDensity: number
  }) => Promise<void>
  submitting: boolean
}) {
  const [step, setStep] = useState<
    'signal' | 'schematic' | 'fromType' | 'fromCell' | 'toType' | 'toCell'
  >('signal')
  const [signal, setSignal] = useState('')
  const [schematicDensity, setSchematicDensity] = useState('')
  const [fromType, setFromType] = useState<ProjectCellTypeKey | ''>('')
  const [fromCell, setFromCell] = useState('')
  const [toType, setToType] = useState<ProjectCellTypeKey | ''>('')
  const [toCell, setToCell] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setStep('signal')
      setSignal('')
      setSchematicDensity('')
      setFromType('')
      setFromCell('')
      setToType('')
      setToCell('')
    }
  }, [isOpen])

  const fromCells = fromType ? cellsByType[fromType] : []
  const toCells = toType ? cellsByType[toType] : []

  const handleNextFromSignal = () => {
    if (!signal.trim()) {
      toast.error('Enter a signal name')
      return
    }
    setStep('schematic')
  }

  const handleNextFromSchematic = () => {
    const schematic = Number(schematicDensity)
    if (!schematicDensity.trim() || !Number.isFinite(schematic) || schematic < 0) {
      toast.error('Enter a valid schematic current density (mA/µm)')
      return
    }
    setStep('fromType')
  }

  const handlePickFromType = (type: ProjectCellTypeKey) => {
    setFromType(type)
    setFromCell('')
    setStep('fromCell')
  }

  const handleContinueFromCell = () => {
    if (!fromCell.trim()) {
      toast.error('Select or enter a from cell')
      return
    }
    setStep('toType')
  }

  const handlePickToType = (type: ProjectCellTypeKey) => {
    setToType(type)
    setToCell('')
    setStep('toCell')
  }

  const handleFinish = async () => {
    if (!toCell.trim()) {
      toast.error('Select or enter a to cell')
      return
    }
    const schematic = Number(schematicDensity)
    if (!signal.trim() || !fromCell.trim() || !Number.isFinite(schematic) || schematic < 0) return
    await onSubmit({
      signal: signal.trim(),
      fromCell: fromCell.trim(),
      toCell: toCell.trim(),
      schematicCurrentDensity: schematic,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add signal" size="md">
      <div className="space-y-4">
        {step === 'signal' ? (
          <>
            <Input
              label="Signal name"
              value={signal}
              onChange={(e) => setSignal(e.target.value)}
              placeholder="e.g. CLK_MAIN"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleNextFromSignal}>Continue</Button>
            </div>
          </>
        ) : null}

        {step === 'schematic' ? (
          <>
            <p className="text-sm text-muted">
              Schematic current density for <strong className="text-ink">{signal}</strong>
            </p>
            <Input
              label="Schematic current density (mA/µm)"
              type="number"
              step="any"
              min={0}
              value={schematicDensity}
              onChange={(e) => setSchematicDensity(e.target.value)}
              placeholder="e.g. 1.2"
              hint="Applied as Given current density on every metal row for this signal"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep('signal')}>Back</Button>
              <Button onClick={handleNextFromSchematic}>Continue</Button>
            </div>
          </>
        ) : null}

        {step === 'fromType' ? (
          <>
            <p className="text-sm text-muted">Select from cell type for <strong className="text-ink">{signal}</strong></p>
            <div className="grid grid-cols-2 gap-2">
              {CELL_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink hover:border-primary hover:bg-primary/5"
                  onClick={() => handlePickFromType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 'fromCell' ? (
          <>
            <p className="text-sm text-muted">
              From cell ({fromType}) for <strong className="text-ink">{signal}</strong>
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Select from project cells</span>
              <select
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                value={fromCells.includes(fromCell) ? fromCell : ''}
                onChange={(e) => setFromCell(e.target.value)}
              >
                <option value="">— Pick a cell —</option>
                {fromCells.map((cell) => (
                  <option key={cell} value={cell}>{cell}</option>
                ))}
              </select>
            </label>
            <Input
              label="Or type cell name"
              value={fromCell}
              onChange={(e) => setFromCell(e.target.value)}
              placeholder="Cell name"
            />
            {fromCells.length === 0 ? (
              <p className="text-sm text-amber-700">No cells of type {fromType} in this project — type the name manually.</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep('fromType')}>Back</Button>
              <Button onClick={handleContinueFromCell}>Continue</Button>
            </div>
          </>
        ) : null}

        {step === 'toType' ? (
          <>
            <p className="text-sm text-muted">
              Select to cell type — {signal}: {fromCell} → …
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CELL_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary hover:bg-primary/5"
                  onClick={() => handlePickToType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 'toCell' ? (
          <>
            <p className="text-sm text-muted">
              To cell ({toType}) — {signal}: {fromCell} → …
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Select from project cells</span>
              <select
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                value={toCells.includes(toCell) ? toCell : ''}
                onChange={(e) => setToCell(e.target.value)}
              >
                <option value="">— Pick a cell —</option>
                {toCells.map((cell) => (
                  <option key={cell} value={cell}>{cell}</option>
                ))}
              </select>
            </label>
            <Input
              label="Or type cell name"
              value={toCell}
              onChange={(e) => setToCell(e.target.value)}
              placeholder="Cell name"
            />
            {toCells.length === 0 ? (
              <p className="text-sm text-amber-700">No cells of type {toType} — type the name manually.</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep('toType')}>Back</Button>
              <Button loading={submitting} onClick={() => void handleFinish()}>Create signal</Button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}
