import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, NotebookPen, Pencil, Plus, Send } from 'lucide-react'
import { Button } from '@components/ui/Button'
import { AddNoteModal } from '@components/notes/AddNoteModal'
import { DailyNotesInlineEditor } from '@components/notes/DailyNotesInlineEditor'
import { EmailDeliveryBadge } from '@components/notes/DailyNotesEmailModal'
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
  defaultExpanded?: boolean
  onBlockChange: (block: DailyNoteBlock) => void
  onSendEmail: (block: DailyNoteBlock) => void
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
  defaultExpanded = false,
  onBlockChange,
  onSendEmail,
  onError,
}: Props) {
  const title = useMemo(() => formatDailyBlockTitle(date), [date])
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

  const [expanded, setExpanded] = useState(defaultExpanded || highlighted)
  const [isEditing, setIsEditing] = useState(false)
  const [addNoteOpen, setAddNoteOpen] = useState(false)

  useEffect(() => {
    if (highlighted) setExpanded(true)
  }, [highlighted])

  const hasBlock = Boolean(block)
  const status = block?.status ?? 'draft'
  const isPastDay = isPastNotesDay(dateKey)
  const isEmailSent = status === 'email_sent'
  const canEditNotes = hasBlock && block && !block.archived && !isPastDay && !isEmailSent
  const canSendEmail =
    hasBlock && block && !block.archived && !isPastDay && !isEmailSent
  const emailIncludeCount = entries.filter((entry) => entry.includeInEmail).length
  const hasContent = projectGroups.length > 0

  useEffect(() => {
    if (isEmailSent) {
      setIsEditing(false)
      setAddNoteOpen(false)
    }
  }, [isEmailSent])

  return (
    <>
    <article
      id={`notes-day-${dateKey}`}
      className={cn(
        'notes-day-card',
        highlighted && 'notes-day-card--highlight',
        expanded && 'notes-day-card--expanded',
        !expanded && 'notes-day-card--collapsed',
        !hasBlock && 'notes-day-card--empty',
        hasBlock && 'notes-day-card--pad',
        isEditing && 'notes-day-card--editing',
      )}
    >
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
              <span>{dayStats.totalNotes} notes</span>
              <span>{dayStats.totalEmployees} employees</span>
              <span>{dayStats.totalProjects} projects</span>
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

      {expanded ? (
        <div id={`notes-day-panel-${dateKey}`} className="notes-day-card__panel">
          {!hasBlock ? (
            <p className="notes-notepad-pad__no-block">No notepad for this day yet.</p>
          ) : (
            <div className="notes-notepad-pad">
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
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    disabled={busy}
                    onClick={() => setIsEditing(true)}
                  >
                    Edit note
                  </Button>
                </div>
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
                ) : !hasContent ? (
                  <div className="notes-notepad-pad__empty">
                    <NotebookPen className="notes-notepad-pad__empty-icon" aria-hidden />
                    <p className="notes-notepad-pad__empty-title">Blank notepad</p>
                    <p className="notes-notepad-pad__empty-text">
                      Click <strong>Add note</strong> or <strong>Edit note</strong> to record project
                      updates for {title}.
                    </p>
                  </div>
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

              {block?.lastEmailDelivery && !isEditing ? (
                <footer className="notes-day-card__footer">
                  <EmailDeliveryBadge delivery={block.lastEmailDelivery} />
                </footer>
              ) : null}
            </div>
          )}
        </div>
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
  </>
  )
}
