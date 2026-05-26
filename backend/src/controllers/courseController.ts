import { Request, Response } from 'express'
import * as courseService from '../services/courseService'

export const courseController = {
  listCourses: async (req: Request, res: Response): Promise<void> => {
    try {
      const q = (req.query.q as string) || ''
      const courses = await courseService.listCourses(q)
      res.json(courses)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load courses' })
    }
  },

  createCourse: async (req: Request, res: Response): Promise<void> => {
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

  updateCourse: async (req: Request, res: Response): Promise<void> => {
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

  deleteCourse: async (req: Request, res: Response): Promise<void> => {
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

  listEnrollments: async (req: Request, res: Response): Promise<void> => {
    try {
      const courseId = req.query.courseId as string | undefined
      const employee = req.query.employee as string | undefined
      const status = req.query.status as any
      const enrollments = await courseService.listEnrollments({ courseId, employee, status })
      res.json(enrollments)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to load enrollments' })
    }
  },

  enrollEmployee: async (req: Request, res: Response): Promise<void> => {
    try {
      const { courseId, employeeId, employeeName } = req.body
      if (!courseId || !employeeId || !employeeName) {
        res.status(400).json({ error: 'courseId, employeeId, employeeName are required' })
        return
      }
      const record = await courseService.enrollEmployee({ courseId, employeeId, employeeName })
      res.status(201).json(record)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to enroll employee' })
    }
  },

  completeEnrollment: async (req: Request, res: Response): Promise<void> => {
    try {
      const rawId = req.params.id
      const id = String(Array.isArray(rawId) ? rawId[0] : rawId ?? '').trim()
      if (!id) {
        res.status(400).json({ error: 'Enrollment id is required' })
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

  deleteEnrollment: async (req: Request, res: Response): Promise<void> => {
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
