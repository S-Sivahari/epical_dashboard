import type { AchievementPageColors } from '../utils/achievementPageColors'

/** Embedded image stored as base64 (same pattern as employee documents) */
export interface AchievementImageBlob {
  data: string
  contentType: string
  filename: string
}

export interface AchievementPageDoc {
  key: 'settings'
  title: string
  subtitle: string
  sectionTitle: string
  sectionSubtitle: string
  colors: AchievementPageColors
  coverImage?: AchievementImageBlob
  updatedAt: Date
}

export interface AchievementItemDoc {
  id: string
  title: string
  description: string
  sortOrder: number
  image?: AchievementImageBlob
  createdAt: Date
  updatedAt: Date
}
