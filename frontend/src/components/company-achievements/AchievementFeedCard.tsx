import type { ReactNode } from 'react'
import { Calendar, Hash, Pencil, Trash2, Trophy, User } from 'lucide-react'
import { Button } from '@components/ui/Button'
import type { CompanyAchievementRow } from '@services/companyAchievementsService'
import { formatDate } from '@/utils/formatDate'
import { getCategoryStyle } from '@/utils/achievementConstants'
import { cn } from '@/utils/cn'

export function AchievementFeedCard({
  row,
  imageSlot,
  editable,
  onEdit,
  onDelete,
  className,
}: {
  row: CompanyAchievementRow
  imageSlot: ReactNode
  editable?: boolean
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}) {
  const categoryStyle = getCategoryStyle(row.category)

  return (
    <article
      className={cn(
        'group flex break-inside-avoid flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_8px_30px_rgba(6,192,51,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(6,192,51,0.14)]',
        className
      )}
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-[#f0fdf4]">
        <div className="aspect-[4/5] w-full sm:aspect-[3/4]">{imageSlot}</div>
        <div className="absolute left-3 top-3">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-1 backdrop-blur-sm',
              categoryStyle.bg,
              categoryStyle.text,
              categoryStyle.ring
            )}
          >
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            {row.category}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <h3 className="font-display text-lg font-bold leading-snug text-ink sm:text-xl">
          {row.title}
        </h3>

        <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.95rem]">
          &ldquo;{row.description}&rdquo;
        </p>

        <div className="mt-auto space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
          {row.employeeOrTeamName ? (
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-[#06C033]" aria-hidden />
              <span className="font-medium text-ink">{row.employeeOrTeamName}</span>
            </p>
          ) : null}
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-[#06C033]" aria-hidden />
            <span>{formatDate(row.achievementDate, 'dd-MMM-yyyy')}</span>
          </p>
        </div>

        {row.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {row.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-full bg-[#f0fdf4] px-2.5 py-0.5 text-xs font-medium text-[#047a24]"
              >
                <Hash className="h-3 w-3 opacity-70" aria-hidden />
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {editable ? (
          <div className="flex flex-wrap gap-2 pt-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
