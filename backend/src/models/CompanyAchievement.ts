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
  sortOrder: number
  image?: AchievementImageBlob
  createdAt: Date
  updatedAt: Date
}
