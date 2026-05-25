import { randomUUID } from 'crypto'
import { getDB } from '../config/db'
import type { Course } from '../models/Course'
import type { CourseEnrollment, CourseStatus } from '../models/CourseEnrollment'

function coursesCol() {
  return getDB().collection<Course>('courses')
}

function enrollmentsCol() {
  return getDB().collection<CourseEnrollment>('course_enrollments')
}

// ── Courses ─────────────────────────────────────────────────────

export async function listCourses(search?: string): Promise<Course[]> {
  const query: any = {}
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { topic: { $regex: search, $options: 'i' } },
      { platform: { $regex: search, $options: 'i' } },
    ]
  }
  return coursesCol().find(query).sort({ createdAt: -1 }).toArray()
}

export async function createCourse(payload: {
  title: string
  topic: string
  platform: string
  link: string
}): Promise<Course> {
  const now = new Date()
  const course: Course = {
    id: randomUUID(),
    title: payload.title.trim(),
    topic: payload.topic.trim(),
    platform: payload.platform.trim(),
    link: payload.link.trim(),
    createdAt: now,
    updatedAt: now,
  }
  await coursesCol().insertOne(course)
  return course
}

export async function deleteCourse(id: string): Promise<boolean> {
  const result = await coursesCol().deleteOne({ id })
  // also remove enrollments for this course
  await enrollmentsCol().deleteMany({ courseId: id })
  return result.deletedCount > 0
}

// ── Enrollments ─────────────────────────────────────────────────

export async function listEnrollments(filters: {
  courseId?: string
  employee?: string
  status?: CourseStatus
}): Promise<CourseEnrollment[]> {
  const query: any = {}
  if (filters.courseId) query.courseId = filters.courseId
  if (filters.employee) {
    query.$or = [
      { employeeId: { $regex: filters.employee, $options: 'i' } },
      { employeeName: { $regex: filters.employee, $options: 'i' } },
    ]
  }
  if (filters.status) query.status = filters.status
  return enrollmentsCol().find(query).sort({ enrolledAt: -1 }).toArray()
}

export async function enrollEmployee(payload: {
  courseId: string
  employeeId: string
  employeeName: string
}): Promise<CourseEnrollment> {
  const course = await coursesCol().findOne({ id: payload.courseId })
  if (!course) throw new Error('Course not found')

  const now = new Date()
  const enrollment: CourseEnrollment = {
    id: randomUUID(),
    courseId: course.id,
    courseTitle: course.title,
    topic: course.topic,
    employeeId: payload.employeeId,
    employeeName: payload.employeeName,
    status: 'Enrolled',
    enrolledAt: now,
    updatedAt: now,
  }

  await enrollmentsCol().insertOne(enrollment)
  return enrollment
}

export async function updateEnrollmentStatus(id: string, status: CourseStatus): Promise<CourseEnrollment | null> {
  const now = new Date()
  const update: any = { status, updatedAt: now }
  if (status === 'Completed') update.completedAt = now

  const result = await enrollmentsCol().findOneAndUpdate({ id }, { $set: update }, { returnDocument: 'after' })
  return result
}

export async function deleteEnrollment(id: string): Promise<boolean> {
  const result = await enrollmentsCol().deleteOne({ id })
  return result.deletedCount > 0
}
