import { env } from '../config/env'

export interface ExternalNewsItem {
  title: string
  content: string
  imageUrl?: string
  link: string
  publishedAt: string
  source?: string
}

type GNewsArticle = {
  title?: string
  description?: string
  content?: string
  image?: string
  url?: string
  publishedAt?: string
  source?: { name?: string }
}

type GNewsResponse = {
  articles?: GNewsArticle[]
}

function buildDateRange(date: string) {
  return {
    from: `${date}T00:00:00Z`,
    to: `${date}T23:59:59Z`,
  }
}

export async function fetchTopHeadlinesByDate(
  date: string,
  limit?: number
): Promise<ExternalNewsItem[]> {
  if (!env.GNEWS_API_KEY) {
    throw new Error('GNews API key is not configured')
  }

  const queryTerms = [
    'Semiconductor',
    'Chip Manufacturing',
    'VLSI',
    'Technology',
    'Artificial Intelligence',
  ]
  const query = queryTerms.map((term) => `"${term}"`).join(' OR ')

  const { from, to } = buildDateRange(date)
  const url = new URL('https://gnews.io/api/v4/top-headlines')
  url.searchParams.set('token', env.GNEWS_API_KEY)
  url.searchParams.set('q', query)
  url.searchParams.set('lang', 'en')
  if (limit) {
    url.searchParams.set('max', String(limit))
  }
  url.searchParams.set('sortBy', 'publishedAt')
  url.searchParams.set('from', from)
  url.searchParams.set('to', to)

  const response = await fetch(url.toString())
  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`GNews request failed (${response.status}) ${message}`.trim())
  }

  const payload = (await response.json()) as GNewsResponse
  const articles = Array.isArray(payload.articles) ? payload.articles : []
  const items = articles.flatMap((article) => {
    const title = (article.title ?? '').trim()
    const link = (article.url ?? '').trim()
    if (!title || !link) return []
    const content = (article.description ?? article.content ?? '').trim() || title
    const imageUrl = article.image?.trim() || ''
    const publishedAt = article.publishedAt ?? new Date().toISOString()
    const source = article.source?.name?.trim() || ''
    const item: ExternalNewsItem = {
      title,
      content,
      link,
      publishedAt,
      ...(imageUrl ? { imageUrl } : {}),
      ...(source ? { source } : {}),
    }
    return [item]
  })

  const deduped = new Map<string, ExternalNewsItem>()
  items.forEach((item) => {
    if (!deduped.has(item.link)) deduped.set(item.link, item)
  })

  return Array.from(deduped.values())
}
