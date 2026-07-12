import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { Modal } from '@components/ui/Modal'
import { DateInput } from '@components/shared/DateInput'
import { getDailyBlockByDateForCopy } from '@/services/notesService'
import type { DailyNoteBlock } from '@/types/notes'
import {
  blockHasActiveNotes,
  findLatestBlockWithNotesBefore,
  toDateKey,
} from '@/utils/notesWeek'

type Props = {
  isOpen: boolean
  targetDateKey: string
  todayHasNotes: boolean
  blocksByDate: Record<string, DailyNoteBlock | null | undefined>
  busy?: boolean
  onClose: () => void
  onCopy: (sourceDateKey: string) => void
}

function dayBefore(dateKey: string): string {
  return toDateKey(subDays(parseISO(dateKey), 1))
}

function formatSourceLabel(dateKey: string): string {
  try {
    return format(parseISO(dateKey), 'EEE dd MMM yyyy')
  } catch {
    return dateKey
  }
}

export function CopyNotesFromDateModal({
  isOpen,
  targetDateKey,
  todayHasNotes,
  blocksByDate,
  busy = false,
  onClose,
  onCopy,
}: Props) {
  const maxSourceDateKey = dayBefore(targetDateKey)

  const defaultSourceDateKey = useMemo(() => {
    const latest = findLatestBlockWithNotesBefore(targetDateKey, blocksByDate)
    if (latest) return latest.date
    return maxSourceDateKey
  }, [targetDateKey, blocksByDate, maxSourceDateKey])

  const [sourceDateKey, setSourceDateKey] = useState(defaultSourceDateKey)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewNoteCount, setPreviewNoteCount] = useState<number | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setSourceDateKey(defaultSourceDateKey)
  }, [isOpen, defaultSourceDateKey])

  useEffect(() => {
    if (!isOpen || !sourceDateKey) {
      setPreviewNoteCount(null)
      setPreviewError(null)
      return
    }

    const cached = blocksByDate[sourceDateKey]
    if (cached && blockHasActiveNotes(cached)) {
      setPreviewNoteCount(cached.childBlocks.filter((child) => !child.archived).length)
      setPreviewError(null)
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    void getDailyBlockByDateForCopy(sourceDateKey, targetDateKey)
      .then((block) => {
        if (cancelled) return
        const count = block.childBlocks.filter((child) => !child.archived).length
        setPreviewNoteCount(count)
        if (count === 0) {
          setPreviewError('No notes were found for this day.')
        }
      })
      .catch(() => {
        if (cancelled) return
        setPreviewNoteCount(0)
        setPreviewError('No notes were found for this day.')
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, sourceDateKey, targetDateKey, blocksByDate])

  const canCopy =
    Boolean(sourceDateKey) &&
    sourceDateKey < targetDateKey &&
    !previewLoading &&
    !previewError &&
    (previewNoteCount ?? 0) > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose()
      }}
      title="Copy notes from another day"
      size="md"
    >
      <p className="mb-4 text-sm leading-relaxed text-slate-600">
        Choose a previous day to copy its notes into today
        {todayHasNotes ? (
          <>
            . This will <strong>replace all of today&apos;s notes</strong> with the selected day&apos;s
            entries.
          </>
        ) : (
          '.'
        )}
      </p>

      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="copy-notes-source-date">
          Copy from
        </label>
        <DateInput
          id="copy-notes-source-date"
          value={sourceDateKey}
          maxDate={maxSourceDateKey}
          onChange={setSourceDateKey}
          disabled={busy}
        />
      </div>

      <div className="mb-5 min-h-[1.25rem] text-sm text-slate-600" aria-live="polite">
        {previewLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Checking notes for {formatSourceLabel(sourceDateKey)}…
          </span>
        ) : previewError ? (
          <span className="text-amber-700">{previewError}</span>
        ) : previewNoteCount != null ? (
          <span>
            {previewNoteCount} note{previewNoteCount === 1 ? '' : 's'} on {formatSourceLabel(sourceDateKey)}
          </span>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canCopy || busy}
          loading={busy}
          onClick={() => onCopy(sourceDateKey)}
        >
          {todayHasNotes ? "Replace today's notes" : 'Copy notes'}
        </Button>
      </div>
    </Modal>
  )
}
