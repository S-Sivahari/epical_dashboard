import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import type { News } from '../models/News'

function col() {
  return getDB().collection<News>('news')
}

export async function listNews(): Promise<News[]> {
  return col().find({}).sort({ publishedAt: -1 }).toArray()
}

export async function createNews(payload: {
  title: string
  content: string
  imageUrl?: string
  link?: string
}): Promise<News> {
  const now = new Date()
  const news: News = {
    id: randomUUID(),
    title: payload.title.trim(),
    content: payload.content.trim(),
    excerpt: payload.content.trim().slice(0, 220),
    imageUrl: payload.imageUrl?.trim(),
    link: payload.link?.trim(),
    publishedAt: now.toISOString(),
    createdAt: now,
    updatedAt: now,
  }
  await col().insertOne(news)
  return news
}

export async function updateNews(
  id: string,
  payload: {
    title: string
    content: string
    imageUrl?: string
    link?: string
  }
): Promise<News | null> {
  const content = payload.content.trim()
  const result = await col().findOneAndUpdate(
    { id },
    {
      $set: {
        title: payload.title.trim(),
        content,
        excerpt: content.slice(0, 220),
        imageUrl: payload.imageUrl?.trim(),
        link: payload.link?.trim(),
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  )
  return result
}

export async function deleteNews(id: string): Promise<boolean> {
  const result = await col().deleteOne({ id })
  return result.deletedCount > 0
}
