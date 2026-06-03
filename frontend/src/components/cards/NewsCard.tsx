import { Trash2, Pencil } from 'lucide-react'
import { formatDate } from '@/utils/formatDate'
import type { NewsItem } from '@services/newsService'
import { Button } from '@components/ui/Button'

export function NewsCard({
  item,
  onRemove,
  onView,
  onEdit,
  variant = 'default',
}: {
  item: NewsItem
  onRemove?: () => void
  onView?: () => void
  onEdit?: () => void
  variant?: 'default' | 'hub'
}) {
  const isHub = variant === 'hub'

  return (
    <article
      className={
        isHub
          ? 'admin-news-feed-card flex h-full flex-col'
          : 'admin-news-card flex h-full flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition-ui hover:border-emerald-200 hover:shadow-md'
      }
    >
      <h3
        className={
          isHub
            ? 'font-display text-base font-bold text-slate-800 line-clamp-2'
            : 'font-display text-base font-semibold text-emerald-900 line-clamp-2'
        }
      >
        {item.title}
      </h3>
      <p
        className={
          isHub
            ? 'mt-3 flex-1 text-sm leading-relaxed text-slate-600 line-clamp-6 whitespace-pre-line'
            : 'mt-3 flex-1 text-sm leading-relaxed text-ink line-clamp-6 whitespace-pre-line'
        }
      >
        {item.content}
      </p>
      {item.link && (
        <a
          className={
            isHub
              ? 'mt-3 block truncate text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline'
              : 'mt-3 block truncate text-sm text-primary hover:underline'
          }
          href={item.link}
          target="_blank"
          rel="noreferrer"
        >
          {item.link}
        </a>
      )}
      <p className={isHub ? 'mt-2 text-xs font-medium text-slate-500' : 'mt-2 text-xs text-muted'}>
        Published {formatDate(item.publishedAt)}
      </p>
      <div
        className={
          isHub
            ? 'admin-news-feed-card-actions mt-4 flex flex-wrap items-center justify-end gap-2.5'
            : 'mt-4 flex items-center justify-end gap-2'
        }
      >
        {onView && (
          <Button
            size="sm"
            variant="warning"
            className={isHub ? 'admin-news-btn-view' : undefined}
            onClick={onView}
          >
            View
          </Button>
        )}
        {onEdit && (
          <Button
            size="sm"
            variant="info"
            className={isHub ? 'admin-news-btn-edit' : undefined}
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
        {onRemove && (
          <Button
            size="sm"
            variant="danger"
            className={isHub ? 'admin-news-btn-remove' : undefined}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>
    </article>
  )
}
