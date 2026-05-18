import { Link } from 'react-router-dom'
import type { NewsItem } from '@/types'
import { formatDate } from '@/utils/formatDate'

export function NewsCard({ item, featured }: { item: NewsItem; featured?: boolean }) {
  return (
    <article
      className={
        featured
          ? 'group col-span-full overflow-hidden rounded-xl border border-border bg-white shadow-sm lg:grid lg:grid-cols-2'
          : 'overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-ui hover:border-primary/40'
      }
    >
      <div className={featured ? 'aspect-[16/9] bg-surface lg:aspect-auto' : 'aspect-video bg-surface'}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">No image</div>
        )}
      </div>
      <div className="flex flex-col justify-center p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {formatDate(item.publishedAt)}
        </p>
        <h3 className="mt-2 font-display text-lg font-semibold text-ink group-hover:text-primary">{item.title}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-muted">{item.excerpt}</p>
        <Link to={`/dashboard/news`} className="mt-4 inline-flex text-sm font-semibold text-primary">
          Read more
        </Link>
      </div>
    </article>
  )
}
