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

export const DEFAULT_EXTERNAL_NEWS_FILTERS = [
  'Semiconductor',
  'Chip Manufacturing',
  'VLSI',
  'Hardware',
  'ASIC',
  'FPGA',
] as const

export type HardwareNewsFilter = (typeof DEFAULT_EXTERNAL_NEWS_FILTERS)[number]

function normalizeFilterTerm(term: string): string {
  return term.trim().toLowerCase()
}

export function resolveHardwareNewsFilters(filters?: string[]): string[] {
  const terms = (filters ?? [...DEFAULT_EXTERNAL_NEWS_FILTERS])
    .map((term) => term.trim())
    .filter(Boolean)
  return terms.length > 0 ? terms : [...DEFAULT_EXTERNAL_NEWS_FILTERS]
}

export function matchesHardwareNewsFilters(
  item: Pick<ExternalNewsItem, 'title' | 'content'>,
  filters: string[],
): boolean {
  if (filters.length === 0) return true
  const haystack = `${item.title} ${item.content}`.toLowerCase()
  return filters.some((term) => haystack.includes(normalizeFilterTerm(term)))
}

export type FetchHeadlinesOptions = {
  limit?: number
  filters?: string[]
}

function buildSearchQuery(filters: string[]): string {
  const terms = resolveHardwareNewsFilters(filters)
  return terms.map((term) => `"${term}"`).join(' OR ')
}

function mapGNewsArticles(articles: GNewsArticle[], fallbackDate: string): ExternalNewsItem[] {
  return articles.flatMap((article) => {
    const title = (article.title ?? '').trim()
    const link = (article.url ?? '').trim()
    if (!title || !link) return []
    const content = (article.description ?? article.content ?? '').trim() || title
    const imageUrl = article.image?.trim() || ''
    const publishedAt = article.publishedAt ?? `${fallbackDate}T12:00:00Z`
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
}

async function fetchTopHeadlinesPage(
  date: string,
  query: string,
  page: number,
  max: number
): Promise<ExternalNewsItem[]> {
  const { from, to } = buildDateRange(date)
  const url = new URL('https://gnews.io/api/v4/top-headlines')
  url.searchParams.set('token', env.GNEWS_API_KEY!)
  url.searchParams.set('q', query)
  url.searchParams.set('category', 'technology')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('max', String(max))
  url.searchParams.set('page', String(page))
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
  return mapGNewsArticles(articles, date)
}

export async function fetchTopHeadlinesByDate(
  date: string,
  options?: FetchHeadlinesOptions
): Promise<ExternalNewsItem[]> {
  if (!env.GNEWS_API_KEY) {
    throw new Error('GNews API key is not configured')
  }

  const filters = resolveHardwareNewsFilters(options?.filters)
  const query = buildSearchQuery(filters)

  const rawLimit = options?.limit ?? 10
  const targetLimit = Math.min(100, Math.max(1, Math.floor(Number(rawLimit) || 10)))

  const deduped = new Map<string, ExternalNewsItem>()
  let page = 1

  // GNews free tier returns at most 10 articles per request — paginate for higher counts.
  while (deduped.size < targetLimit && page <= 100) {
    const remaining = targetLimit - deduped.size
    const pageMax = Math.min(remaining, 100)
    const batch = await fetchTopHeadlinesPage(date, query, page, pageMax)
    if (batch.length === 0) break

    let added = 0
    for (const item of batch) {
      if (!matchesHardwareNewsFilters(item, filters)) continue
      if (!deduped.has(item.link)) {
        deduped.set(item.link, item)
        added += 1
        if (deduped.size >= targetLimit) break
      }
    }

    if (added === 0) break
    page += 1
  }

  return Array.from(deduped.values()).slice(0, targetLimit)
}
