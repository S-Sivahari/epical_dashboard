import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import type { News, NewsImageBlob, NewsListItem } from '../models/News'
import {
  coercePastNewsDateKey,
  publishedAtFromAnyDateKey,
  publishedAtFromDateKey,
  toLocalDateKey,
} from '../utils/newsDateRules'

function col() {
  return getDB().collection<News>('news')
}

function toListItem(doc: News): NewsListItem {
  const { _id, image, updatedAt, createdAt, ...rest } = doc
  return {
    ...rest,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    hasImage: !!(image?.data || rest.imageUrl?.trim()),
  }
}

function resolvePublishedAt(input?: string | Date, fallbackDateKey?: string): string {
  if (!input) {
    const key = coercePastNewsDateKey(undefined, fallbackDateKey)
    return publishedAtFromDateKey(key)
  }
  if (typeof input === 'string') {
    const key = coercePastNewsDateKey(input, fallbackDateKey)
    return publishedAtFromDateKey(key)
  }
  const key = coercePastNewsDateKey(input.toISOString(), fallbackDateKey)
  return publishedAtFromDateKey(key)
}

function resolveManualPublishedAt(input?: string | Date): string {
  if (!input) {
    return publishedAtFromAnyDateKey(toLocalDateKey(new Date()))
  }
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return publishedAtFromAnyDateKey(input.trim())
  }
  const parsed = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(parsed.getTime())) {
    return publishedAtFromAnyDateKey(toLocalDateKey(new Date()))
  }
  return parsed.toISOString()
}

export async function listNews(limit?: number): Promise<NewsListItem[]> {
  const query = col().find({}).sort({ publishedAt: -1 })
  const docs = limit ? await query.limit(limit).toArray() : await query.toArray()
  return docs.map(toListItem)
}

export async function getNewsById(id: string): Promise<News | null> {
  return col().findOne({ id })
}

export async function createNews(payload: {
  title: string
  content: string
  imageUrl?: string
  image?: NewsImageBlob
  link?: string
  publishedAt?: string | Date
}): Promise<NewsListItem> {
  const now = new Date()
  const news: News = {
    id: randomUUID(),
    title: payload.title.trim(),
    content: payload.content.trim(),
    excerpt: payload.content.trim().slice(0, 220),
    imageUrl: payload.image ? undefined : payload.imageUrl?.trim() || undefined,
    image: payload.image,
    link: payload.link?.trim(),
    publishedAt: resolveManualPublishedAt(payload.publishedAt),
    createdAt: now,
    updatedAt: now,
  }
  await col().insertOne(news)
  return toListItem(news)
}

export async function createNewsBatch(
  items: Array<{
    title: string
    content: string
    imageUrl?: string
    image?: NewsImageBlob
    link?: string
    publishedAt?: string | Date
  }>,
  options?: { defaultDateKey?: string }
): Promise<NewsListItem[]> {
  if (items.length === 0) return []
  const now = new Date()
  const defaultDateKey = options?.defaultDateKey
  const docs: News[] = items.map((item) => {
    const title = item.title.trim()
    const content = item.content.trim() || title
    return {
      id: randomUUID(),
      title,
      content,
      excerpt: content.slice(0, 220),
      imageUrl: item.imageUrl?.trim() || undefined,
      image: item.image,
      link: item.link?.trim(),
      publishedAt: resolvePublishedAt(item.publishedAt, defaultDateKey),
      createdAt: now,
      updatedAt: now,
    }
  })
  await col().insertMany(docs)
  return docs.map(toListItem)
}

export async function updateNews(
  id: string,
  payload: {
    title: string
    content: string
    imageUrl?: string
    image?: NewsImageBlob
    clearImage?: boolean
    link?: string
  }
): Promise<NewsListItem | null> {
  const existing = await getNewsById(id)
  if (!existing) return null

  const content = payload.content.trim()
  let image = existing.image
  if (payload.clearImage) {
    image = undefined
  } else if (payload.image) {
    image = payload.image
  }

  const uploadedImage = !!payload.image
  const imageUrl = uploadedImage
    ? undefined
    : payload.clearImage
      ? undefined
      : payload.imageUrl?.trim() || undefined

  const result = await col().findOneAndUpdate(
    { id },
    {
      $set: {
        title: payload.title.trim(),
        content,
        excerpt: content.slice(0, 220),
        imageUrl,
        image,
        link: payload.link?.trim(),
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  )
  return result ? toListItem(result) : null
}

export async function deleteNews(id: string): Promise<boolean> {
  const result = await col().deleteOne({ id })
  return result.deletedCount > 0
}
