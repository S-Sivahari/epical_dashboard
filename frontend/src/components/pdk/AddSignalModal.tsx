import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@components/ui/Modal'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { CellCombobox } from '@components/pdk/CellCombobox'
import { resolveRoute } from '@services/pdkMetalRoutingService'
import type { ProjectCellTypeKey, ProjectCellsByType } from '@/types/pdkMetalRouting'

const CELL_TYPES: ProjectCellTypeKey[] = ['BLOCK', 'IO', 'ESD', 'TOP']

type WizardDraft = {
  signal: string
  schematicDensity: string
  fromType: ProjectCellTypeKey | ''
  fromCell: string
  toType: ProjectCellTypeKey | ''
  toCell: string
}

function readApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error
    if (message) return message
  }
  return fallback
}

export function AddSignalModal({
  isOpen,
  onClose,
  projectId,
  basePath,
  cellsByType,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  projectId: string
  basePath: string
  cellsByType: ProjectCellsByType
  onCreated?: () => void | Promise<void>
}) {
  const navigate = useNavigate()
  const draftRef = useRef<WizardDraft>({
    signal: '',
    schematicDensity: '',
    fromType: '',
    fromCell: '',
    toType: '',
    toCell: '',
  })

  const [step, setStep] = useState<
    'signal' | 'schematic' | 'fromType' | 'fromCell' | 'toType' | 'toCell'
  >('signal')
  const [signal, setSignal] = useState('')
  const [schematicDensity, setSchematicDensity] = useState('')
  const [fromType, setFromType] = useState<ProjectCellTypeKey | ''>('')
  const [fromCell, setFromCell] = useState('')
  const [toType, setToType] = useState<ProjectCellTypeKey | ''>('')
  const [toCell, setToCell] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const syncDraft = (patch: Partial<WizardDraft>) => {
    draftRef.current = { ...draftRef.current, ...patch }
  }

  useEffect(() => {
    draftRef.current = {
      signal,
      schematicDensity,
      fromType,
      fromCell,
      toType,
      toCell,
    }
  }, [signal, schematicDensity, fromType, fromCell, toType, toCell])

  useEffect(() => {
    if (!isOpen) {
      setStep('signal')
      setSignal('')
      setSchematicDensity('')
      setFromType('')
      setFromCell('')
      setToType('')
      setToCell('')
      setSubmitting(false)
      setFormError(null)
      draftRef.current = {
        signal: '',
        schematicDensity: '',
        fromType: '',
        fromCell: '',
        toType: '',
        toCell: '',
      }
    }
  }, [isOpen])

  const fromCells = fromType ? cellsByType[fromType] : []
  const toCells = toType ? cellsByType[toType] : []

  const handleNextFromSignal = () => {
    if (!signal.trim()) {
      setFormError('Enter a signal name')
      return
    }
    setFormError(null)
    setStep('schematic')
  }

  const handleNextFromSchematic = () => {
    const schematic = Number(schematicDensity)
    if (!schematicDensity.trim() || !Number.isFinite(schematic) || schematic < 0) {
      setFormError('Enter a valid given current capability (mA/µm)')
      return
    }
    setFormError(null)
    setStep('fromType')
  }

  const handlePickFromType = (type: ProjectCellTypeKey) => {
    setFromType(type)
    setFromCell('')
    syncDraft({ fromType: type, fromCell: '' })
    setFormError(null)
    setStep('fromCell')
  }

  const handleContinueFromCell = () => {
    if (!fromCell.trim()) {
      setFormError('Select or enter a from cell')
      return
    }
    setFormError(null)
    setStep('toType')
  }

  const handlePickToType = (type: ProjectCellTypeKey) => {
    setToType(type)
    setToCell('')
    syncDraft({ toType: type, toCell: '' })
    setFormError(null)
    setStep('toCell')
  }

  const handleCreate = async () => {
    setFormError(null)

    const draft = draftRef.current
    const resolvedSignal = draft.signal.trim() || signal.trim()
    const resolvedFromCell = draft.fromCell.trim() || fromCell.trim()
    const resolvedToCell = draft.toCell.trim() || toCell.trim()
    const resolvedSchematicRaw = draft.schematicDensity.trim() || schematicDensity.trim()

    if (!projectId) {
      setFormError('Project not found')
      return
    }
    if (!resolvedToCell) {
      setFormError('Select or enter a to cell')
      return
    }
    if (!resolvedSignal) {
      setFormError('Signal name is required')
      return
    }
    if (!resolvedFromCell) {
      setFormError('From cell is required')
      return
    }

    const schematic = Number(resolvedSchematicRaw)
    if (!resolvedSchematicRaw || !Number.isFinite(schematic) || schematic < 0) {
      setFormError('Enter a valid given current capability (mA/µm)')
      return
    }

    const payload = {
      signal: resolvedSignal,
      fromCell: resolvedFromCell,
      toCell: resolvedToCell,
      schematicCurrentDensity: schematic,
    }

    setSubmitting(true)
    try {
      await resolveRoute({ projectId, ...payload })

      const params = new URLSearchParams({
        signal: payload.signal,
        fromCell: payload.fromCell,
        toCell: payload.toCell,
      })

      navigate(`${basePath}/projects/${projectId}/signal-analysis/route?${params.toString()}`)
      onClose()

      void (async () => {
        try {
          await onCreated?.()
        } catch {
          // Refresh failure should not block navigation after create.
        }
      })()
    } catch (err: unknown) {
      setFormError(readApiError(err, 'Failed to create signal route'))
    } finally {
      setSubmitting(false)
    }
  }

  const errorBanner = formError ? (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {formError}
    </p>
  ) : null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add signal" size="md" modal>
      <div className="space-y-4">
        {errorBanner}

        {step === 'signal' ? (
          <>
            <Input
              label="Signal name"
              value={signal}
              onChange={(e) => {
                setSignal(e.target.value)
                syncDraft({ signal: e.target.value })
              }}
              placeholder="e.g. CLK_MAIN"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="button" onClick={handleNextFromSignal}>Continue</Button>
            </div>
          </>
        ) : null}

        {step === 'schematic' ? (
          <>
            <p className="text-sm text-muted">
              Given current capability for <strong className="text-ink">{signal}</strong>
            </p>
            <Input
              label="Given current capability (mA/µm)"
              type="number"
              step="any"
              min={0}
              value={schematicDensity}
              onChange={(e) => {
                setSchematicDensity(e.target.value)
                syncDraft({ schematicDensity: e.target.value })
              }}
              placeholder="e.g. 1.2"
            />
            <p className="text-xs text-muted">
              Applied as given current capability on every metal row for this signal
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep('signal')}>Back</Button>
              <Button type="button" onClick={handleNextFromSchematic}>Continue</Button>
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
          <div className="space-y-4">
            <p className="text-sm text-muted">
              From cell ({fromType}) for <strong className="text-ink">{signal}</strong>
            </p>
            <CellCombobox
              id="add-signal-from-cell"
              label="From cell"
              value={fromCell}
              onChange={(value) => {
                setFromCell(value)
                syncDraft({ fromCell: value })
              }}
              options={fromCells}
            />
            {fromCells.length === 0 ? (
              <p className="text-sm text-amber-700">
                No cells of type {fromType} in this project — type the name manually.
              </p>
            ) : null}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" onClick={() => setStep('fromType')}>Back</Button>
              <Button type="button" onClick={handleContinueFromCell}>Continue</Button>
            </div>
          </div>
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
          <div className="space-y-4">
            <p className="text-sm text-muted">
              To cell ({toType}) — {signal}: {fromCell} → …
            </p>
            <CellCombobox
              id="add-signal-to-cell"
              label="To cell"
              value={toCell}
              onChange={(value) => {
                setToCell(value)
                syncDraft({ toCell: value })
              }}
              options={toCells}
            />
            {toCells.length === 0 ? (
              <p className="text-sm text-amber-700">
                No cells of type {toType} — type the name manually.
              </p>
            ) : null}
            <div
              data-signal-modal-actions
              className="flex justify-end gap-2 border-t border-border pt-4"
            >
              <Button type="button" variant="secondary" onClick={() => setStep('toType')}>
                Back
              </Button>
              <Button
                type="button"
                loading={submitting}
                disabled={submitting}
                onClick={() => void handleCreate()}
              >
                Create signal
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
