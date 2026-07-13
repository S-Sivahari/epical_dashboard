import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, Copy, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { AddNoteModal } from '@components/notes/AddNoteModal'
import { DailyNotesInlineEditor } from '@components/notes/DailyNotesInlineEditor'
import type { DailyNoteBlock, DailyNoteStatus, NoteChildBlock, NoteProjectOption } from '@/types/notes'
import type { Employee } from '@/types'
import { employeeNamesLabel, groupEntriesByProject } from '@/utils/notesBootstrap'
import { computeDayStats } from '@/utils/notesDashboardUtils'
import { formatNoteDisplayLine, noteHtmlToPlainText } from '@/utils/notesPlainText'
import { formatDailyBlockTitle, isPastNotesDay } from '@/utils/notesWeek'
import { cn } from '@/utils/cn'

function deliveryStatusLabel(status: DailyNoteStatus) {
  return status === 'email_sent' ? 'Email sent' : 'Not sent'
}

function employeeNamesDisplay(entry: NoteChildBlock, projects: NoteProjectOption[]): string {
  const names = employeeNamesLabel(entry)
  if (names !== '—') return names
  const project = projects.find((item) => item.id === entry.projectId)
  if (project?.visibleUsers?.length === 1) return project.visibleUsers[0]
  return 'Unassigned'
}

function descriptionLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

type Props = {
  date: Date
  dateKey: string
  block: DailyNoteBlock | null
  projects: NoteProjectOption[]
  employees: Employee[]
  highlighted?: boolean
  busy?: boolean
  canEdit?: boolean
  defaultExpanded?: boolean
  layout?: 'card' | 'panel'
  onBlockChange: (block: DailyNoteBlock) => void
  onSendEmail: (block: DailyNoteBlock) => void
  onDelete?: () => void
  autoOpenAddNote?: boolean
  onAutoOpenAddNoteHandled?: () => void
  onCopyLatest?: () => void
  onError: (message: string) => void
}

