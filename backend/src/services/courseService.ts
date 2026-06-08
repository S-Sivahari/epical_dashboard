import { randomUUID } from 'crypto'
import { ObjectId } from 'mongodb'
import { getDB } from '../config/db'
import type { Course } from '../models/Course'
import type { CourseEnrollment, CourseStatus } from '../models/CourseEnrollment'

function coursesCol() {
  return getDB().collection<Course>('courses')
}

function enrollmentsCol() {
  return getDB().collection<CourseEnrollment>('course_enrollments')
}

/** Driver return shape differs by version; normalize to the updated document */
function extractAfter<T>(res: T | null | ({ value?: T | null } & Record<string, unknown>)): T | null {
  if (!res) return null
  if (typeof res === 'object' && 'value' in res && (res as { value?: T | null }).value !== undefined) {
    return (res as { value: T | null }).value
  }
  return res as T
}

function normalizeEnrollment(doc: CourseEnrollment): CourseEnrollment {
  const id = doc.id || (doc._id ? String(doc._id) : '')
  return { ...doc, id }
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

export async function updateCourse(
  id: string,
  payload: {
    title: string
    topic: string
    platform: string
    link: string
  }
): Promise<Course | null> {
  const title = payload.title.trim()
  const topic = payload.topic.trim()
  const platform = payload.platform.trim()
  const link = payload.link.trim()
  const now = new Date()

  const result = await coursesCol().findOneAndUpdate(
    { id },
    {
      $set: {
        title,
        topic,
        platform,
        link,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  )

  if (result) {
    await enrollmentsCol().updateMany(
      { courseId: id },
      { $set: { courseTitle: title, topic, updatedAt: now } }
    )
  }

  return extractAfter(result)
}

export async function deleteCourse(id: string): Promise<boolean> {
  const result = await coursesCol().deleteOne({ id })
  // also remove enrollments for this course
  await enrollmentsCol().deleteMany({ courseId: id })
  return result.deletedCount > 0
}

// ── Enrollments ─────────────────────────────────────────────────

export async function getEnrollmentById(id: string): Promise<CourseEnrollment | null> {
  const trimmed = id.trim()
  if (!trimmed) return null

  let doc = await enrollmentsCol().findOne({ id: trimmed })
  if (!doc && ObjectId.isValid(trimmed)) {
    doc = await enrollmentsCol().findOne({ _id: new ObjectId(trimmed) })
  }

  return doc ? normalizeEnrollment(doc) : null
}

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
  const rows = await enrollmentsCol().find(query).sort({ enrolledAt: -1 }).toArray()
  return rows.map(normalizeEnrollment)
}

export async function enrollEmployee(payload: {
  courseId: string
  employeeId: string
  employeeName: string
}): Promise<CourseEnrollment> {
  const course = await coursesCol().findOne({ id: payload.courseId })
  if (!course) throw new Error('Course not found')

  const existing = await enrollmentsCol().findOne({
    courseId: payload.courseId,
    employeeId: payload.employeeId,
    status: 'Enrolled',
  })
  if (existing) {
    return normalizeEnrollment(existing)
  }

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
  return normalizeEnrollment(enrollment)
}

export async function updateEnrollmentStatus(id: string, status: CourseStatus): Promise<CourseEnrollment | null> {
  const trimmed = id.trim()
  if (!trimmed) return null

  const now = new Date()
  const update: Record<string, unknown> = { status, updatedAt: now }
  if (status === 'Completed') update.completedAt = now

  let raw = await enrollmentsCol().findOneAndUpdate(
    { id: trimmed },
    { $set: update },
    { returnDocument: 'after' },
  )

  let doc = extractAfter(raw)
  if (!doc && ObjectId.isValid(trimmed)) {
    raw = await enrollmentsCol().findOneAndUpdate(
      { _id: new ObjectId(trimmed) },
      { $set: update },
      { returnDocument: 'after' },
    )
    doc = extractAfter(raw)
  }

  return doc ? normalizeEnrollment(doc) : null
}

export async function deleteEnrollment(id: string): Promise<boolean> {
  const result = await enrollmentsCol().deleteOne({ id })
  return result.deletedCount > 0
}
