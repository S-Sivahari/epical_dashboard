import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { Button } from '@components/ui/Button'
import {
  createChildBlock,
  deleteChildBlock,
  updateChildBlock,
} from '@/services/notesService'
import type { DailyNoteBlock, NoteProjectOption } from '@/types/notes'
import type { Employee } from '@/types'
import { matchExistingEntry, parseNotepadText, serializeBlockToNotepadText } from '@/utils/notepadDocument'
import { plainTextToNoteHtml } from '@/utils/notesPlainText'

type Props = {
  block: DailyNoteBlock
  projects: NoteProjectOption[]
  employees: Employee[]
  onSaved: (block: DailyNoteBlock) => void
  onCancel: () => void
  onError: (message: string) => void
}

export function DailyNotesInlineEditor({
  block,
  projects,
  employees,
  onSaved,
  onCancel,
  onError,
}: Props) {
  const initialText = useMemo(() => {
    const active = block.childBlocks
      .filter((child) => !child.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return serializeBlockToNotepadText(active)
  }, [block, projects])

  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setText(initialText)
    setWarnings([])
  }, [initialText])

  const handleSave = async () => {
    const parsed = parseNotepadText(text, projects, employees)
    if (parsed.entries.some((entry) => entry.employeeIds.length === 0)) {
      onError('Each note needs at least one recognized employee name.')
      return
    }

    setWarnings(parsed.warnings)
    setSaving(true)

    try {
      let currentBlock = block
      const activeEntries = block.childBlocks.filter((child) => !child.archived)
      const matchedIds = new Set<string>()

      for (const draft of parsed.entries) {
        const existing = matchExistingEntry(activeEntries, draft)
        const descriptionHtml = plainTextToNoteHtml(draft.description)

        if (existing) {
          matchedIds.add(existing._id)
          currentBlock = await updateChildBlock(block._id, existing._id, {
            title: draft.projectName,
            projectId: draft.projectId,
            employeeIds: draft.employeeIds,
            description: descriptionHtml,
            includeInEmail: true,
          })
        } else {
          currentBlock = await createChildBlock(block._id, {
            title: draft.projectName,
            projectId: draft.projectId,
            employeeIds: draft.employeeIds,
            description: descriptionHtml,
            includeInEmail: true,
          })
        }
      }

      for (const entry of activeEntries) {
        if (!matchedIds.has(entry._id)) {
          currentBlock = await deleteChildBlock(block._id, entry._id)
        }
      }

      onSaved(currentBlock)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      onError(axiosErr.response?.data?.error || 'Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="notes-notepad-inline-editor">
      <p className="notes-notepad-inline-editor__hint">
        Type project headings (e.g. <code>APOLLO:</code>), employee names, then note lines starting with{' '}
        <code>--</code>.
      </p>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="notes-notepad-inline-editor__textarea--solo"
        spellCheck
      />

      {warnings.length > 0 ? (
        <ul className="notes-notepad-inline-editor__warnings">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="notes-notepad-inline-editor__actions">
        <Button type="button" variant="secondary" icon={<X className="h-4 w-4" />} onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          icon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
