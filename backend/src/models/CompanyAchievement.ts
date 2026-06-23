/** Embedded image stored as base64 (same pattern as employee documents) */
export interface AchievementImageBlob {
  data: string
  contentType: string
  filename: string
}

export interface AchievementPageDoc {
  key: 'settings'
  title: string
  updatedAt: Date
}

export interface AchievementItemDoc {
  id: string
  title: string
  description: string
  category: string
  employeeOrTeamName: string
  achievementDate: Date
  tags: string[]
  sortOrder: number
  image?: AchievementImageBlob
  createdAt: Date
  updatedAt: Date
}

export interface ListAchievementsQuery {
  q?: string
  category?: string
  year?: number
  month?: number
  page?: number
  limit?: number
}

export interface ListAchievementsResult {
  items: AchievementItemDoc[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
