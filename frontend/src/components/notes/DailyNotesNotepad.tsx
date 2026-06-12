import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Loader2, Mail, Send } from 'lucide-react'

import { Button } from '@components/ui/Button'

import { EmailDeliveryBadge } from '@components/notes/DailyNotesEmailModal'

import { updateChildBlock } from '@/services/notesService'

import type { DailyNoteBlock, DailyNoteStatus, NoteChildBlock, NoteProjectOption } from '@/types/notes'

import {
  employeeNamesLabel,
  expandEntriesPerEmployee,
  groupEntriesByProject,
} from '@/utils/notesBootstrap'

import { noteHtmlToPlainText, plainTextToNoteHtml } from '@/utils/notesPlainText'

import { formatDailyBlockTitle } from '@/utils/notesWeek'



function deliveryStatusLabel(status: DailyNoteStatus) {

  return status === 'email_sent' ? 'Email sent' : 'Not sent'

}



function statusClass(status: DailyNoteStatus) {

  return `admin-notes-status admin-notes-status--${status}`

}



function employeeLabel(entry: NoteChildBlock, projects: NoteProjectOption[]): string {

  const names = employeeNamesLabel(entry)

  if (names !== '—') return names

  const project = projects.find((item) => item.id === entry.projectId)

  if (project?.visibleUsers?.length === 1) return project.visibleUsers[0]

  return '—'

}



type Props = {

  date: Date

  dateKey: string

  block: DailyNoteBlock | null

  projects: NoteProjectOption[]

  editing: boolean

  highlighted?: boolean

  busy?: boolean

  onBlockChange: (block: DailyNoteBlock) => void

  onSendEmail: (block: DailyNoteBlock) => void

}



export function DailyNotesNotepad({

  date,

  dateKey,

  block,

  projects,

  editing,

  highlighted = false,

  busy = false,

  onBlockChange,

  onSendEmail,

}: Props) {

  const title = useMemo(() => formatDailyBlockTitle(date), [date])

  const entries = useMemo(() => {

    if (!block) return []

    return block.childBlocks

      .filter((child) => !child.archived)

      .sort((a, b) => a.sortOrder - b.sortOrder)

  }, [block])



  const projectGroups = useMemo(() => {
    const visibleEntries = editing ? entries : expandEntriesPerEmployee(entries)
    return groupEntriesByProject(visibleEntries)
  }, [entries, editing])



  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const [savingId, setSavingId] = useState<string | null>(null)

  const saveTimers = useRef<Record<string, number>>({})



  useEffect(() => {

    if (!block || !editing) return

    const next: Record<string, string> = {}

    entries.forEach((entry) => {

      next[entry._id] = noteHtmlToPlainText(entry.description)

    })

    setDrafts(next)

  }, [block?._id, editing, entries])



  const persistDescription = useCallback(

    async (childId: string, text: string) => {

      if (!block) return

      setSavingId(childId)

      try {

        const updated = await updateChildBlock(block._id, childId, {

          description: plainTextToNoteHtml(text),

          includeInEmail: true,

        })

        onBlockChange(updated)

      } finally {

        setSavingId((current) => (current === childId ? null : current))

      }

    },

    [block, onBlockChange],

  )



  const handleDraftChange = (childId: string, text: string) => {

    setDrafts((prev) => ({ ...prev, [childId]: text }))

    window.clearTimeout(saveTimers.current[childId])

    saveTimers.current[childId] = window.setTimeout(() => {

      void persistDescription(childId, text)

    }, 650)

  }



  useEffect(() => {

    const timers = saveTimers.current

    return () => {

      Object.values(timers).forEach((timer) => window.clearTimeout(timer))

    }

  }, [])



  const emailIncludeCount = entries.filter((entry) => entry.includeInEmail).length



  const renderDescription = (entry: NoteChildBlock) => {

    const plain = noteHtmlToPlainText(entry.description)

    if (!plain) {

      return <span className="notes-notepad__placeholder">No description entered.</span>

    }

    return <pre>{plain}</pre>

  }



  if (!block) {

    return (

      <article

        id={`notes-day-${dateKey}`}

        className={`notes-notepad notes-notepad--empty${highlighted ? ' notes-notepad--highlight' : ''}`}

      >

        <header className="notes-notepad__header">

          <h2 className="notes-notepad__title">{title}</h2>

        </header>

        <p className="notes-notepad__empty">No notes recorded for this day.</p>

      </article>

    )

  }



  return (

    <article

      id={`notes-day-${dateKey}`}

      className={`notes-notepad${editing ? ' notes-notepad--editing' : ''}${highlighted ? ' notes-notepad--highlight' : ''}`}

    >

      <header className="notes-notepad__header">

        <div className="notes-notepad__header-main">

          <h2 className="notes-notepad__title">{title}</h2>

          <span className={statusClass(block.status)}>{deliveryStatusLabel(block.status)}</span>

        </div>

        <div className="notes-notepad__header-actions">

          <Button

            type="button"

            size="sm"

            variant="primary"

            icon={<Send className="h-4 w-4" />}

            disabled={busy || block.archived || emailIncludeCount === 0}

            onClick={() => onSendEmail(block)}

          >

            Send daily notes

          </Button>

        </div>

      </header>



      <div className="notes-notepad__body">

        {projectGroups.length === 0 ? (

          <p className="notes-notepad__empty">

            No project entries yet. Add today&apos;s notes to load projects from the timesheet workspace.

          </p>

        ) : (

          projectGroups.map((group) => (

            <section key={group.projectId} className="notes-notepad__project-group">

              <h3 className="notes-notepad__project">{group.projectName}</h3>

              <div className="notes-notepad__employee-list">
              {group.entries.map((entry) => {
                const employeeKey = entry.employees[0]?.id ?? entry.employeeIds[0] ?? entry._id
                return (
                <div key={`${entry._id}-${employeeKey}`} className="notes-notepad__employee-block">

                  <p className="notes-notepad__employees">{employeeLabel(entry, projects)}</p>

                  {editing ? (

                    <div className="notes-notepad__editor-wrap">

                      <textarea

                        className="notes-notepad__textarea"

                        value={drafts[entry._id] ?? ''}

                        placeholder={

                          'Enter work updates (e.g.\n-- Task one completed\n-- Task two in progress)'

                        }

                        rows={5}

                        aria-label={`Work description for ${employeeLabel(entry, projects)} on ${group.projectName}`}

                        onChange={(e) => handleDraftChange(entry._id, e.target.value)}

                      />

                      {savingId === entry._id ? (

                        <span className="notes-notepad__saving">

                          <Loader2 className="h-3.5 w-3.5 animate-spin" />

                          Saving…

                        </span>

                      ) : null}

                    </div>

                  ) : (

                    <div className="notes-notepad__description">{renderDescription(entry)}</div>

                  )}

                </div>
                )
              })}
              </div>

            </section>

          ))

        )}

      </div>



      {block.lastEmailDelivery ? (

        <footer className="notes-notepad__footer">

          <EmailDeliveryBadge delivery={block.lastEmailDelivery} />

        </footer>

      ) : editing ? (

        <footer className="notes-notepad__footer notes-notepad__footer--hint">

          <Mail className="h-4 w-4 shrink-0" />

          <span>

            Each employee has their own box. Descriptions auto-save as you type. Send daily notes when

            ready.

          </span>

        </footer>

      ) : null}

    </article>

  )

}


