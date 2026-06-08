import api from '@services/api'

export interface Course {
  id: string
  title: string
  topic: string
  platform: string
  link: string
  createdAt: string
}

export type CourseStatus = 'Enrolled' | 'Completed'

export interface CourseEnrollment {
  id: string
  courseId: string
  courseTitle: string
  topic: string
  employeeId: string
  employeeName: string
  status: CourseStatus
  enrolledAt: string
  completedAt?: string
}

export async function listCourses(search?: string): Promise<Course[]> {
  const { data } = await api.get<Course[]>('/courses', { params: search ? { q: search } : undefined })
  return data
}

export async function createCourse(payload: { title: string; topic: string; platform: string; link: string }): Promise<Course> {
  const { data } = await api.post<Course>('/courses', payload)
  return data
}

export async function updateCourse(
  id: string,
  payload: { title: string; topic: string; platform: string; link: string }
): Promise<Course> {
  const { data } = await api.put<Course>(`/courses/${id}`, payload)
  return data
}

export async function deleteCourse(id: string): Promise<void> {
  await api.delete(`/courses/${id}`)
}

export async function listEnrollments(filters: { courseId?: string; employee?: string; status?: CourseStatus } = {}): Promise<CourseEnrollment[]> {
  const { data } = await api.get<CourseEnrollment[]>('/courses/enrollments', { params: filters })
  return data
}

export async function enrollEmployee(payload: { courseId: string; employeeId: string; employeeName: string }): Promise<CourseEnrollment> {
  const { data } = await api.post<CourseEnrollment>('/courses/enrollments', payload)
  return data
}

export async function markComplete(id: string): Promise<CourseEnrollment> {
  const { data } = await api.patch<CourseEnrollment>(`/courses/enrollments/${id}/complete`)
  return data
}

export async function deleteEnrollment(id: string): Promise<void> {
  await api.delete(`/courses/enrollments/${id}`)
}
