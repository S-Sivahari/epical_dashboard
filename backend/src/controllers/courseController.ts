import { Response } from 'express'
import * as courseService from '../services/courseService'
import { AuthRequest } from '../middleware/authMiddleware'
import { getUserById } from '../services/authService'
import { isAdminRole, isEmployeeRole } from '../utils/generateToken'
import { resolveEmployeeForAuthUser } from '../utils/employeeAuth'

async function resolveEmployeeIdForUser(userId: string, userEmail?: string): Promise<string> {
  const employee = await resolveEmployeeForAuthUser(userId, userEmail)
  return employee?.id ? String(employee.id) : userId
}

async function resolveEmployeeNameForUser(userId: string, userEmail?: string): Promise<string> {
  const employee = await resolveEmployeeForAuthUser(userId, userEmail)
  if (employee) {
    return [employee.firstName, employee.middleName, employee.lastName]
      .filter(Boolean)
      .join(' ')
      .trim()
  }
  const profile = await getUserById(userId)
  return profile?.name?.trim() || 'Employee'
}

export const courseController = {
  listCourses: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const courses = await courseService.listCourses(q)
      res.json(courses)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load courses' })
    }
  },

  createCourse: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, topic, platform, link } = req.body
      if (!title || !topic || !platform || !link) {
        res.status(400).json({ error: 'All fields are required' })
        return
      }
      const course = await courseService.createCourse({ title, topic, platform, link })
      res.status(201).json(course)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create course' })
    }
  },

  updateCourse: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { title, topic, platform, link } = req.body
      if (!title || !topic || !platform || !link) {
        res.status(400).json({ error: 'All fields are required' })
        return
      }
      const course = await courseService.updateCourse(req.params.id as string, { title, topic, platform, link })
      if (!course) {
        res.status(404).json({ error: 'Course not found' })
        return
      }
      res.json(course)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update course' })
    }
  },

  deleteCourse: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const ok = await courseService.deleteCourse(req.params.id as string)
      if (!ok) {
        res.status(404).json({ error: 'Course not found' })
        return
      }
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete course' })
    }
  },

  listEnrollments: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const courseId = req.query.courseId as string | undefined
      let employee = req.query.employee as string | undefined
      const status = req.query.status as any

      if (isEmployeeRole(req.user.role)) {
        employee = await resolveEmployeeIdForUser(req.user.id, req.user.email)
      } else if (!isAdminRole(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
        return
      }

      const enrollments = await courseService.listEnrollments({ courseId, employee, status })
      res.json(enrollments)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load enrollments' })
    }
  },

  enrollEmployee: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const { courseId } = req.body ?? {}
      let { employeeId, employeeName } = req.body ?? {}

      if (!courseId) {
        res.status(400).json({ error: 'courseId is required' })
        return
      }

      if (isEmployeeRole(req.user.role)) {
        employeeId = await resolveEmployeeIdForUser(req.user.id, req.user.email)
        employeeName = await resolveEmployeeNameForUser(req.user.id, req.user.email)
      } else if (isAdminRole(req.user.role)) {
        if (!employeeId || !employeeName) {
          res.status(400).json({ error: 'courseId, employeeId, employeeName are required' })
          return
        }
      } else {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
        return
      }

      const record = await courseService.enrollEmployee({ courseId, employeeId, employeeName })
      res.status(201).json(record)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to enroll employee' })
    }
  },

  completeEnrollment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const rawId = req.params.id
      const id = String(Array.isArray(rawId) ? rawId[0] : rawId ?? '').trim()
      if (!id) {
        res.status(400).json({ error: 'Enrollment id is required' })
        return
      }

      if (isEmployeeRole(req.user.role)) {
        const enrollment = await courseService.getEnrollmentById(id)
        if (!enrollment) {
          res.status(404).json({ error: 'Enrollment not found' })
          return
        }
        const employeeId = await resolveEmployeeIdForUser(req.user.id, req.user.email)
        if (enrollment.employeeId !== employeeId) {
          res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
          return
        }
      } else if (!isAdminRole(req.user.role)) {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' })
        return
      }

      const record = await courseService.updateEnrollmentStatus(id, 'Completed')
      if (!record) {
        res.status(404).json({ error: 'Enrollment not found' })
        return
      }
      res.json(record)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update status' })
    }
  },

  deleteEnrollment: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const ok = await courseService.deleteEnrollment(req.params.id as string)
      if (!ok) {
        res.status(404).json({ error: 'Enrollment not found' })
        return
      }
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete enrollment' })
    }
  },
}
