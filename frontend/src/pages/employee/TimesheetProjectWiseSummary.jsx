import { FolderKanban } from 'lucide-react'
import { formatHoursAsDuration } from '@/utils/durationFormat'

export function TimesheetProjectWiseSummary({ totalHours = 0, projectCount = 0 }) {
  return (
    <div className="flex h-full min-h-[5.5rem] flex-col justify-between rounded-xl border border-teal-200/70 bg-gradient-to-br from-teal-50/90 to-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="type-card-label text-teal-900/70">Project Wise Hours</p>
          <p className="type-metric-lg mt-1 text-teal-900">{formatHoursAsDuration(totalHours)}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
          <FolderKanban className="h-5 w-5" />
        </div>
      </div>
      <p className="text-xs font-semibold text-teal-800/60">
        {projectCount} project{projectCount === 1 ? '' : 's'} this week
      </p>
    </div>
  )
}
