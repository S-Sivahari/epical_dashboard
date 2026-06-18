import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import type { AchievementImageBlob, AchievementItemDoc, AchievementPageDoc } from '../models/CompanyAchievement'

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

export async function listAchievements(): Promise<AchievementItemDoc[]> {
  return itemsCol().find({}).sort({ sortOrder: 1, createdAt: -1 }).toArray()
}

export async function getAchievement(id: string): Promise<AchievementItemDoc | null> {
  return itemsCol().findOne({ id })
}

export async function createAchievement(payload: {
  title: string
  description: string
  image?: AchievementImageBlob
}): Promise<AchievementItemDoc> {
  const now = new Date()
  const doc: AchievementItemDoc = {
    id: randomUUID(),
    title: payload.title.trim(),
    description: payload.description.trim(),
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
    image?: AchievementImageBlob
    removeImage?: boolean
  }
): Promise<AchievementItemDoc | null> {
  const now = new Date()
  if (payload.removeImage) {
    const res = await itemsCol().findOneAndUpdate(
      { id },
      {
        $set: {
          title: payload.title.trim(),
          description: payload.description.trim(),
          updatedAt: now,
        },
        $unset: { image: '' },
      },
      { returnDocument: 'after' }
    )
    const doc = extractAfter(res)
    return doc
  }

  const $set: Partial<AchievementItemDoc> = {
    title: payload.title.trim(),
    description: payload.description.trim(),
    updatedAt: now,
  }
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
