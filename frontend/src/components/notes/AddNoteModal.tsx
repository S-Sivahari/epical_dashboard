import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { SearchableEmployeeSelect } from '@components/notes/SearchableEmployeeSelect'
import { SearchableProjectSelect } from '@components/notes/SearchableProjectSelect'
import { createChildBlock, updateChildBlock } from '@/services/notesService'
import type { DailyNoteBlock, NoteProjectEmployee, NoteProjectOption } from '@/types/notes'
import { findEntryForProjectEmployee } from '@/utils/notesBootstrap'
import { noteHtmlToPlainText, plainTextToNoteHtml } from '@/utils/notesPlainText'

type Props = {
  block: DailyNoteBlock
  projects: NoteProjectOption[]
  employees: NoteProjectEmployee[]
  isOpen: boolean
  onClose: () => void
  onSaved: (block: DailyNoteBlock) => void
  onError: (message: string) => void
}

const EMPTY_FORM = {
  projectId: '',
  employeeId: '',
  description: '',
}

export function AddNoteModal({
  block,
  projects,
  employees,
  isOpen,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) setForm(EMPTY_FORM)
  }, [isOpen])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === form.projectId) ?? null,
    [projects, form.projectId],
  )

  const canSave = Boolean(form.projectId && form.employeeId && form.description.trim())

  const handleSave = async () => {
    if (!canSave || !selectedProject) return

    const employee = employees.find((item) => item.id === form.employeeId)
    if (!employee) return

    const descriptionText = form.description.trim()
    setSaving(true)
    try {
      const existing = findEntryForProjectEmployee(block, form.projectId, form.employeeId)
      let updated: DailyNoteBlock

      if (existing) {
        const current = noteHtmlToPlainText(existing.description)
        const combined = current ? `${current}\n${descriptionText}` : descriptionText
        updated = await updateChildBlock(block._id, existing._id, {
          description: plainTextToNoteHtml(combined),
          includeInEmail: true,
        })
      } else {
        updated = await createChildBlock(block._id, {
          title: selectedProject.name,
          projectId: form.projectId,
          employeeIds: [form.employeeId],
          description: plainTextToNoteHtml(descriptionText),
          includeInEmail: true,
        })
      }

      onSaved(updated)
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      onError(axiosErr.response?.data?.error || 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Add note"
      onClose={onClose}
      size="xl"
      modal
      className="add-note-modal"
    >
      <p className="add-note-modal__hint">
        Choose a project and employee, then enter the work update. Notes for the same project and
        employee are grouped together.
      </p>

      <div className="add-note-modal__form">
        <SearchableProjectSelect
          label="Project"
          value={form.projectId}
          projects={projects}
          onChange={(projectId) => setForm((current) => ({ ...current, projectId }))}
        />

        <SearchableEmployeeSelect
          label="Employee"
          value={form.employeeId}
          employees={employees}
          onChange={(employeeId) => setForm((current) => ({ ...current, employeeId }))}
        />

        <label className="add-note-modal__description">
          <span className="admin-notes-field__label">Description</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
            placeholder="Enter work updates…"
            rows={4}
            className="add-note-modal__textarea"
          />
        </label>
      </div>

      <div className="add-note-modal__actions">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          disabled={!canSave || saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Add note'}
        </Button>
      </div>
    </Modal>
  )
}
