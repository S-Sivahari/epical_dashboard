import api from '@services/api'

export interface NewsItem {
  id: string
  title: string
  content: string
  excerpt: string
  imageUrl?: string
  hasImage?: boolean
  link?: string
  publishedAt: string
  updatedAt?: string
}

export interface ExternalNewsItem {
  title: string
  content: string
  imageUrl?: string
  link: string
  publishedAt: string
  source?: string
}

export interface ExternalNewsResponse {
  date: string
  limit?: number
  filters?: string[]
  items: ExternalNewsItem[]
}

export interface FetchExternalNewsParams {
  date?: string
  limit?: number
  filters?: string[]
}

export async function listNews(limit?: number): Promise<NewsItem[]> {
  const params = limit ? { limit: String(limit) } : {}
  const { data } = await api.get<NewsItem[]>('/news', { params })
  return data
}

export async function fetchNewsImageBlob(id: string, revision?: string | null): Promise<Blob | null> {
  try {
    const { data, status } = await api.get<Blob>(`/news/${id}/image`, {
      responseType: 'blob',
      timeout: 10000,
      params: revision ? { v: revision } : undefined,
    })
    if (status !== 200) return null
    return data
  } catch {
    return null
  }
}

export async function resolveNewsImageSrc(
  item: Pick<NewsItem, 'id' | 'imageUrl' | 'hasImage' | 'updatedAt'>
): Promise<string | null> {
  if (item.imageUrl?.trim()) return item.imageUrl.trim()
  if (!item.hasImage) return null
  const blob = await fetchNewsImageBlob(item.id, item.updatedAt)
  return blob ? URL.createObjectURL(blob) : null
}

export async function createNews(payload: {
  title: string
  content: string
  imageUrl?: string
  link?: string
  imageFile?: File | null
}): Promise<NewsItem> {
  const fd = new FormData()
  fd.append('title', payload.title)
  fd.append('content', payload.content)
  if (payload.link?.trim()) fd.append('link', payload.link.trim())
  if (payload.imageUrl?.trim() && !payload.imageFile) fd.append('imageUrl', payload.imageUrl.trim())
  if (payload.imageFile) fd.append('image', payload.imageFile)

  const { data } = await api.post<NewsItem>('/news', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data
}

export async function updateNews(
  id: string,
  payload: {
    title: string
    content: string
    imageUrl?: string
    link?: string
    imageFile?: File | null
    clearImage?: boolean
  }
): Promise<NewsItem> {
  const fd = new FormData()
  fd.append('title', payload.title)
  fd.append('content', payload.content)
  if (payload.link?.trim()) fd.append('link', payload.link.trim())
  if (payload.imageUrl?.trim() && !payload.imageFile) fd.append('imageUrl', payload.imageUrl.trim())
  if (payload.imageFile) fd.append('image', payload.imageFile)
  if (payload.clearImage) fd.append('clearImage', 'true')

  const { data } = await api.put<NewsItem>(`/news/${id}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data
}

export async function deleteNews(id: string): Promise<void> {
  await api.delete(`/news/${id}`)
}

export async function fetchExternalNews(
  params: FetchExternalNewsParams = {}
): Promise<ExternalNewsResponse> {
  const query: Record<string, string> = {}
  if (params.date) query.date = params.date
  if (params.limit != null) query.limit = String(params.limit)
  if (params.filters?.length) query.filters = params.filters.join(',')
  const { data } = await api.get<ExternalNewsResponse>('/news/external', { params: query })
  return data
}

export async function importExternalNews(items: ExternalNewsItem[]): Promise<NewsItem[]> {
  const { data } = await api.post<NewsItem[]>('/news/import', { items })
  return data
}
