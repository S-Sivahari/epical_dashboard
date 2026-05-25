import api from '@services/api'

export interface NewsItem {
  id: string
  title: string
  content: string
  excerpt: string
  imageUrl?: string
  link?: string
  publishedAt: string
}

export async function listNews(): Promise<NewsItem[]> {
  const { data } = await api.get<NewsItem[]>('/news')
  return data
}

export async function createNews(payload: {
  title: string
  content: string
  imageUrl?: string
  link?: string
}): Promise<NewsItem> {
  const { data } = await api.post<NewsItem>('/news', payload)
  return data
}

export async function updateNews(
  id: string,
  payload: {
    title: string
    content: string
    imageUrl?: string
    link?: string
  }
): Promise<NewsItem> {
  const { data } = await api.put<NewsItem>(`/news/${id}`, payload)
  return data
}

export async function deleteNews(id: string): Promise<void> {
  await api.delete(`/news/${id}`)
}
