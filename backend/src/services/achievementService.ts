import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import type {
  AchievementImageBlob,
  AchievementItemDoc,
  AchievementPageDoc,
  ListAchievementsQuery,
  ListAchievementsResult,
} from '../models/CompanyAchievement'

const PAGE_KEY = 'settings' as const

let indexesCreated = false

function pageCol() {
  const col = getDB().collection<AchievementPageDoc>('achievement_page')
  if (!indexesCreated) {
    void createIndexes()
    indexesCreated = true
  }
  return col
}

function itemsCol() {
  const col = getDB().collection<AchievementItemDoc>('achievement_items')
  if (!indexesCreated) {
    void createIndexes()
    indexesCreated = true
  }
  return col
}

async function createIndexes(): Promise<void> {
  try {
    const pageCollection = getDB().collection('achievement_page')
    const itemsCollection = getDB().collection('achievement_items')

    await Promise.all([
      pageCollection.createIndex({ key: 1 }, { unique: true }),
      itemsCollection.createIndex({ id: 1 }, { unique: true }),
      itemsCollection.createIndex({ sortOrder: 1 }),
      itemsCollection.createIndex({ createdAt: -1 }),
      itemsCollection.createIndex({ achievementDate: -1 }),
      itemsCollection.createIndex({ category: 1 }),
      itemsCollection.createIndex({ title: 'text' }),
    ])
  } catch (error) {
    console.error('Failed to create achievement indexes:', error)
  }
}

export async function getPage(): Promise<AchievementPageDoc | null> {
  return pageCol().findOne({ key: PAGE_KEY })
}

export async function upsertPage(payload: { title: string }): Promise<AchievementPageDoc> {
  const doc: AchievementPageDoc = {
    key: PAGE_KEY,
    title: payload.title.trim(),
    updatedAt: new Date(),
  }
  await pageCol().updateOne({ key: PAGE_KEY }, { $set: doc }, { upsert: true })
  return doc
}

async function nextSortOrder(): Promise<number> {
  const last = await itemsCol().findOne({}, { sort: { sortOrder: -1 } })
  return (last?.sortOrder ?? -1) + 1
}

function buildListFilter(query: ListAchievementsQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {}
  const q = query.q?.trim()
  if (q) {
    filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  }
  const category = query.category?.trim()
  if (category) {
    filter.category = category
  }
  if (query.year) {
    const year = query.year
    const month = query.month
    let range: { $gte: Date; $lt: Date }
    if (month && month >= 1 && month <= 12) {
      range = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      }
    } else {
      range = {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      }
    }
    filter.$or = [
      { achievementDate: range },
      { achievementDate: { $exists: false }, createdAt: range },
      { achievementDate: null, createdAt: range },
    ]
  }
  return filter
}

export async function listAchievements(
  query: ListAchievementsQuery = {}
): Promise<ListAchievementsResult> {
  const page = Math.max(1, query.page ?? 1)
  const limit = Math.min(50, Math.max(1, query.limit ?? 12))
  const skip = (page - 1) * limit
  const filter = buildListFilter(query)
  const col = itemsCol()

  const [items, total] = await Promise.all([
    col
      .find(filter)
      .sort({ achievementDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    col.countDocuments(filter),
  ])

  return {
    items,
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  }
}

export async function listAchievementCategories(): Promise<string[]> {
  const rows = await itemsCol().distinct('category')
  return rows
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .sort((a, b) => a.localeCompare(b))
}

export async function getAchievement(id: string): Promise<AchievementItemDoc | null> {
  return itemsCol().findOne({ id })
}

export async function createAchievement(payload: {
  title: string
  description: string
  category: string
  employeeOrTeamName: string
  achievementDate: Date
  tags: string[]
  image?: AchievementImageBlob
}): Promise<AchievementItemDoc> {
  const now = new Date()
  const doc: AchievementItemDoc = {
    id: randomUUID(),
    title: payload.title.trim(),
    description: payload.description.trim(),
    category: payload.category.trim(),
    employeeOrTeamName: payload.employeeOrTeamName.trim(),
    achievementDate: payload.achievementDate,
    tags: payload.tags,
    sortOrder: await nextSortOrder(),
    image: payload.image,
    createdAt: now,
    updatedAt: now,
  }
  await itemsCol().insertOne(doc)
  return doc
}

export async function updateAchievement(
  id: string,
  payload: {
    title: string
    description: string
    category: string
    employeeOrTeamName: string
    achievementDate: Date
    tags: string[]
    image?: AchievementImageBlob
    removeImage?: boolean
  }
): Promise<AchievementItemDoc | null> {
  const now = new Date()
  const baseFields = {
    title: payload.title.trim(),
    description: payload.description.trim(),
    category: payload.category.trim(),
    employeeOrTeamName: payload.employeeOrTeamName.trim(),
    achievementDate: payload.achievementDate,
    tags: payload.tags,
    updatedAt: now,
  }

  if (payload.removeImage) {
    const res = await itemsCol().findOneAndUpdate(
      { id },
      {
        $set: baseFields,
        $unset: { image: '' },
      },
      { returnDocument: 'after' }
    )
    return extractAfter(res)
  }

  const $set: Partial<AchievementItemDoc> = { ...baseFields }
  if (payload.image) {
    $set.image = payload.image
  }

  const res = await itemsCol().findOneAndUpdate({ id }, { $set }, { returnDocument: 'after' })
  return extractAfter(res)
}

/** Driver return shape differs by version; normalize to the updated document */
function extractAfter(
  res:
    | AchievementItemDoc
    | null
    | ({ value?: AchievementItemDoc | null } & Record<string, unknown>)
): AchievementItemDoc | null {
  if (!res) return null
  if (typeof res === 'object' && 'value' in res && res.value !== undefined) {
    return (res as { value: AchievementItemDoc | null }).value
  }
  return res as AchievementItemDoc
}

export async function deleteAchievement(id: string): Promise<boolean> {
  const result = await itemsCol().deleteOne({ id })
  return result.deletedCount > 0
}
