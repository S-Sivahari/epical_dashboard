import { Router } from 'express'
import { courseController } from '../controllers/courseController'

export const courseRoutes = Router()

// Courses
courseRoutes.get('/courses', courseController.listCourses)
courseRoutes.post('/courses', courseController.createCourse)
courseRoutes.put('/courses/:id', courseController.updateCourse)
courseRoutes.delete('/courses/:id', courseController.deleteCourse)

// Enrollments
courseRoutes.get('/courses/enrollments', courseController.listEnrollments)
courseRoutes.post('/courses/enrollments', courseController.enrollEmployee)
courseRoutes.patch('/courses/enrollments/:id/complete', courseController.completeEnrollment)
courseRoutes.delete('/courses/enrollments/:id', courseController.deleteEnrollment)
