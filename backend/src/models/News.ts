import { ObjectId } from 'mongodb'

export interface NewsImageBlob {
  data: string
  contentType: string
  filename?: string
}

export interface News {
  _id?: ObjectId
  id: string
  title: string
  content: string
  excerpt: string
  imageUrl?: string
  image?: NewsImageBlob
  link?: string
  publishedAt: string
  createdAt: Date
  updatedAt: Date
}

export type NewsListItem = Omit<News, '_id' | 'image' | 'updatedAt' | 'createdAt'> & {
  hasImage: boolean
  createdAt: string
  updatedAt: string
}
