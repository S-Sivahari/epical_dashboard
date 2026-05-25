import { Request, Response } from 'express'
import * as newsService from '../services/newsService'

export const newsController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await newsService.listNews()
      res.json(items)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load news' })
    }
  },

  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, content, imageUrl, link } = req.body
      if (!title || !content) {
        res.status(400).json({ error: 'Title and content are required' })
        return
      }
      const item = await newsService.createNews({ title, content, imageUrl, link })
      res.status(201).json(item)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create news' })
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, content, imageUrl, link } = req.body
      if (!title || !content) {
        res.status(400).json({ error: 'Title and content are required' })
        return
      }
      const item = await newsService.updateNews(req.params.id, { title, content, imageUrl, link })
      if (!item) {
        res.status(404).json({ error: 'News not found' })
        return
      }
      res.json(item)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update news' })
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const ok = await newsService.deleteNews(req.params.id)
      if (!ok) {
        res.status(404).json({ error: 'News not found' })
        return
      }
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete news' })
    }
  },
}
