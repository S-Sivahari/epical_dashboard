import { Router } from 'express'
import { courseController } from '../controllers/courseController'
import { authMiddleware, requireRole } from '../middleware/authMiddleware'

export const courseRoutes = Router()

courseRoutes.use(authMiddleware)

// Courses
courseRoutes.get('/courses', courseController.listCourses)
courseRoutes.post('/courses', requireRole('Admin'), courseController.createCourse)
courseRoutes.put('/courses/:id', requireRole('Admin'), courseController.updateCourse)
courseRoutes.delete('/courses/:id', requireRole('Admin'), courseController.deleteCourse)

// Enrollments (specific paths before any future /courses/:id variants)
courseRoutes.get('/courses/enrollments', courseController.listEnrollments)
courseRoutes.post('/courses/enrollments', courseController.enrollEmployee)
courseRoutes.patch('/courses/enrollments/:id/complete', courseController.completeEnrollment)
courseRoutes.delete('/courses/enrollments/:id', requireRole('Admin'), courseController.deleteEnrollment)
