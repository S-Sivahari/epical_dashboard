import { Request, Response } from 'express'
import type { ParsedQs } from 'qs'
import * as newsService from '../services/newsService'
import { fetchTopHeadlinesByDate } from '../services/externalNewsService'
import {
  assertPastNewsDateKey,
  coercePastNewsDateKey,
  normalizeNewsDateInput,
  yesterdayLocalDateKey,
} from '../utils/newsDateRules'

function paramStr(v: any): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return ''
}

function fileToBlob(file?: Express.Multer.File) {
  if (!file?.buffer) return undefined
  return {
    data: file.buffer.toString('base64'),
    contentType: file.mimetype,
    filename: file.originalname || 'image',
  }
}

function normalizeDate(input: string | string[] | ParsedQs | ParsedQs[] | undefined): string | null {
  return normalizeNewsDateInput(paramStr(input))
}

function trimOrEmpty(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export const newsController = {
  list: async (req: Request, res: Response): Promise<void> => {
    try {
      // Limit to recent 20 items for better performance
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20
      const items = await newsService.listNews(limit > 0 && limit <= 100 ? limit : 20)
      
      // Add cache headers for better performance
      res.setHeader('Cache-Control', 'private, max-age=300') // 5 minutes
      res.json(items)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load news'
      res.status(500).json({ error: message })
    }
  },

  getImage: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id)
      const item = await newsService.getNewsById(id)
      if (!item?.image?.data) {
        res.status(404).json({ error: 'No image for this news item' })
        return
      }
      const buffer = Buffer.from(item.image.data, 'base64')
      res.setHeader('Content-Type', item.image.contentType || 'image/jpeg')
      // Increase cache time for images (1 hour)
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.setHeader('ETag', `"${id}-${item.updatedAt?.getTime() || Date.now()}"`)
      res.send(buffer)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load image'
      res.status(500).json({ error: message })
    }
  },

  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const title = trimOrEmpty(req.body.title)
      const content = trimOrEmpty(req.body.content)
      const imageUrl = trimOrEmpty(req.body.imageUrl)
      const link = trimOrEmpty(req.body.link)
      if (!title) {
        res.status(400).json({ error: 'Title is required' })
        return
      }
      const image = fileToBlob(req.file)
      const publishedAt = trimOrEmpty(req.body.publishedAt) || trimOrEmpty(req.body.publishedDate)
      const item = await newsService.createNews({
        title,
        content,
        imageUrl,
        link,
        image,
        publishedAt: publishedAt || undefined,
      })
      res.status(201).json(item)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create news'
      const status = (err as { status?: number }).status
      res.status(status === 400 ? 400 : 500).json({ error: message })
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id)
      const title = trimOrEmpty(req.body.title)
      const content = trimOrEmpty(req.body.content)
      const imageUrl = trimOrEmpty(req.body.imageUrl)
      const link = trimOrEmpty(req.body.link)
      if (!title) {
        res.status(400).json({ error: 'Title is required' })
        return
      }
      const clearImage = req.body.clearImage === 'true' || req.body.clearImage === true
      const image = fileToBlob(req.file)
      const item = await newsService.updateNews(id, {
        title,
        content,
        imageUrl,
        link,
        image,
        clearImage: clearImage && !image,
      })
      if (!item) {
        res.status(404).json({ error: 'News not found' })
        return
      }
      res.json(item)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update news'
      res.status(500).json({ error: message })
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id)
      const ok = await newsService.deleteNews(id)
      if (!ok) {
        res.status(404).json({ error: 'News not found' })
        return
      }
      res.json({ success: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete news'
      res.status(500).json({ error: message })
    }
  },

  fetchExternal: async (req: Request, res: Response): Promise<void> => {
    const rawDate = req.query.date
    const dateParam = typeof rawDate === 'string' ? rawDate.trim() : ''
    const requestedDate = normalizeDate(dateParam)
    if (dateParam && !requestedDate) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' })
      return
    }
    if (requestedDate) {
      try {
        assertPastNewsDateKey(requestedDate)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid date'
        const status = (err as { status?: number }).status ?? 400
        res.status(status).json({ error: message })
        return
      }
    }
    const newsDate = requestedDate || yesterdayLocalDateKey()

    const limitRaw = paramStr(req.query.limit)
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : 10
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(100, Math.max(1, parsedLimit))
      : 10

    const filtersRaw = paramStr(req.query.filters)
    const filters = filtersRaw
      ? filtersRaw
          .split(',')
          .map((term) => term.trim())
          .filter(Boolean)
      : undefined

    try {
      const items = await fetchTopHeadlinesByDate(newsDate, { limit, filters })
      res.json({ date: newsDate, limit, filters: filters ?? [], items })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch external news'
      res.status(500).json({ error: message })
    }
  },

  importExternal: async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = Array.isArray(req.body?.items) ? req.body.items : []
      if (payload.length === 0) {
        res.status(400).json({ error: 'No news items provided' })
        return
      }

      const defaultDate = normalizeDate(req.body.defaultDate) ?? undefined

      const sanitized = payload
        .map((item: any) => {
          const title = trimOrEmpty(item.title)
          const content = trimOrEmpty(item.content) || title
          const link = trimOrEmpty(item.link)
          const imageUrl = trimOrEmpty(item.imageUrl)
          const publishedAt = trimOrEmpty(item.publishedAt)
          if (!title || !link) return null

          const publishedDateKey = coercePastNewsDateKey(publishedAt || undefined, defaultDate)

          return {
            title,
            content,
            link,
            imageUrl: imageUrl || undefined,
            publishedAt: publishedDateKey,
          }
        })
        .filter(Boolean)

      if (sanitized.length === 0) {
        res.status(400).json({ error: 'No valid news items provided' })
        return
      }

      const items = await newsService.createNewsBatch(sanitized, { defaultDateKey: defaultDate })
      res.status(201).json(items)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import news'
      res.status(500).json({ error: message })
    }
  },
}
