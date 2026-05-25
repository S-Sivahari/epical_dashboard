import { Request, Response } from 'express'
import * as newsService from '../services/newsService'

function paramStr(v: string | string[] | undefined): string {
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

export const newsController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await newsService.listNews()
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
      res.setHeader('Cache-Control', 'private, max-age=600')
      res.send(buffer)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load image'
      res.status(500).json({ error: message })
    }
  },

  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, content, imageUrl, link } = req.body
      if (!title || !content) {
        res.status(400).json({ error: 'Title and content are required' })
        return
      }
      const image = fileToBlob(req.file)
      const item = await newsService.createNews({ title, content, imageUrl, link, image })
      res.status(201).json(item)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create news'
      res.status(500).json({ error: message })
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id)
      const { title, content, imageUrl, link } = req.body
      if (!title || !content) {
        res.status(400).json({ error: 'Title and content are required' })
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
}
