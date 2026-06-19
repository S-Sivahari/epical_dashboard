import api from '@services/api'

export interface AchievementPageMeta {
  title: string
  updatedAt: string | null
}

export interface CompanyAchievementRow {
  id: string
  title: string
  description: string
  sortOrder: number
  hasImage: boolean
  createdAt: string
  updatedAt: string
}

export async function getAchievementPageMeta(): Promise<AchievementPageMeta> {
  const { data } = await api.get<AchievementPageMeta>('/company-achievements/page')
  return data
}

export async function updateAchievementPage(title: string): Promise<AchievementPageMeta> {
  const { data } = await api.put<AchievementPageMeta>('/company-achievements/page', { title })
  return data
}

export async function listCompanyAchievements(): Promise<CompanyAchievementRow[]> {
  const { data } = await api.get<CompanyAchievementRow[]>('/company-achievements')
  return data
}

export async function fetchAchievementImageBlob(
  id: string,
  revision?: string | null
): Promise<Blob | null> {
  try {
    const { data, status } = await api.get<Blob>(`/company-achievements/${id}/image`, {
      responseType: 'blob',
      params: revision ? { v: revision } : undefined,
    })
    if (status !== 200) return null
    return data
  } catch {
    return null
  }
}

export async function createCompanyAchievement(formData: FormData): Promise<CompanyAchievementRow> {
  const { data } = await api.post<CompanyAchievementRow>('/company-achievements', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data
}

export async function updateCompanyAchievement(
  id: string,
  formData: FormData
): Promise<CompanyAchievementRow> {
  const { data } = await api.put<CompanyAchievementRow>(
    `/company-achievements/${id}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }
  )
  return data
}

export async function deleteCompanyAchievement(id: string): Promise<void> {
  await api.delete(`/company-achievements/${id}`)
}
