import { Trash2, Pencil } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'
import type { NewsItem } from '@services/newsService'
import { Button } from '@components/ui/Button'

export function NewsCard({
  item,
  onRemove,
  onView,
  onEdit,
}: {
  item: NewsItem
  onRemove?: () => void
  onView?: () => void
  onEdit?: () => void
}) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition-ui hover:border-emerald-200 hover:shadow-md">
      <h3 className="font-display text-base font-semibold text-emerald-900 line-clamp-2">
        {item.title}
      </h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink line-clamp-6 whitespace-pre-line">
        {item.content}
      </p>
      {item.link && (
        <a
          className="mt-3 block truncate text-sm text-primary hover:underline"
          href={item.link}
          target="_blank"
          rel="noreferrer"
        >
          {item.link}
        </a>
      )}
      <p className="mt-2 text-xs text-muted">Published {formatDate(item.publishedAt)}</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        {onView && (
          <Button size="sm" variant="warning" onClick={onView}>
            View
          </Button>
        )}
        {onEdit && (
          <Button size="sm" variant="info" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
        {onRemove && (
          <Button size="sm" variant="danger" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>
    </article>
  )
}
