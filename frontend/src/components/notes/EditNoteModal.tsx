import { useEffect, useMemo, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { NoteDescriptionField, type NoteDescriptionMode } from '@components/notes/NoteDescriptionField'
import { SearchableEmployeeMultiSelect } from '@components/notes/SearchableEmployeeMultiSelect'
import { updateChildBlock } from '@/services/notesService'
import type { DailyNoteBlock, NoteChildBlock } from '@/types/notes'
import type { Employee } from '@/types'
import { employeesSelectableForNoteEdit, entryEmployeeKeys } from '@/utils/notesBootstrap'
import {
  descriptionModeToPlainText,
  inferDescriptionMode,
  noteHtmlToPlainText,
  plainTextToNoteHtml,
  plainTextToPoints,
} from '@/utils/notesPlainText'

type Props = {
  block: DailyNoteBlock
  entry: NoteChildBlock
  employees: Employee[]
  isOpen: boolean
  onClose: () => void
  onSaved: (block: DailyNoteBlock) => void
  onError: (message: string) => void
}

export function EditNoteModal({
  block,
  entry,
  employees,
  isOpen,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [descriptionMode, setDescriptionMode] = useState<NoteDescriptionMode>('paragraph')
  const [paragraph, setParagraph] = useState('')
  const [points, setPoints] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const plain = noteHtmlToPlainText(entry.description)
    const mode = inferDescriptionMode(plain)
    setEmployeeIds(entryEmployeeKeys(entry))
    setDescriptionMode(mode)
    setParagraph(mode === 'paragraph' ? plain : '')
    setPoints(mode === 'points' ? plainTextToPoints(plain) : [])
  }, [isOpen, entry])

  const selectableEmployees = useMemo(
    () => employeesSelectableForNoteEdit(employees, block, entry),
    [block, employees, entry],
  )

  const descriptionText = useMemo(
    () => descriptionModeToPlainText(descriptionMode, paragraph, points),
    [descriptionMode, paragraph, points],
  )

  const canSave = employeeIds.length > 0 && descriptionText.trim().length > 0

  const handleModeChange = (mode: NoteDescriptionMode) => {
    if (mode === descriptionMode) return
    if (mode === 'points') {
      const seed = paragraph.trim() || descriptionModeToPlainText('paragraph', paragraph, points)
      const nextPoints = plainTextToPoints(seed)
      setDescriptionMode(mode)
      setPoints(nextPoints.length > 0 ? nextPoints : [''])
      return
    }
    const nextParagraph =
      paragraph.trim() || descriptionModeToPlainText('points', paragraph, points)
    setDescriptionMode(mode)
    setParagraph(nextParagraph)
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const updated = await updateChildBlock(block._id, entry._id, {
        employeeIds,
        description: plainTextToNoteHtml(descriptionText.trim()),
        includeInEmail: true,
      })
      onSaved(updated)
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      onError(axiosErr.response?.data?.error || 'Failed to update note')
    } finally {
      setSaving(false)
    }
  }

  const projectLabel = entry.projectName || entry.title

  return (
    <Modal
      isOpen={isOpen}
      title="Edit note"
      onClose={onClose}
      size="xl"
      modal
      className="add-note-modal"
    >
      <p className="add-note-modal__hint">
        Update employees and the work note for this project. Remove employees here to assign them
        on a different project note. Switch between paragraph and points as needed.
      </p>

      <div className="add-note-modal__form">
        <div className="admin-notes-field">
          <span className="admin-notes-field__label">Project</span>
          <p className="add-note-modal__readonly-value">{projectLabel}</p>
        </div>

        <SearchableEmployeeMultiSelect
          label="Employees"
          value={employeeIds}
          employees={selectableEmployees}
          onChange={setEmployeeIds}
        />

        <NoteDescriptionField
          mode={descriptionMode}
          onModeChange={handleModeChange}
          paragraphValue={paragraph}
          onParagraphChange={setParagraph}
          points={points}
          onPointsChange={setPoints}
        />
      </div>

      <div className="add-note-modal__actions">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          disabled={!canSave || saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </Modal>
  )
}
