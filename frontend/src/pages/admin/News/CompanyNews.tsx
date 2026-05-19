import { useState } from 'react'
import { PageHeader } from '@components/layout/PageHeader'
import { PageWrapper } from '@components/layout/PageWrapper'
import { Breadcrumb } from '@components/layout/Breadcrumb'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { NewsCard } from '@components/cards/NewsCard'
import { toast } from 'sonner'
import type { NewsItem } from '@/types'

const seed: NewsItem[] = [
  {
    id: 'N-1',
    title: 'Quarterly town hall highlights',
    excerpt: 'Key decisions, roadmap, and people programs for the next quarter.',
    content: 'Full content…',
    publishedAt: '2026-05-02',
    featured: true,
  },
  {
    id: 'N-2',
    title: 'New learning budget',
    excerpt: 'Expanded course catalog and reimbursement guidelines.',
    content: '…',
    publishedAt: '2026-04-18',
  },
  {
    id: 'N-3',
    title: 'Wellness Fridays',
    excerpt: 'Light meeting load and focus blocks for deep work.',
    content: '…',
    publishedAt: '2026-04-05',
  },
]

export function CompanyNews() {
  const [items, setItems] = useState(seed)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const featured = items.find((n) => n.featured) ?? items[0]
  const rest = items.filter((n) => n.id !== featured?.id)

  return (
    <PageWrapper>
      <PageHeader title="Company news" breadcrumb={<Breadcrumb items={[{ label: 'News' }]} />} />
      <section className="mb-8 rounded-xl border border-border bg-surface/60 p-4">
        <p className="mb-3 font-medium text-ink">Publish news</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Image URL" placeholder="https://…" />
        </div>
        <label className="mt-3 block text-sm font-medium text-ink">
          Content
          <textarea
            className="mt-1 min-h-[120px] w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <Button
          className="mt-3"
          onClick={() => {
            setItems((prev) => [
              {
                id: `N-${prev.length + 1}`,
                title: title || 'Untitled',
                excerpt: body.slice(0, 120),
                content: body,
                publishedAt: new Date().toISOString().slice(0, 10),
              },
              ...prev,
            ])
            toast.success('Published')
            setTitle('')
            setBody('')
          }}
        >
          Publish
        </Button>
      </section>

      {featured ? (
        <div className="mb-6 grid gap-4">
          <NewsCard item={featured} featured />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {rest.map((n) => (
          <NewsCard key={n.id} item={n} />
        ))}
      </div>
    </PageWrapper>
  )
}
