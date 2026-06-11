import { useEffect, useState } from 'react'
import { EMPTY_CHECKLIST_EXTENSION } from '@/types/projectWorkspace'
import {
  completeMyCell,
  updateMyCellChecklistExtension,
} from '@services/employeeProjectService'
import { Button } from '@components/employee/ui/button'
import { useToast } from '@components/employee/shared/ToastProvider'
import { cn } from '@pages/employee/lib/utils'
import { isChecklistExtensionComplete } from '@/utils/checklistExtensionUtils'

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes', className: 'is-yes' },
  { value: 'no', label: 'No', className: 'is-no' },
]

function YesNoField({ label, field, value, disabled, onSelect }) {
  return (
    <div className="emp-wf-final-cell-field">
      <span className="emp-wf-final-cell-label">{label}</span>
      <div className="emp-wf-final-cell-toggle" role="group" aria-label={label}>
        {YES_NO_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              'emp-wf-final-cell-toggle-btn',
              value === option.value && 'is-selected',
              value === option.value && option.className,
            )}
            disabled={disabled}
            onClick={() => onSelect(field, option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function EmployeeFinalCellDetailsSection({
  projectId,
  cellId,
  checklist,
  cellStatus = 'ready',
  readOnly = false,
  showCompletionRequirement = false,
  onChange,
  onCellCompleted,
}) {
  const extension = checklist?.extension ?? EMPTY_CHECKLIST_EXTENSION
  const checklistComplete = checklist?.isFilled ?? false
  const totalCount = checklist?.items?.length ?? 0
  const hasChecklistConfigured = Boolean(checklist?.hasFile || totalCount > 0)
  const locked = hasChecklistConfigured && totalCount > 0 && !checklistComplete
  const [drafts, setDrafts] = useState({
    dimensionX: '',
    dimensionY: '',
    highestMetalUsed: '',
  })
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(cellStatus === 'completed')
  const { toast } = useToast()

  useEffect(() => {
    setCompleted(cellStatus === 'completed')
  }, [cellStatus])

  useEffect(() => {
    setDrafts({
      dimensionX: extension.dimensionX != null ? String(extension.dimensionX) : '',
      dimensionY: extension.dimensionY != null ? String(extension.dimensionY) : '',
      highestMetalUsed: extension.highestMetalUsed ?? '',
    })
  }, [extension.dimensionX, extension.dimensionY, extension.highestMetalUsed])

  const saveExtension = async (payload) => {
    if (readOnly || locked) return
    setSaving(true)
    try {
      const data = await updateMyCellChecklistExtension(projectId, cellId, payload)
      onChange?.(data)
    } catch (err) {
      const message = err?.response?.data?.error
      toast({ title: 'Error', description: message || 'Failed to save final cell details' })
    } finally {
      setSaving(false)
    }
  }

  const handleDimensionBlur = (field) => {
    const raw = drafts[field].trim()
    const current = extension[field]

    if (raw === '') {
      if (current != null) void saveExtension({ [field]: null })
      return
    }

    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      toast({ title: 'Invalid value', description: 'Enter a valid number' })
      setDrafts((prev) => ({
        ...prev,
        [field]: current != null ? String(current) : '',
      }))
      return
    }

    if (current === parsed) return
    void saveExtension({ [field]: parsed })
  }

  const handleHighestMetalBlur = () => {
    const raw = drafts.highestMetalUsed.trim()
    if (raw === extension.highestMetalUsed) return
    void saveExtension({ highestMetalUsed: raw })
  }

  const handleYesNo = (field, value) => {
    if (extension[field] === value) return
    void saveExtension({ [field]: value })
  }

  const parsedX = drafts.dimensionX.trim() === '' ? null : Number(drafts.dimensionX)
  const parsedY = drafts.dimensionY.trim() === '' ? null : Number(drafts.dimensionY)
  const displayArea =
    parsedX != null && parsedY != null && Number.isFinite(parsedX) && Number.isFinite(parsedY)
      ? parsedX * parsedY
      : extension.area

  const fieldsDisabled = readOnly || locked || saving || completing
  const extensionComplete = isChecklistExtensionComplete(extension)
  const isCellCompleted = cellStatus === 'completed' || completed
  const canComplete =
    showCompletionRequirement &&
    !readOnly &&
    checklistComplete &&
    extensionComplete &&
    !isCellCompleted

  const handleComplete = async () => {
    if (!canComplete) return
    setCompleting(true)
    try {
      const updatedCell = await completeMyCell(projectId, cellId)
      setCompleted(true)
      onCellCompleted?.(updatedCell)
      toast({ title: 'Cell completed', description: 'This cell has been marked complete.' })
    } catch (err) {
      const data = err?.response?.data
      if (data?.missing?.length) {
        toast({
          title: 'Cannot complete yet',
          description: `Complete all sections first: ${data.missing.join(', ')}`,
        })
      } else {
        toast({ title: 'Error', description: data?.error || 'Failed to complete cell' })
      }
    } finally {
      setCompleting(false)
    }
  }

  if (!hasChecklistConfigured) return null

  return (
    <section
      className={cn('emp-wf-final-cell-details', locked && 'is-locked')}
      aria-label="Final cell details"
    >
      <div className="emp-wf-final-cell-details-head">
        <h3 className="emp-wf-final-cell-details-title">Final Cell Details</h3>
        <p className="emp-wf-final-cell-details-subtitle">
          Fill in after the checklist is completed. These are not checklist questions.
        </p>
      </div>

      {locked ? (
        <p className="emp-wf-final-cell-details-lock-note">
          Complete all checklist questions first ({checklist?.items?.filter((item) => item.response).length ?? 0}/
          {totalCount} answered).
        </p>
      ) : showCompletionRequirement && !extensionComplete ? (
        <p className="emp-wf-final-cell-details-lock-note is-warning">
          Complete all final cell details before completing the final stage.
        </p>
      ) : null}

      <div className="emp-wf-final-cell-details-form">
        <div className="emp-wf-final-cell-row emp-wf-final-cell-row--3">
          <div className="emp-wf-final-cell-field">
            <label className="emp-wf-final-cell-label" htmlFor="emp-final-cell-dimension-x">
              Dimension X
            </label>
            <input
              id="emp-final-cell-dimension-x"
              type="number"
              step="any"
              className="emp-wf-final-cell-input"
              value={drafts.dimensionX}
              placeholder="Enter value"
              disabled={fieldsDisabled}
              onChange={(e) => setDrafts((prev) => ({ ...prev, dimensionX: e.target.value }))}
              onBlur={() => handleDimensionBlur('dimensionX')}
            />
          </div>
          <div className="emp-wf-final-cell-field">
            <label className="emp-wf-final-cell-label" htmlFor="emp-final-cell-dimension-y">
              Dimension Y
            </label>
            <input
              id="emp-final-cell-dimension-y"
              type="number"
              step="any"
              className="emp-wf-final-cell-input"
              value={drafts.dimensionY}
              placeholder="Enter value"
              disabled={fieldsDisabled}
              onChange={(e) => setDrafts((prev) => ({ ...prev, dimensionY: e.target.value }))}
              onBlur={() => handleDimensionBlur('dimensionY')}
            />
          </div>
          <div className="emp-wf-final-cell-field">
            <span className="emp-wf-final-cell-label">Area</span>
            <span className="emp-wf-final-cell-hint">Dimension X × Dimension Y</span>
            <output className="emp-wf-final-cell-area" aria-live="polite">
              {displayArea != null ? displayArea : '—'}
            </output>
          </div>
        </div>

        <div className="emp-wf-final-cell-row emp-wf-final-cell-row--2">
          <div className="emp-wf-final-cell-field">
            <label className="emp-wf-final-cell-label" htmlFor="emp-final-cell-highest-metal">
              Highest Metal Used
            </label>
            <input
              id="emp-final-cell-highest-metal"
              type="text"
              className="emp-wf-final-cell-input"
              value={drafts.highestMetalUsed}
              placeholder="Enter metal layer"
              disabled={fieldsDisabled}
              onChange={(e) => setDrafts((prev) => ({ ...prev, highestMetalUsed: e.target.value }))}
              onBlur={handleHighestMetalBlur}
            />
          </div>
          <YesNoField
            label="Virtual Connection"
            field="virtualConnection"
            value={extension.virtualConnection}
            disabled={fieldsDisabled}
            onSelect={handleYesNo}
          />
        </div>

        <div className="emp-wf-final-cell-row emp-wf-final-cell-row--2">
          <YesNoField
            label="Overall Substrate Contact"
            field="overallSubstrateContact"
            value={extension.overallSubstrateContact}
            disabled={fieldsDisabled}
            onSelect={handleYesNo}
          />
          <YesNoField
            label="Waivable DRC Error"
            field="waivableDrcError"
            value={extension.waivableDrcError}
            disabled={fieldsDisabled}
            onSelect={handleYesNo}
          />
        </div>

        {showCompletionRequirement ? (
          <div className="emp-wf-final-cell-details-footer">
            <Button
              type="button"
              size="sm"
              className="emp-wf-final-cell-complete-btn"
              disabled={!canComplete || saving || completing}
              onClick={() => void handleComplete()}
            >
              {completing ? 'Completing…' : isCellCompleted ? 'Completed' : 'Complete cell'}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
