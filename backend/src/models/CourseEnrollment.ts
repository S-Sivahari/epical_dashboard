import { ObjectId } from 'mongodb'

export type CourseStatus = 'Enrolled' | 'Completed'

export interface CourseEnrollment {
  _id?: ObjectId
  id: string
  courseId: string
  courseTitle: string
  topic: string
  employeeId: string
  employeeName: string
  status: CourseStatus
  enrolledAt: Date
  completedAt?: Date
  updatedAt: Date
}
