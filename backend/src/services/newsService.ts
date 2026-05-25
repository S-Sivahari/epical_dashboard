import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import type { News, NewsImageBlob, NewsListItem } from '../models/News'

function col() {
  return getDB().collection<News>('news')
}

function toListItem(doc: News): NewsListItem {
  const { _id, image, ...rest } = doc
  return {
    ...rest,
    hasImage: !!(image?.data || rest.imageUrl?.trim()),
  }
}

export async function listNews(): Promise<NewsListItem[]> {
  const docs = await col().find({}).sort({ publishedAt: -1 }).toArray()
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
}): Promise<NewsListItem> {
  const now = new Date()
  const news: News = {
    id: randomUUID(),
    title: payload.title.trim(),
    content: payload.content.trim(),
    excerpt: payload.content.trim().slice(0, 220),
    imageUrl: payload.imageUrl?.trim() || undefined,
    image: payload.image,
    link: payload.link?.trim(),
    publishedAt: now.toISOString(),
    createdAt: now,
    updatedAt: now,
  }
  await col().insertOne(news)
  return toListItem(news)
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

  const result = await col().findOneAndUpdate(
    { id },
    {
      $set: {
        title: payload.title.trim(),
        content,
        excerpt: content.slice(0, 220),
        imageUrl: payload.imageUrl?.trim() || undefined,
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
