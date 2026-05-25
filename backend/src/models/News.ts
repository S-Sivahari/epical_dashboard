import { ObjectId } from 'mongodb'

export interface News {
  _id?: ObjectId
  id: string
  title: string
  content: string
  excerpt: string
  imageUrl?: string
  link?: string
  publishedAt: string
  createdAt: Date
  updatedAt: Date
}
