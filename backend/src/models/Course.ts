import { ObjectId } from 'mongodb'

export interface Course {
  _id?: ObjectId
  id: string
  title: string
  topic: string
  platform: string
  link: string
  createdAt: Date
  updatedAt: Date
}
