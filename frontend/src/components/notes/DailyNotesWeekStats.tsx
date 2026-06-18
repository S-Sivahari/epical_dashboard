import { CalendarDays, FileText, MailCheck, NotebookPen } from 'lucide-react'

export type DailyNotesWeekSummary = {
  totalNotes: number
  activeDays: number
  sentDays: number
  pendingDays: number
}

type DailyNotesWeekStatsProps = {
  summary: DailyNotesWeekSummary
}

export function DailyNotesWeekStats({ summary }: DailyNotesWeekStatsProps) {
  return (
    <section className="daily-notes-week-stats" aria-label="Week summary">
      <article className="daily-notes-week-stats__card daily-notes-week-stats__card--forest">
        <span className="daily-notes-week-stats__icon" aria-hidden>
          <FileText className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="daily-notes-week-stats__body">
          <p className="daily-notes-week-stats__value">{summary.totalNotes}</p>
          <p className="daily-notes-week-stats__label">Notes this week</p>
        </div>
      </article>

      <article className="daily-notes-week-stats__card daily-notes-week-stats__card--teal">
        <span className="daily-notes-week-stats__icon" aria-hidden>
          <CalendarDays className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="daily-notes-week-stats__body">
          <p className="daily-notes-week-stats__value">{summary.activeDays}</p>
          <p className="daily-notes-week-stats__label">Active days</p>
        </div>
      </article>

      <article className="daily-notes-week-stats__card daily-notes-week-stats__card--violet">
        <span className="daily-notes-week-stats__icon" aria-hidden>
          <MailCheck className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="daily-notes-week-stats__body">
          <p className="daily-notes-week-stats__value">{summary.sentDays}</p>
          <p className="daily-notes-week-stats__label">Emails sent</p>
        </div>
      </article>

      <article className="daily-notes-week-stats__card daily-notes-week-stats__card--amber">
        <span className="daily-notes-week-stats__icon" aria-hidden>
          <NotebookPen className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="daily-notes-week-stats__body">
          <p className="daily-notes-week-stats__value">{summary.pendingDays}</p>
          <p className="daily-notes-week-stats__label">Pending send</p>
        </div>
      </article>
    </section>
  )
}