export function DailyNotesNotepad({
  date,
  dateKey,
  block,
  projects,
  employees,
  highlighted = false,
  busy = false,
  canEdit = true,
  defaultExpanded = false,
  layout = 'card',
  onBlockChange,
  onSendEmail,
  onDelete,
  autoOpenAddNote = false,
  onAutoOpenAddNoteHandled,
  onCopyLatest,
  onError,
}: Props) {
  const title = useMemo(() => formatDailyBlockTitle(date), [date])
  const isPanelLayout = layout === 'panel'
  const dayStats = useMemo(() => computeDayStats(block), [block])

  const entries = useMemo(() => {
    if (!block) return []
    return block.childBlocks
      .filter((child) => !child.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [block])

  const projectGroups = useMemo(() => {
    return groupEntriesByProject(entries).filter((group) =>
      group.entries.some((entry) => noteHtmlToPlainText(entry.description).trim()),
    )
  }, [entries])

  const [expanded, setExpanded] = useState(isPanelLayout || defaultExpanded || highlighted)
  const [isEditing, setIsEditing] = useState(false)
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (highlighted || isPanelLayout) setExpanded(true)
  }, [highlighted, isPanelLayout])

  const hasBlock = Boolean(block)
  const status = block?.status ?? 'draft'
  const isPastDay = isPastNotesDay(dateKey)
  const canEditNotes =
    hasBlock && block && !block.archived && !isPastDay && canEdit
  const canSendEmail =
    hasBlock && block && !block.archived && !isPastDay && canEdit
  const emailIncludeCount = entries.filter((entry) => entry.includeInEmail).length
  const hasNotes = entries.length > 0

  useEffect(() => {
    if (!canEditNotes) {
      setIsEditing(false)
      setAddNoteOpen(false)
    }
  }, [canEditNotes])

  useEffect(() => {
    if (!autoOpenAddNote || !canEditNotes || !hasBlock) return
    setAddNoteOpen(true)
    onAutoOpenAddNoteHandled?.()
  }, [autoOpenAddNote, canEditNotes, hasBlock, onAutoOpenAddNoteHandled])

  return (
    <>
    <article
      id={`notes-day-${dateKey}`}
      className={cn(
        'notes-day-card',
        isPanelLayout && 'notes-day-card--panel-layout notes-day-card--expanded notes-day-card--pad',
        highlighted && 'notes-day-card--highlight',
        expanded && 'notes-day-card--expanded',
        !expanded && 'notes-day-card--collapsed',
        !hasBlock && 'notes-day-card--empty',
        hasBlock && !isPanelLayout && 'notes-day-card--pad',
        isEditing && 'notes-day-card--editing',
      )}
    >
      {/* In panel layout the date bar already shows the selected day — no redundant header */}
      {!isPanelLayout ? (
        <header className="notes-day-card__header">
          <button
            type="button"
            className="notes-day-card__toggle"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={`notes-day-panel-${dateKey}`}
          >
            <ChevronDown className="notes-day-card__chevron" aria-hidden />
            <div className="notes-day-card__title-wrap">
              <h2 className="notes-day-card__title">{title}</h2>
              <span
                className={cn(
                  'notes-day-card__badge',
                  status === 'email_sent' ? 'is-sent' : 'is-pending',
                )}
              >
                {hasBlock ? deliveryStatusLabel(status) : 'No notepad'}
              </span>
            </div>
            {hasBlock ? (
              <div className="notes-day-card__meta">
                <span>{dayStats.totalNotes} Notes</span>
                <span>{dayStats.totalEmployees} Employees</span>
                <span>{dayStats.totalProjects} Projects</span>
              </div>
            ) : null}
          </button>

          {hasBlock && block && canSendEmail && !isEditing ? (
            <div className="notes-day-card__actions">
              <Button
                type="button"
                size="sm"
                variant="primary"
                icon={<Send className="h-3.5 w-3.5" />}
                disabled={busy || emailIncludeCount === 0}
                onClick={() => onSendEmail(block)}
              >
                Send
              </Button>
            </div>
          ) : null}
        </header>
      ) : null}

      {expanded ? (
        <div id={`notes-day-panel-${dateKey}`} className="notes-day-card__panel">
          {!hasBlock && !isEditing ? (
            <p className="notes-notepad-pad__no-block">No notes added for today.</p>
          ) : (
            <div className={cn('notes-notepad-pad', isPanelLayout && 'notes-notepad-pad--with-footer')}>
              {canEditNotes && !isEditing ? (
                <div className="notes-notepad-pad__toolbar">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    disabled={busy}
                    onClick={() => setAddNoteOpen(true)}
                  >
                    Add note
                  </Button>
                  {onCopyLatest ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={<Copy className="h-3.5 w-3.5" />}
                      disabled={busy}
                      onClick={onCopyLatest}
                    >
                      Copy latest
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    disabled={busy || !hasNotes}
                    onClick={() => setIsEditing(true)}
                  >
                    Edit note
                  </Button>
                  {onDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      className="notes-notepad-pad__delete-btn"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      disabled={busy || !hasNotes}
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      Delete note
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {hasBlock && !canEdit && !isEditing ? (
                <p className="notes-notepad-pad__read-only-hint">
                  View only — you are not assigned to manage notes for this date.
                </p>
              ) : null}

              <div className="notes-notepad-pad__paper">
                {isEditing && block && canEditNotes ? (
                  <DailyNotesInlineEditor
                    block={block}
                    projects={projects}
                    employees={employees}
                    onSaved={(updated) => {
                      onBlockChange(updated)
                      setIsEditing(false)
                    }}
                    onCancel={() => setIsEditing(false)}
                    onError={onError}
                  />
                ) : (
                  <div className="notes-notepad-pad__letter">
                    {projectGroups.map((group) => (
                      <section key={group.projectId} className="notes-notepad-pad__project">
                        <p className="notes-notepad-pad__project-name">
                          {group.projectName.toUpperCase()}:
                        </p>
                        {group.entries.map((entry) => {
                          const names = employeeNamesDisplay(entry, projects)
                          const plain = noteHtmlToPlainText(entry.description)
                          const lines = descriptionLines(plain)
                          return (
                            <div key={entry._id} className="notes-notepad-pad__employee">
                              <p className="notes-notepad-pad__employee-names">{names}</p>
                              {lines.length > 0 ? (
                                <div className="notes-notepad-pad__note-body">
                                  {lines.map((line) => (
                                    <p
                                      key={`${entry._id}-${line}`}
                                      className="notes-notepad-pad__note-line"
                                    >
                                      {formatNoteDisplayLine(line)}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="notes-notepad-pad__no-updates">No updates recorded.</p>
                              )}
                            </div>
                          )
                        })}
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Fixed send footer — panel layout only */}
      {isPanelLayout && hasBlock && block && canSendEmail && !isEditing ? (
        <footer className="notes-notepad-send-footer">
          <div className="notes-notepad-send-footer__info">
            {block.lastEmailDelivery ? (
              <>
                <span className="notes-notepad-send-footer__pill">
                  {block.lastEmailDelivery.recipientCount} employee{block.lastEmailDelivery.recipientCount === 1 ? '' : 's'}
                </span>
                <span className="notes-notepad-send-footer__sent-meta">
                  Sent {format(new Date(block.lastEmailDelivery.sentAt), 'dd MMM, HH:mm')}
                  {block.lastEmailDelivery.sentBy?.name
                    ? ` by ${block.lastEmailDelivery.sentBy.name}`
                    : ''}
                </span>
              </>
            ) : emailIncludeCount > 0 ? (
              <span className="notes-notepad-send-footer__pill">
                {emailIncludeCount} note{emailIncludeCount === 1 ? '' : 's'} to send
              </span>
            ) : (
              <span className="notes-notepad-send-footer__pill notes-notepad-send-footer__pill--muted">
                No notes selected
              </span>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={<Send className="h-3.5 w-3.5" />}
            disabled={busy || emailIncludeCount === 0}
            onClick={() => onSendEmail(block)}
          >
            Send
          </Button>
        </footer>
      ) : null}
    </article>

    {block && addNoteOpen && canEditNotes ? (
      <AddNoteModal
        block={block}
        projects={projects}
        employees={employees}
        isOpen={addNoteOpen}
        onClose={() => setAddNoteOpen(false)}
        onSaved={onBlockChange}
        onError={onError}
      />
    ) : null}

    {/* Delete confirmation dialog */}
    {deleteConfirmOpen ? (
      <div
        className="notes-delete-confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-delete-confirm-title"
        onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmOpen(false) }}
      >
        <div className="notes-delete-confirm-modal">
          <h3 id="notes-delete-confirm-title" className="notes-delete-confirm-modal__title">
            Delete all notes?
          </h3>
          <p className="notes-delete-confirm-modal__body">
            This will permanently delete all {hasNotes ? entries.length : ''} note
            {entries.length === 1 ? '' : 's'} for <strong>{title}</strong>. This cannot be undone.
          </p>
          <div className="notes-delete-confirm-modal__actions">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => {
                setDeleteConfirmOpen(false)
                onDelete?.()
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    ) : null}
  </>
  )
}
