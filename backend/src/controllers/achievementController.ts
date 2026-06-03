import { Request, Response } from 'express'
import * as achievementService from '../services/achievementService'
import { parsePageColorsFromBody, resolvePageColors } from '../utils/achievementPageColors'

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

export const achievementController = {
  getPageMeta: async (_req: Request, res: Response): Promise<void> => {
    try {
      const page = await achievementService.getPage()
      const colors = resolvePageColors(page?.colors)
      res.json({
        title: page?.title?.trim() || 'Company Achievements',
        subtitle: page?.subtitle?.trim() || '',
        sectionTitle: page?.sectionTitle?.trim() || 'Our achievements',
        sectionSubtitle: page?.sectionSubtitle?.trim() || '',
        colors,
        hasCoverImage: !!(page?.coverImage?.data && page?.coverImage?.contentType),
        updatedAt: page?.updatedAt?.toISOString() ?? null,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load page settings'
      res.status(500).json({ error: message })
    }
  },

  /** Binary cover for <img> via blob fetch (Authorization header) */
  getCoverImage: async (_req: Request, res: Response): Promise<void> => {
    try {
      const page = await achievementService.getPage()
      const img = page?.coverImage
      if (!img?.data) {
        res.status(404).json({ error: 'No cover image' })
        return
      }
      const buffer = Buffer.from(img.data, 'base64')
      res.setHeader('Content-Type', img.contentType || 'image/jpeg')
      res.setHeader('Cache-Control', 'private, max-age=600')
      res.send(buffer)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load cover'
      res.status(500).json({ error: message })
    }
  },

  updatePage: async (req: Request, res: Response): Promise<void> => {
    try {
      const title = typeof req.body.title === 'string' ? req.body.title : ''
      const subtitle = typeof req.body.subtitle === 'string' ? req.body.subtitle : ''
      const sectionTitle = typeof req.body.sectionTitle === 'string' ? req.body.sectionTitle : ''
      const sectionSubtitle =
        typeof req.body.sectionSubtitle === 'string' ? req.body.sectionSubtitle : ''
      const clearCover = req.body.clearCover === 'true' || req.body.clearCover === true
      const file = req.file
      const coverImage = file ? fileToBlob(file) : undefined

      if (!title.trim()) {
        res.status(400).json({ error: 'Hero title is required' })
        return
      }
      if (!sectionTitle.trim()) {
        res.status(400).json({ error: 'Section title is required' })
        return
      }

      const colors = parsePageColorsFromBody(req.body as Record<string, unknown>)

      const page = await achievementService.upsertPage({
        title,
        subtitle,
        sectionTitle,
        sectionSubtitle,
        colors,
        coverImage,
        clearCover: clearCover && !file,
      })
      res.json({
        title: page.title,
        subtitle: page.subtitle,
        sectionTitle: page.sectionTitle,
        sectionSubtitle: page.sectionSubtitle,
        colors: page.colors,
        hasCoverImage: !!(page.coverImage?.data),
        updatedAt: page.updatedAt.toISOString(),
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update cover'
      res.status(500).json({ error: message })
    }
  },

  list: async (_req: Request, res: Response): Promise<void> => {
    try {
      const rows = await achievementService.listAchievements()
      res.json(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          sortOrder: r.sortOrder,
          hasImage: !!(r.image?.data && r.image?.contentType),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }))
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list achievements'
      res.status(500).json({ error: message })
    }
  },

  getAchievementImage: async (req: Request, res: Response): Promise<void> => {
    try {
      const row = await achievementService.getAchievement(paramStr(req.params.id))
      const img = row?.image
      if (!img?.data) {
        res.status(404).json({ error: 'No image' })
        return
      }
      const buffer = Buffer.from(img.data, 'base64')
      res.setHeader('Content-Type', img.contentType || 'image/jpeg')
      res.setHeader('Cache-Control', 'private, max-age=600')
      res.send(buffer)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load image'
      res.status(500).json({ error: message })
    }
  },

  create: async (req: Request, res: Response): Promise<void> => {
    try {
      const title = typeof req.body.title === 'string' ? req.body.title : ''
      const description = typeof req.body.description === 'string' ? req.body.description : ''
      if (!title.trim() || !description.trim()) {
        res.status(400).json({ error: 'Title and description are required' })
        return
      }
      const image = fileToBlob(req.file)
      const doc = await achievementService.createAchievement({ title, description, image })
      res.status(201).json({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        sortOrder: doc.sortOrder,
        hasImage: !!doc.image?.data,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create achievement'
      res.status(500).json({ error: message })
    }
  },

  update: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = paramStr(req.params.id)
      const title = typeof req.body.title === 'string' ? req.body.title : ''
      const description = typeof req.body.description === 'string' ? req.body.description : ''
      const removeImage = req.body.removeImage === 'true' || req.body.removeImage === true

      if (!title.trim() || !description.trim()) {
        res.status(400).json({ error: 'Title and description are required' })
        return
      }

      const image = req.file ? fileToBlob(req.file) : undefined

      const updated = await achievementService.updateAchievement(id, {
        title,
        description,
        image,
        removeImage: removeImage && !req.file,
      })
      if (!updated) {
        res.status(404).json({ error: 'Achievement not found' })
        return
      }
      res.json({
        id: updated.id,
        title: updated.title,
        description: updated.description,
        sortOrder: updated.sortOrder,
        hasImage: !!(updated.image?.data),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update achievement'
      res.status(500).json({ error: message })
    }
  },

  remove: async (req: Request, res: Response): Promise<void> => {
    try {
      const ok = await achievementService.deleteAchievement(paramStr(req.params.id))
      if (!ok) {
        res.status(404).json({ error: 'Achievement not found' })
        return
      }
      res.json({ success: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete achievement'
      res.status(500).json({ error: message })
    }
  },
}
