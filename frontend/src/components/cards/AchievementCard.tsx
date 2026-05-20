import type { Achievement } from '@/types'
import { formatDate } from '@/utils/formatDate'

export function AchievementCard({ item }: { item: Achievement }) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <div className="aspect-[4/3] bg-surface">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">No image</div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-2 inline-flex rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
          {formatDate(item.createdAt)}
        </div>
        <h3 className="font-display text-base font-semibold text-ink">{item.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-muted">{item.description}</p>
      </div>
    </article>
  )
}
