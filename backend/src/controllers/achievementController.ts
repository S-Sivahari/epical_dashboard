import { Request, Response } from 'express'
import * as achievementService from '../services/achievementService'

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

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        return parseTags(parsed)
      } catch {
        return []
      }
    }
    return trimmed
      .split(/[,;]+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)
  }
  return []
}

function parseAchievementDate(value: unknown, fallback = new Date()): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value.trim())
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  if (fallback && !Number.isNaN(fallback.getTime())) return fallback
  return null
}

function parseListQuery(req: Request) {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined
  const category = typeof req.query.category === 'string' ? req.query.category : undefined
  const yearRaw = typeof req.query.year === 'string' ? Number(req.query.year) : NaN
  const monthRaw = typeof req.query.month === 'string' ? Number(req.query.month) : NaN
  const pageRaw = typeof req.query.page === 'string' ? Number(req.query.page) : NaN
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN

  return {
    q,
    category,
    year: Number.isFinite(yearRaw) ? yearRaw : undefined,
    month: Number.isFinite(monthRaw) ? monthRaw : undefined,
    page: Number.isFinite(pageRaw) ? pageRaw : undefined,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  }
}

function serializeAchievementRow(r: {
  id: string
  title: string
  description: string
  category?: string
  employeeOrTeamName?: string
  achievementDate?: Date
  tags?: string[]
  sortOrder: number
  image?: { data?: string; contentType?: string }
  createdAt: Date
  updatedAt: Date
}) {
  const achievementDate = r.achievementDate ?? r.createdAt
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category?.trim() || 'General',
    employeeOrTeamName: r.employeeOrTeamName?.trim() || '',
    achievementDate: achievementDate.toISOString(),
    tags: Array.isArray(r.tags) ? r.tags : [],
    sortOrder: r.sortOrder,
    hasImage: !!(r.image?.data && r.image?.contentType),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export const achievementController = {
  getPageMeta: async (_req: Request, res: Response): Promise<void> => {
    try {
      const page = await achievementService.getPage()
      res.json({
        title: page?.title?.trim() || 'Company Achievements',
        updatedAt: page?.updatedAt?.toISOString() ?? null,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load page settings'
      res.status(500).json({ error: message })
    }
  },

  updatePage: async (req: Request, res: Response): Promise<void> => {
    try {
      const title = typeof req.body.title === 'string' ? req.body.title : ''

      if (!title.trim()) {
        res.status(400).json({ error: 'Page title is required' })
        return
      }

      const page = await achievementService.upsertPage({ title })
      res.json({
        title: page.title,
        updatedAt: page.updatedAt.toISOString(),
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update page'
      res.status(500).json({ error: message })
    }
  },

  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await achievementService.listAchievements(parseListQuery(req))
      res.json({
        items: result.items.map(serializeAchievementRow),
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list achievements'
      res.status(500).json({ error: message })
    }
  },

  listCategories: async (_req: Request, res: Response): Promise<void> => {
    try {
      const categories = await achievementService.listAchievementCategories()
      res.json(categories)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list categories'
      res.status(500).json({ error: message })
    }
  },

  getAchievementImage: async (req: Request, res: Response): Promise<void> => {
    try {
      const achievementId = paramStr(req.params.id)
      const row = await achievementService.getAchievement(achievementId)
      const img = row?.image
      if (!img?.data) {
        res.status(404).json({ error: 'No image' })
        return
      }
      const buffer = Buffer.from(img.data, 'base64')
      res.setHeader('Content-Type', img.contentType || 'image/jpeg')
      res.setHeader('Cache-Control', 'private, no-cache')
      if (row?.updatedAt) {
        res.setHeader('ETag', `"${achievementId}-${row.updatedAt.getTime()}"`)
      }
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
      const category = typeof req.body.category === 'string' ? req.body.category : ''
      const employeeOrTeamName =
        typeof req.body.employeeOrTeamName === 'string' ? req.body.employeeOrTeamName : ''
      const achievementDate = parseAchievementDate(req.body.achievementDate)
      const tags = parseTags(req.body.tags)

      if (!title.trim() || !description.trim()) {
        res.status(400).json({ error: 'Title and description are required' })
        return
      }
      if (!category.trim()) {
        res.status(400).json({ error: 'Category is required' })
        return
      }
      if (!employeeOrTeamName.trim()) {
        res.status(400).json({ error: 'Employee or team name is required' })
        return
      }
      if (!achievementDate) {
        res.status(400).json({ error: 'Achievement date is required' })
        return
      }

      const image = fileToBlob(req.file)
      const doc = await achievementService.createAchievement({
        title,
        description,
        category,
        employeeOrTeamName,
        achievementDate,
        tags,
        image,
      })
      res.status(201).json(serializeAchievementRow(doc))
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
      const category = typeof req.body.category === 'string' ? req.body.category : ''
      const employeeOrTeamName =
        typeof req.body.employeeOrTeamName === 'string' ? req.body.employeeOrTeamName : ''
      const achievementDate = parseAchievementDate(req.body.achievementDate)
      const tags = parseTags(req.body.tags)
      const removeImage = req.body.removeImage === 'true' || req.body.removeImage === true

      if (!title.trim() || !description.trim()) {
        res.status(400).json({ error: 'Title and description are required' })
        return
      }
      if (!category.trim()) {
        res.status(400).json({ error: 'Category is required' })
        return
      }
      if (!employeeOrTeamName.trim()) {
        res.status(400).json({ error: 'Employee or team name is required' })
        return
      }
      if (!achievementDate) {
        res.status(400).json({ error: 'Achievement date is required' })
        return
      }

      const image = req.file ? fileToBlob(req.file) : undefined

      const updated = await achievementService.updateAchievement(id, {
        title,
        description,
        category,
        employeeOrTeamName,
        achievementDate,
        tags,
        image,
        removeImage: removeImage && !req.file,
      })
      if (!updated) {
        res.status(404).json({ error: 'Achievement not found' })
        return
      }
      res.json(serializeAchievementRow(updated))
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
