import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { NoteDescriptionField, type NoteDescriptionMode } from '@components/notes/NoteDescriptionField'
import { SearchableEmployeeMultiSelect } from '@components/notes/SearchableEmployeeMultiSelect'
import { SearchableProjectSelect } from '@components/notes/SearchableProjectSelect'
import { createChildBlock } from '@/services/notesService'
import type { DailyNoteBlock, NoteProjectOption } from '@/types/notes'
import type { Employee } from '@/types'
import { employeesAvailableForProjectDay } from '@/utils/notesBootstrap'
import {
  descriptionModeToPlainText,
  plainTextToNoteHtml,
  plainTextToPoints,
} from '@/utils/notesPlainText'

type Props = {
  block: DailyNoteBlock
  projects: NoteProjectOption[]
  employees: Employee[]
  isOpen: boolean
  onClose: () => void
  onSaved: (block: DailyNoteBlock) => void
  onError: (message: string) => void
}

const EMPTY_FORM = {
  projectId: '',
  employeeIds: [] as string[],
  paragraph: '',
  points: [] as string[],
  descriptionMode: 'paragraph' as NoteDescriptionMode,
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

  const selectableEmployees = useMemo(() => {
    if (!form.projectId) return []
    return employeesAvailableForProjectDay(employees, block, form.projectId)
  }, [block, employees, form.projectId])

  const descriptionText = useMemo(
    () => descriptionModeToPlainText(form.descriptionMode, form.paragraph, form.points),
    [form.descriptionMode, form.paragraph, form.points],
  )

  const canSave = Boolean(
    form.projectId && form.employeeIds.length > 0 && descriptionText.trim(),
  )

  const handleProjectChange = (projectId: string) => {
    setForm((current) => ({
      ...current,
      projectId,
      employeeIds: [],
    }))
  }

  const handleModeChange = (mode: NoteDescriptionMode) => {
    setForm((current) => {
      if (mode === current.descriptionMode) return current
      if (mode === 'points') {
        const seed = current.paragraph.trim() || descriptionModeToPlainText('paragraph', current.paragraph, current.points)
        const points = plainTextToPoints(seed)
        return {
          ...current,
          descriptionMode: mode,
          points: points.length > 0 ? points : [''],
        }
      }
      const paragraph =
        current.paragraph.trim() ||
        descriptionModeToPlainText('points', current.paragraph, current.points)
      return { ...current, descriptionMode: mode, paragraph }
    })
  }

  const handleSave = async () => {
    if (!canSave || !selectedProject) return

    setSaving(true)
    try {
      const updated = await createChildBlock(block._id, {
        title: selectedProject.name,
        projectId: form.projectId,
        employeeIds: form.employeeIds,
        description: plainTextToNoteHtml(descriptionText.trim()),
        includeInEmail: true,
      })
      onSaved(updated)
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      onError(axiosErr.response?.data?.error || 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  const noneAvailable = Boolean(form.projectId) && selectableEmployees.length === 0

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
        Choose a project and one or more employees, then enter the work update. Each employee can
        only have one note per project per day. Remove an employee in edit to assign them on another
        project.
      </p>

      <div className="add-note-modal__form">
        <SearchableProjectSelect
          label="Project"
          value={form.projectId}
          projects={projects}
          onChange={handleProjectChange}
        />

        <SearchableEmployeeMultiSelect
          label="Employees"
          value={form.employeeIds}
          employees={selectableEmployees}
          disabled={!form.projectId || noneAvailable}
          onChange={(employeeIds) => setForm((current) => ({ ...current, employeeIds }))}
        />
        {noneAvailable ? (
          <p className="add-note-modal__availability-hint">
            Every employee already has a note on this project for today.
          </p>
        ) : null}

        <NoteDescriptionField
          mode={form.descriptionMode}
          onModeChange={handleModeChange}
          paragraphValue={form.paragraph}
          onParagraphChange={(paragraph) => setForm((current) => ({ ...current, paragraph }))}
          points={form.points}
          onPointsChange={(points) => setForm((current) => ({ ...current, points }))}
        />
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
